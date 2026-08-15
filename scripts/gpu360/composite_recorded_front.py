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
from pathlib import Path

import cv2
import numpy as np
import torch


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--argus-dir", required=True, type=Path)
    parser.add_argument("--generated", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--camera-metadata", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fps", required=True, help="ffmpeg frame-rate value, e.g. 30000/1001")
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--edge-feather", type=float, default=0.05)
    parser.add_argument("--seam-blend", type=float, default=0.01)
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def require_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"{label} 파일이 없거나 비어 있습니다: {path}")


def feather_alpha(mask: np.ndarray, fraction: float) -> np.ndarray:
    """Build an edge feather while treating the horizontal seam as periodic."""
    binary = (mask > 0.5).astype(np.uint8)
    wrapped = np.concatenate([binary, binary, binary], axis=1)
    distance = cv2.distanceTransform(wrapped, cv2.DIST_L2, 5)
    width = binary.shape[1]
    distance = distance[:, width:2 * width]
    feather_pixels = max(1, round(fraction * min(binary.shape)))
    return np.clip(distance / feather_pixels, 0, 1).astype(np.float32)


def blend_seam(frame: np.ndarray, fraction: float) -> np.ndarray:
    """Soften a narrow periodic strip and make the first/last pixels equal."""
    band = min(frame.shape[1] // 4, max(0, round(frame.shape[1] * fraction)))
    if band == 0:
        return frame

    result = frame.astype(np.float32)
    for offset in range(band):
        left = offset
        right = frame.shape[1] - 1 - offset
        strength = 0.5 * (1 + math.cos(math.pi * offset / band))
        average = (result[:, left] + result[:, right]) * 0.5
        result[:, left] = result[:, left] * (1 - strength) + average * strength
        result[:, right] = result[:, right] * (1 - strength) + average * strength
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
        (args.camera_metadata, "카메라 메타데이터"),
    ):
        require_file(path, label)

    if not args.argus_dir.is_dir():
        raise SystemExit(f"Argus 디렉터리가 없습니다: {args.argus_dir}")
    if args.output.exists() and not args.force:
        raise SystemExit(f"출력이 이미 존재합니다. 덮어쓰려면 --force를 사용하세요: {args.output}")
    if not 0 <= args.edge_feather <= 0.25:
        raise SystemExit("--edge-feather는 0~0.25 범위여야 합니다.")
    if not 0 <= args.seam_blend <= 0.1:
        raise SystemExit("--seam-blend는 0~0.1 범위여야 합니다.")

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
    if (generated_width, generated_height) != (args.width, args.height):
        raise SystemExit(
            f"생성 영상 해상도가 {generated_width}x{generated_height}입니다. "
            f"예상값은 {args.width}x{args.height}입니다."
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
        "-f", "rawvideo", "-pixel_format", "bgr24",
        "-video_size", f"{args.width}x{args.height}",
        "-framerate", args.fps, "-i", "pipe:0",
        "-i", str(args.source),
        "-map", "0:v:0", "-map", "1:a?",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "medium",
        "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-shortest", str(args.output),
    ]
    encoder = subprocess.Popen(ffmpeg, stdin=subprocess.PIPE)
    if encoder.stdin is None:
        raise SystemExit("ffmpeg 입력 파이프를 만들지 못했습니다.")

    processed = 0
    try:
        with torch.inference_mode():
            for index in range(frame_count):
                source_ok, source_frame = source.read()
                generated_ok, generated_frame = generated.read()
                if not source_ok or not generated_ok:
                    raise RuntimeError(
                        f"{index}번째 프레임에서 영상이 먼저 끝났습니다 "
                        f"(source={source_ok}, generated={generated_ok})."
                    )

                generated_frame = blend_seam(generated_frame, args.seam_blend)
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
                alpha = feather_alpha(mask[0, 0].cpu().numpy(), args.edge_feather)[..., None]
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
