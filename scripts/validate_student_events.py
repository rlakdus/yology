#!/usr/bin/env python3
"""Validate canonical student event, UI-time, anomaly, media, and catalog links."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / "events" / "student"
JOBS = ROOT / "gpu360" / "jobs" / "student"
CATALOGS = (
    ROOT / "frontend" / "public" / "data" / "student-events.json",
    ROOT / "frontend" / "src" / "data" / "student-events.generated.json",
)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def parse_ui_time(value: Any, label: str, errors: list[str]) -> datetime | None:
    if not isinstance(value, str):
        errors.append(f"{label}: ISO 8601 문자열이 아닙니다")
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        errors.append(f"{label}: 잘못된 ISO 8601 값 {value!r}")
        return None
    require(parsed.utcoffset() is not None, f"{label}: UTC 오프셋이 없습니다", errors)
    require(value.endswith("+09:00"), f"{label}: Asia/Seoul 오프셋(+09:00)이 아닙니다", errors)
    return parsed


def main() -> int:
    errors: list[str] = []
    metadata_files = sorted(EVENTS.glob("event_*/metadata.json"))
    require(bool(metadata_files), "학생 이벤트 메타데이터가 없습니다", errors)

    expected_catalog: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()

    for metadata_path in metadata_files:
        event_dir = metadata_path.parent
        metadata = read_json(metadata_path)
        event_id = metadata.get("event_id")
        slug = metadata.get("slug")
        label = f"{event_dir.name}/metadata.json"
        require(event_id == event_dir.name, f"{label}: event_id와 디렉터리가 다릅니다", errors)
        require(isinstance(slug, str) and bool(slug), f"{label}: slug가 없습니다", errors)
        require(event_id not in seen_ids, f"{label}: 중복 event_id {event_id}", errors)
        require(slug not in seen_slugs, f"{label}: 중복 slug {slug}", errors)
        seen_ids.add(event_id)
        seen_slugs.add(slug)

        display = metadata.get("display") or {}
        peak_at = display.get("peak_at")
        peak_time = parse_ui_time(peak_at, f"{label}.display.peak_at", errors)
        require(display.get("timezone") == "Asia/Seoul", f"{label}: timezone 불일치", errors)
        # UI 시각의 출처는 둘 중 하나여야 한다. ui_configured는 원본 시각을 옮겨 붙인
        # 것이고, source_actual은 원본 시각을 그대로 쓴 것이다. 어느 쪽이든 아래의
        # provenance 검사가 표시 시각을 원본까지 되짚을 수 있어야 통과한다.
        date_basis = display.get("date_basis")
        require(date_basis in ("ui_configured", "source_actual"), f"{label}: 알 수 없는 날짜 기준 {date_basis!r}", errors)
        require(display.get("month") == peak_at[:7].replace("-", "."), f"{label}: 표시 월과 peak_at이 다릅니다", errors)

        start = metadata.get("start_time")
        end = metadata.get("end_time")
        if start is not None or end is not None:
            start_time = parse_ui_time(start, f"{label}.start_time", errors)
            end_time = parse_ui_time(end, f"{label}.end_time", errors)
            if start_time and peak_time and end_time:
                require(start_time <= peak_time <= end_time, f"{label}: peak_at이 이벤트 구간 밖입니다", errors)

        availability = metadata.get("availability") or {}
        source_ready = bool(availability.get("source_video_ready"))
        anomaly_ready = bool(availability.get("anomaly_ready"))
        panorama_ready = bool(availability.get("panorama_ready"))
        vr_ready = bool(availability.get("vr_ready"))
        assets = metadata.get("assets") or []
        source_assets = [event_dir / item["file"] for item in assets if str(item.get("file", "")).startswith("source/")]
        require(source_ready == any(path.is_file() and path.stat().st_size > 0 for path in source_assets), f"{label}: source_video_ready와 원본 파일 상태가 다릅니다", errors)

        mapping = metadata.get("source_mapping")
        if mapping:
            require(mapping.get("display_peak_at") == peak_at, f"{label}: source_mapping의 UI peak 불일치", errors)
        provenance_path = event_dir / "provenance.json"
        if provenance_path.is_file():
            provenance = read_json(provenance_path)
            require(provenance.get("display_peak_at") == peak_at, f"{event_dir.name}/provenance.json: UI peak 불일치", errors)
            source_peak = parse_ui_time(provenance.get("source_peak_at"), f"{event_dir.name}/provenance.source_peak_at", errors)
            if source_peak and peak_time:
                expected_offset = int((peak_time - source_peak).total_seconds())
                require(provenance.get("timeline_offset_seconds") == expected_offset, f"{event_dir.name}/provenance.json: timeline_offset_seconds 불일치", errors)
                # source_actual이라고 선언했으면 옮겨 붙인 시각이 남아 있으면 안 된다.
                if date_basis == "source_actual":
                    require(expected_offset == 0, f"{label}: source_actual인데 UI 시각이 원본과 다릅니다", errors)

        anomaly_path = event_dir / "anomaly.json"
        sensor_path = event_dir / "sensor.json"
        if anomaly_ready:
            require(anomaly_path.is_file() and sensor_path.is_file(), f"{label}: 준비된 이상치 파일이 없습니다", errors)
            if anomaly_path.is_file():
                anomaly = read_json(anomaly_path)
                require(anomaly.get("peak_at") == peak_at, f"{event_dir.name}/anomaly.json: UI peak 불일치", errors)
                require(anomaly.get("time_basis") == "ui_normalized", f"{event_dir.name}/anomaly.json: UI 시간축이 아닙니다", errors)
            if sensor_path.is_file():
                sensor = read_json(sensor_path)
                values = sensor.get("heart_rate") or []
                # 심박 계열의 시각은 두 형태로 온다. 표본마다 시각이 붙어 있거나,
                # (heart_rate_timestamps) 구간만 선언하고 계열을 그 안에 균등 배치한다
                # (episode_start/episode_end). 프론트의 sampleAt이 후자를 그대로 쓴다.
                # 어느 쪽이든 지켜야 하는 것은 하나다. UI가 정점이라고 말하는 시각에
                # 실제 최고 심박이 있어야 한다.
                timestamps = sensor.get("heart_rate_timestamps")
                if timestamps is None:
                    window = (
                        parse_ui_time(sensor.get("episode_start"), f"{event_dir.name}/sensor.episode_start", errors),
                        parse_ui_time(sensor.get("episode_end"), f"{event_dir.name}/sensor.episode_end", errors),
                    )
                    if all(window) and len(values) > 1:
                        span = (window[1] - window[0]) / (len(values) - 1)
                        timestamps = [(window[0] + span * index).isoformat() for index in range(len(values))]
                    else:
                        timestamps = []
                        require(False, f"{event_dir.name}/sensor.json: 심박 시각도 구간도 없습니다", errors)
                require(len(timestamps) == len(values), f"{event_dir.name}/sensor.json: 시각·값 개수 불일치", errors)
                require(peak_at in timestamps, f"{event_dir.name}/sensor.json: UI peak 시각이 없습니다", errors)
                if peak_at in timestamps and values:
                    require(values[timestamps.index(peak_at)] == max(values), f"{event_dir.name}/sensor.json: UI peak와 최고 심박이 다릅니다", errors)

        # 360° 환경은 영상으로도, 정지 파노라마로도 준비될 수 있다. 정지 파노라마만
        # 있는 이벤트를 미준비로 재는 것은 VR 씬이 실제로 서는지와 어긋난다.
        panorama_files = [
            event_dir / entry["file"]
            for key in ("panorama_video", "panorama")
            if isinstance(entry := metadata.get(key), dict) and entry.get("file")
        ]
        require(panorama_ready == any(path.is_file() and path.stat().st_size > 0 for path in panorama_files), f"{label}: panorama_ready와 파노라마 파일 상태가 다릅니다", errors)
        require(vr_ready == (source_ready and anomaly_ready and panorama_ready), f"{label}: vr_ready 계산이 다릅니다", errors)

        job_path = JOBS / f"{event_id}.json"
        if job_path.is_file():
            job = read_json(job_path)
            require(job.get("event") == f"student/{event_id}", f"{job_path.relative_to(ROOT)}: event 경로 불일치", errors)
            # 영상 파노라마 이벤트에서만 job의 view가 메타데이터를 정한다(run_pipeline이
            # metadata["view"]를 job에서 덮어쓴다). 정지 파노라마로 바뀐 이벤트의 view는
            # 시작 시선을 고르는 값이고 남아 있는 영상 job이 정할 것이 아니다.
            if metadata.get("panorama_video"):
                require(job.get("view") == metadata.get("view"), f"{job_path.relative_to(ROOT)}: 초기 VR 시점 불일치", errors)
            require((ROOT / job.get("source", "")).is_file(), f"{job_path.relative_to(ROOT)}: 원본 영상이 없습니다", errors)

        expected_catalog.append({
            "id": slug,
            "eventId": event_id,
            "persona": metadata.get("persona", "student"),
            "title": metadata["title"],
            "subtitle": metadata.get("subtitle", ""),
            "description": metadata.get("description", ""),
            "location": metadata.get("location", ""),
            "icon": metadata.get("icon", "sparkles"),
            "month": display.get("month", ""),
            "peakAt": peak_at,
            "time": (peak_at or "")[11:16],
            "availability": availability,
            "available": source_ready or anomaly_ready,
        })

    require("night-study" in seen_slugs, "event_001의 night-study slug가 없습니다", errors)
    require("exam-interview" not in seen_slugs, "이전 exam-interview slug가 남아 있습니다", errors)

    for catalog_path in CATALOGS:
        require(catalog_path.is_file(), f"{catalog_path.relative_to(ROOT)}: 카탈로그가 없습니다", errors)
        if catalog_path.is_file():
            catalog = read_json(catalog_path)
            require(catalog.get("timezone") == "Asia/Seoul", f"{catalog_path.relative_to(ROOT)}: timezone 불일치", errors)
            require(catalog.get("events") == expected_catalog, f"{catalog_path.relative_to(ROOT)}: 메타데이터와 동기화되지 않았습니다", errors)
            encoded = json.dumps(catalog, ensure_ascii=False)
            require("source_peak_at" not in encoded and "source_mapping" not in encoded, f"{catalog_path.relative_to(ROOT)}: 원본 시각이 UI 카탈로그에 노출됐습니다", errors)

    if errors:
        print("학생 이벤트 검증 실패:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"학생 이벤트 검증 완료: {len(metadata_files)} events, UI timezone=Asia/Seoul")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
