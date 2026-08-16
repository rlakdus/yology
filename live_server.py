"""
VIVIA live signal + moment server.

Data flow
---------
Apple Watch -> HTTP POST http://<MAC_IP>:8000/heart-rate
Apple Watch -> HTTP POST http://<MAC_IP>:8000/moments/watch   ("기록하기")
React       <- WebSocket ws://localhost:8000/ws/web
React       -> GET/POST/PATCH http://localhost:8000/moments

Run:
    pip install -r requirements-live.txt
    uvicorn live_server:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, pstdev
from typing import Any
import json
import os
import time
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

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
latest_signal: dict[str, Any] | None = None

MIN_BASELINE_SAMPLES = 10
Z_THRESHOLD = 1.5

MOMENTS_DIR = Path("data/live_moments")
MOMENTS_DIR.mkdir(parents=True, exist_ok=True)
MAX_PHOTO_BYTES = 10 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class HeartRatePayload(BaseModel):
    bpm: float
    timestamp: float | None = None
    motion: float | None = None
    active_energy_kcal: float | None = None
    distance_m: float | None = None


class NarrativeRequest(BaseModel):
    momentId: str
    title: str
    date: str
    time: str
    location: str
    description: str
    note: str | None = None
    heartRate: float
    baseline: float
    zScore: float
    movement: str
    motion: float
    activeEnergy: float
    oxygen: float | None = None
    respiration: float | None = None
    evidence: list[str] = []


def analyze_bpm(bpm: float) -> dict[str, Any]:
    """Demo-only deviation detector; it does not infer emotion."""
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


def _moment_dir(moment_id: str) -> Path:
    # Prevent path traversal; IDs created by this server contain only safe chars.
    if not moment_id.startswith("moment_") or "/" in moment_id or ".." in moment_id:
        raise HTTPException(status_code=400, detail="Invalid moment id")
    return MOMENTS_DIR / moment_id


def _read_moment(moment_dir: Path) -> dict[str, Any]:
    metadata_path = moment_dir / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Moment not found")
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def _write_moment(moment_dir: Path, metadata: dict[str, Any]) -> None:
    (moment_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _new_moment_metadata(
    *,
    source: str,
    note: str = "",
    signal: dict[str, Any] | None = None,
) -> tuple[Path, dict[str, Any]]:
    moment_id = f"moment_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    moment_dir = MOMENTS_DIR / moment_id
    moment_dir.mkdir(parents=True, exist_ok=False)
    metadata = {
        "id": moment_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "note": note.strip(),
        "photo": None,
        "status": "captured" if not note else "enriched",
        "signal": signal or {},
    }
    _write_moment(moment_dir, metadata)
    return moment_dir, metadata


async def _save_photo(moment_dir: Path, photo: UploadFile | None) -> str | None:
    if not photo or not photo.filename:
        return None

    content_type = (photo.content_type or "").lower()
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=415,
            detail="사진은 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.",
        )

    content = await photo.read(MAX_PHOTO_BYTES + 1)
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="사진은 10MB 이하만 업로드할 수 있습니다.")
    if not content:
        raise HTTPException(status_code=400, detail="빈 이미지 파일입니다.")

    # Remove an earlier photo if the user replaces it.
    for old in moment_dir.glob("photo.*"):
        old.unlink(missing_ok=True)

    photo_name = f"photo{ALLOWED_PHOTO_TYPES[content_type]}"
    (moment_dir / photo_name).write_bytes(content)
    return photo_name


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "web_clients": len(web_clients),
        "baseline_samples": len(history),
        "moment_count": sum(1 for p in MOMENTS_DIR.iterdir() if p.is_dir()),
        "latest_signal": latest_signal,
    }


@app.post("/heart-rate")
async def receive_heart_rate(data: HeartRatePayload) -> dict[str, Any]:
    global latest_signal

    bpm = float(data.bpm)
    if not 30 <= bpm <= 220:
        raise HTTPException(status_code=400, detail="invalid_bpm")

    analysis = analyze_bpm(bpm)
    history.append(bpm)

    motion = None if data.motion is None else max(0.0, float(data.motion))
    active_energy = None if data.active_energy_kcal is None else max(0.0, float(data.active_energy_kcal))
    distance_m = None if data.distance_m is None else max(0.0, float(data.distance_m))

    if motion is None:
        movement_state = "unknown"
    elif motion < 0.035:
        movement_state = "still"
    elif motion < 0.12:
        movement_state = "light"
    else:
        movement_state = "active"

    payload = {
        "type": "heart_rate",
        "bpm": round(bpm, 2),
        "timestamp": data.timestamp or time.time(),
        "motion": None if motion is None else round(motion, 4),
        "movement_state": movement_state,
        "active_energy_kcal": None if active_energy is None else round(active_energy, 3),
        "distance_m": None if distance_m is None else round(distance_m, 2),
        **analysis,
    }
    latest_signal = payload

    print(
        f"❤️ WATCH BPM: {bpm:.0f} | baseline={analysis['baseline']} | "
        f"z={analysis['z_score']} | anomaly={analysis['is_anomaly']} | "
        f"motion={payload['motion']} ({payload['movement_state']}) | kcal={payload['active_energy_kcal']}"
    )

    await broadcast(payload)
    return {"ok": True, **payload}


@app.post("/moments/watch")
async def capture_moment_from_watch() -> dict[str, Any]:
    """Called by the Watch when the user taps '기록하기'."""
    signal = dict(latest_signal or {})
    _, metadata = _new_moment_metadata(source="apple_watch", signal=signal)
    print(f"⌚ MOMENT CAPTURED FROM WATCH: {metadata['id']}")
    await broadcast({"type": "moment_saved", "moment": metadata})
    return {"ok": True, "moment": metadata}


@app.post("/moments")
async def save_moment(
    note: str = Form(""),
    bpm: float | None = Form(None),
    baseline: float | None = Form(None),
    z_score: float | None = Form(None),
    is_anomaly: bool = Form(False),
    signal_timestamp: float | None = Form(None),
    motion: float | None = Form(None),
    movement_state: str | None = Form(None),
    active_energy_kcal: float | None = Form(None),
    distance_m: float | None = Form(None),
    photo: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Create a moment from the web and optionally enrich it with a photo."""
    signal = {
        "type": "heart_rate",
        "bpm": bpm,
        "baseline": baseline,
        "z_score": z_score,
        "is_anomaly": is_anomaly,
        "timestamp": signal_timestamp,
        "motion": motion,
        "movement_state": movement_state,
        "active_energy_kcal": active_energy_kcal,
        "distance_m": distance_m,
    }
    moment_dir, metadata = _new_moment_metadata(source="web", note=note, signal=signal)
    try:
        photo_name = await _save_photo(moment_dir, photo)
    except Exception:
        # Do not leave half-created folders when upload validation fails.
        for child in moment_dir.iterdir():
            child.unlink(missing_ok=True)
        moment_dir.rmdir()
        raise

    if photo_name:
        metadata["photo"] = photo_name
        metadata["status"] = "enriched"
    _write_moment(moment_dir, metadata)
    await broadcast({"type": "moment_saved", "moment": metadata})
    print(f"💾 MOMENT SAVED: {metadata['id']}")
    return {"ok": True, "moment": metadata}


