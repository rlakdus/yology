# 이벤트 데이터·VR 파이프라인

학생 이벤트의 단일 원본은 `events/student/event_NNN/`이다. UI가 직접 임의 날짜를 만들지 않고, 이 디렉터리의 메타데이터를 `scripts/export_event_catalog.py`와 `scripts/export_event_assets.py`로 내보낸 결과만 사용한다.

## 표준 구조

```text
events/student/event_NNN/
├── metadata.json          # UI 시각, 표시 문구, 준비 상태, 초기 VR 시점
├── provenance.json        # 원본 시각↔UI 시각 오프셋과 원본 해시
├── anomaly.json           # UI 시간축으로 이동된 이상치(준비된 이벤트만)
├── sensor.json            # UI 시간축으로 이동된 센서 데이터
├── reasoning.json         # 이벤트 해석
├── source/                # <slug>.original.<확장자> 규칙의 변경하지 않는 원본 영상
└── panorama/
    ├── *-360.mp4          # 검증 완료한 equirectangular 영상
    └── generation.json    # 모델·옵션·입출력 해시
```

GPU 작업 설정은 같은 번호로 `gpu360/jobs/student/event_NNN.json`에 둔다. 이벤트 ID는 영구 식별자이고, 이름 변경은 `slug`와 표시 문구에 반영한다. `event_001`의 정식 slug는 `night-study`, 표시명은 `심야 공부`다.

`event_001`은 녹화 영상이 없는 생체신호 기반 추정 장면이라 GPU 작업 설정이 없다. 360° 공간은 미리 생성한 정지 파노라마 `panorama/night_study_360.generated.png`와 그 깊이 맵으로만 구성한다.

## 시간 매칭 규칙

모든 UI 시각은 `Asia/Seoul` 오프셋을 포함한 ISO 8601로 저장한다. 실제 수집 시각은 UI에 노출하지 않고 `provenance.json`에만 남긴다.

```text
timeline_offset = display_peak_at - source_peak_at
ui_timestamp = source_timestamp + timeline_offset
```

`normalize_event_timeline.py`는 이상치 최고점과 UI 이벤트 시각을 정확히 맞춘 뒤 모든 이상치·센서 타임스탬프에 동일한 오프셋을 적용한다. 값과 원본 파일은 바꾸지 않으며 SHA-256을 기록한다. 데이터가 없는 이벤트는 추정값을 만들지 않고 `availability.anomaly_ready=false`로 표시한다.

```bash
python scripts/normalize_event_timeline.py --event-dir events/student/event_003
python scripts/export_all_event_assets.py
```

현재 UI 기준 최고점은 다음과 같다.

| 이벤트 | 표시명 | UI 최고점 | 데이터 상태 |
| --- | --- | --- | --- |
| `event_001` | 심야 공부 | `2026-03-22 01:22 +09:00` | 에피소드 매칭 완료 (he-1) |
| `event_002` | 대학 입학 후 첫 콘서트 | `2026-05-15 19:42 +09:00` | 없음 |
| `event_003` | 몽골 승마 체험 | `2026-07-25 16:18 +09:00` | 매칭 완료 |
| `event_004` | 영화 관람 | `2026-08-12 20:31 +09:00` | 원본 데이터 대기 |

## VR 영상 규칙

원본 규격은 제각각일 수 있으므로 회전 메타데이터를 적용한 실제 프레임 크기를 읽고 종횡비를 보존한다. 전처리는 첫 프레임을 기본 앵커로 사용해 원본의 줌과 롤만 상쇄하고, 장면 자체의 이동은 유지한다. Argus에는 고정 FOV와 0 roll/pitch/yaw를 전달하므로 원본 카메라 회전·줌을 재현하지 않는다. 생성 주변부도 프레임별로 변화하도록 합성하고, 실제 기록인 정면 영상은 고정 카메라 규격으로 재투영한다.

`metadata.json.view`와 GPU 작업의 `view`가 동일한 초기 시점을 정의한다. 기본값은 `anchor_frame_seconds=0`, `initial_yaw_deg=0`, `initial_pitch_deg=0`이다. 몽골 이벤트는 첫 프레임 시각 검토 결과 앞선 기수를 중앙에 두도록 `initial_yaw_deg=-25`, `initial_pitch_deg=-5`로 수동 고정했다.

준비 상태는 독립적으로 관리한다.

- `source_video_ready`: 원본 영상 존재
- `anomaly_ready`: UI 시간축 이상치·센서 데이터 검증 완료
- `panorama_ready`: 360° MP4 자동 검증 완료
- `vr_ready`: 위 세 항목을 모두 만족
