#!/usr/bin/env python3
"""Run the reproducible Argus -> VEnhancer -> recorded-front pipeline."""
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
STAGES = ("infer", "enhance", "compose", "validate")


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
    parser.add_argument("--from-stage", choices=STAGES, default="infer")
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-config", action="store_true")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"JSON을 읽을 수 없습니다: {path}: {exc}") from exc


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


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print(f"+ {shlex.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def capture(command: list[str], *, cwd: Path | None = None) -> str:
    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def conda(env: str, *command: str) -> list[str]:
    return ["conda", "run", "--no-capture-output", "-n", env, *command]


def probe(path: Path) -> dict[str, Any]:
    raw = capture([
        "ffprobe", "-v", "error",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,nb_frames",
        "-of", "json", str(path),
    ])
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


def validate_job(job: dict[str, Any], path: Path) -> tuple[Path, Path, Path]:
    required = (
        "event", "source", "expected_source_sha256", "output",
        "generation_record", "generation", "enhancement", "composite",
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
    enhancement = job["enhancement"]
    composite = job["composite"]
    if (generation.get("width"), generation.get("height")) != (1024, 512):
        raise SystemExit("Argus 생성 해상도는 현재 1024x512만 지원합니다.")
    if enhancement.get("enabled") and (
        enhancement.get("width"), enhancement.get("height")
    ) != (2048, 1024):
        raise SystemExit("향상 출력 해상도는 현재 2048x1024여야 합니다.")
    if not 0 <= float(composite.get("edge_feather", -1)) <= 0.25:
        raise SystemExit("edge_feather는 0~0.25 범위여야 합니다.")
    return source, output, record


def discover_one(folder: Path, pattern: str, label: str) -> Path:
    matches = sorted(path for path in folder.glob(pattern) if "_round" not in path.stem)
    if len(matches) != 1:
        listing = "\n".join(f"  - {path}" for path in matches) or "  (없음)"
        raise SystemExit(f"{label} 파일을 하나로 결정할 수 없습니다:\n{listing}")
    return matches[0]


def write_run_record(
    path: Path,
    *,
    job: dict[str, Any],
    source_probe: dict[str, Any],
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
        "generation": {
            **job["generation"],
            "full_sampling": True,
            "preserve_source_timeline": True,
            "generated_region": "outside_recorded_front_view",
        },
        "enhancement": job["enhancement"],
        "composite": job["composite"],
        "output": {
            "file": job["output"],
            "sha256": sha256(output),
            "width": job["enhancement"]["width"],
            "height": job["enhancement"]["height"],
            "video_codec": "h264",
            "pixel_format": "yuv420p",
            "audio": "original_aac",
            "faststart": True,
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    job_path = args.job.resolve()
    job = load_json(job_path)
    lock = load_json(LOCK_PATH)
    source, output, record = validate_job(job, job_path)
    start_index = STAGES.index(args.from_stage)

    if args.check_config:
        print(f"OK: {job['event']} -> {output.relative_to(PROJECT_ROOT)}")
        return 0

    require_command("ffprobe")
    source_probe = probe(source)
    work = PROJECT_ROOT / "gpu360" / "work" / job["event"].replace("/", "-")
    raw_dir = work / "argus"
    enhanced_dir = work / "enhanced"
    work_candidate = work / "final" / output.name
    final_candidate = output if args.from_stage == "validate" and output.is_file() else work_candidate
    for folder in (raw_dir, enhanced_dir, final_candidate.parent):
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
        for command in ("conda", "ffmpeg", "git", "nvidia-smi"):
            require_command(command)
        if not args.argus_dir.is_dir():
            raise SystemExit(
                f"Argus가 준비되지 않았습니다: {args.argus_dir}\n"
                "먼저 bash scripts/gpu360/bootstrap_argus.sh를 실행하세요."
            )
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

    generation = job["generation"]
    enhancement = job["enhancement"]
    composite = job["composite"]

    if start_index <= STAGES.index("infer"):
        command = conda(
            "360VG", "accelerate", "launch", "--num_processes", "1", "inference.py",
            "--val_base_folder", str(source),
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
            "--num_frames", str(source_probe["frames"]),
            "--num_frames_batch", str(generation["batch_frames"]),
            "--blend_frames", str(generation["blend_frames"]),
            "--num_inference_steps", str(generation["inference_steps"]),
            "--inference_final_rotation", "0",
            "--rotation_during_inference",
            "--extended_decoding",
            "--predict_camera_motion",
            "--blend_decoding_ratio", "16",
            "--calibration_cache_path", str(work / "calibration"),
        )
        run(command, cwd=args.argus_dir)

    if start_index < STAGES.index("validate"):
        raw_video = discover_one(raw_dir, f"{source.stem}_output_fov*_hw*.mp4", "Argus 출력")
        camera_metadata = raw_dir / f"{source.stem}_camera.json"
        if not camera_metadata.is_file():
            raise SystemExit(f"카메라 메타데이터가 없습니다: {camera_metadata}")

        if start_index <= STAGES.index("enhance") and enhancement["enabled"]:
            target_fps = max(1, round(source_probe["fps_float"]))
            run(
                conda(
                    "venhancer", "python", "enhance_a_video.py",
                    "--version", "v2",
                    "--up_scale", str(enhancement["scale"]),
                    "--target_fps", str(target_fps),
                    "--noise_aug", str(enhancement["noise_augmentation"]),
                    "--solver_mode", "fast", "--steps", "15",
                    "--input_path", str(raw_video),
                    "--prompt_path",
                    "A clear, high-resolution 360-degree panorama. Sharp details, natural colors, and seamless stitching throughout the entire view.",
                    "--save_dir", str(enhanced_dir),
                ),
                cwd=args.argus_dir / "venhancer",
            )

        generated_video = (
            enhanced_dir / f"{raw_video.stem}_enhanced.mp4"
            if enhancement["enabled"]
            else raw_video
        )
        if not generated_video.is_file():
            raise SystemExit(f"향상 영상이 없습니다: {generated_video}")

        if start_index <= STAGES.index("compose"):
            compose_command = conda(
                "360VG", "python", str(Path(__file__).with_name("composite_recorded_front.py")),
                "--argus-dir", str(args.argus_dir.resolve()),
                "--generated", str(generated_video),
                "--source", str(source),
                "--camera-metadata", str(camera_metadata),
                "--output", str(final_candidate),
                "--fps", source_probe["fps"],
                "--width", str(enhancement["width"]),
                "--height", str(enhancement["height"]),
                "--edge-feather", str(composite["edge_feather"]),
                "--seam-blend", str(composite["seam_blend"]),
                "--device", args.device,
            )
            if args.force:
                compose_command.append("--force")
            run(compose_command)

    if not final_candidate.is_file():
        raise SystemExit(f"최종 후보 영상이 없습니다: {final_candidate}")
    run([
        sys.executable,
        str(PROJECT_ROOT / "scripts" / "validate_panorama_video.py"),
        str(final_candidate), "--source", str(source),
    ])

    if final_candidate.resolve() != output.resolve():
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_candidate, output)
    write_run_record(
        record,
        job=job,
        source_probe=source_probe,
        lock=lock,
        checkpoint_id=checkpoint_id,
        output=output,
    )
    print(f"완료: {output.relative_to(PROJECT_ROOT)}")
    print(f"생성 기록: {record.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
