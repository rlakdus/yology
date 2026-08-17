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

                generated_frame = blend_seam(generated_frame, args.seam_blend)
                if (generated_width, generated_height) != (args.width, args.height):
                    generated_frame = cv2.resize(
                        generated_frame,
                        (args.width, args.height),
                        interpolation=cv2.INTER_LANCZOS4,
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
