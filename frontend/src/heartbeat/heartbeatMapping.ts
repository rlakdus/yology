export type HeartbeatStats = {
  baseline: number;
  low: number;
  high: number;
  range: number;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const quantile = (sorted: number[], probability: number) => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const index = Math.floor(position);
  const weight = position - index;
  const next = sorted[Math.min(index + 1, sorted.length - 1)];
  return sorted[index] * (1 - weight) + next * weight;
};

/** 기록 심박의 이상값 영향을 줄이기 위해 기준값과 10~90 분위 범위를 쓴다. */
export const heartbeatStats = (
  series: number[] | undefined,
  sourceBaseline?: number,
): HeartbeatStats => {
  const valid = (series ?? [])
    .filter((value) => Number.isFinite(value) && value >= 30 && value <= 220)
    .sort((a, b) => a - b);

  if (valid.length === 0) return { baseline: 72, low: 66, high: 78, range: 6 };

  // 기준 구간에서 구한 값이 있으면 사건 전체 중앙값보다 우선한다.
  const baseline = Number.isFinite(sourceBaseline)
    ? clamp(sourceBaseline as number, 30, 220)
    : quantile(valid, 0.5);
  const low = quantile(valid, 0.1);
  const high = quantile(valid, 0.9);
  return {
    baseline,
    low,
    high,
    // 평균 위·아래를 같은 -1~1 축에 놓을 수 있도록 큰 쪽을 대칭 범위로 쓴다.
    range: Math.max(1, baseline - low, high - baseline),
  };
};

export const relativeHeartbeat = (bpm: number, stats: HeartbeatStats) =>
  clamp((bpm - stats.baseline) / stats.range, -1, 1);

export type HeartbeatMappingOptions = {
  userBaseline: number;
  /** 체험자 기준에서 위·아래로 표현할 최대 BPM 폭. */
  userRange?: number;
  gain?: number;
  minBpm?: number;
  maxBpm?: number;
};

/** 원본의 절대 BPM을 버리고 평균 대비 위치만 체험자 범위로 옮긴다. */
export const mapRecordedBpm = (
  sourceBpm: number,
  stats: HeartbeatStats,
  options: HeartbeatMappingOptions,
) => {
  const userRange = options.userRange ?? clamp(options.userBaseline * 0.18, 8, 18);
  const gain = options.gain ?? 0.85;
  const mapped = options.userBaseline + relativeHeartbeat(sourceBpm, stats) * userRange * gain;
  return clamp(mapped, options.minBpm ?? 45, options.maxBpm ?? 140);
};

/** 전이의 시작과 끝에서 속도가 튀지 않는 보간 곡선. */
export const smoothstep = (progress: number) => {
  const value = clamp(progress, 0, 1);
  return value * value * (3 - 2 * value);
};

export const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * clamp(progress, 0, 1);
