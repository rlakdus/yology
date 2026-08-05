#!/usr/bin/env python3
"""Apple 건강 메인 내보내기(export.xml)를 파싱해 바이탈·활동 테이블로 나눈다.

CDA 파일(export_cda.xml)에는 바이탈 3종(심박·SpO2·호흡수)만 들어있다. 활동 데이터
(걸음수·계단·활동에너지·HRV·운동세션)는 같은 내보내기 zip 안의 이 export.xml에 있고,
형식도 CDA와 완전히 다르다 — HL7 CDA의 중첩 <observation>이 아니라 평탄한 <Record>
엘리먼트다. 그래서 parse_cda.py와 별도 파서를 둔다.

## 왜 스트리밍(iterparse)인가

export.xml은 50MB가 넘는다. ET.fromstring으로 통째로 올리면 메모리를 크게 먹고 느리다.
iterparse로 <Record>를 하나씩 처리하고 즉시 비워(clear) 메모리를 일정하게 유지한다.

## 순간 측정 vs 구간 측정

Record는 두 종류다. 이 구분이 뒤 단계(활동 보정 모델)의 시간 정렬을 좌우한다.

  순간 측정 (startDate == endDate): 심박, 호흡수, SpO2, HRV, 안정시심박 등
      -> 그 시각의 값. timestamp 하나로 표현.
  구간 측정 (startDate < endDate): 걸음수, 계단, 활동에너지, 신체활동강도 등
      -> 그 구간 동안의 누적/평균. start~end 범위를 유지해야 심박 샘플에 정렬 가능.

그래서 결과를 두 파일로 나눈다:
    data/output/export_vitals.csv     순간 측정 (long-format, feelback 모델이 소비)
    data/output/export_activity.csv   구간 측정 (start/end/value 유지)

사용법:
    python3 scripts/parse_export.py [--input data/input/export.xml] [--outdir data/output]
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

PREFIX = "HKQuantityTypeIdentifier"

# 순간 측정: type -> 정규화 display_name (CDA 파일과 명칭을 맞춰 모델이 그대로 소비)
POINT_TYPES = {
    "HeartRate": "Heart rate",
    "RespiratoryRate": "Respiratory rate",
    "OxygenSaturation": "Oxygen saturation",
    "HeartRateVariabilitySDNN": "HRV SDNN",
    "RestingHeartRate": "Resting heart rate",
    "WalkingHeartRateAverage": "Walking heart rate",
}

# 구간 측정: type -> 짧은 이름. 활동 부하 피처의 원천.
INTERVAL_TYPES = {
    "StepCount": "steps",
    "FlightsClimbed": "flights",
    "ActiveEnergyBurned": "active_energy",
    "DistanceWalkingRunning": "distance_km",
    "PhysicalEffort": "physical_effort",
    "AppleExerciseTime": "exercise_min",
}


def parse_dt(value: str) -> datetime:
    """'2026-07-01 19:30:41 +0900' -> tz-aware datetime."""
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S %z")


def parse(path: Path):
    point_rows, interval_rows = [], []
    n_records = 0

    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "Record":
            continue
        n_records += 1
        rtype = elem.get("type", "")
        short = rtype[len(PREFIX):] if rtype.startswith(PREFIX) else rtype

        if short in POINT_TYPES:
            val = elem.get("value")
            metadata = {m.get("key"): m.get("value") for m in elem.findall("MetadataEntry")}
            ctx = metadata.get("HKMetadataKeyHeartRateMotionContext")
            point_rows.append({
                "display_name": POINT_TYPES[short],
                "timestamp": parse_dt(elem.get("startDate")),
                "value": float(val) if val is not None else None,
                "unit": elem.get("unit"),
                "motion_context": int(ctx) if ctx is not None else None,
                "source_name": elem.get("sourceName"),
                "hk_type": rtype,
            })
        elif short in INTERVAL_TYPES:
            val = elem.get("value")
            start, end = parse_dt(elem.get("startDate")), parse_dt(elem.get("endDate"))
            interval_rows.append({
                "metric": INTERVAL_TYPES[short],
                "start": start,
                "end": end,
                "duration_s": (end - start).total_seconds(),
                "value": float(val) if val is not None else None,
                "unit": elem.get("unit"),
                "source_name": elem.get("sourceName"),
            })

        elem.clear()  # 처리 끝난 엘리먼트는 즉시 비워 메모리를 일정하게 유지

    return point_rows, interval_rows, n_records


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", default="data/input/export.xml", type=Path)
    parser.add_argument("--outdir", default="data/output", type=Path)
    args = parser.parse_args()

    point_rows, interval_rows, n_records = parse(args.input)

    vitals = pd.DataFrame(point_rows).sort_values(["display_name", "timestamp"])
    vitals["motion_context"] = vitals["motion_context"].astype("Int64")

    # SpO2는 원본이 0~1 비율일 수 있다(CDA와 동일). %로 통일.
    spo2 = vitals["display_name"] == "Oxygen saturation"
    frac = spo2 & (vitals["value"] <= 1)
    if frac.any():
        vitals.loc[frac, "value"] = (vitals.loc[frac, "value"] * 100).round(1)

    activity = pd.DataFrame(interval_rows).sort_values(["metric", "start"])

    # Keep each person's export separate: export_XX.xml -> export_XX_*.csv.
    # The original export.xml keeps its established output names.
    output_prefix = args.input.stem
    vitals_path = args.outdir / f"{output_prefix}_vitals.csv"
    activity_path = args.outdir / f"{output_prefix}_activity.csv"
    vitals.to_csv(vitals_path, index=False)
    activity.to_csv(activity_path, index=False)

    print(f"Record 총 {n_records}건 파싱\n")
    print(f"순간 측정 -> {vitals_path}  ({len(vitals)}행)")
    for name, g in vitals.groupby("display_name"):
        print(f"  {name:22s} {len(g):5d}건  {g['timestamp'].min():%Y-%m-%d} ~ "
              f"{g['timestamp'].max():%Y-%m-%d}")
    print(f"\n구간 측정 -> {activity_path}  ({len(activity)}행)")
    for name, g in activity.groupby("metric"):
        print(f"  {name:18s} {len(g):6d}건  합계 {g['value'].sum():10.1f} {g['unit'].iloc[0]:8s}  "
              f"{g['start'].min():%Y-%m-%d} ~ {g['start'].max():%Y-%m-%d}")


if __name__ == "__main__":
    main()
