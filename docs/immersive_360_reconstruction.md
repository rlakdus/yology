# 360° 몰입형 재현 설계

## 목표

사용자가 어느 방향으로 시선을 돌려도 빈 공간이나 늘어난 사진 경계가 보이지 않도록
전방위 환경을 제공한다. 촬영된 정면 영역은 깊이 메시로 강화하고, 보이지 않던 영역은
생성된 2:1 equirectangular 파노라마로 닫는다.

## 표현 계층

1. **360° 환경 셸**: `panorama/*.png`를 depth-displaced 구체 내부에 매핑한다. 회전은 무제한이다.
2. **정면 깊이 메시**: 원본 이미지와 depth/fill 사이드카로 제한된 위치 시차를 만든다.
3. **이벤트 효과**: 심박, 영상, 채팅 기반 톤과 오디오를 기존 타임라인대로 유지한다.

이 구조는 회전 3DoF를 완전히 지원하고, 파노라마와 동일한 2:1 depth map을 이용해
약 10cm 이내의 제한된 위치 시차를 제공한다. 큰 위치 이동에서는 실제로 촬영되지 않은
가림 영역이 드러나므로 6DoF 자유 보행은 범위에서 제외한다.

## 이벤트 메타데이터

```json
"panorama": {
  "file": "panorama/waiting_room_360.generated.png",
  "generated": true,
  "mode": "recorded_anchor",
  "anchor_yaw_deg": 0,
  "source_note": "AI-generated 360 environment anchored to images/waiting_room.jpg"
}
```

`generated`와 `source_note`는 실제 기록과 AI 추정 영역을 구분하기 위한 provenance다.

## 자산 생성 규칙

- 2:1 equirectangular PNG/JPEG, 개발 4096×2048 이상 권장
- 원본 사진은 정면 앵커로 유지
- 좌우 경계가 이어지는 seamless wrap 필수
- 수평선은 중앙, 카메라는 수평 유지
- 천장과 바닥 극점의 늘어짐 및 중복 객체 검수

## 내보내기와 실행

```powershell
python scripts/export_event_assets.py --persona he --event event_001
cd frontend
npm run dev
```

파노라마가 없는 기존 이벤트는 흐린 정면 배경과 단색 환경 셸로 자동 폴백한다.

## 적용된 샘플 페르소나

| 페르소나 | 대표 이벤트 | 360° 환경 | 기록 수준 |
|---|---|---|---|
| `he` | 병원 방문 | 병원 대기실 | 실제 정면 사진을 기준으로 확장 |
| `office` | 7/26 16:54 지속성 각성 | 퇴근 전 사무실 | 생체신호 기반 완전 생성 추정 |
| `student` | 7/22 01:21 야간 급발현 | 심야 공부방 | 생체신호 기반 완전 생성 추정 |

`office`와 `student`는 해당 시각의 사진·위치 기록이 없으므로 생체신호가 장면을 증명하지
않는다. UI와 `reasoning.json`에서 생성 가설임을 유지해야 한다.
