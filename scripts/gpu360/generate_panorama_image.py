#!/usr/bin/env python3
"""Outpaint a single recorded front-view frame into a full 2:1 equirectangular panorama image.

Run inside the Argus 360VG environment; imports Argus's own ``pers2equi_batch`` so the
camera convention matches ``composite_recorded_front.py``, and reuses that script's
``feather_alpha``/``blend_seam`` helpers so the front placement and left/right seam
treatment stay consistent with the video pipeline.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

from composite_recorded_front import blend_seam, feather_alpha


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--argus-dir", required=True, type=Path)
    parser.add_argument("--front-image", required=True, type=Path)
    parser.add_argument("--fov-x-deg", type=float, default=90.0)
    parser.add_argument("--roll-deg", type=float, default=0.0)
    parser.add_argument("--pitch-deg", type=float, default=0.0)
    parser.add_argument("--yaw-deg", type=float, default=0.0)
    parser.add_argument("--width", type=int, default=2048)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument(
        "--prompt",
        default=(
            "interior of a dark movie theater auditorium, black walls, rows of empty "
            "cinema seats, no windows, dim ambient lighting, cinematic, photorealistic"
        ),
    )
    parser.add_argument(
        "--negative-prompt",
        default=(
            "windows, daylight, sunlight, bright walls, blinds, curtains, living room, "
            "home interior, furniture, people, text, watermark"
        ),
    )
    parser.add_argument("--model", default="diffusers/stable-diffusion-xl-1.0-inpainting-0.1")
    parser.add_argument("--guidance-scale", type=float, default=8.0)
    parser.add_argument("--num-inference-steps", type=int, default=30)
    parser.add_argument("--strength", type=float, default=0.99)
    parser.add_argument("--mask-dilate-px", type=int, default=8)
    parser.add_argument("--edge-feather", type=float, default=0.02)
    parser.add_argument("--seam-blend", type=float, default=0.02)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--device", default="cuda:0")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.front_image.is_file():
        raise SystemExit(f"정면 이미지가 없습니다: {args.front_image}")
    if not args.argus_dir.is_dir():
        raise SystemExit(f"Argus 디렉터리가 없습니다: {args.argus_dir}")

    sys.path.insert(0, str(args.argus_dir.resolve()))
    try:
        from src.pers2equi import pers2equi_batch
    except ImportError as exc:
        raise SystemExit(
            "Argus 모듈을 불러오지 못했습니다. 360VG Conda 환경에서 실행하세요."
        ) from exc

    device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise SystemExit(f"CUDA 장치를 사용할 수 없습니다: {args.device}")

    front_bgr = cv2.imread(str(args.front_image))
    if front_bgr is None:
        raise SystemExit(f"정면 이미지를 읽을 수 없습니다: {args.front_image}")
    front_rgb = cv2.cvtColor(front_bgr, cv2.COLOR_BGR2RGB)
    front_tensor = (
        torch.from_numpy(front_rgb)
        .to(device=device, dtype=torch.float32)
        .permute(2, 0, 1)
        .unsqueeze(0)
        / 127.5 - 1
    )

    with torch.inference_mode():
        projected, mask = pers2equi_batch(
            front_tensor,
            fov_x=args.fov_x_deg,
            roll=np.asarray([np.deg2rad(args.roll_deg)], dtype=np.float32),
            pitch=np.asarray([np.deg2rad(args.pitch_deg)], dtype=np.float32),
            yaw=np.asarray([np.deg2rad(args.yaw_deg)], dtype=np.float32),
            height=args.height,
            width=args.width,
            device=device,
            return_mask=True,
        )
    projected_rgb = (
        ((projected[0].permute(1, 2, 0).clamp(-1, 1) + 1) * 127.5).byte().cpu().numpy()
    )
    known_mask = (mask[0, 0].cpu().numpy() > 0.5)

    inpaint_mask = (~known_mask).astype(np.uint8) * 255
    if args.mask_dilate_px > 0:
        kernel = np.ones((args.mask_dilate_px, args.mask_dilate_px), np.uint8)
        inpaint_mask = cv2.dilate(inpaint_mask, kernel)

    from diffusers import AutoPipelineForInpainting

    pipe = AutoPipelineForInpainting.from_pretrained(
        args.model, torch_dtype=torch.float16
    ).to(device)
    pipe.enable_vae_tiling()
    pipe.set_progress_bar_config(disable=False)

    generator = torch.Generator(device=device).manual_seed(args.seed)
    result = pipe(
        prompt=args.prompt,
        negative_prompt=args.negative_prompt,
        image=Image.fromarray(projected_rgb),
        mask_image=Image.fromarray(inpaint_mask),
        height=args.height,
        width=args.width,
        guidance_scale=args.guidance_scale,
        num_inference_steps=args.num_inference_steps,
        strength=args.strength,
        generator=generator,
    ).images[0]

    generated_rgb = np.array(result)
    generated_bgr = blend_seam(cv2.cvtColor(generated_rgb, cv2.COLOR_RGB2BGR), args.seam_blend)

    known_bgr = cv2.cvtColor(projected_rgb, cv2.COLOR_RGB2BGR)
    alpha = feather_alpha(known_mask.astype(np.float32), args.edge_feather, 0.0)[..., None]
    final_bgr = (
        known_bgr.astype(np.float32) * alpha + generated_bgr.astype(np.float32) * (1 - alpha)
    ).astype(np.uint8)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(args.output), final_bgr)
    print(f"파노라마 이미지 생성 완료: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
