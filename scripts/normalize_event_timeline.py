#!/usr/bin/env python3
"""Create UI-timeline anomaly and sensor artifacts from immutable source data."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def number(value: str) -> float | None:
    if not value.strip():
        return None
    parsed = float(value)
    return int(parsed) if parsed.is_integer() else round(parsed, 4)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event-dir", required=True, type=Path)
    args = parser.parse_args()

    event_dir = args.event_dir.resolve()
    metadata_path = event_dir / "metadata.json"
    metadata = read_json(metadata_path)
    mapping = metadata.get("source_mapping") or {}
    if mapping.get("status") != "ready":
        raise SystemExit(f"source_mapping is not ready: {event_dir}")

    anomaly_source = (ROOT / mapping["anomaly_file"]).resolve()
    sensor_source = (ROOT / mapping["sensor_file"]).resolve()
    for source in (anomaly_source, sensor_source):
        if not source.is_file():
            raise SystemExit(f"source file is missing: {source}")

    source_anomaly = read_json(anomaly_source)
    source_peak = parse_time(mapping["source_peak_at"])
    display_peak = parse_time(mapping["display_peak_at"])
    offset = display_peak - source_peak

    source_start = parse_time(source_anomaly["start"])
    source_end = parse_time(source_anomaly["end"])
    display_start = source_start + offset
    display_end = source_end + offset

    anomaly = {
        **{
            key: value
            for key, value in source_anomaly.items()
            if key not in {"start", "end", "source", "source_note"}
        },
        "event_id": metadata["event_id"],
        "start": iso(display_start),
        "end": iso(display_end),
        "peak_at": iso(display_peak),
        "time_basis": "ui_normalized",
    }

    with sensor_source.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    sensor: dict[str, Any] = {
        "heart_rate_source": "recorded",
        "time_basis": "ui_normalized",
        "timezone": metadata["display"]["timezone"],
    }
    metric_columns = {
        "heart_rate": ("heart_rate_timestamps", "heart_rate"),
        "hrv_sdnn": ("hrv_sdnn_timestamps", "hrv_sdnn"),
        "resp_rate": ("resp_rate_timestamps", "resp_rate"),
        "resting_hr": ("resting_hr_timestamps", "resting_hr"),
    }
    for column, (timestamp_key, value_key) in metric_columns.items():
        timestamps: list[str] = []
        values: list[float] = []
        for row in rows:
            value = number(row.get(column, ""))
            if value is None:
                continue
            timestamps.append(iso(parse_time(row["timestamp"]) + offset))
            values.append(value)
        if values:
            sensor[timestamp_key] = timestamps
            sensor[value_key] = values

    metadata["start_time"] = iso(display_start)
    metadata["end_time"] = iso(display_end)
    metadata["availability"]["anomaly_ready"] = True

    provenance = {
        "status": "ready",
        "event_id": metadata["event_id"],
        "source_person": mapping["person"],
        "anomaly_file": mapping["anomaly_file"],
        "anomaly_sha256": digest(anomaly_source),
        "sensor_file": mapping["sensor_file"],
        "sensor_sha256": digest(sensor_source),
        "source_window_start": source_anomaly["start"],
        "source_window_end": source_anomaly["end"],
        "source_peak_at": mapping["source_peak_at"],
        "display_window_start": iso(display_start),
        "display_window_end": iso(display_end),
        "display_peak_at": mapping["display_peak_at"],
        "timeline_offset_seconds": int(offset.total_seconds()),
        "values_modified": False,
        "exported_to_frontend": False,
    }

    write_json(metadata_path, metadata)
    write_json(event_dir / "anomaly.json", anomaly)
    write_json(event_dir / "sensor.json", sensor)
    write_json(event_dir / "provenance.json", provenance)
    print(
        f"{metadata['event_id']}: {source_peak.isoformat()} -> "
        f"{display_peak.isoformat()} ({int(offset.total_seconds()):+d}s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
