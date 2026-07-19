#!/usr/bin/env python3
"""Feelback v3: 실측 활동으로 설명되지 않는 심박 상승(잔차) 탐지 + HRV 교차확인.

v2까지는 걸음수가 없어서 활동을 심박 샘플링 밀도로 "추정"할 수밖에 없었고,
그 결과 "활동 중 심박 171"이 질주인지 감정인지 구분 못 해 상당수를 판정 유보(Tier
B/C)했다. export.xml이 확보되면서 그 한계가 풀렸다:

    - 걸음수/계단/활동에너지/신체활동강도(PhysicalEffort) = 실측 활동 부하
    - HRV(SDNN)                                          = 감정의 직접 생리 증거

이제 질문은 완전히 데이터로 답할 수 있다: **"이 심박이 방금 한 실제 신체 활동으로
설명되는가? 안 된다면 HRV가 함께 떨어졌는가?"**

    기대HR = 시간대 기준선 + f(걸음/계단)      ← 예측엔 가속도계 기반 신호만 (아래 ⚠)
    잔차   = 실제HR − 기대HR
    탐지   = 잔차가 큰 순간  (motion_context 라벨과 무관 — 실측 걸음수가 움직임을 정량화)
    확인   = 그 순간 HRV가 개인 기준선 대비 눌렸는가

핵심 개선: v2는 motion_context=2(활동)면 통째로 판정 유보했지만, v3는 걸음수가
움직임을 수치로 말해주므로 **"살짝 걷는 중의 감정 반응"(걸음 조금 + 심박 급등)도
잡는다.** 원래 목표였던 "달리기·계단 오르기 외의 감정 변화"가 이제 가능하다.

단, 걸음이 안 찍히는 정지성 운동(실내 자전거·근력)은 걸음으로 못 거르므로, 워치가
초 단위로 밀집 기록하는 특성을 이용한 밀도 기반 세션 탐지로 따로 배제한다
(detect_sessions). 걸음 피처와 밀도 세션은 상호 보완이다.

추가 축 두 개:
    - 심박 회복 속도(HRR, attach_recovery): 피크 후 하강이 느리면 지속성(긴장성) 각성,
      빠르면 위상성(놀람) 각성. 느린 회복에 가점 — 순위에만 영향, 탐지 게이트 불변.
    - 만성 저조(daily_condition): 급성 스파이크와 반대 시그니처(심박 평범 + 하루 종일
      HRV 바닥 + 안정시심박 상승)를 일 단위로 별도 판정 → feelback_daily_condition.csv.

## 활동 피처 정렬 (구간→순간)

걸음수 등은 start~end 구간의 누적값이다. 순간 측정인 심박에 붙이려면 분 단위
타임라인으로 펼친 뒤 창(window) 합으로 되집계한다 (build_activity_timeline).
걸음 소스는 iPhone(전 기간 커버, 구간 겹침 0%)만 쓴다 — Watch와 섞으면 이중계상된다.

사용법:
    python3 feelback_residual.py [--vitals data/export_vitals.csv]
                                 [--activity data/export_activity.csv] [--outdir data]
"""
import argparse
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd

# ---- 운동 세션 탐지 (샘플링 밀도 기반) ------------------------------------
# 걸음·계단은 걷기·계단 강도는 잘 잡지만, 걸음이 안 찍히는 정지성 운동(실내 자전거,
# 근력, 심박 버스트)을 놓친다. 그런 구간은 워치가 초 단위로 밀집 기록하므로 샘플링
# 밀도가 곧 세션 라벨이다. 걸음 피처와 밀도 세션은 상호 보완이라 둘 다 쓴다.
SESSION_GAP_S = 30        # 이 간격 이내로 이어지면 같은 런
SESSION_MIN_N = 5         # 런 크기 ≥ 이 값이고
SESSION_MED_GAP_S = 15.0  # 런 내부 간격 중앙값 ≤ 이 값이면 고밀도 런
SESSION_BRIDGE_MIN = 5.0  # 고밀도 런 사이 ≤ 이 간격이면 이어붙여 한 세션으로

# ---- 활동 피처 창 ----------------------------------------------------------
WIN_RECENT_MIN = 5       # 직전 0~5분 (진행 중 활동 + 급성 회복)
STEP_SOURCE = "iPhone"   # 걸음 기준 소스 (구간 겹침 0%, 전 기간 커버)

