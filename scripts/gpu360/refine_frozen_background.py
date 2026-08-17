#!/usr/bin/env python3
"""고정 배경 파노라마의 천정/바닥 비실측 영역을 실측 하늘 그라데이션과 어두운 지면으로 정리한다.

generate_panorama_image.py가 --ref-image로 실측 커버리지를 넓혀도, SDXL이 채운 천정 면에는
반투명 얼룩이, 바닥 면에는 무늬 잔상이 시드를 바꿔도 형태만 달리해 남는다. 하늘은 물리적으로
같은 고도각(행)에서 거의 균일하므로, 실측 커버리지 안의 하늘 픽셀에서 행별 중앙값 그라데이션을
만들어 위쪽 임계 고도각 이상의 비실측 픽셀을 그것으로 페더 블렌딩한다. 바닥도 실측 하단 경계
부근의 어두운 픽셀로 수렴시킨다. 참조 프레임 가장자리 모션 블러가 실측으로 보호되어 남는
청록 스미어는 색 조건으로 선별해 함께 하늘로 수렴시킨다.

커버리지 마스크(.npy, HxW bool)는 정면+참조들을 pers2equi로 투영해 OR한 것을 저장해 두고 쓴다.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def interior_ramp(mask: np.ndarray, feather_px: int) -> np.ndarray:
    """실측 영역 안쪽으로 0→1로 차오르는 경사. 좌우 경계는 주기적으로 다룬다.

    교체 알파를 실측 경계에서 딱 끊으면 그 자리에 밝기 단차가 그대로 드러난다
    (고개를 숙였을 때 바닥에 각진 경계로 보인다). 경계 안쪽 얼마간을 함께 어둡게
    깎아 내려 단차를 없앤다.
    """
    binary = mask.astype(np.uint8)
    wrapped = np.concatenate([binary, binary, binary], axis=1)
    distance = cv2.distanceTransform(wrapped, cv2.DIST_L2, 5)
    width = binary.shape[1]
    distance = distance[:, width:2 * width]
    return np.clip(distance / max(1, feather_px), 0, 1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--coverage", required=True, type=Path, help="실측 커버리지 bool .npy")
    parser.add_argument("--sky-pitch-deg", type=float, default=16.0)
    parser.add_argument("--sky-feather-px", type=int, default=150)
    parser.add_argument("--ground-pitch-deg", type=float, default=-42.0)
    parser.add_argument("--ground-feather-px", type=int, default=110)
    parser.add_argument("--boundary-feather-px", type=int, default=70,
                        help="실측 영역 경계에서 교체가 스며드는 폭.")
    parser.add_argument("--teal-blend", type=float, default=0.85,
                        help="청록 스미어를 하늘로 수렴시키는 강도 (0이면 끔).")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    img = cv2.imread(str(args.input)).astype(np.float32)
    if img is None:
        raise SystemExit(f"입력을 읽을 수 없습니다: {args.input}")
    height, width = img.shape[:2]
    real = np.load(args.coverage)
    if real.shape != (height, width):
        raise SystemExit(f"커버리지 크기가 다릅니다: {real.shape} vs {(height, width)}")

    ys = np.arange(height)
    pitch_of_row = 90 - (ys + 0.5) * 180 / height
    real_interior = interior_ramp(real, args.boundary_feather_px)

    # --- 실측 하늘에서 행별 그라데이션 추출 ---
    b, g, r = img[..., 0], img[..., 1], img[..., 2]
    lum = 0.114 * b + 0.587 * g + 0.299 * r
    sat = (img.max(axis=2) - img.min(axis=2)) / (img.max(axis=2) + 1e-6)
    skyish = real & (b >= g - 6) & (sat < 0.45) & (lum > 35) & (lum < 235)

    sky_rows = {
        y: np.median(img[y][skyish[y]], axis=0)
        for y in range(height // 2)
        if skyish[y].sum() >= 150
    }
    if not sky_rows:
        raise SystemExit("실측 하늘 픽셀을 찾지 못했습니다.")
    obs_y = np.array(sorted(sky_rows), dtype=np.float32)
    obs_c = np.stack([sky_rows[y] for y in sorted(sky_rows)]).astype(np.float32)

    grad = np.zeros((height, 3), np.float32)
    for ch in range(3):
        grad[:, ch] = np.interp(np.arange(height), obs_y, obs_c[:, ch])
    # 관측 상단보다 위는 해질녘 천정이 더 어둡도록 상단 관측 구간의 기울기로 외삽한다.
    top = obs_y < obs_y.min() + 60
    if top.sum() >= 8:
        for ch in range(3):
            slope = np.clip(np.polyfit(obs_y[top], obs_c[top, ch], 1)[0], 0.0, 0.5)
            above = np.arange(int(obs_y.min()))
            grad[above, ch] = np.clip(
                grad[int(obs_y.min()), ch] - slope * (obs_y.min() - above), 0, 255,
            )
    grad = cv2.GaussianBlur(grad.reshape(height, 1, 3), (1, 61), 0).reshape(height, 3)
    sky_plane = np.repeat(grad[:, None, :], width, axis=1)

    # --- 천정 교체 (실측은 보존) ---
    sky_zone = (pitch_of_row[:, None] >= args.sky_pitch_deg) & ~real
    ramp = np.clip(
        (pitch_of_row - args.sky_pitch_deg) * height / 180 / args.sky_feather_px * 2, 0, 1,
    )
    alpha = cv2.GaussianBlur(sky_zone.astype(np.float32) * ramp[:, None], (41, 41), 0)
    alpha = (alpha * (1 - real_interior))[..., None]
    img = img * (1 - alpha) + sky_plane * alpha

    # --- 청록 스미어 중화 (실측 여부와 무관, 색 조건으로 선별) ---
    if args.teal_blend > 0:
        b2, g2 = img[..., 0], img[..., 1]
        lum2 = 0.114 * img[..., 0] + 0.587 * img[..., 1] + 0.299 * img[..., 2]
        sat2 = (img.max(axis=2) - img.min(axis=2)) / (img.max(axis=2) + 1e-6)
        tealish = (
            (pitch_of_row[:, None] >= args.sky_pitch_deg)
            & (g2 > b2 + 6) & (lum2 > 85) & (sat2 < 0.55)
        )
        teal_alpha = cv2.GaussianBlur(tealish.astype(np.float32), (31, 31), 0)
        teal_alpha = np.clip(teal_alpha * 1.4, 0, 1)[..., None] * args.teal_blend
        img = img * (1 - teal_alpha) + sky_plane * teal_alpha

    # --- 바닥 교체 ---
    band = (pitch_of_row < args.ground_pitch_deg + 14) & (pitch_of_row > args.ground_pitch_deg - 6)
    samples = [
        np.median(img[y][real[y]], axis=0)
        for y in band.nonzero()[0]
        if real[y].sum() > 50
    ]
    # 완전히 검게 만들면 고개를 숙였을 때 발밑이 빈 공간처럼 읽힌다. 실측 하단보다
    # 어둡되 형태가 어렴풋이 남는 밝기로 맞춘다.
    ground_color = (
        np.median(np.stack(samples), axis=0) * 0.75
        if samples else np.array([24, 22, 20], np.float32)
    )
    ground_zone = (pitch_of_row[:, None] <= args.ground_pitch_deg) & ~real
    ramp_g = np.clip(
        (args.ground_pitch_deg - pitch_of_row) * height / 180 / args.ground_feather_px * 2, 0, 1,
    )
    alpha_g = cv2.GaussianBlur(ground_zone.astype(np.float32) * ramp_g[:, None], (41, 41), 0)
    alpha_g = (alpha_g * (1 - real_interior))[..., None]
    # 완전 균일색은 오히려 티가 나므로 원본의 저주파 명암을 남긴다.
    low = cv2.GaussianBlur(img, (0, 0), 25)
    ground_plane = np.clip(low * 0.35 + ground_color[None, None, :] * 0.65, 0, 255)
    img = img * (1 - alpha_g) + ground_plane * alpha_g

    # 좌우 랩 경계는 generate 단계의 blend_seam이 처리했고, 여기서의 교체는 행 단위
    # (수평 균일)라 새 불연속을 만들지 않는다.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), np.clip(img, 0, 255).astype(np.uint8))
    print(f"정리 완료: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