@app.patch("/moments/{moment_id}")
async def enrich_moment(
    moment_id: str,
    note: str = Form(""),
    photo: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Add memo/photo to a Watch-captured moment."""
    moment_dir = _moment_dir(moment_id)
    metadata = _read_moment(moment_dir)

    if note.strip():
        metadata["note"] = note.strip()

    photo_name = await _save_photo(moment_dir, photo)
    if photo_name:
        metadata["photo"] = photo_name

    metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
    if metadata.get("note") or metadata.get("photo"):
        metadata["status"] = "enriched"

    _write_moment(moment_dir, metadata)
    await broadcast({"type": "moment_updated", "moment": metadata})
    print(f"✍️ MOMENT ENRICHED: {moment_id}")
    return {"ok": True, "moment": metadata}


@app.get("/moments")
def list_moments() -> dict[str, Any]:
    moments: list[dict[str, Any]] = []
    for path in sorted(MOMENTS_DIR.glob("*/metadata.json"), reverse=True):
        try:
            item = json.loads(path.read_text(encoding="utf-8"))
            if item.get("photo"):
                item["photo_url"] = f"/moments/{item['id']}/photo"
            moments.append(item)
        except Exception:
            continue
    return {"ok": True, "moments": moments}


@app.get("/moments/{moment_id}/photo")
def get_moment_photo(moment_id: str) -> FileResponse:
    moment_dir = _moment_dir(moment_id)
    metadata = _read_moment(moment_dir)
    photo_name = metadata.get("photo")
    if not photo_name:
        raise HTTPException(status_code=404, detail="No photo")
    photo_path = moment_dir / photo_name
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(photo_path)



def _preview_narrative(data: NarrativeRequest) -> dict[str, Any]:
    """Always-available fallback for submitted/demo sites without an API key."""
    hr_delta = round(data.heartRate - data.baseline)
    movement_copy = {
        "STILL": "큰 움직임은 거의 없었고",
        "still": "큰 움직임은 거의 없었고",
        "LIGHT": "가벼운 움직임이 이어졌고",
        "light": "가벼운 움직임이 이어졌고",
        "ACTIVE": "활발한 움직임이 함께 있었고",
        "active": "활발한 움직임이 함께 있었고",
    }.get(data.movement, "움직임의 맥락이 함께 기록되었고")

    context = data.note.strip() if data.note else data.description
    return {
        "title": f"{data.title}, 몸이 남긴 작은 흔적",
        "lead": (
            f"{data.time}, {data.location}. {movement_copy} 심박은 {data.heartRate:.0f} bpm으로 "
            f"개인 기준선보다 {abs(hr_delta):.0f} bpm {'높았습니다' if hr_delta >= 0 else '낮았습니다'}."
        ),
        "paragraphs": [
            (
                f"이 순간의 신호 편차는 {data.zScore:.1f}σ였습니다. VIVIA는 이 수치를 감정의 이름으로 바꾸지 않고, "
                "평소의 몸과 달랐던 정도를 나타내는 하나의 흔적으로 남깁니다."
            ),
            (
                f"함께 남은 맥락은 ‘{context}’입니다. 시간·장소·주변 기록과 Body Trace를 포개면, "
                "숫자 하나만으로는 보이지 않던 순간의 윤곽이 조금 더 선명해집니다."
            ),
        ],
        "closing": "기억은 무엇을 느꼈는지 단정하는 대신, 그 순간 무엇이 달라졌는지를 따라 다시 시작됩니다.",
        "mode": "preview",
    }


@app.post("/reconstruct/narrative")
def reconstruct_narrative(data: NarrativeRequest) -> dict[str, Any]:
    """Generate a Korean memory narrative from signals + context.

    If OPENAI_API_KEY is missing or the API call fails, return a deterministic
    preview narrative so the submitted website still works offline.
    """
    fallback = _preview_narrative(data)
    if not os.getenv("OPENAI_API_KEY"):
        return {"ok": True, "narrative": fallback, "provider": "preview"}

    try:
        from openai import OpenAI

        client = OpenAI()
        prompt = {
            "moment": {
                "title": data.title,
                "date": data.date,
                "time": data.time,
                "location": data.location,
                "user_context": data.note or data.description,
            },
            "body_trace": {
                "heart_rate_bpm": data.heartRate,
                "personal_baseline_bpm": data.baseline,
                "deviation_z": data.zScore,
                "movement_state": data.movement,
                "motion_g": data.motion,
                "active_energy_kcal": data.activeEnergy,
                "oxygen_saturation_percent": data.oxygen,
                "respiratory_rate_per_min": data.respiration,
            },
            "evidence": data.evidence,
        }

        instructions = """
You are the narrative engine for VIVIA, a memory reconstruction experience.
Write in Korean. Build a restrained, literary but professional first-person-adjacent memory narrative from the supplied observations.
Never claim a biosignal directly proves a specific emotion, diagnosis, or mental state. Distinguish observation from interpretation.
Do not invent people, dialogue, weather, objects, sounds, or events that are not in the input.
Use body data as texture: trajectory, contrast with personal baseline, movement context, and what stayed stable.
Return ONLY valid JSON with this exact shape:
{
  "title": "short poetic title",
  "lead": "1-2 sentence opening",
  "paragraphs": ["paragraph 1", "paragraph 2"],
  "closing": "one memorable closing sentence"
}
Each paragraph should be 2-3 Korean sentences. Avoid clinical tone and avoid overclaiming emotion.
""".strip()

        response = client.responses.create(
            model=os.getenv("OPENAI_NARRATIVE_MODEL", "gpt-5.6"),
            reasoning={"effort": "low"},
            instructions=instructions,
            input=json.dumps(prompt, ensure_ascii=False),
        )
        parsed = json.loads(response.output_text)
        narrative = {
            "title": str(parsed["title"]),
            "lead": str(parsed["lead"]),
            "paragraphs": [str(x) for x in parsed["paragraphs"]][:3],
            "closing": str(parsed["closing"]),
            "mode": "openai",
        }
        if len(narrative["paragraphs"]) < 2:
            raise ValueError("Narrative needs at least two paragraphs")
        return {"ok": True, "narrative": narrative, "provider": "openai"}
    except Exception as exc:
        print(f"⚠️ AI narrative fallback: {exc}")
        return {"ok": True, "narrative": fallback, "provider": "preview"}


# Compatibility with the earlier Watch WebSocket prototype.
@app.websocket("/ws/watch")
async def watch_stream(websocket: WebSocket) -> None:
    global latest_signal
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
            latest_signal = payload
            await broadcast(payload)
    except WebSocketDisconnect:
        return


@app.websocket("/ws/web")
async def web_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    web_clients.add(websocket)
    print(f"🌐 React connected. clients={len(web_clients)}")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        web_clients.discard(websocket)
    except Exception:
        web_clients.discard(websocket)
