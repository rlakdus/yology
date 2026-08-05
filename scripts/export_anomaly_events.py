#!/usr/bin/env python3
"""Export one person's anomaly episode CSVs to a frontend-ready JSON file.

Usage:
    python scripts/export_anomaly_events.py --person he
    python scripts/export_anomaly_events.py --person he --input-dir data/output \
        --output frontend/public/data/he-anomaly-episodes.json
"""
import argparse
import csv
import json
from pathlib import Path


NUMBER_FIELDS = {
    "duration_min", "n_samples", "peak_hr", "expected_hr", "excess_bpm",
    "steps_5m", "hrv_ms", "hrr_slope", "peak_z", "score",
}


def as_number(value: str | None):
    if value is None or not value.strip():
        return None
    number = float(value)
    return int(number) if number.is_integer() else round(number, 2)


def read_episodes(path: Path, person_id: str) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    episodes = []
    for row in rows:
        episode = {
            key: as_number(value) if key in NUMBER_FIELDS else value
            for key, value in row.items()
        }
        episodes.append(episode)

    episodes.sort(key=lambda episode: episode.get("score") or float("-inf"), reverse=True)
    for rank, episode in enumerate(episodes, start=1):
        episode["id"] = f"{person_id}-{rank}"
        episode["rank"] = rank
    return episodes


def count_low_condition_days(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open(encoding="utf-8-sig", newline="") as source:
        return sum(
            row.get("low_condition", "").strip().lower() == "true"
            for row in csv.DictReader(source)
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--person", required=True,
                        help="웹 페르소나에 연결할 사람 식별자 (예: he)")
    parser.add_argument("--input-dir", default="data/output", type=Path)
    parser.add_argument("--output", type=Path,
                        help="웹용 JSON 경로 (기본값: frontend/public/data/<person>-anomaly-episodes.json)")
    args = parser.parse_args()

    suffix = "_feelback_residual_episodes.csv"
    person_id = args.person.lower()
    prefix = f"export_{person_id}"
    episode_path = args.input_dir / f"{prefix}{suffix}"
    if not episode_path.exists():
        parser.error(f"탐지 결과 파일을 찾을 수 없습니다: {episode_path}")

    daily_path = args.input_dir / f"{prefix}_feelback_daily_condition.csv"
    episodes = read_episodes(episode_path, person_id)
    person = {
        "id": person_id,
        "label": person_id.upper(),
        "episode_count": len(episodes),
        "low_condition_days": count_low_condition_days(daily_path),
        "episodes": episodes,
    }

    payload = {
        "description": "Feelback anomaly candidates exported from residual-model CSV outputs.",
        "person": person,
    }
    output = args.output or Path("frontend/public/data") / f"{person_id}-anomaly-episodes.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(episodes)} episodes for {person_id.upper()} -> {output}")


if __name__ == "__main__":
    main()
