#!/usr/bin/env python3
"""Run the remaining student panorama jobs on dedicated visible GPUs."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PIPELINE = Path(__file__).with_name("run_pipeline.py")
DEFAULT_ASSIGNMENTS = (
    ("event_002", 0),
    ("event_001", 1),
    ("event_004", 2),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--argus-dir",
        type=Path,
        default=PROJECT_ROOT / ".gpu360" / "argus-code",
    )
    parser.add_argument(
        "--unet",
        type=Path,
        default=PROJECT_ROOT / ".gpu360" / "checkpoints" / "argus",
    )
    parser.add_argument(
        "--checkpoint-id",
        default=os.getenv("ARGUS_CHECKPOINT_ID", "official-argus-unet"),
    )
    parser.add_argument(
        "--from-stage",
        choices=("prepare", "infer", "enhance", "compose", "validate"),
        default="prepare",
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-config", action="store_true")
    parser.add_argument("--skip-export", action="store_true")
    parser.add_argument(
        "--assignment",
        action="append",
        default=[],
        metavar="EVENT=GPU",
        help="대상 이벤트와 물리 GPU 번호. 생략하면 event_002=0, event_001=1, event_004=2",
    )
    return parser.parse_args()


def parse_assignments(values: list[str]) -> tuple[tuple[str, int], ...]:
    if not values:
        return DEFAULT_ASSIGNMENTS
    assignments: list[tuple[str, int]] = []
    for value in values:
        event_id, separator, gpu_text = value.partition("=")
        if not separator or not event_id or not gpu_text.isdigit():
            raise SystemExit(f"잘못된 --assignment 값입니다: {value} (예: event_002=0)")
        gpu_index = int(gpu_text)
        job_path = PROJECT_ROOT / "gpu360" / "jobs" / "student" / f"{event_id}.json"
        if not job_path.is_file():
            raise SystemExit(f"이벤트 작업 설정이 없습니다: {job_path}")
        assignments.append((event_id, gpu_index))
    events = [event_id for event_id, _ in assignments]
    gpus = [gpu for _, gpu in assignments]
    if len(events) != len(set(events)):
        raise SystemExit("--assignment에 중복 이벤트가 있습니다.")
    if len(gpus) != len(set(gpus)):
        raise SystemExit("--assignment에 중복 GPU가 있습니다.")
    return tuple(assignments)


def pipeline_command(event_id: str, gpu_index: int, args: argparse.Namespace) -> list[str]:
    command = [
        sys.executable,
        str(PIPELINE),
        "--job",
        str(PROJECT_ROOT / "gpu360" / "jobs" / "student" / f"{event_id}.json"),
        "--argus-dir",
        str(args.argus_dir),
        "--unet",
        str(args.unet),
        "--checkpoint-id",
        args.checkpoint_id,
        "--from-stage",
        args.from_stage,
        "--device",
        "cuda:0",
    ]
    if args.force:
        command.append("--force")
    if args.check_config:
        command.append("--check-config")
    return command


def visible_gpu_count() -> int:
    result = subprocess.run(
        [
            "nvidia-smi",
            "--query-gpu=index",
            "--format=csv,noheader,nounits",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return len([line for line in result.stdout.splitlines() if line.strip()])


def main() -> int:
    args = parse_args()
    assignments = parse_assignments(args.assignment)

    if args.check_config:
        for event_id, gpu_index in assignments:
            subprocess.run(
                pipeline_command(event_id, gpu_index, args),
                cwd=PROJECT_ROOT,
                check=True,
            )
            print(f"{event_id} -> physical GPU {gpu_index}")
        return 0

    required_gpu_count = max(gpu for _, gpu in assignments) + 1
    available_gpu_count = visible_gpu_count()
    if available_gpu_count < required_gpu_count:
        raise SystemExit(
            f"GPU가 {available_gpu_count}개만 보입니다. "
            f"이 실행에는 최소 {required_gpu_count}개가 필요합니다."
        )
    if not args.argus_dir.is_dir():
        raise SystemExit(f"Argus 디렉터리가 없습니다: {args.argus_dir}")
    if not args.unet.exists():
        raise SystemExit(f"Argus 체크포인트가 없습니다: {args.unet}")

    started_at = datetime.now(timezone.utc)
    run_id = started_at.strftime("%Y%m%dT%H%M%SZ")
    log_dir = PROJECT_ROOT / ".gpu360" / "logs" / f"parallel-{run_id}"
    log_dir.mkdir(parents=True, exist_ok=False)
    processes: dict[str, tuple[int, subprocess.Popen[bytes], object]] = {}

    for event_id, gpu_index in assignments:
        log_path = log_dir / f"{event_id}.log"
        log_stream = log_path.open("wb")
        env = os.environ.copy()
        env["CUDA_VISIBLE_DEVICES"] = str(gpu_index)
        env["PYTHONUNBUFFERED"] = "1"
        process = subprocess.Popen(
            pipeline_command(event_id, gpu_index, args),
            cwd=PROJECT_ROOT,
            env=env,
            stdout=log_stream,
            stderr=subprocess.STDOUT,
        )
        processes[event_id] = (gpu_index, process, log_stream)
        print(f"시작: {event_id} -> GPU {gpu_index} · 로그 {log_path}", flush=True)

    pending = set(processes)
    results: dict[str, dict[str, int | str]] = {}
    while pending:
        for event_id in list(pending):
            gpu_index, process, log_stream = processes[event_id]
            return_code = process.poll()
            if return_code is None:
                continue
            log_stream.close()  # type: ignore[attr-defined]
            results[event_id] = {
                "gpu": gpu_index,
                "return_code": return_code,
                "status": "complete" if return_code == 0 else "failed",
            }
            pending.remove(event_id)
            print(f"종료: {event_id} -> {results[event_id]['status']}", flush=True)
        if pending:
            time.sleep(10)

    completed_at = datetime.now(timezone.utc)
    summary = {
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "elapsed_seconds": round((completed_at - started_at).total_seconds(), 3),
        "results": results,
    }
    (log_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    failed = [event_id for event_id, result in results.items() if result["return_code"]]
    if failed:
        print(f"실패한 이벤트: {', '.join(sorted(failed))}", file=sys.stderr)
        return 1

    if not args.skip_export:
        subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "scripts" / "export_all_event_assets.py")],
            cwd=PROJECT_ROOT,
            check=True,
        )
    print(f"모든 이벤트 완료 · 요약 {log_dir / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
