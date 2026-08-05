# yology

건강 데이터(Apple Health / Samsung Health)에서 감정적으로 의미 있는 순간(이상치)을 탐지하고,
그 순간의 상황을 사진·채팅 등으로 복원하는 프로젝트.

## 이상치 탐지 파이프라인 (`feelback_residual.py`)

```
심박/HRV/호흡수 + 걸음/계단(있으면)
   ↓ 운동 세션 제외 (밀집 기록 구간 = 운동으로 간주)
   ↓ 시간대별 평소 심박(기준선) 계산
   ↓ 기대HR = 기준선 + 걸음/계단 보정 (Huber 회귀)
   ↓ 실제HR − 기대HR = 잔차 → 많이 벗어난 순간만 후보
   ↓ 근처 HRV가 눌려있는지 확인 (감정의 생리적 증거)
   ↓ 회복 속도로 지속성(긴장)/위상성(놀람) 구분
   ↓ 연속된 후보를 하나의 이벤트로 병합
feelback_residual_episodes.csv (이상치 이벤트 목록)
```

**핵심 아이디어**: "이 시간대·이 활동량이면 이 정도 심박이 정상"이라는 기대치를 실측 걸음/계단으로
구하고, 거기서 벗어난 정도를 HRV·회복속도까지 곁들여 종합 판단한다. 걸음수가 없어도
(`--exclude-activity`) 운동 세션 필터는 그대로 작동해 감정/운동을 어느 정도 구분한다.

자세한 설명은 [docs/feelback_model.md](docs/feelback_model.md), 페르소나별 적용 결과는
[persona/README.md](persona/README.md) 참고.
