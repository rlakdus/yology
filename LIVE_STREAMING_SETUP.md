# VIVIA 실시간 Apple Watch 데이터 연결

이 버전은 기존 오프라인 이벤트/VR 코드를 유지하면서 Home의 BODY SIGNAL 카드만 실시간 WebSocket 데이터에 연결합니다.

## 이미 이 프로젝트에 있던 좋은 구조

`frontend/src/heartbeat/heartbeatSource.ts`에는 이미 `HeartbeatSource.kind = "recorded" | "live"`와
`start() / stop() / subscribe()` 확장 지점이 있습니다. 따라서 이후 VR 심박 오디오까지 실시간으로 바꾸기도 쉽습니다.
이번 패치는 먼저 Home 실시간 표시를 최소 단위로 붙인 버전입니다.

## 1. 서버 실행

프로젝트 루트:

```bash
pip install -r requirements-live.txt
uvicorn live_server:app --host 0.0.0.0 --port 8000
```

브라우저에서 아래가 열리면 서버는 정상입니다.

```text
http://localhost:8000/health
```

## 2. React 실행

```bash
cd frontend
npm install
npm run dev
```

기본적으로 React는:

```text
ws://localhost:8000/ws/web
```

에 연결합니다.

다른 서버 주소를 쓰려면 `frontend/.env.local`:

```text
VITE_LIVE_WS_URL=ws://localhost:8000/ws/web
```

## 3. Apple Watch / iPhone에서 Mac으로 전송

Mac IP 확인:

```bash
ipconfig getifaddr en0
```

예: `192.168.0.14`

`docs/VIVIALiveSocket.swift`의 주소를:

```swift
ws://192.168.0.14:8000/ws/watch
```

로 바꿉니다.

HealthKit에서 새 BPM을 받을 때:

```swift
VIVIALiveSocket.shared.connect()
VIVIALiveSocket.shared.sendHeartRate(bpm)
```

를 호출합니다.

Watch와 Mac이 같은 Wi-Fi에 있는 것이 가장 편합니다.

## 4. Watch 없이 먼저 테스트

터미널에서 `websocat`이 있다면:

```bash
websocat ws://localhost:8000/ws/watch
```

접속 후 반복 입력:

```json
{"type":"heart_rate","bpm":72}
{"type":"heart_rate","bpm":73}
{"type":"heart_rate","bpm":71}
{"type":"heart_rate","bpm":74}
```

10개 이상 baseline 데이터를 넣은 뒤 큰 값을 넣으면:

```json
{"type":"heart_rate","bpm":110}
```

Home의 `MOMENT DETECTED` 카드가 코랄색으로 반응합니다.

## 5. 중요한 해석

현재 실시간 detector는 최근 60개 BPM으로 baseline을 만든 간단한 데모용 z-score입니다.
이는 **감정을 판정하는 모델이 아니라 평소와 다른 신체신호 변화를 찾는 모델**입니다.

기존 `feelback_anomaly.py`는 오프라인 전체 데이터용 Isolation Forest 파이프라인이므로,
실시간 스트리밍에 그대로 매 샘플마다 재학습시키지 않는 편이 좋습니다.
발표 데모는 `live_server.py`의 온라인 detector로 감지하고, 저장된 이벤트를 이후 기존 reconstruction/VR 파이프라인에 넘기는 구조를 추천합니다.
