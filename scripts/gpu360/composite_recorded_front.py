#!/usr/bin/env python3
"""Reproject recorded perspective frames onto an Argus panorama video.

Run this inside the Argus 360VG environment. It imports Argus's own
``pers2equi_batch`` implementation so the camera convention is identical to
the generation pass.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import cv2
import numpy as np
import torch


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--argus-dir", required=True, type=Path)
    parser.add_argument("--generated", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--audio-source", required=True, type=Path)
    parser.add_argument("--camera-metadata", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fps", required=True, help="ffmpeg frame-rate value, e.g. 30000/1001")
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--edge-feather", type=float, default=0.05)
    parser.add_argument("--source-mask-inset", type=float, default=0.0)
    parser.add_argument("--seam-blend", type=float, default=0.01)
    parser.add_argument(
        "--surround-motion", type=float, default=0.0,
        help=(
            "고정 주변부에 입힐 합성 움직임의 세기 (0~1, 0이면 끔). 정면과 이어지는 "
            "좌우 대역에만 휴대폰 불빛 반짝임과 미세한 웅성임을 더한다."
        ),
    )
    parser.add_argument("--surround-motion-yaw-deg", type=float, default=78.0,
                        help="움직임 창의 yaw 반폭. 정면(±30도)보다 넓어야 새 영역이 생긴다.")
    parser.add_argument("--surround-motion-yaw-feather-deg", type=float, default=18.0)
    parser.add_argument("--surround-motion-pitch-deg", type=float, default=21.0,
                        help="움직임 창의 pitch 반높이.")
    parser.add_argument("--surround-motion-pitch-feather-deg", type=float, default=8.0)
    parser.add_argument(
        "--surround-motion-pitch-center-deg", type=float, default=-13.0,
        help=(
            "움직임 창의 pitch 중심. 기본값은 refine_frozen_background.py가 평평하게 "
            "다시 칠하는 하늘(+16도 위)과 바닥(-42도 아래) 사이에 창을 가둔다."
        ),
    )
    parser.add_argument("--surround-twinkle-hz", type=float, default=2.6)
    parser.add_argument("--surround-sway-px", type=float, default=2.5)
    parser.add_argument(
        "--surround-wash", type=float, default=0.8,
        help=(
            "무대 조명이 관중석을 훑는 밝기 변동의 세기. 녹화 정면의 프레임별 휘도를 "
            "그대로 따라간다. 점광원이 거의 없는 왼쪽을 살리는 유일한 성분이다."
        ),
    )
    parser.add_argument("--surround-motion-seed", type=int, default=0)
    parser.add_argument("--freeze-generated-surroundings", action="store_true")
    parser.add_argument(
        "--freeze-frame-seconds",
        type=float,
        default=0.0,
        help="고정할 생성 파노라마 프레임의 시점(초). --freeze-generated-surroundings와 함께 사용합니다.",
    )
    parser.add_argument(
        "--stabilize-generated-color-after",
        type=float,
        help="이 시점(초) 이후 생성 주변부의 색상 통계만 기준 프레임에 맞춥니다.",
    )
    parser.add_argument(
        "--color-stabilization-strength",
        type=float,
        default=1.0,
        help="생성 주변부 색상 안정화 강도 (기본값: 1.0)",
    )
    parser.add_argument(
        "--color-stabilization-transition",
        type=float,
        default=1.0,
        help="색상 안정화 강도를 올리는 전환 시간(초)",
    )
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def require_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"{label} 파일이 없거나 비어 있습니다: {path}")


def feather_alpha(mask: np.ndarray, fraction: float, inset_fraction: float) -> np.ndarray:
    """Build an edge feather while treating the horizontal seam as periodic."""
    binary = (mask > 0.5).astype(np.uint8)
    wrapped = np.concatenate([binary, binary, binary], axis=1)
    distance = cv2.distanceTransform(wrapped, cv2.DIST_L2, 5)
    width = binary.shape[1]
    distance = distance[:, width:2 * width]
    minimum_dimension = min(binary.shape)
    feather_pixels = max(1, round(fraction * minimum_dimension))
    inset_pixels = max(0, round(inset_fraction * minimum_dimension))
    normalized = np.clip((distance - inset_pixels) / feather_pixels, 0, 1)
    # Smoothstep removes the visible slope change at both ends of the blend.
    return (normalized * normalized * (3 - 2 * normalized)).astype(np.float32)


def stabilize_color_statistics(
    frame: np.ndarray,
    reference: np.ndarray,
    strength: float,
) -> np.ndarray:
    """Match Lab statistics without mixing frames, preserving all scene motion."""
    if strength <= 0:
        return frame

    current_lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
    reference_lab = cv2.cvtColor(reference, cv2.COLOR_BGR2LAB).astype(np.float32)
    corrected = current_lab.copy()
    for channel in range(3):
        current_values = current_lab[..., channel]
        reference_values = reference_lab[..., channel]
        current_mean = float(current_values.mean())
        reference_mean = float(reference_values.mean())
        current_std = max(float(current_values.std()), 1.0)
        reference_std = max(float(reference_values.std()), 1.0)
        scale = np.clip(reference_std / current_std, 0.75, 1.25)
        corrected[..., channel] = (
            (current_values - current_mean) * scale + reference_mean
        )
    corrected_bgr = cv2.cvtColor(
        np.clip(corrected, 0, 255).astype(np.uint8),
        cv2.COLOR_LAB2BGR,
    )
    return cv2.addWeighted(corrected_bgr, strength, frame, 1.0 - strength, 0)


def blend_seam(frame: np.ndarray, fraction: float) -> np.ndarray:
    """Close the wrap discontinuity by ramping the edge mismatch to zero.

    Only the first and last columns look at the same direction. Averaging column
    ``i`` with column ``W-1-i`` for the whole band would make those two equal as
    well, even though they point several degrees apart — that forces the band into
    a mirror image of itself, which reads as a hard vertical line with reflected
    content when the viewer looks straight back. Instead take half the edge
    mismatch and fade that same offset out across the band, so the two edges meet
    while everything inside keeps its own content.
    """
    band = min(frame.shape[1] // 4, max(0, round(frame.shape[1] * fraction)))
    if band == 0:
        return frame

    result = frame.astype(np.float32)
    half_mismatch = (result[:, -1] - result[:, 0]) * 0.5
    for offset in range(band):
        strength = 0.5 * (1 + math.cos(math.pi * offset / band))
        result[:, offset] += half_mismatch * strength
        result[:, frame.shape[1] - 1 - offset] -= half_mismatch * strength
    return np.clip(result, 0, 255).astype(np.uint8)


def _smoothstep_out(distance: np.ndarray, half: float, feather: float) -> np.ndarray:
    """1 inside ``half``, easing to 0 over ``feather`` beyond it."""
    ramp = np.clip((distance - half) / max(feather, 1e-6), 0.0, 1.0)
    return (1 - ramp * ramp * (3 - 2 * ramp)).astype(np.float32)


def build_motion_window(
    width: int, height: int, *,
    yaw_center_deg: float, yaw_half_deg: float, yaw_feather_deg: float,
    pitch_center_deg: float, pitch_half_deg: float, pitch_feather_deg: float,
    strength: float,
) -> np.ndarray:
    """A separable window over the equirect sphere, on Argus's own lon/lat grid.

    The grid must match ``pers2equi_batch`` (``linspace(-180, 180)`` across,
    ``linspace(90, -90)`` down) so the window stays concentric with the recorded
    front. Yaw distance wraps; pitch does not.
    """
    longitudes = np.linspace(-180.0, 180.0, width, dtype=np.float32)
    latitudes = np.linspace(90.0, -90.0, height, dtype=np.float32)
    yaw_distance = np.abs((longitudes - yaw_center_deg + 180.0) % 360.0 - 180.0)
    pitch_distance = np.abs(latitudes - pitch_center_deg)
    window = (
        _smoothstep_out(yaw_distance, yaw_half_deg, yaw_feather_deg)[None, :]
        * _smoothstep_out(pitch_distance, pitch_half_deg, pitch_feather_deg)[:, None]
    )
    return (window * strength).astype(np.float32)


class SurroundMotion:
    """Give the frozen surround a little life, without inventing new geometry.

    The still panorama is sharp and correct; what it lacks is any sign that the
    crowd is alive. Two effects supply that, both confined to a window centred on
    the recorded front and much wider in yaw than in pitch, which is what makes
    the growth read as left/right:

    * the hillside is covered in phone flashlights, so find those point sources
      once and let each one breathe on its own phase — a real crowd's lights
      never pulse together;
    * the stage lights wash over the whole venue, so drive the window's overall
      brightness from the recorded front's own luminance. This is the only part
      that reaches the left side, where the still is generated crowd holding
      almost no lights (23 point sources against the hillside's 535) — without it
      that half stays dead no matter how hard the twinkle is pushed;
    * add a very small low-frequency warp for the sway of standing bodies.

    Everything is precomputed against the single still frame, so the motion is
    perfectly repeatable and cannot flicker the way a generated video does.
    """

    def __init__(
        self, base: np.ndarray, window: np.ndarray, *,
        twinkle_hz: float, sway_px: float, seed: int,
        wash: np.ndarray | None = None,
    ) -> None:
        self.window = window[..., None]
        self.sway_px = sway_px
        self.wash = wash
        height, width = base.shape[:2]
        rng = np.random.default_rng(seed)

        luma = (0.114 * base[..., 0] + 0.587 * base[..., 1] + 0.299 * base[..., 2])
        # A point light is a pixel well above its own neighbourhood, not merely a
        # bright one — that separates flashlights from a lit stage or pale sky.
        local = cv2.medianBlur(np.clip(luma, 0, 255).astype(np.uint8), 21).astype(np.float32)
        excess = luma - local
        peaks = (excess > 20) & (luma > 105) & (window > 0.02)
        count, _, stats, centroids = cv2.connectedComponentsWithStats(
            peaks.astype(np.uint8), connectivity=8,
        )
        keep = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] <= 60]
        self.points_x = np.clip(centroids[keep, 0].astype(np.int32), 0, width - 1)
        self.points_y = np.clip(centroids[keep, 1].astype(np.int32), 0, height - 1)
        self.amplitude = np.clip(
            excess[self.points_y, self.points_x] * 0.55, 0, 90,
        ).astype(np.float32)
        self.phase = rng.uniform(0, 2 * np.pi, len(keep)).astype(np.float32)
        self.rate = (twinkle_hz * rng.uniform(0.55, 1.7, len(keep))).astype(np.float32)

        # Three drifting sines with mismatched periods; no repeat is visible over
        # a ten second clip and it costs one array multiply per frame.
        xs = np.arange(width, dtype=np.float32)[None, :]
        ys = np.arange(height, dtype=np.float32)[:, None]
        self._waves = [
            (np.sin(xs / 190.0 + ys / 130.0).astype(np.float32), 0.23, 0.0),
            (np.sin(xs / 95.0 - ys / 210.0 + 1.7).astype(np.float32), 0.37, 1.1),
            (np.sin(xs / 310.0 + ys / 70.0 + 3.1).astype(np.float32), 0.19, 2.4),
        ]
        self._grid_x = np.tile(xs, (height, 1))
        self._grid_y = np.tile(ys, (1, width))

    def frame_count(self) -> int:
        return len(self.amplitude)

    def apply(self, base: np.ndarray, seconds: float, index: int = 0) -> np.ndarray:
        frame = base
        if self.sway_px > 0 and len(self._waves):
            shift = np.zeros_like(self._grid_x)
            for wave, frequency, offset in self._waves:
                shift += wave * np.sin(2 * np.pi * frequency * seconds + offset)
            shift *= self.sway_px / 3.0
            # The window keeps the sway off the flat repainted sky and ground.
            shift = shift * self.window[..., 0]
            frame = cv2.remap(
                base, self._grid_x + shift, self._grid_y + shift * 0.45,
                interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP,
            )

        lit = frame.astype(np.float32)
        if self.wash is not None and index < len(self.wash):
            # 창 안에서만 무대 조명의 밝기 변동을 따라간다.
            lit = lit * (1 + (self.wash[index] - 1) * self.window)

        if len(self.amplitude):
            glow = np.zeros(frame.shape[:2], np.float32)
            np.add.at(
                glow, (self.points_y, self.points_x),
                self.amplitude * np.sin(2 * np.pi * self.rate * seconds + self.phase),
            )
            lit = lit + cv2.GaussianBlur(glow, (0, 0), 1.7)[..., None] * self.window
        return np.clip(lit, 0, 255)


def open_video(path: Path, label: str) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise SystemExit(f"{label} 영상을 열 수 없습니다: {path}")
    return capture


def main() -> int:
    args = parse_args()
    for path, label in (
        (args.generated, "생성"),
        (args.source, "원본"),
        (args.audio_source, "오디오 원본"),
        (args.camera_metadata, "카메라 메타데이터"),
    ):
        require_file(path, label)

    if not args.argus_dir.is_dir():
        raise SystemExit(f"Argus 디렉터리가 없습니다: {args.argus_dir}")
    if args.output.exists() and not args.force:
        raise SystemExit(f"출력이 이미 존재합니다. 덮어쓰려면 --force를 사용하세요: {args.output}")
    if not 0 <= args.edge_feather <= 0.25:
        raise SystemExit("--edge-feather는 0~0.25 범위여야 합니다.")
    if not 0 <= args.source_mask_inset <= 0.1:
        raise SystemExit("--source-mask-inset은 0~0.1 범위여야 합니다.")
    if not 0 <= args.seam_blend <= 0.1:
        raise SystemExit("--seam-blend는 0~0.1 범위여야 합니다.")
    if not 0 <= args.surround_motion <= 1:
        raise SystemExit("--surround-motion은 0~1 범위여야 합니다.")
    if args.surround_motion > 0:
        if not args.freeze_generated_surroundings:
            raise SystemExit(
                "--surround-motion은 고정 주변부에만 쓸 수 있습니다. "
                "--freeze-generated-surroundings와 함께 지정하세요."
            )
        reach = args.surround_motion_yaw_deg + args.surround_motion_yaw_feather_deg
        if reach >= 180:
            raise SystemExit(
                f"움직임 창이 경도 180도 이음새에 닿습니다 (도달 {reach:.1f}도). "
                "--surround-motion-yaw-deg를 줄이세요."
            )
    if (
        args.stabilize_generated_color_after is not None
        and args.stabilize_generated_color_after < 0
    ):
        raise SystemExit("--stabilize-generated-color-after는 0 이상이어야 합니다.")
    if not 0 <= args.color_stabilization_strength <= 1:
        raise SystemExit("--color-stabilization-strength는 0~1 범위여야 합니다.")
    if args.color_stabilization_transition < 0:
        raise SystemExit("--color-stabilization-transition은 0 이상이어야 합니다.")
    if (
        args.freeze_generated_surroundings
        and args.stabilize_generated_color_after is not None
    ):
        raise SystemExit("주변부 고정과 시간축 안정화 옵션은 동시에 사용할 수 없습니다.")
    if args.freeze_frame_seconds < 0:
        raise SystemExit("--freeze-frame-seconds는 0 이상이어야 합니다.")

    try:
        fps = float(Fraction(args.fps))
    except (ValueError, ZeroDivisionError) as exc:
        raise SystemExit(f"올바르지 않은 FPS 값입니다: {args.fps}") from exc
    if fps <= 0:
        raise SystemExit(f"FPS는 0보다 커야 합니다: {args.fps}")

    sys.path.insert(0, str(args.argus_dir.resolve()))
    try:
        from src.pers2equi import pers2equi_batch
    except ImportError as exc:
        raise SystemExit(
            "Argus 모듈을 불러오지 못했습니다. 360VG Conda 환경에서 실행하세요."
        ) from exc

    camera = json.loads(args.camera_metadata.read_text(encoding="utf-8"))
    fov_x = float(camera["fov_x_deg"])
    rolls = np.asarray(camera["roll_rad"], dtype=np.float32)
    pitches = np.asarray(camera["pitch_rad"], dtype=np.float32)
    yaws = np.asarray(camera["yaw_rad"], dtype=np.float32)
    frame_count = len(rolls)
    if frame_count == 0 or len(pitches) != frame_count or len(yaws) != frame_count:
        raise SystemExit("카메라 자세 배열의 길이가 올바르지 않습니다.")

    device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise SystemExit(f"CUDA 장치를 사용할 수 없습니다: {args.device}")

    source = open_video(args.source, "원본")
    generated = open_video(args.generated, "생성")
    generated_width = int(generated.get(cv2.CAP_PROP_FRAME_WIDTH))
    generated_height = int(generated.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if generated_width != generated_height * 2:
        raise SystemExit(
            f"생성 영상이 2:1 파노라마가 아닙니다: "
            f"{generated_width}x{generated_height}"
        )

    frozen_generated_frame = None
    stabilization_reference_frame = None
    if args.freeze_generated_surroundings:
        if args.freeze_frame_seconds > 0:
            generated_fps = generated.get(cv2.CAP_PROP_FPS) or fps
            generated.set(cv2.CAP_PROP_POS_FRAMES, round(args.freeze_frame_seconds * generated_fps))
        frozen_ok, frozen_generated_frame = generated.read()
        if not frozen_ok:
            raise SystemExit("고정할 생성 파노라마 프레임을 읽지 못했습니다.")
        # 고정 주변부는 매 프레임 같은 그림이다. 이음새 정리와 크기 맞춤을 300번
        # 되풀이할 이유가 없고, 합성 움직임도 완성된 이 한 장을 기준으로 잡아야 한다.
        frozen_generated_frame = blend_seam(frozen_generated_frame, args.seam_blend)
        if (generated_width, generated_height) != (args.width, args.height):
            frozen_generated_frame = cv2.resize(
                frozen_generated_frame, (args.width, args.height),
                interpolation=cv2.INTER_LANCZOS4,
            )

    surround_motion = None
    if args.surround_motion > 0:
        window = build_motion_window(
            args.width, args.height,
            yaw_center_deg=float(np.degrees(np.median(yaws))),
            yaw_half_deg=args.surround_motion_yaw_deg,
            yaw_feather_deg=args.surround_motion_yaw_feather_deg,
            pitch_center_deg=args.surround_motion_pitch_center_deg,
            pitch_half_deg=args.surround_motion_pitch_deg,
            pitch_feather_deg=args.surround_motion_pitch_feather_deg,
            strength=args.surround_motion,
        )
        seam_columns = max(1, round(args.width * args.seam_blend))
        if window[:, :seam_columns].any() or window[:, -seam_columns:].any():
            raise SystemExit("움직임 창이 이음새 블렌드 구간과 겹칩니다.")
        wash = None
        if args.surround_wash > 0:
            # 녹화 정면을 그대로 광도계로 쓴다. 한 번 훑고 중앙값으로 정규화해야
            # 밝은 클립이 통째로 밝아지는 일 없이 변동만 옮겨온다.
            probe = open_video(args.source, "원본")
            series = []
            while True:
                ok, probe_frame = probe.read()
                if not ok:
                    break
                series.append(float(
                    (0.114 * probe_frame[..., 0] + 0.587 * probe_frame[..., 1]
                     + 0.299 * probe_frame[..., 2]).mean()
                ))
            probe.release()
            if series:
                relative = np.asarray(series, np.float32)
                relative /= max(float(np.median(relative)), 1e-3)
                wash = np.clip(1 + (relative - 1) * args.surround_wash, 0.75, 1.35)
                print(
                    f"무대 조명 워시: {wash.min():.3f}~{wash.max():.3f} "
                    f"({len(wash)}프레임, 세기 {args.surround_wash})"
                )
        surround_motion = SurroundMotion(
            frozen_generated_frame, window,
            twinkle_hz=args.surround_twinkle_hz,
            sway_px=args.surround_sway_px,
            seed=args.surround_motion_seed,
            wash=wash,
        )
        print(
            f"합성 움직임: 점광원 {surround_motion.frame_count()}개, "
            f"yaw ±{args.surround_motion_yaw_deg:.0f}(+{args.surround_motion_yaw_feather_deg:.0f})도, "
            f"pitch {args.surround_motion_pitch_center_deg:.0f}±{args.surround_motion_pitch_deg:.0f}"
            f"(+{args.surround_motion_pitch_feather_deg:.0f})도"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
        "-f", "rawvideo", "-pixel_format", "bgr24",
        "-video_size", f"{args.width}x{args.height}",
        "-framerate", args.fps, "-i", "pipe:0",
        "-i", str(args.audio_source),
        "-map", "0:v:0", "-map", "1:a:0?",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "medium",
        "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", str(args.output),
    ]
    encoder = subprocess.Popen(ffmpeg, stdin=subprocess.PIPE)
    if encoder.stdin is None:
        raise SystemExit("ffmpeg 입력 파이프를 만들지 못했습니다.")

    processed = 0
    try:
        with torch.inference_mode():
            for index in range(frame_count):
                source_ok, source_frame = source.read()
                if frozen_generated_frame is None:
                    generated_ok, generated_frame = generated.read()
                else:
                    generated_ok, generated_frame = True, frozen_generated_frame
                if not source_ok or not generated_ok:
                    raise RuntimeError(
                        f"{index}번째 프레임에서 영상이 먼저 끝났습니다 "
                        f"(source={source_ok}, generated={generated_ok})."
                    )

                if args.stabilize_generated_color_after is not None:
                    timestamp = index / fps
                    if timestamp <= args.stabilize_generated_color_after:
                        stabilization_reference_frame = generated_frame.copy()
                    elif stabilization_reference_frame is not None:
                        if args.color_stabilization_transition == 0:
                            correction_strength = args.color_stabilization_strength
                        else:
                            progress = min(
                                1.0,
                                (timestamp - args.stabilize_generated_color_after)
                                / args.color_stabilization_transition,
                            )
                            correction_strength = (
                                args.color_stabilization_strength * progress
                            )
                        generated_frame = stabilize_color_statistics(
                            generated_frame,
                            stabilization_reference_frame,
                            correction_strength,
                        )

                if frozen_generated_frame is None:
                    generated_frame = blend_seam(generated_frame, args.seam_blend)
                    if (generated_width, generated_height) != (args.width, args.height):
                        generated_frame = cv2.resize(
                            generated_frame,
                            (args.width, args.height),
                            interpolation=cv2.INTER_LANCZOS4,
                        )
                elif surround_motion is not None:
                    generated_frame = surround_motion.apply(
                        generated_frame, index / fps, index,
                    )
                source_rgb = cv2.cvtColor(source_frame, cv2.COLOR_BGR2RGB)
                source_tensor = (
                    torch.from_numpy(source_rgb)
                    .to(device=device, dtype=torch.float32)
                    .permute(2, 0, 1)
                    .unsqueeze(0)
                    / 127.5 - 1
                )
                projected, mask = pers2equi_batch(
                    source_tensor,
                    fov_x=fov_x,
                    roll=np.asarray([rolls[index]], dtype=np.float32),
                    pitch=np.asarray([pitches[index]], dtype=np.float32),
                    yaw=np.asarray([yaws[index]], dtype=np.float32),
                    height=args.height,
                    width=args.width,
                    device=device,
                    return_mask=True,
                )
                projected_rgb = (
                    ((projected[0].permute(1, 2, 0).clamp(-1, 1) + 1) * 127.5)
                    .byte()
                    .cpu()
                    .numpy()
                )
                projected_bgr = cv2.cvtColor(projected_rgb, cv2.COLOR_RGB2BGR)
                alpha = feather_alpha(
                    mask[0, 0].cpu().numpy(),
                    args.edge_feather,
                    args.source_mask_inset,
                )[..., None]
                composited = (
                    projected_bgr.astype(np.float32) * alpha
                    + generated_frame.astype(np.float32) * (1 - alpha)
                )
                encoder.stdin.write(np.clip(composited, 0, 255).astype(np.uint8).tobytes())
                processed += 1
    except Exception:
        encoder.stdin.close()
        encoder.terminate()
        encoder.wait()
        if args.output.exists():
            args.output.unlink()
        raise
    finally:
        source.release()
        generated.release()

    encoder.stdin.close()
    return_code = encoder.wait()
    if return_code != 0:
        if args.output.exists():
            args.output.unlink()
        raise SystemExit(f"ffmpeg 인코딩이 실패했습니다: exit {return_code}")
    if processed != frame_count:
        raise SystemExit(f"처리 프레임 수가 다릅니다: {processed}/{frame_count}")

    print(f"원본 정면 합성 완료: {args.output} ({processed} frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
