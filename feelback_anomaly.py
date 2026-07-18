"""
FEELBACK 이상치 탐지
──────────────────
실행 방법:
    python feelback_anomaly.py

사람(person)별로 완전히 분리해서 돌린다 — baseline(평소 심박수)이
사람마다 다르므로, Z-score 컨텍스트와 Isolation Forest 학습을 절대
섞지 않는다.

결과:
    터미널에 사람별 감지된 이벤트 출력
    anomaly_result.json 저장 (person을 키로 하는 dict)
"""

import json
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ──────────────────────────────────────────
# 설정값 — 여기만 바꾸면 됨
# ──────────────────────────────────────────

CSV_PATHS = [
    "data/export_cda_normalized.csv",
    "data/export_cda_ahyeon_normalized.csv",
    "data/shealth_normalized.csv",
]
ZSCORE_THRESHOLD = 1.5   # 낮출수록 더 많이 잡힘 (1.0 ~ 2.0)
IF_CONTAMINATION = 0.05  # 전체의 몇 %를 이상치로 볼지
MIN_DURATION     = 3     # 최소 몇 분 이상 지속돼야 이벤트로 볼지
BPM_INTERP_LIMIT = 30    # 심박수 보간 최대 허용 공백(분) — 이보다 길게 비면 보간하지 않고 버림
MIN_ROWS_PER_PERSON = 60 # 이보다 적으면 그 사람은 건너뜀 (모델 학습이 의미 없음)
OUTPUT_JSON      = "anomaly_result.json"


# ══════════════════════════════════════════
# STEP 0. 데이터 로드
# long-format CSV(여러 개) → person별 wide-format DataFrame
# ══════════════════════════════════════════

def load_raw(paths: list[str]) -> pd.DataFrame:
    """여러 정규화 CSV(애플 여러 명 + 삼성)를 한 long-format으로 합친다.
    합치기만 하고 person으로 절대 섞어 계산하지 않는다 — 이후 단계에서
    person별로 나눠서 처리한다."""
    frames = [pd.read_csv(p) for p in paths]
    df = pd.concat(frames, ignore_index=True)
    # 애플(마이크로초 없음)과 삼성(마이크로초 있음) CSV가 timestamp 문자열
    # 정밀도가 달라 고정 format으로는 못 읽으므로 format="ISO8601"로 통일.
    df["timestamp"] = pd.to_datetime(
        df["timestamp"], utc=True, format="ISO8601"
    ).dt.tz_convert("Asia/Seoul").dt.tz_localize(None)
    return df


def build_wide(df_raw: pd.DataFrame, person: str) -> pd.DataFrame:
    """
    한 사람(person)의 long-format 행만 골라
    timestamp | bpm | spo2 | resp_rate 형태로 변환.
    display_name이 없는 지표(예: 삼성엔 SpO2/호흡수 없음)는
    전부 NaN인 컬럼으로 남는다 — extract_features에서 0으로 처리됨.
    """
    df_p = df_raw[df_raw["person"] == person]

    # ── 심박수 ──────────────────────────────
    hr = df_p[df_p["display_name"] == "Heart rate"].copy()
    hr = hr.set_index("timestamp")["value"]
    hr = hr[(hr >= 30) & (hr <= 220)]           # 유효 범위 필터
    hr = hr.resample("1min").mean()
    # 오래 비어있는 구간(기기 미착용 등)까지 보간하면 없는 데이터를
    # 지어내는 셈이라, BPM_INTERP_LIMIT(분) 이상 공백은 보간하지 않는다.
    hr = hr.interpolate(method="time", limit=BPM_INTERP_LIMIT)

    # ── 혈중산소 (SpO2) ──────────────────────
    spo2 = df_p[df_p["display_name"] == "Oxygen saturation"].copy()
    spo2 = spo2.set_index("timestamp")["value"]
    spo2 = spo2 * 100                           # 0~1 비율 → % 변환
    spo2 = spo2[(spo2 >= 70) & (spo2 <= 100)]  # 유효 범위 필터
    spo2 = spo2.resample("1min").mean()
    spo2 = spo2.interpolate(method="time", limit=60)

    # ── 호흡수 ──────────────────────────────
    resp = df_p[df_p["display_name"] == "Respiratory rate"].copy()
    resp = resp.set_index("timestamp")["value"]
    resp = resp[(resp >= 5) & (resp <= 60)]     # 유효 범위 필터
    resp = resp.resample("1min").mean()
    resp = resp.interpolate(method="time", limit=60)

    # ── wide-format 합치기 ──────────────────
    wide = hr.to_frame("bpm")
    wide = wide.join(spo2.to_frame("spo2"), how="left")
    wide = wide.join(resp.to_frame("resp_rate"), how="left")
    wide = wide.reset_index()
    wide = wide.dropna(subset=["bpm"])
    wide = wide.sort_values("timestamp").reset_index(drop=True)

    print(f"\n[{person} 로드 완료]")
    if wide.empty:
        print("  심박수 데이터 없음 — 건너뜀")
        return wide
    print(f"  기간:    {wide['timestamp'].min()} ~ {wide['timestamp'].max()}")
    print(f"  심박수:  {wide['bpm'].notna().sum()}건")
    print(f"  SpO2:    {wide['spo2'].notna().sum()}건 (보간 포함)")
    print(f"  호흡수:  {wide['resp_rate'].notna().sum()}건 (보간 포함)")

    return wide


