# event_003 Argus panorama-video handoff

재현 가능한 환경과 실행법은 [`gpu_360_video_generation.md`](gpu_360_video_generation.md), 이벤트·시간 규칙은 [`event_data_pipeline.md`](event_data_pipeline.md)를 따른다.

웹 애플리케이션의 최종 영상 경로는 다음과 같다.

`events/student/event_003/panorama/mongolia-horse-riding-360.mp4`

## 생성 계약

1. `source/mongolia-horse-riding.original.mp4`의 SHA-256을 작업 설정과 대조한다.
2. 원본 종횡비를 유지하고 첫 프레임을 메인 시점으로 삼아 줌·롤을 상쇄한다. 장면의 실제 이동은 유지한다.
3. Argus를 1024×512, 고정 FOV 90°, 고정 roll/pitch/yaw 0으로 실행한다. 236프레임 전체를 25프레임 내부 배치와 4프레임 겹침으로 처리하되, 각 배치는 기록 프레임에서 다시 조건화해 이전 생성 결과의 오류가 누적되지 않게 한다.
4. VEnhancer 타일 인코딩으로 3072×1536까지 향상하고 원본 정면을 직접 재투영해 4096×2048로 합성한다.
5. 전처리한 정면을 동일한 고정 카메라 규격으로 재투영하되, 오디오는 변경하지 않은 원본에서 가져온다.
6. H.264 High Profile, `yuv420p`, AAC, MP4 `faststart`로 인코딩한다.
7. `generation.json`에 체크포인트, 옵션, 입력·출력 해시와 전처리 보고서를 기록한다.

AI가 만든 주변 시야는 가설적 복원이며, 재투영된 정면만 기록된 영상 증거로 취급한다.

## 검수

```bash
conda run -n 360VG python scripts/validate_panorama_video.py \
  events/student/event_003/panorama/mongolia-horse-riding-360.mp4 \
  --source events/student/event_003/source/mongolia-horse-riding.original.mp4
```

자동 검사는 해상도·2:1 비율·코덱·픽셀 포맷·길이·FPS·오디오를 확인한다. 추가로 첫 시점이 주 장면인지, 0°/360° seam과 내부 배치 경계가 자연스러운지, 정면 페더에 이중상이 없는지 시각 검토한다.
