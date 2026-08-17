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


def merge_reference(
    canvas_bgr: np.ndarray,
    known_mask: np.ndarray,
    ref_bgr: np.ndarray,
    ref_mask: np.ndarray,
    feather: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Blend a posed reference projection into the canvas without touching the interior
    of already-known regions.

    The reference owns any pixels nobody has claimed yet; where it overlaps existing
    coverage it fades out toward the interior of that coverage, so the recorded front
    (merged first) always wins deep inside its own footprint and the hand-off happens
    in a feathered band at the boundary.
    """
    overlap = ref_mask & known_mask
    # Handheld frames taken seconds apart drift in exposure/white balance. Match the
    # reference to the canvas over their overlap so the sky does not band at each seam.
    if overlap.sum() >= 2000:
        ref_lab = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        canvas_lab = cv2.cvtColor(canvas_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        for channel in range(3):
            ref_values = ref_lab[..., channel][overlap]
            canvas_values = canvas_lab[..., channel][overlap]
            ref_std = float(ref_values.std())
            if ref_std < 1e-3:
                continue
            scale = min(1.6, max(0.6, float(canvas_values.std()) / ref_std))
            ref_lab[..., channel] = (
                (ref_lab[..., channel] - float(ref_values.mean())) * scale
                + float(canvas_values.mean())
            )
        ref_bgr = cv2.cvtColor(np.clip(ref_lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

    known_interior = feather_alpha(known_mask.astype(np.float32), feather, 0.0)
    alpha = (ref_mask.astype(np.float32) * (1.0 - known_interior))[..., None]
    merged = (
        canvas_bgr.astype(np.float32) * (1 - alpha) + ref_bgr.astype(np.float32) * alpha
    ).astype(np.uint8)
    return merged, known_mask | ref_mask


def build_seed_fill(
    front_bgr: np.ndarray,
    known_bgr: np.ndarray,
    known_mask: np.ndarray,
    blur: int,
) -> np.ndarray:
    """Pre-fill the unknown region with blurred colour carried over from the front view.

    A large black region reads to SDXL as a studio backdrop, so it paints isolated objects
    onto it instead of continuing the room. Stretching the front frame over the whole
    canvas keeps the vertical semantics (ceiling above, table/floor below) and gives the
    model plausible ambient colour to refine.
    """
    height, width = known_mask.shape
    stretched = cv2.resize(front_bgr, (width, height), interpolation=cv2.INTER_LINEAR)
    kernel = blur if blur % 2 == 1 else blur + 1
    ambient = cv2.GaussianBlur(stretched, (kernel, kernel), 0)
    filled = known_bgr.copy()
    filled[~known_mask] = ambient[~known_mask]
    return filled


def fill_faces(
    canvas_bgr: np.ndarray,
    coverage: np.ndarray,
    *,
    pipe,
    equi2pers,
    pers2equi_batch,
    args: argparse.Namespace,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray]:
    """Outpaint the surround one cube face at a time instead of in equirect space.

    SDXL has no equirectangular prior — asked to fill a 2:1 canvas directly it produces a
    flat photo stretched across the sphere. Rendering each face as an ordinary perspective
    image keeps the model on familiar ground, and ``pers2equi_batch`` puts it back with the
    correct geometry. Faces adjacent to the recorded front go first so every later face is
    conditioned on already-filled neighbours.
    """
    size = args.face_size
    for index, (yaw_deg, pitch_deg) in enumerate(args.faces):
        equi_rgb = cv2.cvtColor(canvas_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        equi_t = torch.from_numpy(equi_rgb).permute(2, 0, 1).unsqueeze(0).to(device)
        cov_t = (
            torch.from_numpy(coverage.astype(np.float32))
            .unsqueeze(0).repeat(3, 1, 1).unsqueeze(0).to(device)
        )
        rots = [{
            "roll": 0.0,
            "pitch": float(np.deg2rad(pitch_deg)),
            "yaw": float(np.deg2rad(yaw_deg)),
        }]
        face = equi2pers(equi_t, rots=rots, height=size, width=size, fov_x=args.face_fov_deg, z_down=True)
        face_cov = equi2pers(cov_t, rots=rots, height=size, width=size, fov_x=args.face_fov_deg, z_down=True)

        face_rgb = (face[0].permute(1, 2, 0).clamp(0, 1) * 255).byte().cpu().numpy()
        face_known = face_cov[0, 0].cpu().numpy() > 0.5

        # 수평 면들은 45도 간격의 90도 면이라 대부분 서로 겹치지만, 마지막 두 면(135와
        # 225)은 정확히 180도에서 겹침 없이 맞닿는다. 뒤에 채워지는 쪽이 빈 화소를
        # alpha 1로 곧장 덮어써서 그 경도에 세로 단절이 남고, 이미 덮인 뒤에 오는 180도
        # 면은 인페인팅할 미지 영역이 없어 그것을 메우지 못한다. 이 면에서만 가운데 띠를
        # 강제로 미지로 되돌려 양쪽을 보고 다시 그리게 한다.
        heal_band = 0
        if args.seam_heal_deg > 0 and index == args.seam_heal_face_index:
            heal_band = int(round(size * args.seam_heal_deg / args.face_fov_deg))
        if heal_band > 0:
            start = max(0, size // 2 - heal_band // 2)
            face_known[:, start:start + heal_band] = False

        if face_known.all():
            continue

        face_mask = (~face_known).astype(np.uint8) * 255
        if args.mask_dilate_px > 0:
            kernel = np.ones((args.mask_dilate_px, args.mask_dilate_px), np.uint8)
            face_mask = cv2.dilate(face_mask, kernel)

        # The zenith and nadir see nothing but their neighbours, so without their own
        # prompt they simply extend whatever surrounds them — a crowd drawn across the sky.
        if pitch_deg > 0:
            prompt = args.up_prompt or args.prompt
            negative_prompt = args.up_negative_prompt or args.negative_prompt
        elif pitch_deg < 0:
            prompt = args.down_prompt or args.prompt
            negative_prompt = args.down_negative_prompt or args.negative_prompt
        else:
            prompt = args.prompt
            negative_prompt = args.negative_prompt

        generator = torch.Generator(device=device).manual_seed(args.seed + yaw_deg + pitch_deg)
        filled = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=Image.fromarray(face_rgb),
            mask_image=Image.fromarray(face_mask),
            height=size,
            width=size,
            guidance_scale=args.guidance_scale,
            num_inference_steps=args.num_inference_steps,
            strength=args.strength if args.strength is not None else 0.99,
            generator=generator,
        ).images[0]

        filled_t = (
            torch.from_numpy(np.array(filled)).permute(2, 0, 1).unsqueeze(0).to(device).float()
            / 127.5 - 1
        )
        with torch.inference_mode():
            back, back_mask = pers2equi_batch(
                filled_t,
                fov_x=args.face_fov_deg,
                roll=np.zeros(1, dtype=np.float32),
                pitch=np.asarray([np.deg2rad(pitch_deg)], dtype=np.float32),
                yaw=np.asarray([np.deg2rad(yaw_deg)], dtype=np.float32),
                height=args.height,
                width=args.width,
                device=device,
                return_mask=True,
            )
        back_rgb = ((back[0].permute(1, 2, 0).clamp(-1, 1) + 1) * 127.5).byte().cpu().numpy()
        back_bgr = cv2.cvtColor(back_rgb, cv2.COLOR_RGB2BGR)
        face_area = back_mask[0, 0].cpu().numpy() > 0.5

        # Ramp the face in across its own border so neighbouring faces cross-fade instead of
        # meeting at a hard cut; anywhere still empty takes the new content outright.
        alpha = feather_alpha(face_area.astype(np.float32), args.face_feather, 0.0)
        alpha = np.where(coverage, alpha, face_area.astype(np.float32))
        # 이음새 치유 면은 이미 덮인 자리를 다시 그린 것이라, 자기 경계에서만 페더되는
        # 위 규칙으로는 띠 가장자리가 다시 단절된다. 다시 그린 띠 주변만 좁게 교차 페이드한다.
        if heal_band > 0:
            redrawn = np.zeros_like(face_known, dtype=np.float32)
            redrawn[:, start:start + heal_band] = 1.0
            redrawn_equi, _ = pers2equi_batch(
                torch.from_numpy(redrawn).to(device)[None, None].repeat(1, 3, 1, 1) * 2 - 1,
                fov_x=args.face_fov_deg,
                roll=np.zeros(1, dtype=np.float32),
                pitch=np.asarray([np.deg2rad(pitch_deg)], dtype=np.float32),
                yaw=np.asarray([np.deg2rad(yaw_deg)], dtype=np.float32),
                height=args.height, width=args.width, device=device, return_mask=True,
            )
            band = (redrawn_equi[0, 0].cpu().numpy() + 1) / 2
            alpha = cv2.GaussianBlur(band * face_area, (0, 0), 9)
        alpha = alpha[..., None]
        canvas_bgr = (
            canvas_bgr.astype(np.float32) * (1 - alpha) + back_bgr.astype(np.float32) * alpha
        ).astype(np.uint8)
        coverage = coverage | face_area
        print(f"  face yaw={yaw_deg} pitch={pitch_deg}: 커버리지 {coverage.mean() * 100:.1f}%")
    return canvas_bgr, coverage


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
    parser.add_argument(
        "--seed-fill",
        action="store_true",
        help=(
            "빈 영역을 검정으로 두지 않고 정면에서 뽑은 흐린 색으로 미리 채운 뒤 인페인팅한다. "
            "밝은 장면에서 모델이 '검은 배경 위의 물체'를 만들어내는 것을 막는다."
        ),
    )
    parser.add_argument(
        "--seed-fill-blur",
        type=int,
        default=101,
        help="미리 채운 배경을 흐리게 만드는 가우시안 커널 크기 (홀수).",
    )
    parser.add_argument(
        "--multi-view",
        action="store_true",
        help=(
            "주변부를 큐브 면 단위 원근 이미지로 나눠 생성한 뒤 파노라마에 투영한다. "
            "SDXL에 equirectangular 사전지식이 없어 2:1 캔버스를 직접 채우면 평면 사진이 "
            "늘어난 형태가 나오는 문제를 피한다."
        ),
    )
    parser.add_argument("--up-prompt", help="천정(위) 면 전용 프롬프트. 없으면 --prompt를 쓴다.")
    parser.add_argument("--up-negative-prompt")
    parser.add_argument("--down-prompt", help="바닥(아래) 면 전용 프롬프트. 없으면 --prompt를 쓴다.")
    parser.add_argument("--down-negative-prompt")
    parser.add_argument(
        "--seam-heal-deg",
        type=float,
        default=12.0,
        help=(
            "마지막 수평 면(경도 180도)에서 강제로 다시 그릴 가운데 띠의 폭(도). "
            "135도 면과 225도 면이 겹침 없이 맞닿아 생기는 세로 단절을 메운다. 0이면 끈다."
        ),
    )
    parser.add_argument("--face-size", type=int, default=1024)
    parser.add_argument("--face-fov-deg", type=float, default=90.0)
    parser.add_argument(
        "--face-feather",
        type=float,
        default=0.06,
        help="큐브 면끼리 겹치는 구간에서 교차 페이드시킬 비율.",
    )
    parser.add_argument("--guidance-scale", type=float, default=8.0)
    parser.add_argument("--num-inference-steps", type=int, default=30)
    parser.add_argument(
        "--strength",
        type=float,
        help="기본값은 인페인팅 0.99, --seed-fill 0.7 (미리 채운 배경을 남겨야 하므로 더 낮다).",
    )
    parser.add_argument(
        "--ref-image",
        action="append",
        default=[],
        metavar="PATH,YAW,PITCH[,FOV | ,ROLL,FOV]",
        help=(
            "정면과 같은 자리에서 다른 방향을 찍은 참조 이미지. 지정한 각도(도)로 구면에 "
            "투영해 실측 영역으로 깔고, SDXL은 나머지 빈틈만 채운다. 여러 번 지정할 수 "
            "있고 나열 순서대로 우선권을 가진다. 각도는 estimate_reference_pose.py로 "
            "구한다. 필드가 4개면 네 번째는 FOV(roll 0), 5개면 ROLL,FOV 순이다."
        ),
    )
    parser.add_argument(
        "--ref-feather",
        type=float,
        default=0.03,
        help="참조 이미지가 기존 커버리지 경계에서 교차 페이드되는 폭 비율.",
    )
    parser.add_argument("--mask-dilate-px", type=int, default=8)
    parser.add_argument("--edge-feather", type=float, default=0.02)
    parser.add_argument("--seam-blend", type=float, default=0.02)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--device", default="cuda:0")
    args = parser.parse_args()
    # Expand outward from the recorded front (yaw 0) in overlapping steps so each face is
    # conditioned on its neighbour, then close the poles.
    args.faces = [
        (45, 0), (315, 0), (90, 0), (270, 0),
        (135, 0), (225, 0), (180, 0),
        (0, -90), (0, 90),
    ]
    # 135도 면과 225도 면이 맞닿는 경도 180도를 다시 그리는 면.
    args.seam_heal_face_index = args.faces.index((180, 0))
    return args


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
    known_bgr = cv2.cvtColor(projected_rgb, cv2.COLOR_RGB2BGR)

    for spec in args.ref_image:
        parts = spec.split(",")
        if len(parts) not in (3, 4, 5):
            raise SystemExit(
                f"--ref-image 형식은 PATH,YAW,PITCH[,FOV | ,ROLL,FOV] 입니다: {spec}"
            )
        ref_path = Path(parts[0])
        ref_yaw, ref_pitch = float(parts[1]), float(parts[2])
        ref_roll = float(parts[3]) if len(parts) == 5 else 0.0
        ref_fov = float(parts[-1]) if len(parts) > 3 else args.fov_x_deg
        ref_src = cv2.imread(str(ref_path))
        if ref_src is None:
            raise SystemExit(f"참조 이미지를 읽을 수 없습니다: {ref_path}")
        ref_tensor = (
            torch.from_numpy(cv2.cvtColor(ref_src, cv2.COLOR_BGR2RGB))
            .to(device=device, dtype=torch.float32)
            .permute(2, 0, 1)
            .unsqueeze(0)
            / 127.5 - 1
        )
        with torch.inference_mode():
            ref_projected, ref_mask_t = pers2equi_batch(
                ref_tensor,
                fov_x=ref_fov,
                roll=np.asarray([np.deg2rad(ref_roll)], dtype=np.float32),
                pitch=np.asarray([np.deg2rad(ref_pitch)], dtype=np.float32),
                yaw=np.asarray([np.deg2rad(ref_yaw)], dtype=np.float32),
                height=args.height,
                width=args.width,
                device=device,
                return_mask=True,
            )
        ref_projected_bgr = cv2.cvtColor(
            ((ref_projected[0].permute(1, 2, 0).clamp(-1, 1) + 1) * 127.5)
            .byte().cpu().numpy(),
            cv2.COLOR_RGB2BGR,
        )
        ref_area = ref_mask_t[0, 0].cpu().numpy() > 0.5
        known_bgr, known_mask = merge_reference(
            known_bgr, known_mask, ref_projected_bgr, ref_area, args.ref_feather,
        )
        print(f"참조 병합 {ref_path.name} yaw={ref_yaw} pitch={ref_pitch} roll={ref_roll} "
              f"fov={ref_fov}: 커버리지 {known_mask.mean() * 100:.1f}%")

    inpaint_mask = (~known_mask).astype(np.uint8) * 255
    if args.mask_dilate_px > 0:
        kernel = np.ones((args.mask_dilate_px, args.mask_dilate_px), np.uint8)
        inpaint_mask = cv2.dilate(inpaint_mask, kernel)
    generator = torch.Generator(device=device).manual_seed(args.seed)
    shared = {
        "prompt": args.prompt,
        "negative_prompt": args.negative_prompt,
        "guidance_scale": args.guidance_scale,
        "num_inference_steps": args.num_inference_steps,
        "generator": generator,
    }

    if args.multi_view:
        from diffusers import AutoPipelineForInpainting
        from equilib import equi2pers

        pipe = AutoPipelineForInpainting.from_pretrained(
            args.model, torch_dtype=torch.float16
        ).to(device)
        pipe.vae.enable_tiling()
        pipe.set_progress_bar_config(disable=True)
        if args.ref_image:
            # 참조들이 하늘·능선 색을 이미 알고 있으니, 정면 한 장을 늘리는 대신
            # 전체 실측 영역을 저해상에서 TELEA로 이어붙여 주변광을 만든다. 정면
            # 스트레치는 무대 조명색을 하늘까지 끌고 가 스며든다(event_002의 초록 하늘).
            small = cv2.resize(known_bgr, (512, 256), interpolation=cv2.INTER_AREA)
            small_hole = cv2.resize(
                (~known_mask).astype(np.uint8) * 255, (512, 256),
                interpolation=cv2.INTER_NEAREST,
            )
            ambient_small = cv2.inpaint(small, small_hole, 5, cv2.INPAINT_TELEA)
            ambient = cv2.resize(
                ambient_small, (args.width, args.height), interpolation=cv2.INTER_LINEAR,
            )
            kernel = args.seed_fill_blur if args.seed_fill_blur % 2 == 1 else args.seed_fill_blur + 1
            ambient = cv2.GaussianBlur(ambient, (kernel, kernel), 0)
            canvas = known_bgr.copy()
            canvas[~known_mask] = ambient[~known_mask]
        else:
            canvas = build_seed_fill(front_bgr, known_bgr, known_mask, args.seed_fill_blur)
        canvas, coverage = fill_faces(
            canvas,
            known_mask.copy(),
            pipe=pipe,
            equi2pers=equi2pers,
            pers2equi_batch=pers2equi_batch,
            args=args,
            device=device,
        )
        if not coverage.all():
            print(f"경고: {(~coverage).mean() * 100:.2f}% 가 채워지지 않아 흐린 배경으로 남습니다.")
        generated_bgr = blend_seam(canvas, args.seam_blend)
    elif args.seed_fill:
        # The inpainting UNet blanks the masked region internally, so the pre-filled
        # surround only survives through img2img's initial latents.
        from diffusers import AutoPipelineForImage2Image

        seeded_bgr = build_seed_fill(front_bgr, known_bgr, known_mask, args.seed_fill_blur)
        pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16
        ).to(device)
        pipe.vae.enable_tiling()
        pipe.set_progress_bar_config(disable=False)
        result = pipe(
            image=Image.fromarray(cv2.cvtColor(seeded_bgr, cv2.COLOR_BGR2RGB)),
            strength=args.strength if args.strength is not None else 0.7,
            **shared,
        ).images[0]
        generated_bgr = blend_seam(
            cv2.cvtColor(np.array(result), cv2.COLOR_RGB2BGR), args.seam_blend
        )
    else:
        from diffusers import AutoPipelineForInpainting

        pipe = AutoPipelineForInpainting.from_pretrained(
            args.model, torch_dtype=torch.float16
        ).to(device)
        pipe.vae.enable_tiling()
        pipe.set_progress_bar_config(disable=False)
        result = pipe(
            image=Image.fromarray(projected_rgb),
            mask_image=Image.fromarray(inpaint_mask),
            height=args.height,
            width=args.width,
            strength=args.strength if args.strength is not None else 0.99,
            **shared,
        ).images[0]
        generated_bgr = blend_seam(
            cv2.cvtColor(np.array(result), cv2.COLOR_RGB2BGR), args.seam_blend
        )

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
