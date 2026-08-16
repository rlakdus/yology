#!/usr/bin/env python3
"""라이브 Apple Watch 데모용 WebSocket 중계 서버.

iPhone 컴패니언 앱이 /ws/watch로 심박 샘플을 보내면, 최근 구간의 rolling
mean/std로 z-score를 매기고 급발현(짧은 시간 내 큰 상승)을 같이 확인해
feelback_residual.py의 급발현 게이트 개념을 활동 데이터 없는 단일 신호용으로
단순화한 판정을 내린다. 판정 결과는 /ws/viewer에 연결된 프런트엔드로 그대로
방송한다.

실행:
    pip install -r requirements.txt
    uvicorn server:app --host 0.0.0.0 --port 8000

--host 0.0.0.0으로 띄워야 같은 Wi-Fi의 iPhone이 Mac의 로컬 IP로 접속할 수 있다.
"""
import time
import uuid
from collections import deque
from statistics import mean, pstdev

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ---- 탐지 파라미터 (feelback_residual.py의 급발현 게이트를 실시간 단일 신호용으로 축소) ----
WINDOW_SECONDS = 120       # rolling baseline 계산에 쓰는 최근 구간
MIN_SAMPLES_FOR_BASELINE = 5
Z_THRESHOLD = 2.5          # 잔차 z 컷
ONSET_WINDOW_SECONDS = 20  # 급발현 판단 시 직전 샘플을 찾는 범위
ONSET_DELTA = 15           # 이 bpm 이상 급상승이면 급발현
ONSET_Z_RELAXED = 1.5      # 급발현 경로의 완화된 z 컷

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LiveState:
    def __init__(self) -> None:
        self.samples: deque[tuple[float, float]] = deque()  # (ts, bpm)
        self.viewers: set[WebSocket] = set()
        self.current_episode: dict | None = None
        self.episodes: dict[str, dict] = {}
        self.saved_events: list[dict] = []

    def add_sample(self, ts: float, bpm: float) -> dict:
        self.samples.append((ts, bpm))
        cutoff = ts - WINDOW_SECONDS
        while self.samples and self.samples[0][0] < cutoff:
            self.samples.popleft()

        history = [b for t, b in self.samples if t != ts]
        if len(history) < MIN_SAMPLES_FOR_BASELINE:
            baseline, std = bpm, 0.0
        else:
            baseline = mean(history)
            std = pstdev(history) or 1.0

        z = (bpm - baseline) / std if std else 0.0

        onset_cutoff = ts - ONSET_WINDOW_SECONDS
        earlier = [b for t, b in self.samples if t <= onset_cutoff]
        is_onset = bool(earlier) and (bpm - earlier[-1]) >= ONSET_DELTA

        anomaly = z >= Z_THRESHOLD or (is_onset and z >= ONSET_Z_RELAXED)

        return {
            "ts": ts,
            "bpm": bpm,
            "baseline": round(baseline, 1),
            "z": round(z, 2),
            "is_onset": is_onset,
            "anomaly": anomaly,
        }

    def update_episode(self, sample: dict) -> dict | None:
        """이상 탐지 결과를 기반으로 진행 중인 에피소드를 시작/갱신/종료한다."""
        if sample["anomaly"]:
            if self.current_episode is None:
                episode_id = uuid.uuid4().hex[:8]
                self.current_episode = {
                    "id": episode_id,
                    "start_ts": sample["ts"],
                    "end_ts": None,
                    "peak_bpm": sample["bpm"],
                    "baseline": sample["baseline"],
                    "peak_z": sample["z"],
                }
                self.episodes[episode_id] = self.current_episode
                return {"type": "moment_start", "episode": self.current_episode}

            ep = self.current_episode
            ep["peak_bpm"] = max(ep["peak_bpm"], sample["bpm"])
            ep["peak_z"] = max(ep["peak_z"], sample["z"])
            return None

        if self.current_episode is not None:
            ep = self.current_episode
            ep["end_ts"] = sample["ts"]
            self.current_episode = None
            return {"type": "moment_end", "episode": ep}

        return None

    async def broadcast(self, payload: dict) -> None:
        dead = []
        for viewer in self.viewers:
            try:
                await viewer.send_json(payload)
            except Exception:
                dead.append(viewer)
        for viewer in dead:
            self.viewers.discard(viewer)


state = LiveState()


@app.websocket("/ws/watch")
async def ws_watch(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            bpm = float(payload["bpm"])
            ts = float(payload.get("ts") or time.time())

            sample = state.add_sample(ts, bpm)
            await state.broadcast({"type": "sample", **sample})

            episode_event = state.update_episode(sample)
            if episode_event is not None:
                await state.broadcast(episode_event)
    except WebSocketDisconnect:
        pass


@app.websocket("/ws/viewer")
async def ws_viewer(websocket: WebSocket) -> None:
    await websocket.accept()
    state.viewers.add(websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") == "save_event":
                episode = state.episodes.get(payload.get("episode_id", ""))
                if episode is not None:
                    state.saved_events.append(episode)
                    await state.broadcast({"type": "event_saved", "episode": episode})
    except WebSocketDisconnect:
        pass
    finally:
        state.viewers.discard(websocket)


@app.get("/events")
def list_saved_events() -> list[dict]:
    return state.saved_events


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "viewers": len(state.viewers), "samples": len(state.samples)}