# ══════════════════════════════════════════
# STEP 1. 피처 추출
# ══════════════════════════════════════════

def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    심박수 하나에서 감정 분석에 필요한 피처 뽑기

    bpm_rolling_mean  10분 이동평균 (베이스라인)
    bpm_rolling_std   10분 이동표준편차 (HRV 대체)
    bpm_delta         현재 - 베이스라인 (얼마나 튀나)
    bpm_gradient      1분당 변화량 (얼마나 빠르게 올랐나)
    spo2_delta        SpO2 평소 대비 변화
    resp_delta        호흡수 평소 대비 변화
    hour              시간대
    """
    df = df.copy().sort_values("timestamp").reset_index(drop=True)

    WINDOW = 10  # 이동 윈도우 (분)

    # 심박수 피처
    df["bpm_rolling_mean"] = df["bpm"].rolling(WINDOW, min_periods=1).mean()
    df["bpm_rolling_std"]  = df["bpm"].rolling(WINDOW, min_periods=1).std().fillna(1)
    df["bpm_delta"]        = df["bpm"] - df["bpm_rolling_mean"]
    df["bpm_gradient"]     = df["bpm"].diff().fillna(0)

    # SpO2 피처
    if df["spo2"].notna().sum() > 0:
        spo2_filled        = df["spo2"].ffill()
        spo2_mean          = spo2_filled.rolling(WINDOW, min_periods=1).mean()
        df["spo2_delta"]   = spo2_filled - spo2_mean
    else:
        df["spo2_delta"]   = 0.0

    # 호흡수 피처
    if df["resp_rate"].notna().sum() > 0:
        resp_filled        = df["resp_rate"].ffill()
        resp_mean          = resp_filled.rolling(WINDOW, min_periods=1).mean()
        df["resp_delta"]   = resp_filled - resp_mean
    else:
        df["resp_delta"]   = 0.0

    # 시간 맥락
    df["hour"]             = df["timestamp"].dt.hour
    df["day_of_week"]      = df["timestamp"].dt.dayofweek

    return df


# ══════════════════════════════════════════
# STEP 2. Z-score 1차 필터
# ══════════════════════════════════════════

def zscore_filter(df: pd.DataFrame, threshold: float):
    """
    전후 60분 컨텍스트 기준 z-score 계산
    threshold 이상인 행만 후보로 통과
    """
    df = df.copy()

    roll         = df["bpm"].rolling(60, center=True, min_periods=5)
    ctx_mean     = roll.mean()
    ctx_std      = roll.std().clip(lower=1)
    df["z_score"] = (df["bpm"] - ctx_mean) / ctx_std

    candidates   = df[df["z_score"] > threshold].copy()

    print(f"\n[Z-score 필터]")
    print(f"  전체 {len(df)}행 → 후보 {len(candidates)}행")
    print(f"  (threshold={threshold})")

    return candidates, df


# ══════════════════════════════════════════
# STEP 3. Isolation Forest 2차 필터
# ══════════════════════════════════════════

def isolation_forest(candidates: pd.DataFrame,
                     full_df: pd.DataFrame,
                     contamination: float):
    """
    7개 피처 조합으로 진짜 이상치만 선별
    Z-score는 bpm만 보지만 IF는 다차원으로 봄
    """
    FEATURES = [
        "bpm",
        "bpm_delta",
        "bpm_gradient",
        "bpm_rolling_std",
        "spo2_delta",
        "resp_delta",
        "hour",
    ]
    cols = [c for c in FEATURES if c in full_df.columns]

    # 전체 데이터로 정상 패턴 학습
    scaler  = StandardScaler()
    X_full  = scaler.fit_transform(full_df[cols].fillna(0))

    model   = IsolationForest(
        contamination = contamination,
        n_estimators  = 100,
        random_state  = 42,
    )
    model.fit(X_full)

    # 후보에서 이상치(-1)만 선별
    X_cand              = scaler.transform(candidates[cols].fillna(0))
    result              = candidates.copy()
    result["if_label"]  = model.predict(X_cand)
    result["if_score"]  = model.score_samples(X_cand)

    anomalies = result[result["if_label"] == -1].copy()

    print(f"\n[Isolation Forest]")
    print(f"  후보 {len(candidates)}행 → 이상치 {len(anomalies)}행")

    return anomalies


# ══════════════════════════════════════════
# STEP 4. 이벤트 묶기 + 패턴 분류
# ══════════════════════════════════════════

def build_events(anomalies: pd.DataFrame,
                 full_df: pd.DataFrame,
                 min_duration: int) -> list[dict]:
    """
    연속된 이상치 행 → 하나의 이벤트로 묶기
    패턴 분류: 급격한_상승 / 완만한_상승 / 지속형
    """
    if anomalies.empty:
        return []

    df = anomalies.sort_values("timestamp").copy()
    df["gap"]   = df["timestamp"].diff().dt.total_seconds().fillna(0)
    df["group"] = (df["gap"] > 5 * 60).cumsum()  # 5분 이상 끊기면 새 그룹

    baseline = full_df["bpm"].quantile(0.3)  # 안정 상태 (하위 30%)

    events = []
    for _, group in df.groupby("group"):
        if len(group) < min_duration:
            continue

        start      = group["timestamp"].iloc[0]
        end        = group["timestamp"].iloc[-1]
        peak_bpm   = group["bpm"].max()
        peak_z     = group["z_score"].max()
        duration   = len(group)
        gradient   = group["bpm_gradient"].mean()
        if_score   = group["if_score"].min()

        # 회복 시간
        after      = full_df[full_df["timestamp"] > end].head(30)
        recovery   = 30.0
        for _, row in after.iterrows():
            if row["bpm"] <= baseline * 1.1:
                recovery = (row["timestamp"] - end).total_seconds() / 60
                break

        # 패턴 분류
        if gradient > 3.0:
            pattern = "급격한_상승"
        elif duration > 15:
            pattern = "지속형"
        else:
            pattern = "완만한_상승"

        events.append({
            "start":        start.strftime("%Y-%m-%d %H:%M"),
            "end":          end.strftime("%H:%M"),
            "peak_bpm":     round(float(peak_bpm), 1),
            "peak_zscore":  round(float(peak_z), 2),
            "duration_min": int(duration),
            "gradient":     round(float(gradient), 2),
            "recovery_min": round(float(recovery), 1),
            "pattern":      pattern,
            "if_score":     round(float(if_score), 3),
        })

    return events


# ══════════════════════════════════════════
# 결과 출력
# ══════════════════════════════════════════

def print_results(person: str, events: list[dict]):
    print(f"\n{'='*50}")
    print(f"[{person}] 감지된 이벤트: {len(events)}개")
    print(f"{'='*50}")

    for i, e in enumerate(events, 1):
        print(f"\n[{i}] {e['start']} ~ {e['end']}")
        print(f"  심박수:   {e['peak_bpm']:.0f} BPM")
        print(f"  z-score:  {e['peak_zscore']:.2f}  "
              f"({'★★★' if e['peak_zscore'] > 3 else '★★' if e['peak_zscore'] > 2 else '★'})")
        print(f"  지속:     {e['duration_min']}분")
        print(f"  회복:     {e['recovery_min']:.0f}분")
        print(f"  패턴:     {e['pattern']}")
        print(f"  IF점수:   {e['if_score']:.3f}")


# ══════════════════════════════════════════
# 사람 한 명에 대한 파이프라인 실행
# ══════════════════════════════════════════

def run_for_person(df_raw: pd.DataFrame, person: str) -> list[dict]:
    wide = build_wide(df_raw, person)
    if len(wide) < MIN_ROWS_PER_PERSON:
        print(f"  → 유효 데이터 {len(wide)}행 (< {MIN_ROWS_PER_PERSON}) — 건너뜀")
        return []

    df_feat = extract_features(wide)
    candidates, full_df = zscore_filter(df_feat, ZSCORE_THRESHOLD)
    anomalies = isolation_forest(candidates, full_df, IF_CONTAMINATION)
    events = build_events(anomalies, full_df, MIN_DURATION)
    print_results(person, events)
    return events


# ══════════════════════════════════════════
# 실행
# ══════════════════════════════════════════

if __name__ == "__main__":

    print("=" * 50)
    print("FEELBACK 이상치 탐지 (person별 분리 실행)")
    print("=" * 50)

    df_raw = load_raw(CSV_PATHS)
    persons = sorted(df_raw["person"].dropna().unique())
    print(f"\n대상 person: {persons}")

    results = {}
    for person in persons:
        results[person] = run_for_person(df_raw, person)

    # JSON 저장 (person을 키로 하는 dict)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    for person, events in results.items():
        print(f"  {person}: {len(events)}개")
    print(f"[저장] {OUTPUT_JSON}")
