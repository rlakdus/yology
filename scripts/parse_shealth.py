#!/usr/bin/env python3
"""삼성 헬스 내보내기(CSV 3종)를 export_cda_normalized.csv와 같은 long-format으로 정제한다.

애플(export_cda.xml)과 삼성은 서로 다른 사람의 데이터이므로 병합하지 않고,
같은 컬럼 스키마로 맞춰서 person 컬럼으로만 구분한다 — 이상치 탐지 모델은
반드시 person별로 따로 학습/추론해야 한다 (baseline이 사람마다 다르므로).

입력 (data/ 아래 고정 파일명):
    com.samsung.shealth.tracker.heart_rate.*.csv
    com.samsung.shealth.tracker.pedometer_step_count.*.csv
    com.samsung.shealth.exercise.recovery_heart_rate.*.csv

출력:
    data/shealth_normalized.csv
"""
import argparse
import glob
import json
import re
from datetime import timedelta, timezone
from pathlib import Path

import pandas as pd

COLUMNS = [
    "person", "category", "loinc_code", "display_name", "timestamp",
    "value", "unit", "interpretation", "source_name", "source_version",
    "device", "hk_type", "metadata",
]


def parse_offset(s: str) -> timezone:
    """'UTC+0900' -> timezone(+09:00)"""
    m = re.match(r"UTC([+-])(\d{2})(\d{2})", str(s))
    sign, hh, mm = m.group(1), int(m.group(2)), int(m.group(3))
    delta = timedelta(hours=hh, minutes=mm)
    return timezone(-delta if sign == "-" else delta)


def to_kst(series_dt: pd.Series, offsets: pd.Series) -> pd.Series:
    """행마다 다른 time_offset을 적용해 tz-aware timestamp로 만든 뒤 KST로 통일."""
    KST = timezone(timedelta(hours=9))
    out = []
    for dt, off in zip(series_dt, offsets):
        if pd.isna(dt):
            out.append(pd.NaT)
            continue
        out.append(dt.replace(tzinfo=parse_offset(off)).astimezone(KST))
    return pd.Series(out, index=series_dt.index)


def load_shealth_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path, skiprows=1, encoding="utf-8-sig", index_col=False)


def find_one(pattern: str) -> str:
    matches = sorted(glob.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"no file matches {pattern}")
    return matches[-1]


def parse_heart_rate(path: str) -> pd.DataFrame:
    p = "com.samsung.health.heart_rate."
    df = load_shealth_csv(path)
    df = df.dropna(subset=[p + "start_time", p + "heart_rate"])
    ts = to_kst(pd.to_datetime(df[p + "start_time"]), df[p + "time_offset"])
    meta = df.apply(lambda r: json.dumps({
        "max": r[p + "max"], "min": r[p + "min"],
        "heart_beat_count": r[p + "heart_beat_count"],
        "datauuid": r[p + "datauuid"],
    }, default=str, ensure_ascii=False), axis=1)
    return pd.DataFrame({
        "category": "Vital signs",
        "loinc_code": None,
        "display_name": "Heart rate",
        "timestamp": ts,
        "value": df[p + "heart_rate"].astype(float),
        "unit": "count/min",
        "interpretation": None,
        "source_name": "Samsung Health",
        "source_version": None,
        "device": df[p + "deviceuuid"],
        "hk_type": "com.samsung.shealth.tracker.heart_rate",
        "metadata": meta,
    })


def parse_recovery_heart_rate(path: str) -> pd.DataFrame:
    """미사용: 이 테이블의 heart_rate 컬럼은 실제 값이 아니라
    `<uuid>.heart_rate.json` 형태의 파일명 참조뿐이다 (100% 확인됨).
    실제 시계열은 삼성 헬스 원본 export의 jsons/ 폴더에 있는데
    이 프로젝트엔 그 파일들이 없어서 파싱할 수 없다.
    해당 JSON들을 구하면 이 함수를 다시 연결하면 된다.
    """
    raise NotImplementedError("recovery_heart_rate.csv의 heart_rate 컬럼은 JSON 파일 참조라 값이 없음")


def parse_pedometer(path: str) -> pd.DataFrame:
    p = "com.samsung.health.step_count."
    df = load_shealth_csv(path)
    df = df.dropna(subset=[p + "start_time", p + "count"])
    ts = to_kst(pd.to_datetime(df[p + "start_time"]), df[p + "time_offset"])
    meta = df.apply(lambda r: json.dumps({
        "run_step": r["run_step"], "walk_step": r["walk_step"],
        "distance_m": r[p + "distance"], "calorie": r[p + "calorie"],
        "speed": r[p + "speed"], "duration_sec": r["duration"],
        "datauuid": r[p + "datauuid"],
    }, default=str, ensure_ascii=False), axis=1)
    return pd.DataFrame({
        "category": "Physical activity",
        "loinc_code": None,
        "display_name": "Step count",
        "timestamp": ts,
        "value": df[p + "count"].astype(float),
        "unit": "steps",
        "interpretation": None,
        "source_name": "Samsung Health",
        "source_version": None,
        "device": df[p + "deviceuuid"],
        "hk_type": "com.samsung.shealth.tracker.pedometer_step_count",
        "metadata": meta,
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--datadir", default="data", type=Path)
    parser.add_argument("--person", default="samsung")
    parser.add_argument("--output", default="data/shealth_normalized.csv", type=Path)
    args = parser.parse_args()

    hr_path = find_one(str(args.datadir / "com.samsung.shealth.tracker.heart_rate.*.csv"))
    ped_path = find_one(str(args.datadir / "com.samsung.shealth.tracker.pedometer_step_count.*.csv"))

    parts = [
        parse_heart_rate(hr_path),
        parse_pedometer(ped_path),
    ]
    df = pd.concat(parts, ignore_index=True)
    df.insert(0, "person", args.person)
    df = df.sort_values(["display_name", "timestamp"]).reset_index(drop=True)
    df = df[COLUMNS]

    df.to_csv(args.output, index=False)

    print(f"normalized -> {args.output}  ({len(df)} rows)")
    print(df.groupby("display_name").agg(
        rows=("value", "size"),
        start=("timestamp", "min"),
        end=("timestamp", "max"),
    ).to_string())


if __name__ == "__main__":
    main()