# 활동 부하 피처: (metric, 창분) → 컬럼명.
#
# ⚠ 예측 피처는 반드시 "가속도계 기반 순수 움직임 신호"(걸음·계단)만 쓴다.
# ActiveEnergyBurned와 PhysicalEffort는 상관은 더 높지만(에너지 +0.81) Apple이
# 심박에서 역산하는 값이라 치명적 순환논리를 일으킨다. 실측 확인 결과, 걸음이 정확히
# 0(=움직임 전무)인 샘플에서도 에너지>5kcal이면 심박 중앙 157, 에너지≤5면 83이었다.
# 즉 에너지를 예측에 넣으면 "심박 157은 33kcal 활동으로 설명됨"이라며 정작 찾으려는
# 감정성 급등을 스스로 지워버린다. 걸음·계단은 HR과 독립이라 이 오염이 없다.
ACT_FEATURES = [
    ("steps", WIN_RECENT_MIN, "steps_5m"),
    ("flights", WIN_RECENT_MIN, "flights_5m"),
]
FEATURE_COLS = [c for _, _, c in ACT_FEATURES]

# 에너지·활동강도는 예측엔 못 쓰지만, 탐지 결과를 사람이 읽을 때 참고용으로 붙인다.
REPORT_FEATURES = [
    ("active_energy", WIN_RECENT_MIN, "energy_5m"),
    ("physical_effort", WIN_RECENT_MIN, "effort_5m"),
]

# ---- 탐지 ------------------------------------------------------------------
Z_THRESHOLD = 2.5        # 잔차 robust z 컷
ONSET_WINDOW_MIN = 15    # 급발현 판단 시 직전 샘플을 찾는 범위(분)
ONSET_DELTA = 15         # 이 bpm 이상 급상승이면 급발현
ONSET_Z_RELAXED = 1.5    # 급발현 경로의 완화된 z 컷 (2경로 게이트)
MERGE_GAP_MIN = 10       # 이 간격 이내 연속 탐지는 한 에피소드로 병합(분)
NIGHT_HOURS = set(range(23, 24)) | set(range(0, 7))
RESP_WINDOW_MIN = 10
RESP_ELEVATED = 18

# ---- 심박 회복 속도 (HRR) — 지속성 각성 축 -------------------------------
# 급발현(onset)은 상승만 본다. 하강 프로파일이 위상성(놀람: 빠른 회복) vs 긴장성
# (지속 스트레스: 느린 회복/정체)을 가른다. 실측: 고립 스파이크 16.8·야간각성 8.8
# bpm/분 vs 검증 최강 커피챗긴장 1.2·HRV붕괴 1.1 bpm/분 → 3 bpm/분이 둘을 깨끗이 가른다.
# 가장 확실히 검증된 감정 사건일수록 회복이 느려, 느린 HRR은 지속성 각성의 증거다.
RECOVERY_MIN_LAG = 1.5    # 피크 후 이 분 이상 뒤 샘플부터 회복 측정(즉시 노이즈 제외)
RECOVERY_MAX_MIN = 5.0    # 이 분 이내에서 가장 이른 회복 샘플을 쓴다
HRR_SLOW = 3.0            # 회복 기울기 ≤ 이 값(bpm/분)이면 느린 회복
SUSTAINED_MARGIN = 10     # 회복 시점에도 심박이 기준선 대비 이 bpm 이상 높으면 정체
SUSTAINED_BONUS = 1.0     # 지속성 각성 가점 (순위에만 영향 — 탐지 게이트 불변)

# "가만히 있었다"의 실측 정의 (motion_context 라벨 대신):
# 직전 5분 걸음이 이 이하면 사실상 정지 상태로 본다.
SEDENTARY_STEPS_5M = 20

# HRV 교차확인: 근처(±분) HRV가 개인 중앙값 대비 이 비율 이하면 "눌림"
HRV_WINDOW_MIN = 20
HRV_DROP_RATIO = 0.75

