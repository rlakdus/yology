#!/usr/bin/env python3
"""Repair and normalize an Apple Health CDA export (export_cda.xml).

The export is missing the <component><section> wrapper's opening tags
around the document body -- only their closing tags survive at the end
of the file -- so it fails strict XML parsing. This script patches that,
then flattens every <observation> (heart rate / SpO2 / respiratory rate,
etc.) into one long-format table.

Usage:
    python3 scripts/parse_cda.py [--input data/export_cda.xml] [--outdir data]

Outputs (written to --outdir):
    export_cda.fixed.xml       well-formed XML (original left untouched)
    export_cda_normalized.csv  one row per observation
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

NS_URI = "urn:hl7-org:v3"


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
    args = parser.parse_args()

    raw = args.input.read_text(encoding="utf-8")
    fixed = fix_xml(raw)

    fixed_path = args.outdir / "export_cda.fixed.xml"
    fixed_path.write_text(fixed, encoding="utf-8")

    root = ET.fromstring(fixed)
    rows = extract_observations(root)

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["category", "timestamp"]).reset_index(drop=True)

    csv_path = args.outdir / "export_cda_normalized.csv"
    df.to_csv(csv_path, index=False)

    print(f"fixed xml  -> {fixed_path}")
    print(f"normalized -> {csv_path}  ({len(df)} rows)")
    print(df.groupby("category").size().to_string())


if __name__ == "__main__":
    main()
