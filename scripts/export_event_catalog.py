#!/usr/bin/env python3
"""Export student event metadata as the single frontend catalog."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--events-dir", type=Path, default=ROOT / "events" / "student")
    parser.add_argument(
        "--public-output",
        type=Path,
        default=ROOT / "frontend" / "public" / "data" / "student-events.json",
    )
    parser.add_argument(
        "--source-output",
        type=Path,
        default=ROOT / "frontend" / "src" / "data" / "student-events.generated.json",
    )
    args = parser.parse_args()

    events: list[dict[str, Any]] = []
    for metadata_path in sorted(args.events_dir.glob("event_*/metadata.json")):
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        display = metadata.get("display") or {}
        availability = metadata.get("availability") or {}
        events.append({
            "id": metadata["slug"],
            "eventId": metadata["event_id"],
            "persona": metadata.get("persona", "student"),
            "title": metadata["title"],
            "subtitle": metadata.get("subtitle", ""),
            "description": metadata.get("description", ""),
            "location": metadata.get("location", ""),
            "icon": metadata.get("icon", "sparkles"),
            "month": display.get("month", ""),
            "peakAt": display.get("peak_at"),
            "time": (display.get("peak_at") or "")[11:16],
            "availability": availability,
            "available": bool(
                availability.get("source_video_ready")
                or availability.get("anomaly_ready")
            ),
        })

    payload = {
        "schema_version": 1,
        "timezone": "Asia/Seoul",
        "events": events,
    }
    encoded = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    for output in (args.public_output, args.source_output):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding="utf-8")
        print(f"Exported {len(events)} events -> {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
