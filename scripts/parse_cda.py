#!/usr/bin/env python3
"""Apple 건강 CDA 내보내기 파일(export_cda.xml)을 복구하고 정규화한다.

이 내보내기 파일은 본문을 감싸는 <component><section> 여는 태그가 빠져
있고 파일 끝에 닫는 태그만 남아 있어 그대로는 XML 정합성 검사를 통과하지
못한다. 이 스크립트는 먼저 그 누락된 태그를 보정한 뒤, 심박수/혈중산소포
화도/호흡수 등 모든 <observation>을 한 줄씩 풀어 하나의 long-format
테이블로 만든다.

사용법:
    python3 scripts/parse_cda.py [--input data/export_cda.xml] [--outdir data]

결과물 (--outdir 아래에 생성):
    export_cda.fixed.xml       정합성이 복구된 XML (원본은 수정하지 않음)
    export_cda_normalized.csv  observation 1건당 1행으로 정규화한 테이블
"""
import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

NS_URI = "urn:hl7-org:v3"

# "김하은의 Apple Watch" -> "김하은" 처럼 소유격 "의" 앞부분을 사람 이름으로 본다.
# 공백이 일반 스페이스가 아니라 \xa0(non-breaking space)인 경우도 있어 \s로 함께 처리.
PERSON_PATTERN = re.compile(r"^(.+?)의\s")


def extract_person_candidate(source_name: str) -> str | None:
    if not isinstance(source_name, str):
        return None
    m = PERSON_PATTERN.match(source_name)
    return m.group(1) if m else None


def resolve_document_person(source_names: pd.Series, fallback: str) -> str:
    """문서 하나 = 환자 한 명이므로, source_name이 기기별로 달라도
    (예: '김아연의 Apple Watch' vs 수동 입력 '건강') 문서 전체에서
    가장 많이 등장하는 이름으로 person을 통일한다."""
    candidates = source_names.map(extract_person_candidate).dropna()
    if candidates.empty:
        return fallback
    return candidates.mode().iloc[0]


def fix_xml(raw: str) -> str:
    """일부 내보내기 파일은 본문을 감싸는 <component><section>의 여는 태그가
    빠져 있어 정합성 검사를 통과하지 못한다. 이미 정상인 파일(앱 버전에 따라
    다름)까지 건드리면 오히려 태그가 중복돼 깨지므로, 먼저 그대로 파싱을
    시도해보고 실패할 때만 보정한다."""
    try:
        ET.fromstring(raw)
        return raw  # 이미 정합성 문제 없음
    except ET.ParseError:
        pass

    marker = "</recordTarget>"
    if marker not in raw:
        raise ValueError("unexpected document: no </recordTarget> found")
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

            rows.append({
                "category": category,
                "loinc_code": code_el.get("code") if code_el is not None else None,
                "display_name": code_el.get("displayName") if code_el is not None else None,
                "timestamp": ts.isoformat() if ts else None,
                "value": float(value_el.get("value")) if value_el is not None else None,
                "unit": value_el.get("unit") if value_el is not None else None,
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
    parser.add_argument("--person-fallback", default="apple_unknown",
                         help="source_name에서 이름을 못 뽑았을 때 쓸 person 값")
    args = parser.parse_args()

    raw = args.input.read_text(encoding="utf-8")
    fixed = fix_xml(raw)

    stem = args.input.stem  # "export_cda" or "export_cda_ahyeon" 등 입력 파일명 기준
    fixed_path = args.outdir / f"{stem}.fixed.xml"
    fixed_path.write_text(fixed, encoding="utf-8")

    root = ET.fromstring(fixed)
    rows = extract_observations(root)

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    person = resolve_document_person(df["source_name"], args.person_fallback)
    df.insert(0, "person", person)
    df = df.sort_values(["category", "timestamp"]).reset_index(drop=True)

    csv_path = args.outdir / f"{stem}_normalized.csv"
    df.to_csv(csv_path, index=False)

    print(f"fixed xml  -> {fixed_path}")
    print(f"normalized -> {csv_path}  ({len(df)} rows)")
    print(df.groupby(["person", "display_name"]).size().to_string())


if __name__ == "__main__":
    main()
