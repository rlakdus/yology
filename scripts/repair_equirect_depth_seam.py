#!/usr/bin/env python3
"""Remove the left/right wrap step from an equirectangular depth map.

estimate_depth.py runs Depth Anything on the whole panorama squashed into one
square input. The model has no idea the left and right edges are the same place,
so the two edges come back at different depths. On a sphere those columns are
adjacent, so the step shows up in VR as a vertical crease that slides against the
rest of the room whenever the head moves - the one artifact a viewer cannot look
away from, because it sits at a fixed place in the room.

The fix is a gradient-domain one: keep every local depth relation and spread the
correction over the full 360deg as a gentle per-row ramp. A ramp of +-step/2
across a whole revolution is far below the threshold where a viewer reads it as
geometry, while the seam itself closes.

Usage:
    python scripts/repair_equirect_depth_seam.py \
        events/student/event_001/panorama/night_study_360.generated.png.depth.png
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

# 이음선 단차를 재는 띠 폭(픽셀). 한 열만 보면 모델 노이즈가 그대로 섞인다.
EDGE_BAND = 4
# 단차를 세로로 다듬는 창 높이(픽셀). 행마다 널뛰는 보정은 가로 줄무늬를 만든다.
SMOOTH_ROWS = 31


def wrap_step(depth: np.ndarray, band: int = EDGE_BAND) -> np.ndarray:
    """Per-row depth difference between the two columns that meet on the sphere."""
    return depth[:, :band].mean(axis=1) - depth[:, -band:].mean(axis=1)


def smooth_rows(values: np.ndarray, window: int = SMOOTH_ROWS) -> np.ndarray:
    if window <= 1:
        return values
    kernel = np.ones(window, dtype=np.float64) / window
    padded = np.pad(values, window // 2, mode="edge")
    return np.convolve(padded, kernel, mode="valid")[: len(values)]


def remove_wrap_step(depth: np.ndarray) -> np.ndarray:
    """Close the wrap seam of a 0~1 depth map with a per-row horizontal ramp."""
    height, width = depth.shape
    # 왼쪽 열은 단차의 절반만큼 내리고 오른쪽 열은 그만큼 올려, 두 열이 가운데서 만난다.
    step = smooth_rows(wrap_step(depth))
    ramp = np.linspace(0.5, -0.5, width, dtype=np.float64)
    return np.clip(depth - step[:, None] * ramp[None, :], 0.0, 1.0)


def report(label: str, depth: np.ndarray) -> None:
    step = np.abs(depth[:, 0] - depth[:, -1]).mean()
    neighbour = np.abs(np.diff(depth, axis=1)).mean()
    print(f"  {label}: 이음선 단차 {step:.4f}, 이웃 열 평균 {neighbour:.4f} "
          f"({step / max(neighbour, 1e-9):.1f}배)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("depth", type=Path, help="깊이 맵 PNG (8bit 그레이스케일)")
    parser.add_argument("--output", type=Path, help="따로 저장할 경로 (기본은 제자리)")
    args = parser.parse_args()

    if not args.depth.is_file():
        parser.error(f"깊이 맵을 찾을 수 없습니다: {args.depth}")

    image = Image.open(args.depth).convert("L")
    height, width = image.size[1], image.size[0]
    if abs(width / height - 2.0) > 0.01:
        parser.error(f"2:1 equirect 깊이 맵이 아닙니다: {width}x{height}")

    depth = np.asarray(image, dtype=np.float64) / 255.0
    print(f"{args.depth} ({width}x{height})")
    report("보정 전", depth)

    repaired = remove_wrap_step(depth)
    report("보정 후", repaired)
    print(f"  최대 이동량 {np.abs(repaired - depth).max() * 255:.1f}/255")

    output = args.output or args.depth
    Image.fromarray((repaired * 255).round().astype(np.uint8), mode="L").save(output)
    print(f"  저장: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
