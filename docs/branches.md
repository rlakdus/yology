# 브랜치 현황 (2026-08-17 기준)

`feat/gpu-360-video-generation`에서 원격 브랜치 정리를 검토하며 기록한 스냅샷이다.
현재는 실제 삭제 없이 현황만 남긴다 — 미병합 브랜치는 소유자 확인 후 처리한다.

| 브랜치 | 마지막 커밋 | 작성자 | main 대비 | 상태 |
| --- | --- | --- | --- | --- |
| `feat/gpu-360-video-generation` | 08-17 | root | +20 | 작업 중 (본 문서 작성 브랜치) |
| `uiver3` | 08-17 | rlakdus | +16 | `feat/gpu-360-video-generation`에 완전 병합됨 |
| `uiver2` | 08-16 | anstjgus922 | +15 | `feat/gpu-360-video-generation`에 완전 병합됨 |
| `feat/360-panorama-vr-video` | 08-15 | isally03 | +3 | `feat/gpu-360-video-generation`에 완전 병합됨 |
| `feat/anomaly-reproduction` | 08-14 | isally03 | +0 | main과 동일, 고유 커밋 없음 |
| `persona` | 08-14 | rlakdus | -2 | main보다 뒤처짐, 미병합 |
| `feat/immersive-360-reconstruction` | 08-10 | isally03 | -15 / +2 | main과 발산, 미병합 |
| `ay` | 08-03 | rlakdus | -31 | 가장 오래됨, 미병합 |

## 정리 방침

- **`uiver3`, `uiver2`, `feat/360-panorama-vr-video`, `feat/anomaly-reproduction`**:
  이미 병합됐거나 main과 동일해 고유 작업이 없음. 삭제해도 히스토리 손실 없음 — 삭제 시점만
  팀과 조율.
- **`persona`, `feat/immersive-360-reconstruction`, `ay`**: main과 다른 방향으로 갈라진
  미병합 작업. 방치된 것인지 재사용 예정인지 브랜치 소유자(`rlakdus`, `isally03`) 확인 없이는
  삭제하지 않는다.
