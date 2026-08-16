#!/usr/bin/env python3
"""Copy one event folder into the frontend and emit a VR-ready manifest.

Source events live outside the frontend's static root, so the browser cannot
fetch them directly. This script copies the usable assets into
`frontend/public/events/<persona>/<event_id>/` and writes a single
`vr-event.json` that the VR page reads.

Along the way it resolves two problems at export time rather than at runtime:
empty placeholder files are dropped, and asset references that do not match the
files actually on disk are matched by basename or skipped with a warning.

Usage:
    python scripts/export_event_assets.py --persona caregiver --event event_001
    python scripts/export_event_assets.py --persona caregiver --event event_001 \
        --events-dir events --output-dir frontend/public/events
"""
import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
VIDEO_SUFFIXES = {".mp4", ".webm", ".mov"}


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def is_usable(path: Path) -> bool:
    """Placeholder files are committed at zero bytes; they are not assets."""
    return path.is_file() and path.stat().st_size > 0


def media_kind(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return "image"
    if suffix in VIDEO_SUFFIXES:
        return "video"
    return None


def resolve_reference(reference: str, event_dir: Path) -> Path | None:
    """Find the file a manifest entry means.

    Legacy events reference names that drifted from the files on disk
    (``hospital.jpg`` for ``images/waiting_room.jpg``), so fall back to matching
    by basename and finally to the sole file of the same media kind.
    """
    direct = event_dir / reference
    if direct.is_file():
        return direct

    name = Path(reference).name
    matches = [path for path in event_dir.rglob("*") if path.is_file() and path.name == name]
    if matches:
        return matches[0]

    kind = media_kind(Path(reference))
    if kind:
        same_kind = [
            path for path in sorted(event_dir.rglob("*"))
            if path.is_file() and media_kind(path) == kind
        ]
        if len(same_kind) == 1:
            return same_kind[0]
    return None


def collect_references(metadata: dict, event_dir: Path) -> list[tuple[str, str | None]]:
    """Return (reference, taken_at) pairs, preferring metadata over reasoning.json."""
    assets = metadata.get("assets")
    if assets:
        return [(entry["file"], entry.get("taken_at")) for entry in assets if entry.get("file")]

    reasoning_path = event_dir / "reasoning.json"
    if not reasoning_path.exists():
        return []

    reasoning = json.loads(reasoning_path.read_text(encoding="utf-8"))
    references: list[tuple[str, str | None]] = []
    for key in ("selected_images", "selected_videos"):
        references.extend((reference, None) for reference in reasoning.get(key, []))
    return references


def build_media(metadata: dict, event_dir: Path, target_dir: Path) -> list[dict]:
    start = parse_time(metadata.get("start_time"))
    end = parse_time(metadata.get("end_time"))
    span = (end - start).total_seconds() if start and end else 0

    media: list[dict] = []
    for reference, taken_at in collect_references(metadata, event_dir):
        source = resolve_reference(reference, event_dir)
        if source is None:
            print(f"  ! 참조를 찾을 수 없어 제외: {reference}")
            continue
        if not is_usable(source):
            print(f"  ! 빈 파일이라 제외: {source.relative_to(event_dir)}")
            continue

        kind = media_kind(source)
        if kind is None:
            print(f"  ! 미디어 형식이 아니라 제외: {source.relative_to(event_dir)}")
            continue

        relative = source.relative_to(event_dir)
        destination = target_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

        # 사이드카 산출물을 함께 나른다.
        #   .depth.png — estimate_depth.py. 패널을 기복 있는 메시로 만든다.
        #   .fill.png  — inpaint_disocclusion.py. 부조가 찢어진 자리를 받친다.
        def sidecar(suffix: str) -> Path | None:
            if kind != "image":
                return None
            candidate = source.parent / f"{source.name}{suffix}"
            if not is_usable(candidate):
                return None
            relative_path = candidate.relative_to(event_dir)
            shutil.copy2(candidate, target_dir / relative_path)
            return relative_path

        depth_relative = sidecar(".depth.png")
        fill_relative = sidecar(".fill.png")

        # Pre-compute the timeline position so the frontend never re-parses dates.
        at = None
        moment = parse_time(taken_at)
        if moment and start and span > 0:
            at = min(1.0, max(0.0, (moment - start).total_seconds() / span))

        media.append({
            "kind": kind,
            "src": relative.as_posix(),
            "at": round(at, 4) if at is not None else None,
            "depth": depth_relative.as_posix() if depth_relative else None,
            "fill": fill_relative.as_posix() if fill_relative else None,
        })

    # Assets without a timestamp fall back to an even spread over the timeline.
    untimed = [entry for entry in media if entry["at"] is None]
    if untimed:
        step = 1 / (len(untimed) + 1)
        for index, entry in enumerate(untimed, start=1):
            entry["at"] = round(index * step, 4)

    media.sort(key=lambda entry: entry["at"])
    return media


def read_chats(event_dir: Path) -> list[str]:
    lines: list[str] = []
    for path in sorted((event_dir / "chats").glob("*.txt")) if (event_dir / "chats").is_dir() else []:
        lines.extend(
            stripped for line in path.read_text(encoding="utf-8").splitlines()
            if (stripped := line.strip())
        )
    return lines


def export_panorama(metadata: dict, event_dir: Path, target_dir: Path) -> dict | None:
    """Copy an optional equirectangular environment and preserve its provenance."""
    entry = metadata.get("panorama")
    if not isinstance(entry, dict) or not entry.get("file"):
        return None

    source = event_dir / entry["file"]
    if not is_usable(source):
        print(f"  ! 파노라마를 찾을 수 없어 제외: {entry['file']}")
        return None

    relative = source.relative_to(event_dir)
    destination = target_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

    depth_value = entry.get("depth")
    depth_source = (
        event_dir / depth_value
        if depth_value
        else source.with_suffix(f"{source.suffix}.depth.png")
    )
    depth_relative = None
    if is_usable(depth_source):
        depth_relative = depth_source.relative_to(event_dir)
        depth_destination = target_dir / depth_relative
        depth_destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(depth_source, depth_destination)

    return {
        "src": relative.as_posix(),
        "depth": depth_relative.as_posix() if depth_relative else None,
        "generated": bool(entry.get("generated", False)),
        "mode": str(entry.get("mode", "scenario_hypothesis")),
        "anchor_yaw_deg": float(entry.get("anchor_yaw_deg", 0)),
        "source_note": str(entry.get("source_note", "")),
    }


def export_panorama_video(metadata: dict, event_dir: Path, target_dir: Path) -> dict | None:
    """Export an optional mono equirectangular video descriptor and assets.

    The descriptor is preserved even while an external GPU job is pending. This
    makes a missing generated deliverable visible to the browser's retry flow
    instead of silently falling back to the original flat video.
    """
    entry = metadata.get("panorama_video")
    if not isinstance(entry, dict) or not entry.get("file"):
        return None

    relative = Path(entry["file"])
    source = event_dir / relative
    if is_usable(source):
        destination = target_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    else:
        print(f"  ! 360 video deliverable is missing: {entry['file']}")

    fallback_relative = None
    fallback_value = entry.get("fallback_image_file")
    if fallback_value:
        fallback_source = event_dir / fallback_value
        if is_usable(fallback_source):
            fallback_relative = fallback_source.relative_to(event_dir)
            fallback_destination = target_dir / fallback_relative
            fallback_destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fallback_source, fallback_destination)
        else:
            print(f"  ! panorama video fallback is missing: {fallback_value}")

    projection = str(entry.get("projection", "equirectangular"))
    if projection != "equirectangular":
        raise ValueError(f"Unsupported panorama video projection: {projection}")

    return {
        "src": relative.as_posix(),
        "projection": projection,
        "fallback_image": fallback_relative.as_posix() if fallback_relative else None,
        "yaw_offset_deg": float(entry.get("yaw_offset_deg", 0)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--persona", required=True, help="페르소나 식별자 (예: caregiver)")
    parser.add_argument("--event", required=True, help="이벤트 폴더 이름 (예: event_001)")
    parser.add_argument("--events-dir", default=Path("events"), type=Path)
    parser.add_argument("--output-dir", default=Path("frontend/public/events"), type=Path)
    args = parser.parse_args()

    event_dir = args.events_dir / args.persona / args.event
    if not event_dir.is_dir():
        parser.error(f"이벤트 폴더를 찾을 수 없습니다: {event_dir}")

    metadata_path = event_dir / "metadata.json"
    if not metadata_path.exists():
        parser.error(f"metadata.json이 없습니다: {metadata_path}")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    # 폴더를 통째로 지웠다 다시 만들지 않는다. vite 개발 서버가 이 경로를 서빙하는
    # 동안 Windows에서 rmtree가 실패하고, 폴더가 삭제 대기 상태로 잠겨버린다.
    # 대신 제자리에 덮어쓰고 남은 파일만 나중에 정리한다.
    target_dir = args.output_dir / args.persona / args.event
    target_dir.mkdir(parents=True, exist_ok=True)
    before = {path for path in target_dir.rglob("*") if path.is_file()}

    print(f"{event_dir} -> {target_dir}")
    media = build_media(metadata, event_dir, target_dir)
    panorama = export_panorama(metadata, event_dir, target_dir)
    panorama_video = export_panorama_video(metadata, event_dir, target_dir)

    start = parse_time(metadata.get("start_time"))
    end = parse_time(metadata.get("end_time"))
    duration_min = round((end - start).total_seconds() / 60, 2) if start and end else 0

    sensor_path = event_dir / "sensor.json"
    payload = {
        "event_id": metadata.get("event_id", args.event),
        "persona": metadata.get("persona", args.persona),
        "title": metadata.get("title", args.event),
        "description": metadata.get("description", ""),
        "emotion": metadata.get("emotion", ""),
        "vr_scene": metadata.get("vr_scene", ""),
        "start_time": metadata.get("start_time"),
        "end_time": metadata.get("end_time"),
        "duration_min": duration_min,
        "panorama": panorama,
        "panorama_video": panorama_video,
        "media": media,
        "chats": read_chats(event_dir),
        "sensor": json.loads(sensor_path.read_text(encoding="utf-8")) if sensor_path.exists() else {},
    }
    if metadata.get("experience"):
        payload["experience"] = metadata["experience"]
    if metadata.get("data_provenance"):
        payload["data_provenance"] = metadata["data_provenance"]

    output = target_dir / "vr-event.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # 이번에 쓰지 않은 지난 산출물만 걷어낸다. 잠겨 있으면 경고만 남기고 넘어간다.
    written = {output}
    if panorama:
        written.add(target_dir / panorama["src"])
        if panorama["depth"]:
            written.add(target_dir / panorama["depth"])
    if panorama_video:
        written.add(target_dir / panorama_video["src"])
        if panorama_video["fallback_image"]:
            written.add(target_dir / panorama_video["fallback_image"])
    for entry in media:
        written.add(target_dir / entry["src"])
        for sidecar_path in (entry["depth"], entry["fill"]):
            if sidecar_path:
                written.add(target_dir / sidecar_path)

    for stale in before - written:
        try:
            stale.unlink()
        except OSError:
            print(f"  ! 지난 파일을 지우지 못했습니다 (사용 중일 수 있음): {stale.name}")

    images = sum(1 for entry in media if entry["kind"] == "image")
    videos = sum(1 for entry in media if entry["kind"] == "video")
    print(f"  이미지 {images}개 · 영상 {videos}개 · 채팅 {len(payload['chats'])}줄 -> {output}")


if __name__ == "__main__":
    main()
