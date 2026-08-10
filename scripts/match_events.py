#!/usr/bin/env python3
"""탐지된 이상치 이벤트에 실제 사진/채팅/영상을 매칭해 event_001과 같은 구조로 번들을 만든다.

파일명 규칙 (사진/채팅/영상 전부 동일 — EXIF 유무와 무관하게 통일):
    YYYYMMDD_HHMM_설명.확장자   예: 20260703_1456_카페.jpg

사용법:
    1. events/inbox/ 에 사진(.jpg/.jpeg/.png/.heic), 채팅(.txt), 영상(.mp4/.mov)을
       위 이름 규칙으로 넣어둔다.
    2. python3 scripts/match_events.py

동작:
    data/feelback_residual_episodes.csv의 각 이벤트 시각 기준 ±window-min(기본 30분)
    이내에 있는 inbox 파일을 찾아, events/<persona>/event_YYYYMMDD_HHMM/ 밑에
    event_001과 동일한 구조(metadata.json/reasoning.json/sensor.json + 미디어 복사본)로
    번들을 만든다. 매칭되는 미디어가 하나도 없는 이벤트는 번들을 만들지 않는다 —
    재구성할 근거(사진/채팅/영상)가 없으면 만드는 의미가 없기 때문이다.

    title/persona/vr_scene은 자동으로 못 채운다(모델이 모르는 정보라서) —
    None으로 두고 metadata.json을 나중에 사람이 채워 넣는 걸 전제로 한다.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

import pandas as pd

FNAME_RE = re.compile(r"^(\d{8})_(\d{4})(?:_(.*))?\.(\w+)$")
IMAGE_EXT = {"jpg", "jpeg", "png", "heic"}
VIDEO_EXT = {"mp4", "mov"}
CHAT_EXT = {"txt"}

AROUSAL_EMOTION = {
    "지속성": "지속성 스트레스/긴장",
    "위상성": "급성 놀람/각성",
}


def parse_inbox(inbox: Path) -> pd.DataFrame:
    """inbox 폴더의 파일명에서 타임스탬프를 뽑는다. 규칙에 안 맞는 파일은 건너뛴다."""
    rows = []
    for f in sorted(inbox.iterdir()):
        if not f.is_file():
            continue
        m = FNAME_RE.match(f.name)
        if not m:
            print(f"  건너뜀 (파일명 규칙 YYYYMMDD_HHMM_설명.확장자 안 맞음): {f.name}")
            continue
        date_s, time_s, desc, ext = m.groups()
        # 파일명은 사람이 현지 시각(KST)으로 적는다고 보고, 이벤트 CSV의 tz-aware
        # 타임스탬프와 비교 가능하도록 명시적으로 KST로 맞춘다.
        ts = pd.Timestamp(f"{date_s[:4]}-{date_s[4:6]}-{date_s[6:]} {time_s[:2]}:{time_s[2:]}",
                           tz="Asia/Seoul")
        ext = ext.lower()
        kind = ("image" if ext in IMAGE_EXT else
                "video" if ext in VIDEO_EXT else
                "chat" if ext in CHAT_EXT else None)
        if kind is None:
            print(f"  건너뜀 (지원 안 하는 확장자 .{ext}): {f.name}")
            continue
        rows.append({"path": f, "timestamp": ts, "kind": kind, "desc": desc or ""})
    return pd.DataFrame(rows)


def nearest_within(media: pd.DataFrame, kind: str, center: pd.Timestamp, window_min: int) -> list[Path]:
    if media.empty:
        return []
    sub = media[media["kind"] == kind]
    if sub.empty:
        return []
    diff = (sub["timestamp"] - center).abs()
    close = sub[diff <= pd.Timedelta(minutes=window_min)]
    return close.sort_values("timestamp")["path"].tolist()


def heart_rate_slice(vitals: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp, n: int = 8) -> list[float]:
    """event_001의 sensor.json처럼 그 구간의 실제 심박수를 n개 정도로 성기게 뽑는다."""
    sub = vitals[(vitals["display_name"] == "Heart rate") &
                 (vitals["timestamp"] >= start) & (vitals["timestamp"] <= end)]
    if sub.empty:
        return []
    step = max(1, len(sub) // n)
    return sub.iloc[::step]["value"].head(n).round(1).tolist()


def build_bundle(ep: pd.Series, images, chats, videos, vitals: pd.DataFrame,
                  persona: str, outdir: Path) -> Path:
    event_id = f"event_{ep['start'].strftime('%Y%m%d_%H%M')}"
    event_dir = outdir / persona / event_id
    for sub in ("images", "chats", "videos"):
        (event_dir / sub).mkdir(parents=True, exist_ok=True)

    for src in images:
        shutil.copy2(src, event_dir / "images" / src.name)
    for src in chats:
        shutil.copy2(src, event_dir / "chats" / src.name)
    for src in videos:
        shutil.copy2(src, event_dir / "videos" / src.name)

    metadata = {
        "event_id": event_id,
        "title": None,        # 모델이 알 수 없는 정보 — 나중에 사람이 채움
        "persona": persona,
        "emotion": AROUSAL_EMOTION.get(ep.get("arousal"), "설명되지 않는 각성"),
        "description": ep["evidence"],
        "start_time": ep["start"].isoformat(),
        "end_time": ep["end"].isoformat(),
        "vr_scene": None,
    }
    reasoning = {
        "selected_images": [p.name for p in images],
        "selected_chats": [p.name for p in chats],
        "selected_videos": [p.name for p in videos],
    }
    sensor = {"heart_rate": heart_rate_slice(vitals, ep["start"], ep["end"])}

    (event_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (event_dir / "reasoning.json").write_text(json.dumps(reasoning, ensure_ascii=False, indent=2), encoding="utf-8")
    (event_dir / "sensor.json").write_text(json.dumps(sensor, ensure_ascii=False, indent=2), encoding="utf-8")
    return event_dir


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--episodes", default="data/feelback_residual_episodes.csv", type=Path)
    p.add_argument("--vitals", default="data/export_cda_normalized.csv", type=Path)
    p.add_argument("--inbox", default="events/inbox", type=Path)
    p.add_argument("--outdir", default="events", type=Path)
    p.add_argument("--persona", default="caregiver")
    p.add_argument("--window-min", type=int, default=30)
    args = p.parse_args()

    args.inbox.mkdir(parents=True, exist_ok=True)
    episodes = pd.read_csv(args.episodes, parse_dates=["start", "end"])
    vitals = pd.read_csv(args.vitals, parse_dates=["timestamp"])

    print(f"[inbox 파싱] {args.inbox}")
    media = parse_inbox(args.inbox)
    if media.empty:
        print(f"\n{args.inbox}에 규칙에 맞는 파일이 없습니다. (YYYYMMDD_HHMM_설명.확장자)")
        return
    print(f"  이미지 {(media['kind']=='image').sum()} / 채팅 {(media['kind']=='chat').sum()} "
          f"/ 영상 {(media['kind']=='video').sum()}")

    made = 0
    for _, ep in episodes.iterrows():
        center = ep["start"]
        images = nearest_within(media, "image", center, args.window_min)
        chats = nearest_within(media, "chat", center, args.window_min)
        videos = nearest_within(media, "video", center, args.window_min)
        if not (images or chats or videos):
            continue
        made += 1
        event_dir = build_bundle(ep, images, chats, videos, vitals, args.persona, args.outdir)
        print(f"  [{event_dir.name}] {ep['start']} — 이미지{len(images)} 채팅{len(chats)} "
              f"영상{len(videos)} -> {event_dir}")

    print(f"\n총 이벤트 {len(episodes)}개 중 미디어 매칭된 {made}개 번들 생성 "
          f"-> {args.outdir}/{args.persona}/")
    if made:
        print("title/persona/vr_scene은 자동으로 못 채웠으니 metadata.json에서 직접 채워 넣어야 함.")


if __name__ == "__main__":
    main()
