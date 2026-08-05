#!/usr/bin/env python3
"""Estimate a depth map for each image in an event folder.

A single photo rendered on a flat plane reads as a flat photo. Displacing a mesh
by a depth map turns it into a shallow relief, so moving the camera even a few
centimetres produces real parallax. This script produces that depth map once,
offline, so the VR page pays no runtime cost.

The model is Depth Anything V2 Small (quantized ONNX, ~27MB). It outputs relative
inverse depth - nearer pixels get larger values - which is exactly the form the
displacement shader wants.

Usage:
    pip install -r requirements-depth.txt
    python scripts/estimate_depth.py --persona caregiver --event event_001
    python scripts/estimate_depth.py --image events/caregiver/event_001/images/waiting_room.jpg
"""
import argparse
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

MODEL_URL = (
    "https://huggingface.co/onnx-community/depth-anything-v2-small"
    "/resolve/main/onnx/model_quantized.onnx"
)
MODEL_PATH = Path(__file__).parent / ".models" / "depth-anything-v2-small-quantized.onnx"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
INPUT_SIZE = 518

# Depth Anything inherits DINOv2's ImageNet normalisation.
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def ensure_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"모델을 내려받는 중 (~27MB): {MODEL_URL}")
    # 받다 만 파일이 캐시로 남지 않도록 임시 파일에 받은 뒤 옮긴다.
    staging = MODEL_PATH.with_suffix(".part")
    urllib.request.urlretrieve(MODEL_URL, staging)
    staging.replace(MODEL_PATH)
    print(f"  저장: {MODEL_PATH}")
    return MODEL_PATH


def preprocess(image: Image.Image) -> np.ndarray:
    resized = image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BICUBIC)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    array = (array - MEAN) / STD
    return array.transpose(2, 0, 1)[None]  # NCHW


def postprocess(depth: np.ndarray, size: tuple[int, int]) -> Image.Image:
    """Normalise, stretch back to the source size, and soften speckle."""
    # 소수의 극단값이 전체 범위를 잡아먹지 않도록 퍼센타일로 자른다.
    low, high = np.percentile(depth, 2), np.percentile(depth, 98)
    if high <= low:
        high = low + 1e-6
    normalised = np.clip((depth - low) / (high - low), 0, 1)

    result = Image.fromarray((normalised * 255).astype(np.uint8), mode="L")
    result = result.resize(size, Image.BICUBIC)

    # cv2도 scipy도 없으므로 PIL만으로 처리한다. median이 얼룩을 지우면서
    # 경계를 어느 정도 지키고, 약한 gaussian이 변위 메시의 계단을 없앤다.
    result = result.filter(ImageFilter.MedianFilter(size=5))
    return result.filter(ImageFilter.GaussianBlur(radius=1.5))


def estimate(session: ort.InferenceSession, path: Path) -> Path:
    image = Image.open(path)
    inputs = {session.get_inputs()[0].name: preprocess(image)}
    raw = session.run(None, inputs)[0]

    depth = np.squeeze(raw)
    if depth.ndim != 2:
        raise RuntimeError(f"예상치 못한 출력 형태입니다: {raw.shape}")

    output = path.with_suffix(f"{path.suffix}.depth.png")
    postprocess(depth, image.size).save(output)
    return output


def collect_images(args, parser) -> list[Path]:
    if args.image:
        if not args.image.is_file():
            parser.error(f"이미지를 찾을 수 없습니다: {args.image}")
        return [args.image]

    if not (args.persona and args.event):
        parser.error("--persona와 --event를 함께 주거나 --image를 주세요.")

    event_dir = args.events_dir / args.persona / args.event
    if not event_dir.is_dir():
        parser.error(f"이벤트 폴더를 찾을 수 없습니다: {event_dir}")

    return sorted(
        path for path in event_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in IMAGE_SUFFIXES
        and not path.name.endswith(".depth.png")
        and path.stat().st_size > 0
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--persona", help="페르소나 식별자 (예: caregiver)")
    parser.add_argument("--event", help="이벤트 폴더 이름 (예: event_001)")
    parser.add_argument("--image", type=Path, help="이미지 한 장만 처리할 때의 경로")
    parser.add_argument("--events-dir", default=Path("events"), type=Path)
    parser.add_argument("--force", action="store_true", help="이미 있는 depth도 다시 만든다")
    args = parser.parse_args()

    images = collect_images(args, parser)
    if not images:
        print("처리할 이미지가 없습니다.")
        return

    session = ort.InferenceSession(str(ensure_model()), providers=["CPUExecutionProvider"])

    for path in images:
        output = path.with_suffix(f"{path.suffix}.depth.png")
        if output.exists() and not args.force:
            print(f"  건너뜀 (이미 있음): {output.name}")
            continue

        print(f"  추정 중: {path.name}")
        estimate(session, path)
        print(f"    -> {output.name}")


if __name__ == "__main__":
    main()
