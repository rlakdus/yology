#!/usr/bin/env python3
"""Normalize and stabilize a perspective source before fixed-view 360 generation."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np


def parse_normalized_rect(value: str) -> tuple[float, float, float, float]:
    try:
        rect = tuple(float(part) for part in value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("좌표는 x0,y0,x1,y1 형식이어야 합니다.") from exc
    if len(rect) != 4:
        raise argparse.ArgumentTypeError("좌표는 x0,y0,x1,y1 네 값이어야 합니다.")
    x0, y0, x1, y1 = rect
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise argparse.ArgumentTypeError("좌표는 0~1 범위이며 x0<x1, y0<y1이어야 합니다.")
    return x0, y0, x1, y1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--anchor-seconds", type=float, default=0)
    parser.add_argument("--minimum-valid-area-ratio", type=float, default=0.7)
    parser.add_argument("--maximum-tracking-failure-ratio", type=float, default=0.1)
    parser.add_argument(
        "--tracking-exclude-rect",
        type=parse_normalized_rect,
        help="특징점 추적에서 제외할 정규화 좌표 x0,y0,x1,y1",
    )
    parser.add_argument(
        "--skip-stabilization",
        action="store_true",
        help="촬영 카메라가 고정된 원본에서 줌·롤 추정을 생략합니다.",
    )
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def open_video(path: Path) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise SystemExit(f"영상을 열 수 없습니다: {path}")
    capture.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    return capture


def read_frames(path: Path) -> tuple[list[np.ndarray], float]:
    capture = open_video(path)
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frames: list[np.ndarray] = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(frame)
    capture.release()
    if not frames or fps <= 0:
        raise SystemExit(f"프레임 또는 FPS를 읽지 못했습니다: {path}")
    height, width = frames[0].shape[:2]
    if any(frame.shape[:2] != (height, width) for frame in frames):
        raise SystemExit("영상 도중 프레임 규격이 바뀌는 원본은 지원하지 않습니다.")
    return frames, fps


def estimate_transforms(
    frames: list[np.ndarray],
    anchor_index: int,
    tracking_exclude_rect: tuple[float, float, float, float] | None,
) -> tuple[list[np.ndarray], int]:
    anchor_gray = cv2.cvtColor(frames[anchor_index], cv2.COLOR_BGR2GRAY)
    tracking_mask = np.full(anchor_gray.shape, 255, dtype=np.uint8)
    if tracking_exclude_rect is not None:
        height, width = anchor_gray.shape
        x0, y0, x1, y1 = tracking_exclude_rect
        tracking_mask[
            round(y0 * height):round(y1 * height),
            round(x0 * width):round(x1 * width),
        ] = 0
    orb = cv2.ORB_create(nfeatures=4000, fastThreshold=8)
    anchor_keypoints, anchor_descriptors = orb.detectAndCompute(anchor_gray, tracking_mask)
    if anchor_descriptors is None or len(anchor_keypoints) < 12:
        raise SystemExit("기준 프레임에서 안정화 특징점을 충분히 찾지 못했습니다.")

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    transforms: list[np.ndarray] = []
    failures = 0
    identity = np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32)

    for index, frame in enumerate(frames):
        if index == anchor_index:
            transforms.append(identity.copy())
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        keypoints, descriptors = orb.detectAndCompute(gray, tracking_mask)
        if descriptors is None or len(keypoints) < 12:
            failures += 1
            transforms.append(identity.copy())
            continue

        pairs = matcher.knnMatch(anchor_descriptors, descriptors, k=2)
        good = [first for first, second in pairs if first.distance < 0.72 * second.distance]
        if len(good) < 10:
            failures += 1
            transforms.append(identity.copy())
            continue

        anchor_points = np.float32(
            [anchor_keypoints[match.queryIdx].pt for match in good]
        )
        frame_points = np.float32([keypoints[match.trainIdx].pt for match in good])
        forward, inliers = cv2.estimateAffinePartial2D(
            anchor_points,
            frame_points,
            method=cv2.RANSAC,
            ransacReprojThreshold=3.0,
            maxIters=3000,
            confidence=0.995,
        )
        if forward is None or inliers is None or int(inliers.sum()) < 8:
            failures += 1
            transforms.append(identity.copy())
            continue
        inverse = cv2.invertAffineTransform(forward).astype(np.float32)
        # Preserve scene translation/panning, but cancel zoom and roll around the frame center.
        height, width = frame.shape[:2]
        center = np.array([width / 2, height / 2], dtype=np.float32)
        linear = inverse[:, :2]
        inverse[:, 2] = center - linear @ center
        transforms.append(inverse)
    return transforms, failures


def valid_crop(
    shape: tuple[int, int],
    transforms: list[np.ndarray],
    minimum_area_ratio: float,
) -> tuple[int, int, int, int, float]:
    height, width = shape
    source_mask = np.full((height, width), 255, dtype=np.uint8)
    valid = source_mask.copy()
    for transform in transforms:
        warped = cv2.warpAffine(
            source_mask,
            transform,
            (width, height),
            flags=cv2.INTER_NEAREST,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=0,
        )
        valid = cv2.bitwise_and(valid, warped)

    scale = 1.0
    while scale >= 0.5:
        crop_width = max(2, int(width * scale) // 2 * 2)
        crop_height = max(2, int(height * scale) // 2 * 2)
        x = (width - crop_width) // 2
        y = (height - crop_height) // 2
        if np.all(valid[y:y + crop_height, x:x + crop_width] > 0):
            area_ratio = (crop_width * crop_height) / (width * height)
            if area_ratio < minimum_area_ratio:
                raise SystemExit(
                    f"공통 유효 영역이 너무 작습니다: {area_ratio:.3f} < {minimum_area_ratio:.3f}"
                )
            return x, y, crop_width, crop_height, area_ratio
        scale -= 0.01
    raise SystemExit("모든 프레임에 공통으로 유효한 고정 crop을 찾지 못했습니다.")


def main() -> int:
    args = parse_args()
    if args.output.exists() and not args.force:
        raise SystemExit(f"출력이 이미 있습니다. 덮어쓰려면 --force를 사용하세요: {args.output}")
    if not 0 < args.minimum_valid_area_ratio <= 1:
        raise SystemExit("minimum-valid-area-ratio는 0~1 범위여야 합니다.")
    if not 0 <= args.maximum_tracking_failure_ratio < 1:
        raise SystemExit("maximum-tracking-failure-ratio는 0~1 범위여야 합니다.")

    frames, fps = read_frames(args.source)
    height, width = frames[0].shape[:2]
    anchor_index = min(
        len(frames) - 1,
        max(0, round(args.anchor_seconds * fps)),
    )
    if args.skip_stabilization:
        identity = np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32)
        transforms = [identity.copy() for _ in frames]
        failures = 0
    else:
        transforms, failures = estimate_transforms(
            frames,
            anchor_index,
            args.tracking_exclude_rect,
        )
    failure_ratio = failures / len(frames)
    if failure_ratio > args.maximum_tracking_failure_ratio:
        raise SystemExit(
            f"안정화 추적 실패율이 너무 높습니다: "
            f"{failure_ratio:.3f} > {args.maximum_tracking_failure_ratio:.3f}"
        )

    x, y, crop_width, crop_height, area_ratio = valid_crop(
        (height, width),
        transforms,
        args.minimum_valid_area_ratio,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output_width = width // 2 * 2
    output_height = height // 2 * 2
    encoder = subprocess.Popen(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
            "-f", "rawvideo", "-pixel_format", "bgr24",
            "-video_size", f"{output_width}x{output_height}",
            "-framerate", str(fps), "-i", "pipe:0",
            "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "10",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(args.output),
        ],
        stdin=subprocess.PIPE,
    )
    if encoder.stdin is None:
        raise SystemExit("정규화 영상의 ffmpeg 입력 파이프를 만들지 못했습니다.")

    scales: list[float] = []
    rotations: list[float] = []
    for frame, transform in zip(frames, transforms):
        stabilized = cv2.warpAffine(
            frame,
            transform,
            (width, height),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
        )
        crop = stabilized[y:y + crop_height, x:x + crop_width]
        normalized = cv2.resize(crop, (output_width, output_height))
        encoder.stdin.write(normalized.tobytes())
        scale = float(np.hypot(transform[0, 0], transform[0, 1]))
        scales.append(scale)
        rotations.append(float(np.degrees(np.arctan2(transform[0, 1], transform[0, 0]))))
    encoder.stdin.close()
    return_code = encoder.wait()
    if return_code != 0:
        if args.output.exists():
            args.output.unlink()
        raise SystemExit(f"정규화 영상 인코딩이 실패했습니다: exit {return_code}")

    report = {
        "source": str(args.source),
        "output": str(args.output),
        "frames": len(frames),
        "fps": fps,
        "source_width": width,
        "source_height": height,
        "display_aspect_ratio": width / height,
        "anchor_frame_seconds": args.anchor_seconds,
        "anchor_frame_index": anchor_index,
        "tracking_failures": failures,
        "tracking_failure_ratio": round(failure_ratio, 6),
        "tracking_exclude_rect": args.tracking_exclude_rect,
        "common_crop": {
            "x": x,
            "y": y,
            "width": crop_width,
            "height": crop_height,
            "valid_area_ratio": round(area_ratio, 6),
        },
        "inverse_scale_range": [round(min(scales), 6), round(max(scales), 6)],
        "inverse_rotation_deg_range": [
            round(min(rotations), 6),
            round(max(rotations), 6),
        ],
        "stabilization_mode": (
            "identity_fixed_camera" if args.skip_stabilization else "affine_zoom_roll"
        ),
        "zoom_removed": not args.skip_stabilization,
        "roll_removed": not args.skip_stabilization,
        "translation_preserved": True,
        "source_orientation_metadata_applied": True,
        "aspect_policy": "preserve",
        "intermediate_codec": "h264_crf10",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"고정 시점 입력 준비 완료: {args.output} "
        f"(crop={area_ratio:.3f}, tracking_failures={failures}/{len(frames)})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
