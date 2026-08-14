# VIVIA Live Demo + Moment Recording

## What changed
- `Live Demo` nav now opens `/live-demo`.
- Live page visualizes Apple Watch heart rate, personal baseline, z-score, and anomaly points.
- If anomaly remains true for 10 seconds in the browser, the page shows a `MOMENT DETECTED` banner.
- `이 순간 기록하기` opens a recorder where the user can add a memo and an image.
- Saving sends the current signal snapshot + memo + image to FastAPI.
- FastAPI saves each record under `data/live_moments/<moment_id>/` as `metadata.json` plus the image.

## Install / run
```bash
pip install -r requirements-live.txt
uvicorn live_server:app --host 0.0.0.0 --port 8000
```

In another terminal:
```bash
cd frontend
npm install
npm run dev
```

## Endpoints
- Watch -> `POST /heart-rate`
- Browser live stream -> `WS /ws/web`
- Save memo/photo -> `POST /moments`
- Inspect saved moments -> `GET /moments`

## Important
The current detector is demo-only and detects deviation from a recent baseline. It does not infer emotion.
