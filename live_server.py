"""
VIVIA live heart-rate relay.

Data flow
---------
Apple Watch / iPhone -> ws://<MAC_IP>:8000/ws/watch
React frontend       <- ws://localhost:8000/ws/web

Incoming watch JSON:
{
  "type": "heart_rate",
  "bpm": 83,
  "timestamp": 1786723200.123
}

Run:
    pip install -r requirements-live.txt
    uvicorn live_server:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from collections import deque
from statistics import mean, pstdev
from typing import Any
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="VIVIA Live Signal Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

web_clients: set[WebSocket] = set()
history: deque[float] = deque(maxlen=60)

MIN_BASELINE_SAMPLES = 10
Z_THRESHOLD = 2.0


def analyze_bpm(bpm: float) -> dict[str, Any]:
    """
    Demo-only online detector.
    It detects deviation from the recent personal baseline; it does NOT infer emotion.
    """
    if len(history) < MIN_BASELINE_SAMPLES:
        baseline = mean(history) if history else bpm
        return {
            "baseline": round(float(baseline), 2),
            "z_score": 0.0,
            "is_anomaly": False,
        }

    baseline = mean(history)
    sigma = max(pstdev(history), 1.0)
    z_score = abs(bpm - baseline) / sigma

    return {
        "baseline": round(float(baseline), 2),
        "z_score": round(float(z_score), 3),
        "is_anomaly": bool(z_score >= Z_THRESHOLD),
    }


async def broadcast(payload: dict[str, Any]) -> None:
    stale: list[WebSocket] = []

    for client in web_clients:
        try:
            await client.send_json(payload)
        except Exception:
            stale.append(client)

    for client in stale:
        web_clients.discard(client)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "web_clients": len(web_clients),
        "baseline_samples": len(history),
    }


@app.websocket("/ws/watch")
async def watch_stream(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") != "heart_rate":
                continue

            try:
                bpm = float(data["bpm"])
            except (KeyError, TypeError, ValueError):
                continue

            if not 30 <= bpm <= 220:
                continue

            analysis = analyze_bpm(bpm)
            history.append(bpm)

            payload = {
                "type": "heart_rate",
                "bpm": round(bpm, 2),
                "timestamp": data.get("timestamp", time.time()),
                **analysis,
            }

            await broadcast(payload)

    except WebSocketDisconnect:
        return


@app.websocket("/ws/web")
async def web_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    web_clients.add(websocket)

    try:
        # Keep the browser connection open. We do not require messages from it.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        web_clients.discard(websocket)
    except Exception:
        web_clients.discard(websocket)
