#!/usr/bin/env python3
"""Fill the areas a single photo cannot show once the viewpoint moves.

Displacing a photo by its depth map turns it into a shallow relief, but the
pixels hidden *behind* near objects were never captured. Moving the camera tears
those regions open and the backdrop shows through as grey patches.

This script finds those regions from the depth discontinuities, paints them with
LaMa - a GAN inpainter built for large masks that runs comfortably on CPU - and
writes a background layer the renderer puts behind the relief.

Output per image:
    <name>.fill.png   depth 불연속 뒤가 채워진 배경 레이어

Usage:
    pip install -r requirements-depth.txt
    python scripts/estimate_depth.py --persona he --event event_001
    python scripts/inpaint_disocclusion.py --persona he --event event_001
"""
import argparse
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx"
MODEL_PATH = Path(__file__).parent / ".models" / "lama_fp32.onnx"

# LaMa ONNX는 512×512 고정 입력이다.
TILE = 512

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}

# 깊이가 이만큼(0~1 기준) 급히 꺾이면 전경 실루엣으로 본다.
# 셰이더의 DEPTH.stretchCut과 같은 판단을 오프라인에서 하는 셈이다.
EDGE_THRESHOLD = 0.015
# 마스크를 이만큼 부풀린다. 넓게 잡아도 손해가 없다 — 이 레이어는 부조가 찢어진
# 자리에서만 드러나므로, 넘치게 칠한 부분은 애초에 보이지 않는다.
DILATE = 41


def ensure_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"LaMa 모델을 내려받는 중: {MODEL_URL}")
    staging = MODEL_PATH.with_suffix(".part")
    urllib.request.urlretrieve(MODEL_URL, staging)
    staging.replace(MODEL_PATH)
    print(f"  저장: {MODEL_PATH}")
    return MODEL_PATH


def disocclusion_mask(depth: Image.Image) -> Image.Image:
    """Mark the near side of sharp depth edges so LaMa can rebuild behind it.

    Masking the far side destroys pixels that are already valid background and
    produces the long smeared bands seen in the first prototype.  The pixels we
    need to invent are behind the foreground silhouette, so remove a narrow band
    from the *near* object instead and let LaMa extend the known background into
    that band.
    """
    array = np.asarray(depth.convert("L"), dtype=np.float32) / 255.0

    # 가로·세로 기울기. 값이 큰 쪽이 가깝고, 급락하는 자리가 실루엣이다.
    gy, gx = np.gradient(array)
    steep = np.hypot(gx, gy) > EDGE_THRESHOLD

    # 경계 주변을 넓힌 뒤 가까운 물체 쪽만 남긴다. 먼 쪽의 실제 배경을 보존해야
    # LaMa가 바닥·벽의 선을 실루엣 뒤로 자연스럽게 이어 그릴 수 있다.
    mask = Image.fromarray((steep * 255).astype(np.uint8), mode="L")
    mask = mask.filter(ImageFilter.MaxFilter(DILATE))

    blurred = np.asarray(
        Image.fromarray((array * 255).astype(np.uint8), mode="L")
        .filter(ImageFilter.GaussianBlur(radius=DILATE)),
        dtype=np.float32,
    ) / 255.0
    nearer = array > blurred + EDGE_THRESHOLD * 0.25

    combined = (np.asarray(mask, dtype=np.float32) / 255.0 > 0.5) & nearer
    return Image.fromarray((combined * 255).astype(np.uint8), mode="L")


def run_lama(session: ort.InferenceSession, image: Image.Image, mask: Image.Image) -> Image.Image:
    source_size = image.size
    rgb = image.convert("RGB").resize((TILE, TILE), Image.BICUBIC)
    binary = mask.resize((TILE, TILE), Image.NEAREST)

    image_input = np.asarray(rgb, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    mask_input = (np.asarray(binary, dtype=np.float32)[None, None] > 127).astype(np.float32)

    names = [entry.name for entry in session.get_inputs()]
    output = session.run(None, {names[0]: image_input, names[1]: mask_input})[0]

    painted = np.squeeze(output)
    if painted.shape[0] == 3:
        painted = painted.transpose(1, 2, 0)
    # LaMa ONNX는 0~255 범위로 내보낸다.
    painted = np.clip(painted if painted.max() > 1.5 else painted * 255.0, 0, 255)

    return Image.fromarray(painted.astype(np.uint8), mode="RGB").resize(source_size, Image.BICUBIC)


def fill(session: ort.InferenceSession, image_path: Path, depth_path: Path) -> Path:
    image = Image.open(image_path)
    mask = disocclusion_mask(Image.open(depth_path))

    covered = np.asarray(mask, dtype=np.float32).mean() / 255.0
    print(f"    가려진 영역 {covered * 100:.1f}%")

    painted = run_lama(session, image, mask)

    # 채워진 곳만 갈아끼우고 나머지는 원본을 그대로 둔다. 실제로 찍힌 화소를
    # 생성물로 덮어쓰지 않기 위해서다.
    soft = mask.filter(ImageFilter.GaussianBlur(radius=2))
    result = Image.composite(painted, image.convert("RGB"), soft)

    output = image_path.with_suffix(f"{image_path.suffix}.fill.png")
    result.save(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--persona", required=True)
    parser.add_argument("--event", required=True)
    parser.add_argument("--events-dir", default=Path("events"), type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    event_dir = args.events_dir / args.persona / args.event
    if not event_dir.is_dir():
        parser.error(f"이벤트 폴더를 찾을 수 없습니다: {event_dir}")

    images = sorted(
        path for path in event_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in IMAGE_SUFFIXES
        and not path.name.endswith((".depth.png", ".fill.png"))
        and path.stat().st_size > 0
    )
    if not images:
        print("처리할 이미지가 없습니다.")
        return

    session = ort.InferenceSession(str(ensure_model()), providers=["CPUExecutionProvider"])

    for image_path in images:
        depth_path = image_path.with_suffix(f"{image_path.suffix}.depth.png")
        if not depth_path.exists():
            print(f"  ! 깊이 맵이 없어 건너뜁니다 (estimate_depth.py 먼저): {image_path.name}")
            continue

        output = image_path.with_suffix(f"{image_path.suffix}.fill.png")
        if output.exists() and not args.force:
            print(f"  건너뜀 (이미 있음): {output.name}")
            continue

        print(f"  채우는 중: {image_path.name}")
        fill(session, image_path, depth_path)
        print(f"    -> {output.name}")


if __name__ == "__main__":
    main()
