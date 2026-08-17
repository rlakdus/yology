#!/usr/bin/env python3
"""Export the frontend event catalog and every VR event asset bundle."""

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
EVENTS_DIR = ROOT / "events"
EXPORTER = ROOT / "scripts" / "export_event_assets.py"
CATALOG_EXPORTER = ROOT / "scripts" / "export_event_catalog.py"
STUDENT_VALIDATOR = ROOT / "scripts" / "validate_student_events.py"


def main() -> None:
    subprocess.run([sys.executable, str(CATALOG_EXPORTER)], cwd=ROOT, check=True)
    metadata_files = sorted(EVENTS_DIR.glob("*/*/metadata.json"))
    if not metadata_files:
        raise SystemExit("No event metadata files were found.")

    for metadata_path in metadata_files:
        event_dir = metadata_path.parent
        persona = event_dir.parent.name
        event = event_dir.name
        subprocess.run(
            [
                sys.executable,
                str(EXPORTER),
                "--persona",
                persona,
                "--event",
                event,
            ],
            cwd=ROOT,
            check=True,
        )

    subprocess.run([sys.executable, str(STUDENT_VALIDATOR)], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
