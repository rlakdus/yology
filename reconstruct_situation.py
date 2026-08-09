"""
FEELBACK 상황 복원 (2차)
──────────────────────
1차(feelback_anomaly.py)가 찾은 "언제 이상했는지" 이벤트에, 걸음수·시간대
같은 지금 가진 신호만으로 "가장 그럴듯한 상황"을 규칙 기반으로 추론해서
붙인다.

주의 — 이건 실제 상황을 알아내는 게 아니라 추론이다:
    걸음수/시간대만으로 운동/수면/각성을 구분하는 거라 오분류가 있을 수 있고,
    "설명되지_않는_각성"이 곧 감정적 사건이라는 보장도 없다. 어디까지나
    "생체신호 흔적 기반 최선의 추측"이라는 한계를 달고 쓴다.

실행 방법:
    python reconstruct_situation.py

결과:
    각 이벤트에 situation_category / situation_note 필드를 붙여
    situation_result.json 저장
"""

import json

import pandas as pd

ANOMALY_JSON   = "anomaly_result.json"
STEP_CSV       = "data/shealth_normalized.csv"   # 걸음수는 지금 삼성 데이터에만 있음
OUTPUT_JSON    = "situation_result.json"

NIGHT_HOURS      = set(range(23, 24)) | set(range(0, 6))  # 23시, 0~5시
STEP_WINDOW_MIN  = 10   # 이벤트 시작 기준 전후 몇 분까지 걸음수를 볼지
STEP_ACTIVE_MIN  = 50   # 이 이상 걸으면 "활동중"으로 봄


# ══════════════════════════════════════════
# 걸음수 조회 준비 (사람별로 있으면만)
# ══════════════════════════════════════════

def load_step_series(path: str) -> pd.DataFrame:
    """person -> 걸음수 시계열(timestamp, value) 매핑."""
    df = pd.read_csv(path)
    df = df[df["display_name"] == "Step count"].copy()
    if df.empty:
        return {}
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, format="ISO8601") \
        .dt.tz_convert("Asia/Seoul").dt.tz_localize(None)
    return {
        person: g.set_index("timestamp")["value"].sort_index()
        for person, g in df.groupby("person")
    }


def steps_around(step_series: pd.Series | None, start: pd.Timestamp, end: pd.Timestamp) -> int | None:
    """이벤트 [start-window, end+window] 구간의 걸음수 합. 다음 경우엔
    None(=판단 불가)을 돌려준다 — 0으로 채워서 '운동 아님'이라고 거짓
    확신하지 않기 위함:
      - 그 사람은 걸음수 데이터가 아예 없음
      - 걸음수 데이터는 있지만, 이 이벤트 시각이 그 기록 범위(coverage) 밖임
        (예: 삼성 걸음수는 2026-06-05부터만 있는데 이벤트는 2023년)
    """
    if step_series is None or step_series.empty:
        return None
    if start < step_series.index.min() or end > step_series.index.max():
        return None
    pad = pd.Timedelta(minutes=STEP_WINDOW_MIN)
    window = step_series[(step_series.index >= start - pad) & (step_series.index <= end + pad)]
    return int(window.sum())


# ══════════════════════════════════════════
# 규칙 기반 분류
# ══════════════════════════════════════════

def classify(event: dict, steps: int | None) -> tuple[str, str]:
    hour = int(event["start"].split(" ")[1].split(":")[0])
    is_night = hour in NIGHT_HOURS
    trigger  = event["trigger"]

    if steps is not None and steps >= STEP_ACTIVE_MIN:
        category = "운동성_추정"
        note = (f"{event['start']} 무렵 전후 {STEP_WINDOW_MIN}분 내 걸음수 {steps}보 — "
                f"신체 활동 중 심박수가 튄 것으로 추정됨.")
        return category, note

    if is_night:
        category = "수면중_이상"
        trig_desc = {"resp": "호흡수", "bpm": "심박수", "spo2": "산소포화도"}.get(trigger, trigger)
        note = (f"{event['start']}(새벽 시간대)에 {trig_desc} 이상 감지, peak {event['peak_bpm']:.0f}bpm — "
                f"수면 중 발생한 것으로 보임 (수면무호흡·악몽·자세 변화 등 여러 원인 가능, 특정 불가).")
        return category, note

    if steps is None:
        category = "확인불가"
        note = (f"{event['start']} 이벤트 — 이 시점엔 걸음수 기록이 없어(데이터 자체가 없거나 "
                f"수집 기간 밖) 운동 여부를 판단할 수 없음. peak {event['peak_bpm']:.0f}bpm, trigger={trigger}.")
        return category, note

    # steps is not None and steps < STEP_ACTIVE_MIN and daytime
    category = "설명되지_않는_각성"
    note = (f"{event['start']} 깨어있는 시간대, 걸음수 {steps}보(활동 없음)인데 "
            f"{trigger} 급변 — 운동으로 설명 안 되는 각성. 감정/스트레스성 후보.")
    return category, note


# ══════════════════════════════════════════
# 실행
# ══════════════════════════════════════════

def main():
    with open(ANOMALY_JSON, encoding="utf-8") as f:
        results = json.load(f)

    step_series_by_person = load_step_series(STEP_CSV)

    enriched = {}
    counts_by_category = {}

    for person, events in results.items():
        step_series = step_series_by_person.get(person)
        out_events = []
        for e in events:
            start = pd.Timestamp(e["start"])
            end_time = pd.Timestamp(f"{e['start'][:10]} {e['end']}")
            if end_time < start:  # 자정을 넘긴 이벤트 보정
                end_time += pd.Timedelta(days=1)

            steps = steps_around(step_series, start, end_time)
            category, note = classify(e, steps)

            e = {**e, "situation_category": category, "situation_note": note}
            out_events.append(e)
            counts_by_category.setdefault(person, {}).setdefault(category, 0)
            counts_by_category[person][category] += 1

        enriched[person] = out_events

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print("=" * 50)
    print("FEELBACK 상황 복원 (2차) — 규칙 기반 추론")
    print("=" * 50)
    for person, cats in counts_by_category.items():
        print(f"\n[{person}]")
        for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {n}개")
    print(f"\n[저장] {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
