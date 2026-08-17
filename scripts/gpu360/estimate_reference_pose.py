#!/usr/bin/env python3
"""같은 자리에서 다른 방향을 찍은 참조 이미지의 yaw/pitch/roll과 화각을 추정한다.

``generate_panorama_image.py --ref-image PATH,YAW,PITCH[,FOV]``에 넣을 값을 만든다.
정면(0,0,0)과 이미 자세를 아는 이미지들을 기준점으로 삼아 SIFT로 대응점을 모으고,
카메라 광선끼리의 회전을 Kabsch로 풀되 화각은 1차원 탐색으로 함께 정한다.

각도 규약은 Argus ``pers2equi_batch``와 같다. 그 함수의 회전은
``M = Rz(yaw) · Ry(-pitch) · Rx(-roll)`` 이고 카메라 좌표계는 X 전방, Y 우측, Z 상단이다
(``world_ray = M @ camera_ray``). 따라서 yaw는 왼쪽에서 오른쪽으로, pitch는 위를 향할 때
양수다.

전제는 순수 회전, 즉 촬영 위치가 같다는 것이다. 몇 미터 떨어진 곳에서 찍은 사진은
시차 때문에 잔차가 커진다. 잔차(deg)를 함께 출력하니 채택 여부를 그 값으로 판단한다.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def rotation_from_angles(yaw_deg: float, pitch_deg: float, roll_deg: float) -> np.ndarray:
    """Argus 규약의 M = Rz(yaw) Ry(-pitch) Rx(-roll)."""
    a, b, c = np.deg2rad([yaw_deg, -pitch_deg, -roll_deg])
    rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    ry = np.array([[np.cos(b), 0, np.sin(b)], [0, 1, 0], [-np.sin(b), 0, np.cos(b)]])
    rx = np.array([[1, 0, 0], [0, np.cos(c), -np.sin(c)], [0, np.sin(c), np.cos(c)]])
    return rz @ ry @ rx


def angles_from_rotation(matrix: np.ndarray) -> tuple[float, float, float]:
    """M에서 (yaw, pitch, roll)을 되꺼낸다. rotation_from_angles의 역이다."""
    b = -np.arcsin(np.clip(matrix[2, 0], -1.0, 1.0))
    a = np.arctan2(matrix[1, 0], matrix[0, 0])
    c = np.arctan2(matrix[2, 1], matrix[2, 2])
    return float(np.rad2deg(a)), float(-np.rad2deg(b)), float(-np.rad2deg(c))


def camera_rays(points: np.ndarray, width: int, height: int, fov_x_deg: float) -> np.ndarray:
    """픽셀 좌표를 카메라 광선(X 전방, Y 우측, Z 상단)으로 바꾼다."""
    half = np.tan(np.deg2rad(fov_x_deg) / 2)
    u = (points[:, 0] + 0.5) / width * 2 - 1
    v = (points[:, 1] + 0.5) / height * 2 - 1
    rays = np.stack([np.ones_like(u), u * half, -v * half * height / width], axis=1)
    return rays / np.linalg.norm(rays, axis=1, keepdims=True)


def kabsch(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    """source를 target으로 보내는 최적 회전 (둘 다 단위 벡터, 행 단위)."""
    correlation = target.T @ source
    u, _, vt = np.linalg.svd(correlation)
    signs = np.diag([1.0, 1.0, float(np.sign(np.linalg.det(u @ vt)))])
    return u @ signs @ vt


def match_pairs(
    detector, matcher, query_gray: np.ndarray, train_gray: np.ndarray, ratio: float,
) -> tuple[np.ndarray, np.ndarray]:
    kq, dq = detector.detectAndCompute(query_gray, None)
    kt, dt = detector.detectAndCompute(train_gray, None)
    if dq is None or dt is None or len(kq) < 8 or len(kt) < 8:
        return np.empty((0, 2)), np.empty((0, 2))
    pairs = matcher.knnMatch(dq, dt, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < ratio * n.distance]
    if not good:
        return np.empty((0, 2)), np.empty((0, 2))
    return (
        np.array([kq[m.queryIdx].pt for m in good]),
        np.array([kt[m.trainIdx].pt for m in good]),
    )


def solve_pose(
    ref_points: np.ndarray,
    ref_size: tuple[int, int],
    world_rays: np.ndarray,
    fov_candidates: np.ndarray,
    inlier_deg: float,
) -> dict:
    """화각을 훑으면서 각 후보마다 회전을 풀고, 잔차가 가장 작은 것을 고른다."""
    width, height = ref_size
    best: dict | None = None

    for fov in fov_candidates:
        rays = camera_rays(ref_points, width, height, float(fov))
        keep = np.ones(len(rays), bool)
        rotation = np.eye(3)
        # 재가중 반복: 맞춘 뒤 각오차가 큰 대응점을 떨어뜨리고 다시 맞춘다.
        for _ in range(6):
            if keep.sum() < 8:
                break
            rotation = kabsch(rays[keep], world_rays[keep])
            cos = np.clip((rays @ rotation.T * world_rays).sum(axis=1), -1, 1)
            errors = np.rad2deg(np.arccos(cos))
            threshold = max(inlier_deg, float(np.median(errors[keep]) * 2))
            updated = errors < threshold
            if updated.sum() < 8 or (updated == keep).all():
                keep = updated if updated.sum() >= 8 else keep
                break
            keep = updated

        if keep.sum() < 8:
            continue
        cos = np.clip((rays @ rotation.T * world_rays).sum(axis=1), -1, 1)
        errors = np.rad2deg(np.arccos(cos))
        score = float(np.median(errors[keep]))
        if best is None or score < best["residual_deg"]:
            yaw, pitch, roll = angles_from_rotation(rotation)
            best = {
                "fov_x_deg": round(float(fov), 2),
                "yaw_deg": round(yaw, 2),
                "pitch_deg": round(pitch, 2),
                "roll_deg": round(roll, 2),
                "residual_deg": round(score, 3),
                "inliers": int(keep.sum()),
                "correspondences": int(len(rays)),
            }
    if best is None:
        raise SystemExit("대응점이 부족해 자세를 추정하지 못했습니다.")
    return best


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--front-image", required=True, type=Path)
    parser.add_argument("--front-fov-deg", type=float, required=True)
    parser.add_argument(
        "--anchor",
        action="append",
        default=[],
        metavar="PATH,YAW,PITCH,FOV",
        help="이미 자세를 아는 이미지. 정면과 함께 기준점으로 쓴다.",
    )
    parser.add_argument(
        "--reference",
        action="append",
        default=[],
        required=True,
        metavar="PATH[,FOV]",
        help="자세를 추정할 이미지. FOV를 주면 고정하고, 없으면 함께 추정한다.",
    )
    parser.add_argument("--fov-min", type=float, default=45.0)
    parser.add_argument("--fov-max", type=float, default=95.0)
    parser.add_argument("--fov-step", type=float, default=0.5)
    parser.add_argument("--ratio", type=float, default=0.78, help="SIFT Lowe 비율 검정 임계값.")
    parser.add_argument("--inlier-deg", type=float, default=1.5)
    parser.add_argument(
        "--chain",
        action="store_true",
        help="풀린 참조를 다음 참조의 기준점으로 추가한다. 정면과 겹치지 않는 사진에 쓴다.",
    )
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def load_gray(path: Path) -> tuple[np.ndarray, tuple[int, int]]:
    image = cv2.imread(str(path))
    if image is None:
        raise SystemExit(f"이미지를 읽을 수 없습니다: {path}")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.createCLAHE(2.0, (8, 8)).apply(gray), (image.shape[1], image.shape[0])


def main() -> int:
    args = parse_args()
    detector = cv2.SIFT_create(6000)
    matcher = cv2.BFMatcher()

    front_gray, front_size = load_gray(args.front_image)
    anchors = [{
        "path": args.front_image, "gray": front_gray, "size": front_size,
        "fov": args.front_fov_deg, "rotation": np.eye(3),
    }]
    for spec in args.anchor:
        parts = spec.split(",")
        if len(parts) != 4:
            raise SystemExit(f"--anchor 형식은 PATH,YAW,PITCH,FOV 입니다: {spec}")
        gray, size = load_gray(Path(parts[0]))
        anchors.append({
            "path": Path(parts[0]), "gray": gray, "size": size, "fov": float(parts[3]),
            "rotation": rotation_from_angles(float(parts[1]), float(parts[2]), 0.0),
        })

    results = {}
    for spec in args.reference:
        parts = spec.split(",")
        ref_path = Path(parts[0])
        fixed_fov = float(parts[1]) if len(parts) > 1 else None
        ref_gray, ref_size = load_gray(ref_path)

        ref_points: list[np.ndarray] = []
        world_rays: list[np.ndarray] = []
        per_anchor = {}
        for anchor in anchors:
            query, train = match_pairs(detector, matcher, ref_gray, anchor["gray"], args.ratio)
            per_anchor[anchor["path"].name] = len(query)
            if len(query) < 8:
                continue
            rays = camera_rays(train, anchor["size"][0], anchor["size"][1], anchor["fov"])
            ref_points.append(query)
            world_rays.append(rays @ anchor["rotation"].T)

        if not ref_points:
            raise SystemExit(f"기준점과 겹치는 대응점이 없습니다: {ref_path}")

        candidates = (
            np.array([fixed_fov])
            if fixed_fov is not None
            else np.arange(args.fov_min, args.fov_max + 1e-9, args.fov_step)
        )
        solved = solve_pose(
            np.concatenate(ref_points), ref_size,
            np.concatenate(world_rays), candidates, args.inlier_deg,
        )
        solved["matches_per_anchor"] = per_anchor
        solved["image"] = str(ref_path)
        results[ref_path.name] = solved
        print(
            f"{ref_path.name}: yaw={solved['yaw_deg']:+.2f} pitch={solved['pitch_deg']:+.2f} "
            f"roll={solved['roll_deg']:+.2f} fov={solved['fov_x_deg']:.1f} "
            f"잔차={solved['residual_deg']:.2f}° "
            f"인라이어={solved['inliers']}/{solved['correspondences']}"
        )
        print(f"  기준점별 대응: {per_anchor}")

        if args.chain:
            anchors.append({
                "path": ref_path, "gray": ref_gray, "size": ref_size,
                "fov": solved["fov_x_deg"],
                "rotation": rotation_from_angles(
                    solved["yaw_deg"], solved["pitch_deg"], solved["roll_deg"],
                ),
            })

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
        print(f"기록: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
