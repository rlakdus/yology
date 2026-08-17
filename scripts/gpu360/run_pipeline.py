#!/usr/bin/env python3
"""Run fixed-view prepare -> Argus -> VEnhancer -> recorded-front generation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCK_PATH = PROJECT_ROOT / "gpu360" / "argus.lock.json"
STAGES = ("prepare", "infer", "enhance", "compose", "validate")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True, type=Path)
    parser.add_argument(
        "--argus-dir",
        type=Path,
        default=PROJECT_ROOT / ".gpu360" / "argus-code",
    )
    parser.add_argument(
        "--unet",
        type=Path,
        default=Path(os.environ["ARGUS_UNET_PATH"]) if os.getenv("ARGUS_UNET_PATH") else None,
    )
    parser.add_argument("--checkpoint-id", default=os.getenv("ARGUS_CHECKPOINT_ID"))
    parser.add_argument("--from-stage", choices=STAGES, default="prepare")
    parser.add_argument(
        "--to-stage",
        choices=STAGES,
        default="validate",
        help="이 단계까지만 실행합니다. 고정 파노라마 이미지를 쓸 때 infer까지만 돌리는 용도.",
    )
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-config", action="store_true")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"JSON을 읽을 수 없습니다: {path}: {exc}") from exc


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_project_path(value: str) -> Path:
    path = (PROJECT_ROOT / value).resolve()
    try:
        path.relative_to(PROJECT_ROOT.resolve())
    except ValueError as exc:
        raise SystemExit(f"프로젝트 외부 경로는 사용할 수 없습니다: {value}") from exc
    return path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_command(command: str) -> None:
    if shutil.which(command) is None:
        raise SystemExit(f"필수 명령을 찾을 수 없습니다: {command}")


def subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def run(
    command: list[str],
    *,
    cwd: Path | None = None,
    env_updates: dict[str, str] | None = None,
) -> None:
    print(f"+ {shlex.join(command)}", flush=True)
    env = subprocess_env()
    if env_updates:
        env.update(env_updates)
    subprocess.run(command, cwd=cwd, check=True, env=env)


def capture(command: list[str], *, cwd: Path | None = None) -> str:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env=subprocess_env(),
    ).stdout.strip()


def conda(env: str, *command: str) -> list[str]:
    return ["conda", "run", "--no-capture-output", "-n", env, *command]


def probe(path: Path) -> dict[str, Any]:
    raw = capture(conda(
        "360VG",
        "ffprobe", "-v", "error",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,nb_frames",
        "-of", "json", str(path),
    ))
    data = json.loads(raw)
    video = next(
        (stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"),
        None,
    )
    if not video:
        raise SystemExit(f"영상 스트림이 없습니다: {path}")
    fps_value = video.get("avg_frame_rate")
    if not fps_value or fps_value == "0/0":
        raise SystemExit(f"프레임률을 확인할 수 없습니다: {path}")
    fps = Fraction(fps_value)
    frame_text = video.get("nb_frames")
    if frame_text and frame_text != "N/A":
        frames = int(frame_text)
    else:
        frames = round(float(data["format"]["duration"]) * float(fps))
    if frames < 2:
        raise SystemExit(f"전체 프레임 수가 올바르지 않습니다: {frames}")
    return {
        "duration_seconds": float(data["format"]["duration"]),
        "fps": str(fps),
        "fps_float": float(fps),
        "frames": frames,
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "video_codec": video.get("codec_name"),
    }


def validate_audio(job: dict[str, Any], path: Path) -> None:
    """Check the optional ``audio`` block.

    ``original`` keeps the recorded track; ``synthesized`` discards it and renders a
    procedural bed from a layer spec instead. Only ``synthesized`` needs extra files.
    """
    audio = job.get("audio")
    if audio is None:
        return
    mode = audio.get("mode")
    if mode not in ("original", "synthesized"):
        raise SystemExit(f"audio.mode는 original 또는 synthesized여야 합니다 ({path}): {mode}")
    if float(audio.get("target_lufs", -18.0)) > 0:
        raise SystemExit("audio.target_lufs는 0 이하여야 합니다.")
    if float(audio.get("true_peak_db", -1.0)) > 0:
        raise SystemExit("audio.true_peak_db는 0 이하여야 합니다.")
    if mode != "synthesized":
        return
    for key in ("spec", "file"):
        if key not in audio:
            raise SystemExit(f"audio.mode가 synthesized면 audio.{key}가 필요합니다 ({path}).")
    if not resolve_project_path(audio["spec"]).is_file():
        raise SystemExit(f"사운드 베드 사양이 없습니다: {audio['spec']}")
    if resolve_project_path(audio["file"]).suffix.lower() != ".wav":
        raise SystemExit("audio.file은 .wav여야 합니다.")


def validate_job(job: dict[str, Any], path: Path) -> tuple[Path, Path, Path]:
    required = (
        "event", "source", "expected_source_sha256", "output",
        "generation_record", "generation", "input", "view",
        "enhancement", "composite",
    )
    missing = [key for key in required if key not in job]
    if missing:
        raise SystemExit(f"작업 설정에 필드가 없습니다 ({path}): {', '.join(missing)}")

    source = resolve_project_path(job["source"])
    output = resolve_project_path(job["output"])
    record = resolve_project_path(job["generation_record"])
    if not source.is_file() or source.stat().st_size == 0:
        raise SystemExit(f"원본 영상이 없거나 비어 있습니다: {source}")
    actual_hash = sha256(source)
    if actual_hash != job["expected_source_sha256"]:
        raise SystemExit(
            "원본 SHA-256이 작업 설정과 다릅니다.\n"
            f"  expected: {job['expected_source_sha256']}\n  actual:   {actual_hash}"
        )

    generation = job["generation"]
    input_config = job["input"]
    enhancement = job["enhancement"]
    composite = job["composite"]
    if (generation.get("width"), generation.get("height")) != (1024, 512):
        raise SystemExit("Argus 생성 해상도는 현재 1024x512만 지원합니다.")
    if float(input_config.get("fixed_fov_deg", 0)) <= 0:
        raise SystemExit("input.fixed_fov_deg는 양수여야 합니다.")
    if input_config.get("aspect_policy") != "preserve":
        raise SystemExit("현재 input.aspect_policy는 preserve만 지원합니다.")
    enhancement_width = int(enhancement.get("width", 0))
    enhancement_height = int(enhancement.get("height", 0))
    if enhancement.get("enabled") and (
        enhancement_width <= 0 or enhancement_width != enhancement_height * 2
    ):
        raise SystemExit("향상 출력은 양수인 2:1 해상도여야 합니다.")
    output_width = int(composite.get("output_width", enhancement_width))
    output_height = int(composite.get("output_height", enhancement_height))
    if output_width <= 0 or output_width != output_height * 2:
        raise SystemExit("최종 합성 출력은 양수인 2:1 해상도여야 합니다.")
    if output_width < enhancement_width or output_height < enhancement_height:
        raise SystemExit("최종 합성 출력은 향상 영상보다 작을 수 없습니다.")
    if not 0 <= float(composite.get("edge_feather", -1)) <= 0.25:
        raise SystemExit("edge_feather는 0~0.25 범위여야 합니다.")
    if not 0 <= float(composite.get("source_mask_inset", 0)) <= 0.1:
        raise SystemExit("source_mask_inset은 0~0.1 범위여야 합니다.")
    stabilize_after = composite.get("stabilize_generated_color_after")
    if stabilize_after is not None and float(stabilize_after) < 0:
        raise SystemExit("stabilize_generated_color_after는 0 이상이어야 합니다.")
    if not 0 <= float(composite.get("color_stabilization_strength", 1.0)) <= 1:
        raise SystemExit("color_stabilization_strength는 0~1 범위여야 합니다.")
    if float(composite.get("color_stabilization_transition", 1.0)) < 0:
        raise SystemExit("color_stabilization_transition은 0 이상이어야 합니다.")
    if composite.get("freeze_generated_surroundings", False) and stabilize_after is not None:
        raise SystemExit("주변부 고정과 시간축 안정화는 동시에 사용할 수 없습니다.")
    frozen_image = composite.get("frozen_panorama_image")
    if frozen_image is not None:
        if stabilize_after is not None:
            raise SystemExit("고정 파노라마 이미지와 시간축 안정화는 동시에 사용할 수 없습니다.")
        if not resolve_project_path(frozen_image).is_file():
            raise SystemExit(f"고정 파노라마 이미지가 없습니다: {frozen_image}")
    validate_audio(job, path)
    return source, output, record


def wrap_panorama_image(image: Path, work_dir: Path) -> Path:
    """Wrap a still equirectangular panorama as a one-frame video.

    ``composite_recorded_front.py`` reads the generated surroundings from a video, so a
    still background is supplied as a single frame that ``--freeze-generated-surroundings``
    then holds for the whole timeline.
    """
    work_dir.mkdir(parents=True, exist_ok=True)
    wrapped = work_dir / f"{image.stem}_frozen.mp4"
    run(conda(
        "360VG", "ffmpeg", "-y", "-loglevel", "warning",
        "-loop", "1", "-i", str(image),
        "-t", "1", "-r", "24", "-pix_fmt", "yuv420p", str(wrapped),
    ))
    return wrapped


def discover_one(folder: Path, pattern: str, label: str) -> Path:
    matches = sorted(path for path in folder.glob(pattern) if "_round" not in path.stem)
    if len(matches) != 1:
        listing = "\n".join(f"  - {path}" for path in matches) or "  (없음)"
        raise SystemExit(f"{label} 파일을 하나로 결정할 수 없습니다:\n{listing}")
    return matches[0]


def update_event_metadata(job: dict[str, Any]) -> None:
    event_dir = PROJECT_ROOT / "events" / job["event"]
    metadata_path = event_dir / "metadata.json"
    if not metadata_path.is_file():
        return
    metadata = load_json(metadata_path)
    output = resolve_project_path(job["output"])
    fallback = metadata.get("panorama", {}).get("file")
    metadata["panorama_video"] = {
        "file": output.relative_to(event_dir).as_posix(),
        "projection": "equirectangular",
        "fallback_image_file": fallback,
        "yaw_offset_deg": float(job["view"].get("initial_yaw_deg", 0)),
    }
    availability = metadata.setdefault("availability", {})
    availability["panorama_ready"] = True
    availability["vr_ready"] = bool(
        availability.get("anomaly_ready")
        and availability.get("source_video_ready")
    )
    metadata["view"] = job["view"]
    write_json(metadata_path, metadata)


def audio_record(job: dict[str, Any]) -> dict[str, Any]:
    """Describe what ended up on the audio track, for generation.json."""
    audio = job.get("audio", {})
    if audio.get("mode") != "synthesized":
        return {"mode": "original", "codec": "aac", "source": job["source"]}
    bed = resolve_project_path(audio["file"])
    if not bed.is_file():
        # --from-stage validate로 들어오면 compose를 건너뛰므로 베드가 없을 수 있습니다.
        raise SystemExit(f"사운드 베드가 없습니다. compose부터 실행하세요: {audio['file']}")
    return {
        "mode": "synthesized",
        "codec": "aac",
        "spec": audio["spec"],
        "file": audio["file"],
        "sha256": sha256(bed),
        "target_lufs": float(audio.get("target_lufs", -18.0)),
        "true_peak_db": float(audio.get("true_peak_db", -1.0)),
        "recorded_audio_discarded": True,
        "reason": audio.get("reason"),
    }


def write_run_record(
    path: Path,
    *,
    job: dict[str, Any],
    source_probe: dict[str, Any],
    prepared_probe: dict[str, Any],
    preparation: dict[str, Any],
    lock: dict[str, Any],
    checkpoint_id: str,
    output: Path,
) -> None:
    payload = {
        "status": "complete",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "name": "Beyond the Frame (Argus)",
            "repository": lock["repository"],
            "commit": lock["commit"],
            "checkpoint": checkpoint_id,
        },
        "source": {
            "file": job["source"],
            "sha256": job["expected_source_sha256"],
            **source_probe,
        },
        "preparation": {
            **preparation,
            "probe": prepared_probe,
        },
        "view": job["view"],
        "generation": {
            **job["generation"],
            "fixed_fov_deg": job["input"]["fixed_fov_deg"],
            "camera_motion_prediction": False,
            "rotation_during_inference": False,
            "roll_pitch_yaw": "fixed_zero",
            "full_sampling": True,
            "preserve_source_timeline": True,
            "generated_region": "outside_recorded_front_view",
        },
        "enhancement": job["enhancement"],
        "composite": job["composite"],
        "output": {
            "file": job["output"],
            "sha256": sha256(output),
            "width": job["composite"].get("output_width", job["enhancement"]["width"]),
            "height": job["composite"].get("output_height", job["enhancement"]["height"]),
            "video_codec": "h264",
            "pixel_format": "yuv420p",
            "audio": audio_record(job),
            "faststart": True,
        },
    }
    frozen_image = job["composite"].get("frozen_panorama_image")
    if frozen_image is not None:
        frozen_image_path = resolve_project_path(frozen_image)
        payload["panorama_image"] = {
            "file": frozen_image,
            "sha256": sha256(frozen_image_path),
            "role": "frozen_generated_surroundings",
        }
        payload["generation"]["generated_region"] = "recorded_front_view_only"
    write_json(path, payload)


def main() -> int:
    args = parse_args()
    job_path = args.job.resolve()
    job = load_json(job_path)
    lock = load_json(LOCK_PATH)
    source, output, record = validate_job(job, job_path)
    start_index = STAGES.index(args.from_stage)
    stop_index = STAGES.index(args.to_stage)
    if stop_index < start_index:
        raise SystemExit(f"--to-stage는 --from-stage 이후여야 합니다: {args.from_stage} -> {args.to_stage}")

    if args.check_config:
        print(f"OK: {job['event']} -> {output.relative_to(PROJECT_ROOT)}")
        return 0

    for command in ("conda", "git", "nvidia-smi"):
        require_command(command)
    run(conda("360VG", "ffmpeg", "-version"))
    run(conda("360VG", "ffprobe", "-version"))

    source_probe = probe(source)
    work = PROJECT_ROOT / "gpu360" / "work" / job["event"]
    prepared_dir = work / "prepared"
    prepared_source = prepared_dir / "fixed-view.mp4"
    preparation_report = prepared_dir / "preparation.json"
    raw_dir = work / "argus"
    enhanced_dir = work / "enhanced"
    work_candidate = work / "final" / output.name
    final_candidate = output if args.from_stage == "validate" and output.is_file() else work_candidate
    for folder in (prepared_dir, raw_dir, enhanced_dir, final_candidate.parent):
        folder.mkdir(parents=True, exist_ok=True)

    if start_index < STAGES.index("validate") and output.exists() and not args.force:
        raise SystemExit(f"최종 출력이 이미 있습니다. 덮어쓰려면 --force를 사용하세요: {output}")
    if args.force and start_index <= STAGES.index("compose") and work_candidate.exists():
        work_candidate.unlink()

    checkpoint_id = args.checkpoint_id
    if checkpoint_id is None and args.unet is not None:
        checkpoint_id = args.unet.name
    if checkpoint_id is None and record.is_file():
        checkpoint_id = load_json(record).get("model", {}).get("checkpoint")
    if not checkpoint_id:
        raise SystemExit("--checkpoint-id 또는 ARGUS_CHECKPOINT_ID를 지정하세요.")

    if start_index < STAGES.index("validate"):
        if not args.argus_dir.is_dir():
            raise SystemExit(f"Argus가 준비되지 않았습니다: {args.argus_dir}")
        current_commit = capture(["git", "rev-parse", "HEAD"], cwd=args.argus_dir)
        if current_commit != lock["commit"]:
            raise SystemExit(f"Argus 커밋이 lock과 다릅니다: {current_commit}")
        if start_index <= STAGES.index("infer") and (
            args.unet is None or not args.unet.exists()
        ):
            raise SystemExit("--unet 또는 ARGUS_UNET_PATH로 Argus 체크포인트를 지정하세요.")
        run(["nvidia-smi"])
        run(conda("360VG", "python", "-c", "import torch; assert torch.cuda.is_available()"))
        if start_index <= STAGES.index("enhance"):
            run(conda("venhancer", "python", "-c", "import torch; assert torch.cuda.is_available()"))

    input_config = job["input"]
    view = job["view"]
    generation = job["generation"]
    enhancement = job["enhancement"]
    composite = job["composite"]

    if start_index <= STAGES.index("prepare"):
        prepare_command = conda(
            "360VG", "python", str(Path(__file__).with_name("prepare_source.py")),
            "--source", str(source),
            "--output", str(prepared_source),
            "--report", str(preparation_report),
            "--anchor-seconds", str(view["anchor_frame_seconds"]),
            "--minimum-valid-area-ratio", str(input_config["minimum_valid_area_ratio"]),
            "--maximum-tracking-failure-ratio", str(input_config["maximum_tracking_failure_ratio"]),
        )
        stabilize_zoom = bool(input_config.get("stabilize_zoom", True))
        stabilize_rotation = bool(input_config.get("stabilize_rotation", True))
        if not stabilize_zoom and not stabilize_rotation:
            prepare_command.append("--skip-stabilization")
        elif stabilize_zoom != stabilize_rotation:
            raise SystemExit("줌과 회전 안정화는 현재 함께 켜거나 꺼야 합니다.")
        tracking_exclude_rect = input_config.get("tracking_exclude_rect")
        if tracking_exclude_rect:
            prepare_command.extend([
                "--tracking-exclude-rect",
                ",".join(str(value) for value in tracking_exclude_rect),
            ])
        if args.force:
            prepare_command.append("--force")
        run(prepare_command)
    if not prepared_source.is_file() or not preparation_report.is_file():
        raise SystemExit("prepare 산출물이 없습니다. --from-stage prepare부터 실행하세요.")
    prepared_probe = probe(prepared_source)
    preparation = load_json(preparation_report)

    if stop_index <= STAGES.index("prepare"):
        print(f"{args.to_stage} 단계까지 완료했습니다: {prepared_source}")
        return 0

    if start_index <= STAGES.index("infer"):
        command = conda(
            "360VG", "accelerate", "launch", "--num_processes", "1", "inference.py",
            "--val_base_folder", str(prepared_source),
            "--val_save_folder", str(raw_dir),
            "--unet_path", str(args.unet.resolve()),  # type: ignore[union-attr]
            "--pretrained_model_name_or_path", "stabilityai/stable-video-diffusion-img2vid",
            "--decode_chunk_size", "10",
            "--noise_aug_strength", "0.02",
            "--guidance_scale", str(generation["guidance_scale"]),
            "--height", str(generation["height"]),
            "--width", str(generation["width"]),
            "--fixed_start_frame",
            "--full_sampling",
            "--num_frames", str(prepared_probe["frames"]),
            "--num_frames_batch", str(generation["batch_frames"]),
            "--blend_frames", str(generation["blend_frames"]),
            "--num_inference_steps", str(generation["inference_steps"]),
            "--fixed_fov", str(input_config["fixed_fov_deg"]),
            "--inference_final_rotation", "0",
            "--extended_decoding",
            "--blend_decoding_ratio", "16",
        )
        if generation.get("reset_batch_conditioning", False):
            command.append("--reset_batch_conditioning")
        run(command, cwd=args.argus_dir)

    if stop_index <= STAGES.index("infer"):
        print(f"{args.to_stage} 단계까지 완료했습니다: {work}")
        return 0

    if start_index < STAGES.index("validate"):
        raw_video = discover_one(raw_dir, f"{prepared_source.stem}_output_fov*_hw*.mp4", "Argus 출력")
        camera_metadata = raw_dir / f"{prepared_source.stem}_camera.json"
        if not camera_metadata.is_file():
            raise SystemExit(f"카메라 메타데이터가 없습니다: {camera_metadata}")

        frozen_image = composite.get("frozen_panorama_image")
        if start_index <= STAGES.index("enhance") and enhancement["enabled"] and frozen_image is None:
            target_fps = max(1, round(prepared_probe["fps_float"]))
            run(
                conda(
                    "venhancer", "python", "enhance_a_video.py",
                    "--version", "v2",
                    "--up_scale", str(enhancement["scale"]),
                    "--target_fps", str(target_fps),
                    "--noise_aug", str(enhancement["noise_augmentation"]),
                    "--solver_mode", str(enhancement.get("solver_mode", "fast")),
                    "--steps", str(enhancement.get("steps", 15)),
                    "--input_path", str(raw_video),
                    "--prompt_path",
                    "A clear, high-resolution 360-degree panorama. Sharp details, natural colors, and seamless stitching throughout the entire view.",
                    "--save_dir", str(enhanced_dir),
                ),
                cwd=args.argus_dir / "venhancer",
                env_updates={
                    "FFMPEG_PATH": capture(conda("360VG", "python", "-c", "import shutil; print(shutil.which('ffmpeg') or '')")),
                    "VENHANCER_MAX_PIXELS": str(enhancement["width"] * enhancement["height"]),
                },
            )

        if frozen_image is not None:
            # The Argus panorama is discarded here; only its camera calibration is reused.
            generated_video = wrap_panorama_image(resolve_project_path(frozen_image), enhanced_dir)
        else:
            generated_video = (
                enhanced_dir / f"{raw_video.stem}_enhanced.mp4"
                if enhancement["enabled"]
                else raw_video
            )
        if not generated_video.is_file():
            raise SystemExit(f"향상 영상이 없습니다: {generated_video}")

        if stop_index <= STAGES.index("enhance"):
            print(f"{args.to_stage} 단계까지 완료했습니다: {generated_video}")
            return 0

        audio_config = job.get("audio", {})
        audio_source = source
        if audio_config.get("mode") == "synthesized":
            audio_source = resolve_project_path(audio_config["file"])
            if start_index <= STAGES.index("compose"):
                # 베드 길이는 사양이 아니라 실제 합성 타임라인을 따라야 합니다.
                run(conda(
                    "360VG", "python", str(Path(__file__).with_name("make_audio_bed.py")),
                    "--spec", str(resolve_project_path(audio_config["spec"])),
                    "--output", str(audio_source),
                    "--duration", f"{prepared_probe['duration_seconds']:.3f}",
                    "--target-lufs", str(audio_config.get("target_lufs", -18.0)),
                    "--true-peak-db", str(audio_config.get("true_peak_db", -1.0)),
                    "--force",
                ))
            elif not audio_source.is_file():
                raise SystemExit(f"사운드 베드가 없습니다: {audio_config['file']}")

        if start_index <= STAGES.index("compose"):
            compose_command = conda(
                "360VG", "python", str(Path(__file__).with_name("composite_recorded_front.py")),
                "--argus-dir", str(args.argus_dir.resolve()),
                "--generated", str(generated_video),
                "--source", str(prepared_source),
                "--audio-source", str(audio_source),
                "--camera-metadata", str(camera_metadata),
                "--output", str(final_candidate),
                "--fps", prepared_probe["fps"],
                "--width", str(composite.get("output_width", enhancement["width"])),
                "--height", str(composite.get("output_height", enhancement["height"])),
                "--edge-feather", str(composite["edge_feather"]),
                "--source-mask-inset", str(composite.get("source_mask_inset", 0)),
                "--seam-blend", str(composite["seam_blend"]),
                "--device", args.device,
            )
            if composite.get("freeze_generated_surroundings", False) or frozen_image is not None:
                compose_command.append("--freeze-generated-surroundings")
                freeze_seconds = composite.get("freeze_frame_seconds")
                if freeze_seconds is not None and frozen_image is None:
                    compose_command.extend(["--freeze-frame-seconds", str(freeze_seconds)])
            stabilize_after = composite.get("stabilize_generated_color_after")
            if stabilize_after is not None:
                compose_command.extend([
                    "--stabilize-generated-color-after", str(stabilize_after),
                    "--color-stabilization-strength",
                    str(composite.get("color_stabilization_strength", 1.0)),
                    "--color-stabilization-transition",
                    str(composite.get("color_stabilization_transition", 1.0)),
                ])
            if args.force:
                compose_command.append("--force")
            run(compose_command)

        if stop_index <= STAGES.index("compose"):
            print(f"{args.to_stage} 단계까지 완료했습니다: {final_candidate}")
            return 0

    if not final_candidate.is_file():
        raise SystemExit(f"최종 후보 영상이 없습니다: {final_candidate}")
    run(conda(
        "360VG", "python",
        str(PROJECT_ROOT / "scripts" / "validate_panorama_video.py"),
        str(final_candidate), "--source", str(source),
        "--expected-width", str(composite.get("output_width", enhancement["width"])),
        "--expected-height", str(composite.get("output_height", enhancement["height"])),
    ))

    if final_candidate.resolve() != output.resolve():
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_candidate, output)
    write_run_record(
        record,
        job=job,
        source_probe=source_probe,
        prepared_probe=prepared_probe,
        preparation=preparation,
        lock=lock,
        checkpoint_id=checkpoint_id,
        output=output,
    )
    update_event_metadata(job)
    print(f"완료: {output.relative_to(PROJECT_ROOT)}")
    print(f"생성 기록: {record.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
