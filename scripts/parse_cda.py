#!/usr/bin/env python3
"""Apple 건강 CDA 내보내기 파일(export_cda.xml)을 복구하고 정규화한다.

이 내보내기 파일은 본문을 감싸는 <component><section> 여는 태그가 빠져
있고 파일 끝에 닫는 태그만 남아 있어 그대로는 XML 정합성 검사를 통과하지
못한다. 이 스크립트는 먼저 그 누락된 태그를 보정한 뒤, 심박수/혈중산소포
화도/호흡수 등 모든 <observation>을 한 줄씩 풀어 하나의 long-format
테이블로 만든다.

정규화 규칙:
  - 자주 쓰는 metadataEntry 키는 정식 컬럼으로 승격한다
    (motion_context, barometric_pressure_kpa). 그 외 키만 metadata JSON에 남긴다.
  - 혈중산소포화도(LOINC 2710-2)는 원본이 0~1 비율로 기록되므로 ×100 해서
    실제 % 값으로 저장한다.
  - 기존 CSV가 있으면 병합 후 (hk_type, timestamp, value) 기준으로 중복을
    제거한다. 내보내기 기간이 겹치거나 이전 기간이 빠진 내보내기를 다시
    파싱해도 데이터가 중복되거나 유실되지 않는다.

사용법:
    python3 scripts/parse_cda.py [--input data/export_cda.xml] [--outdir data]

결과물 (--outdir 아래에 생성):
    export_cda.fixed.xml       정합성이 복구된 XML (원본은 수정하지 않음)
    export_cda_normalized.csv  observation 1건당 1행으로 정규화한 테이블
"""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

NS_URI = "urn:hl7-org:v3"

LOINC_SPO2 = "2710-2"  # 원본이 0~1 비율로 기록되는 항목 (×100 필요)

# 중복 판정 키: 같은 항목이 같은 시각에 같은 값이면 동일 측정으로 본다
DEDUP_KEYS = ["hk_type", "timestamp", "value"]


def promote_metadata(metadata: dict) -> dict:
    """자주 쓰는 metadataEntry 키를 정식 컬럼 값으로 변환해 돌려준다."""
    cols = {"motion_context": None, "barometric_pressure_kpa": None}
    ctx = metadata.pop("HKMetadataKeyHeartRateMotionContext", None)
    if ctx is not None:
        cols["motion_context"] = int(ctx)
    pressure = metadata.pop("HKMetadataKeyBarometricPressure", None)
    if pressure is not None:  # 형식: "100.719 kPa"
        cols["barometric_pressure_kpa"] = float(pressure.split()[0])
    return cols


def fix_xml(raw: str) -> str:
    marker = "</recordTarget>"
    if marker not in raw:
        raise ValueError("unexpected document: no </recordTarget> found")
    if "<component>\n  <section>" in raw:
        return raw  # already patched
    idx = raw.index(marker) + len(marker)
    return raw[:idx] + "\n <component>\n  <section>" + raw[idx:]


def parse_timestamp(value: str) -> datetime:
    """HL7 TS format: YYYYMMDDHHMMSS±ZZZZ"""
    dt = datetime.strptime(value[:14], "%Y%m%d%H%M%S")
    sign, offset = value[14], value[15:19]
    delta = timedelta(hours=int(offset[:2]), minutes=int(offset[2:]))
    if sign == "-":
        delta = -delta
    return dt.replace(tzinfo=timezone(delta))


def tag(name: str) -> str:
    return f"{{{NS_URI}}}{name}"


def extract_observations(root: ET.Element) -> list[dict]:
    rows = []
    for entry in root.iter(tag("entry")):
        organizer = entry.find(tag("organizer"))
        if organizer is None:
            continue
        category_code = organizer.find(tag("code"))
        category = category_code.get("displayName") if category_code is not None else None

        for obs in organizer.iter(tag("observation")):
            code_el = obs.find(tag("code"))
            value_el = obs.find(tag("value"))
            eff_low = obs.find(f"{tag('effectiveTime')}/{tag('low')}")
            text_el = obs.find(tag("text"))
            interp_el = obs.find(tag("interpretationCode"))

            metadata = {}
            if text_el is not None:
                for m in text_el.findall(tag("metadataEntry")):
                    key = m.findtext(tag("key"))
                    val = m.findtext(tag("value"))
                    if key:
                        metadata[key] = val

            ts = parse_timestamp(eff_low.get("value")) if eff_low is not None else None

            loinc = code_el.get("code") if code_el is not None else None
            value = float(value_el.get("value")) if value_el is not None else None
            if loinc == LOINC_SPO2 and value is not None and value <= 1:
                value = round(value * 100, 1)

            rows.append({
                "category": category,
                "loinc_code": loinc,
                "display_name": code_el.get("displayName") if code_el is not None else None,
                "timestamp": ts.isoformat() if ts else None,
                "value": value,
                "unit": value_el.get("unit") if value_el is not None else None,
                **promote_metadata(metadata),
                "interpretation": interp_el.get("code") if interp_el is not None else None,
                "source_name": text_el.findtext(tag("sourceName")) if text_el is not None else None,
                "source_version": text_el.findtext(tag("sourceVersion")) if text_el is not None else None,
                "device": text_el.findtext(tag("device")) if text_el is not None else None,
                "hk_type": text_el.findtext(tag("type")) if text_el is not None else None,
                "metadata": json.dumps(metadata, ensure_ascii=False) if metadata else None,
            })
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", default="data/export_cda.xml", type=Path)
    parser.add_argument("--outdir", default="data", type=Path)
    args = parser.parse_args()

    raw = args.input.read_text(encoding="utf-8")
    fixed = fix_xml(raw)

    fixed_path = args.outdir / "export_cda.fixed.xml"
    fixed_path.write_text(fixed, encoding="utf-8")

    root = ET.fromstring(fixed)
    rows = extract_observations(root)

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["motion_context"] = df["motion_context"].astype("Int64")

    # 기존 CSV와 병합: 이전 내보내기에만 있던 기간을 보존하고,
    # 겹치는 기간은 DEDUP_KEYS 기준으로 중복 제거한다.
    csv_path = args.outdir / "export_cda_normalized.csv"
    n_new, n_kept = len(df), 0
    if csv_path.exists():
        old = pd.read_csv(csv_path, parse_dates=["timestamp"])
        if set(old.columns) == set(df.columns):  # 구버전 스키마면 전체 재생성
            old["motion_context"] = old["motion_context"].astype("Int64")
            df = pd.concat([old, df], ignore_index=True)
            n_kept = len(old)

    df = df.drop_duplicates(DEDUP_KEYS)
    df = df.sort_values(["category", "timestamp"]).reset_index(drop=True)
    df.to_csv(csv_path, index=False)

    print(f"fixed xml  -> {fixed_path}")
    print(f"normalized -> {csv_path}  ({len(df)} rows = 기존 {n_kept} + 신규 {n_new} - 중복 {n_kept + n_new - len(df)})")
    print(df.groupby("category").size().to_string())


if __name__ == "__main__":
    main()
