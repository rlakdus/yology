export type HeartRateSample = {
  timestampMs: number;
  bpm: number;
  confidence: number;
};

export type HeartbeatSource = {
  kind: "recorded" | "live";
  /** 통계 계산과 폴백에 쓰는 현재까지의 유효 BPM 값. */
  values(): number[];
  /** 기록 소스는 0~1 진행도, 실시간 소스는 최신 위치를 기준으로 샘플을 반환한다. */
  sample(progress: number): HeartRateSample | null;
  /** 실시간 센서 어댑터가 연결·해제를 구현할 확장 지점. */
  start?(): Promise<void>;
  stop?(): Promise<void>;
  subscribe?(listener: (sample: HeartRateSample) => void): () => void;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** 기존 number[] 사건 데이터를 공통 심박 소스 계약으로 감싼다. */
export const createRecordedHeartbeatSource = (
  series: number[] | undefined,
  timelineDurationMs = 1000,
): HeartbeatSource => {
  const valid = (series ?? []).filter((value) => Number.isFinite(value));

  return {
    kind: "recorded",
    values: () => valid,
    sample: (progress) => {
      if (valid.length === 0) return null;
      if (valid.length === 1) {
        return { timestampMs: 0, bpm: valid[0], confidence: 1 };
      }

      const position = clamp(progress, 0, 1) * (valid.length - 1);
      const index = Math.floor(position);
      const nextIndex = Math.min(index + 1, valid.length - 1);
      const weight = position - index;
      return {
        // 원본 타임스탬프가 없는 배열은 현재 재현 타임라인에 균등 배치한다.
        timestampMs: clamp(progress, 0, 1) * timelineDurationMs,
        bpm: valid[index] * (1 - weight) + valid[nextIndex] * weight,
        confidence: 1,
      };
    },
  };
};
