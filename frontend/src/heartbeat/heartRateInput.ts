import { mapRecordedBpm, type HeartbeatStats } from "./heartbeatMapping";

export type HeartRateInputSnapshot =
  | { status: "unavailable" | "error"; baselineBpm: null }
  | { status: "ready"; baselineBpm: number };

export type HeartRateInputProvider = {
  snapshot(): HeartRateInputSnapshot;
};

const unavailableProvider: HeartRateInputProvider = {
  snapshot: () => ({ status: "unavailable", baselineBpm: null }),
};

let activeProvider = unavailableProvider;

/** 향후 BLE·웨어러블 어댑터가 준비되면 이 계약만 교체한다. */
export const setHeartRateInputProvider = (provider: HeartRateInputProvider | null) => {
  activeProvider = provider ?? unavailableProvider;
};

export const readHeartRateInput = () => activeProvider.snapshot();

/** 사용자 기준 맥박이 없으면 사건에 기록된 BPM을 손대지 않는다. */
export const translateEventBpm = (
  sourceBpm: number,
  stats: HeartbeatStats,
  snapshot: HeartRateInputSnapshot,
) => {
  if (
    snapshot.status !== "ready"
    || !Number.isFinite(snapshot.baselineBpm)
    || snapshot.baselineBpm < 35
    || snapshot.baselineBpm > 200
  ) {
    return sourceBpm;
  }

  return mapRecordedBpm(sourceBpm, stats, { userBaseline: snapshot.baselineBpm });
};