# ---- 만성 저조 (일 단위) ---------------------------------------------------
# 급성 스파이크 모델이 구조적으로 놓치는 시그니처: 심박은 평범한데 하루 종일 HRV가
# 바닥이고 안정시심박이 들린 날 (예: 7/05 컨디션 저조 — HRV 14~18ms vs 개인 32ms).
DAILY_HRV_LOW_RATIO = 0.75   # 일 중앙 HRV가 개인 중앙값의 이 비율 미만이면 저조
DAILY_HRV_MIN_N = 2          # 하루 HRV 표본이 이보다 적으면 판정 유보
DAILY_RHR_ELEVATED = 5       # 안정시심박이 개인 중앙값보다 이 bpm 이상 높으면 가중 증거


def load_vitals(path: Path):
    v = pd.read_csv(path, parse_dates=["timestamp"])
    def pick(name):
        return v[v["display_name"] == name].sort_values("timestamp").reset_index(drop=True)
    return (pick("Heart rate"), pick("Respiratory rate"), pick("HRV SDNN"),
            pick("Resting heart rate"))


def detect_sessions(hr: pd.DataFrame) -> pd.DataFrame:
    """고밀도 연속 구간을 운동 세션으로 표시한다 (걸음이 안 잡히는 정지성 운동 포함).

    워치는 운동 심박을 끊긴 버스트로 기록하므로, 가까운 고밀도 런을 이어붙여 세션
    경계를 복원한다.
    """
    gap_s = hr["timestamp"].diff().dt.total_seconds()
    run_id = (gap_s.isna() | (gap_s > SESSION_GAP_S)).cumsum()

    runs = []
    for _, idx in hr.groupby(run_id).groups.items():
        if len(idx) < SESSION_MIN_N:
            continue
        inner = gap_s.loc[idx].iloc[1:]
        if len(inner) and inner.median() <= SESSION_MED_GAP_S:
            runs.append((hr.loc[idx, "timestamp"].min(), hr.loc[idx, "timestamp"].max()))
    runs.sort()

    sessions = []
    for start, end in runs:
        if sessions and (start - sessions[-1][1]).total_seconds() / 60 <= SESSION_BRIDGE_MIN:
            sessions[-1] = (sessions[-1][0], max(end, sessions[-1][1]))
        else:
            sessions.append((start, end))

    hr["in_session"] = False
    for start, end in sessions:
        hr.loc[hr["timestamp"].between(start, end), "in_session"] = True
    hr.attrs["sessions"] = sessions
    return hr


def build_activity_timeline(activity: pd.DataFrame, t0, t1) -> dict:
    """구간 측정을 분 단위 값 배열로 펼친다. 반환: metric -> (분index0=t0 기준 누적합).

    각 구간의 값을 그 구간이 덮는 분들에 균등 배분한다. 그러면 임의의 창 [a,b] 합은
    누적합의 차분으로 O(1)에 구해진다. 같은 소스 내 구간은 겹치지 않으므로 이중계상 없다.
    """
    total_min = int((t1 - t0).total_seconds() // 60) + 2
    timelines = {}
    for metric in {m for m, _, _ in ACT_FEATURES + REPORT_FEATURES}:
        g = activity[activity["metric"] == metric]
        if metric == "steps":
            g = g[g["source_name"] == STEP_SOURCE]
        grid = np.zeros(total_min + 1)
        for start, end, val in zip(g["start"], g["end"], g["value"]):
            if pd.isna(val) or end < t0 or start > t1:
                continue
            s = max((start - t0).total_seconds() / 60, 0)
            e = min((end - t0).total_seconds() / 60, total_min)
            span = max(e - s, 1e-6)
            i0, i1 = int(np.floor(s)), int(np.ceil(e))
            for i in range(i0, min(i1, total_min)):
                overlap = min(i + 1, e) - max(i, s)
                if overlap > 0:
                    grid[i] += val * overlap / span
        timelines[metric] = np.concatenate([[0.0], np.cumsum(grid)])  # prefix[i]=합(0..i-1)
    timelines["_t0"] = t0
    timelines["_total_min"] = total_min
    return timelines


def window_sum(timeline: dict, metric: str, ts: pd.Series, win_min: int) -> np.ndarray:
    """각 시각 ts에 대해 [ts-win, ts] 구간의 metric 합."""
    t0, total = timeline["_t0"], timeline["_total_min"]
    pref = timeline[metric]
    end_min = ((ts - t0).dt.total_seconds() / 60).clip(0, total).to_numpy()
    start_min = np.clip(end_min - win_min, 0, total)
    ei = np.floor(end_min).astype(int)
    si = np.floor(start_min).astype(int)
    return pref[ei] - pref[si]


def attach_features(hr: pd.DataFrame, timeline: dict) -> pd.DataFrame:
    for metric, win, col in ACT_FEATURES + REPORT_FEATURES:
        hr[col] = window_sum(timeline, metric, hr["timestamp"], win)
    hr["sedentary"] = hr["steps_5m"] <= SEDENTARY_STEPS_5M
    return hr


def circadian_baseline(hr: pd.DataFrame) -> pd.Series:
    """시간대별 안정 시(실측 걸음 기준) 심박 기준선, 인접 ±1시간 원형 평활."""
    rest = hr[hr["sedentary"]]
    med = rest.groupby(rest["timestamp"].dt.hour)["value"].median()
    global_med = rest["value"].median()
    table = {}
    for h in range(24):
        neighbors = [(h - 1) % 24, h, (h + 1) % 24]
        meds = [med[n] for n in neighbors if n in med.index]
        table[h] = float(np.mean(meds)) if meds else float(global_med)
    return pd.Series(table)


def huber_fit(X, y, delta=1.35, iters=30):
    """IRLS Huber 회귀. 감정 에피소드(소수 이상치)가 계수를 끌고가지 않게 한다."""
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    for _ in range(iters):
        resid = y - X @ beta
        scale = max(1.4826 * np.median(np.abs(resid - np.median(resid))), 1e-6)
        u = np.abs(resid) / scale
        w = np.where(u <= delta, 1.0, delta / np.maximum(u, 1e-9))
        XW = X * w[:, None]
        new = np.linalg.lstsq(XW.T @ X, XW.T @ y, rcond=None)[0]
        if np.allclose(new, beta, rtol=1e-6, atol=1e-8):
            return new
        beta = new
    return beta


def fit_expected(hr: pd.DataFrame):
    """기대HR = 기준선 + f(실측 활동). 잔차 z는 활동 수준별로 척도를 잡는다."""
    X = np.column_stack([np.ones(len(hr))] + [hr[c].to_numpy() for c in FEATURE_COLS])
    y = (hr["value"] - hr["baseline"]).to_numpy(dtype=float)
    beta = huber_fit(X, y)
    hr["expected"] = hr["baseline"] + X @ beta
    hr["residual"] = hr["value"] - hr["expected"]

    # 활동 시 잔차는 넓게, 정지 시 좁게 흩어진다(강도 추정 오차). 하나의 척도로 재면
    # 활동 잔차가 산포를 부풀려 정지 상태의 조용한 감정 반응을 묻어버린다.
    hr["z"] = np.nan
    for _, grp in hr.groupby("sedentary"):
        r = grp["residual"]
        mad = max((r - r.median()).abs().median(), 1.0)
        hr.loc[grp.index, "z"] = (r - r.median()) / (1.4826 * mad)
    return hr, beta


def attach_hrv(hr: pd.DataFrame, hrv: pd.DataFrame) -> pd.DataFrame:
    """각 심박 샘플 근처 HRV와, 그것이 개인 기준선 대비 눌렸는지.

    (워치는 운동 중 SDNN을 기록하지 않아 이 데이터의 HRV는 전부 세션 밖이다. 실측
    확인 결과 세션 내 HRV 0건 → 운동 오염 배제는 이득 없이 참양성만 제거하므로 안 쓴다.)
    """
    hr["hrv_nearby"] = np.nan
    hr["hrv_depressed"] = False
    if hrv.empty:
        return hr
    hrv_med = hrv["value"].median()
    idx = pd.merge_asof(
        hr[["timestamp"]], hrv[["timestamp", "value"]].rename(columns={"value": "hrv"}),
        on="timestamp", direction="nearest", tolerance=pd.Timedelta(minutes=HRV_WINDOW_MIN))
    hr["hrv_nearby"] = idx["hrv"].to_numpy()
    hr["hrv_depressed"] = hr["hrv_nearby"] < hrv_med * HRV_DROP_RATIO
    return hr


def daily_condition(hrv: pd.DataFrame, resting: pd.DataFrame) -> pd.DataFrame:
    """만성 저조 모듈: 급성 스파이크와 반대 시그니처(심박 평범 + HRV 바닥)를 일 단위로 잡는다.

    급성 각성만 보는 잔차 모델은 "며칠에 걸친 HRV 저하 + 안정시심박 상승"으로 나타나는
    컨디션 저조를 구조적으로 놓친다(문서 한계 4, 7/05 사례). 이를 일 단위로 별도 판정한다:

    일 중앙 HRV가 개인 중앙값의 DAILY_HRV_LOW_RATIO 미만이면 저조일 후보.
    안정시심박이 개인 중앙값보다 DAILY_RHR_ELEVATED bpm 이상 높으면 가중 증거로 붙인다.
    """
    if hrv.empty:
        return pd.DataFrame()
    personal_med = hrv["value"].median()

    day = hrv.groupby(hrv["timestamp"].dt.date)["value"].agg(["median", "count"])
    day.columns = ["hrv_day_med", "hrv_n"]
    day["hrv_ratio"] = day["hrv_day_med"] / personal_med

    if not resting.empty:
        rhr_med = resting["value"].median()
        rhr_day = resting.groupby(resting["timestamp"].dt.date)["value"].median()
        day["resting_hr"] = rhr_day
        day["rhr_delta"] = day["resting_hr"] - rhr_med

    day["low_condition"] = (day["hrv_ratio"] < DAILY_HRV_LOW_RATIO) & (day["hrv_n"] >= DAILY_HRV_MIN_N)

    def note(row):
        if not row["low_condition"]:
            return ""
        parts = [f"일 HRV {row['hrv_day_med']:.0f}ms = 개인 중앙값 {personal_med:.0f}ms의 "
                 f"{row['hrv_ratio'] * 100:.0f}% (표본 {int(row['hrv_n'])}개)"]
        if pd.notna(row.get("rhr_delta")) and row["rhr_delta"] >= DAILY_RHR_ELEVATED:
            parts.append(f"안정시심박 +{row['rhr_delta']:.0f}bpm")
        return "; ".join(parts)
    day["evidence"] = day.apply(note, axis=1)
    return day.reset_index(names="date")


def attach_recovery(hr: pd.DataFrame) -> pd.DataFrame:
    """각 심박 샘플의 회복 프로파일 — 피크 후 심박이 얼마나 빨리 내려오는가.

    피크 후 [RECOVERY_MIN_LAG, RECOVERY_MAX_MIN]분 사이의 가장 이른 샘플 하나로 회복
    기울기를 잰다(희소 샘플링이라 곡선 피팅은 무리 → 단순 기울기). 느린 회복 + 회복
    시점에도 기준선 대비 높음 + 정지 상태 = 지속성(긴장성) 각성. 회복 창에 걸음이 끼면
    걷기 지속과 구분 안 되므로 정지 조건으로 배제한다. 회복 샘플이 없으면 NA(불이익 없음).
    """
    # tz-aware 타임스탬프는 to_numpy()가 object라 초 단위 float로 환산해 다룬다.
    sec = (hr["timestamp"] - hr["timestamp"].iloc[0]).dt.total_seconds().to_numpy()
    val = hr["value"].to_numpy(dtype=float)
    n = len(hr)
    lag = RECOVERY_MIN_LAG * 60
    maxw = RECOVERY_MAX_MIN * 60
    lo = np.searchsorted(sec, sec + lag, side="left")   # 첫 t≥ t_i+lag
    hi = np.searchsorted(sec, sec + maxw, side="right")  # t≤ t_i+maxw 개수

    rec_hr = np.full(n, np.nan)
    rec_dt = np.full(n, np.nan)
    for i in range(n):
        j = lo[i]
        if i < j < hi[i]:
            rec_hr[i] = val[j]
            rec_dt[i] = (sec[j] - sec[i]) / 60.0
    hr["recovery_hr"] = rec_hr
    hr["hrr_slope"] = (val - rec_hr) / rec_dt          # 클수록 빠른 회복(위상성)
    hr["sustained"] = (
        pd.notna(rec_hr)
        & (hr["hrr_slope"] <= HRR_SLOW)
        & (rec_hr - hr["baseline"].to_numpy() >= SUSTAINED_MARGIN)
        & hr["sedentary"]
    )
    return hr


def score(hr: pd.DataFrame, resp: pd.DataFrame) -> pd.DataFrame:
    hours = hr["timestamp"].dt.hour
    gap_min = hr["timestamp"].diff().dt.total_seconds() / 60.0
    hr["onset_delta"] = hr["value"].diff().where(gap_min <= ONSET_WINDOW_MIN)
    hr["is_onset"] = hr["onset_delta"] >= ONSET_DELTA

    def resp_near(ts):
        if resp.empty:
            return np.nan
        d = (resp["timestamp"] - ts).abs().dt.total_seconds() / 60.0
        near = resp.loc[d <= RESP_WINDOW_MIN, "value"]
        return near.max() if not near.empty else np.nan
    hr["resp_nearby"] = hr["timestamp"].map(resp_near)

    hr["score"] = (
        hr["z"]
        + hr["is_onset"].astype(float) * 1.0
        + hr["sustained"].astype(float) * SUSTAINED_BONUS   # 느린 회복 = 지속성 각성
        + hours.isin(NIGHT_HOURS).astype(float) * 1.0
        + (hr["resp_nearby"] >= RESP_ELEVATED).astype(float) * 0.5
        + hr["hrv_depressed"].astype(float) * 1.5   # 감정의 직접 생리 증거 — 최고 가점
    )
    return hr


def group_episodes(flagged: pd.DataFrame) -> pd.DataFrame:
    if flagged.empty:
        return pd.DataFrame()
    gap = flagged["timestamp"].diff().dt.total_seconds() / 60.0
    episode_id = (gap.isna() | (gap > MERGE_GAP_MIN)).cumsum()

    def summarize(g: pd.DataFrame) -> pd.Series:
        peak = g.loc[g["score"].idxmax()]
        act = "정지(걸음<20)" if peak["sedentary"] else f"걸음 {peak['steps_5m']:.0f}/5분"
        reasons = [f"기대{peak['expected']:.0f}(기준선{peak['baseline']:.0f}"
                   f"+활동{peak['expected'] - peak['baseline']:+.0f}) 대비 실제{peak['value']:.0f} "
                   f"→ 초과 {peak['residual']:+.0f}bpm (z={peak['z']:.1f}); 직전5분 {act}"]
        if peak["is_onset"]:
            reasons.append(f"급발현 +{peak['onset_delta']:.0f}bpm")
        # 회복 프로파일: 느린 회복=지속성(긴장성), 빠른 회복=위상성(놀람)
        arousal = None
        if peak["sustained"]:
            arousal = "지속성"
            reasons.append(f"지속성 각성(회복 {peak['hrr_slope']:.1f}bpm/분, "
                           f"{peak['recovery_hr']:.0f}까지만 하강)")
        elif pd.notna(peak["hrr_slope"]) and peak["hrr_slope"] >= HRR_SLOW:
            arousal = "위상성"
            reasons.append(f"위상성(빠른 회복 {peak['hrr_slope']:.1f}bpm/분)")
        if peak["hrv_depressed"]:
            reasons.append(f"HRV 눌림 {peak['hrv_nearby']:.0f}ms")
        if peak["timestamp"].hour in NIGHT_HOURS:
            reasons.append("야간")
        if pd.notna(peak["resp_nearby"]) and peak["resp_nearby"] >= RESP_ELEVATED:
            reasons.append(f"호흡수↑ {peak['resp_nearby']:.0f}/min")
        return pd.Series({
            "start": g["timestamp"].min(),
            "end": g["timestamp"].max(),
            "duration_min": round((g["timestamp"].max() - g["timestamp"].min()).total_seconds() / 60, 1),
            "n_samples": len(g),
            "peak_hr": g["value"].max(),
            "expected_hr": round(peak["expected"], 1),
            "excess_bpm": round(g["residual"].max(), 1),
            "steps_5m": round(peak["steps_5m"]),
            "hrv_ms": round(peak["hrv_nearby"], 1) if pd.notna(peak["hrv_nearby"]) else None,
            "hrr_slope": round(peak["hrr_slope"], 1) if pd.notna(peak["hrr_slope"]) else None,
            "arousal": arousal,
            "peak_z": round(g["z"].max(), 2),
            "score": round(peak["score"], 2),
            "evidence": "; ".join(reasons),
        })

    eps = flagged.groupby(episode_id).apply(summarize, include_groups=False)
    return eps.sort_values("score", ascending=False).reset_index(drop=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--vitals", default="data/export_vitals.csv", type=Path)
    p.add_argument("--activity", default="data/export_activity.csv", type=Path)
    p.add_argument("--outdir", default="data", type=Path)
    args = p.parse_args()

    hr_all, resp, hrv, resting = load_vitals(args.vitals)
    activity = pd.read_csv(args.activity, parse_dates=["start", "end"])

    hr_all = detect_sessions(hr_all)
    sessions = hr_all.attrs["sessions"]
    timeline = build_activity_timeline(activity, hr_all["timestamp"].min(), hr_all["timestamp"].max())
    hr_all = attach_features(hr_all, timeline)

    # 운동 세션(정지성 운동 포함) 내부는 후보에서 제외 — 걸음이 없어도 강도를 못 재
    # 감정과 운동을 분리할 수 없다. 세션 밖은 걸음·계단으로 기대HR을 보정해 판정한다.
    hr = hr_all[~hr_all["in_session"]].copy().reset_index(drop=True)
    hr["baseline"] = hr["timestamp"].dt.hour.map(circadian_baseline(hr))
    hr, beta = fit_expected(hr)
    hr = attach_hrv(hr, hrv)
    hr = attach_recovery(hr)
    hr = score(hr, resp)

    strong = hr["z"] >= Z_THRESHOLD
    onset_path = hr["is_onset"] & (hr["z"] >= ONSET_Z_RELAXED)
    flagged = hr[strong | onset_path].copy()
    episodes = group_episodes(flagged)

    n_sess = len(sessions)
    print(f"심박 {len(hr_all)}건 → 운동 세션 {n_sess}개({int(hr_all['in_session'].sum())}건) 제외 "
          f"→ 후보 {len(hr)}건")
    print(f"  실측 정지 상태(걸음<{SEDENTARY_STEPS_5M}/5분): {int(hr['sedentary'].sum())}건 / "
          f"활동 중: {int((~hr['sedentary']).sum())}건")
    print(f"  HRV 부착: {int(hr['hrv_nearby'].notna().sum())}건 (±{HRV_WINDOW_MIN}분 이내)")
    print("\n기대HR 회귀 계수:")
    for name, b in zip(["절편"] + FEATURE_COLS, beta):
        print(f"  {name:12s} {b:+8.3f}")
    print(f"\n탐지 {len(flagged)}건 → 에피소드 {len(episodes)}개")
    if episodes.empty:
        print("탐지된 에피소드가 없습니다.")
        return
    n_sus = int((episodes["arousal"] == "지속성").sum())
    n_pha = int((episodes["arousal"] == "위상성").sum())
    print(f"  회복 프로파일: 지속성(긴장성) {n_sus}개 / 위상성(놀람) {n_pha}개 / 불명 "
          f"{len(episodes) - n_sus - n_pha}개")

    out = args.outdir / "feelback_residual_episodes.csv"
    episodes.to_csv(out, index=False)
    cols = ["start", "duration_min", "peak_hr", "expected_hr", "excess_bpm",
            "steps_5m", "hrv_ms", "hrr_slope", "arousal", "peak_z", "score"]
    with pd.option_context("display.width", 220):
        print(episodes[cols].to_string(index=False))
    print(f"\nsaved -> {out}")

    # 급성 스파이크와 별개로, 일 단위 만성 저조(HRV 바닥 + 안정시심박 상승)를 판정한다.
    daily = daily_condition(hrv, resting)
    if not daily.empty:
        daily_out = args.outdir / "feelback_daily_condition.csv"
        daily.to_csv(daily_out, index=False)
        low = daily[daily["low_condition"]]
        print(f"\n만성 저조 판정: {len(daily)}일 중 {len(low)}일")
        for _, row in low.iterrows():
            print(f"  {row['date']}  {row['evidence']}")
        print(f"saved -> {daily_out}")


if __name__ == "__main__":
    main()
