import { useEffect, useMemo, useState } from "react";

export type LiveHeartRateSample = {
  type: "heart_rate";
  bpm: number;
  timestamp?: number;
  baseline?: number | null;
  z_score?: number;
  is_anomaly?: boolean;
};

type LiveHeartRateState = {
  sample: LiveHeartRateSample | null;
  connected: boolean;
  error: string | null;
};

const DEFAULT_WS_URL = "ws://localhost:8000/ws/web";

export const useLiveHeartRate = (): LiveHeartRateState => {
  const [sample, setSample] = useState<LiveHeartRateSample | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsUrl = useMemo(
    () => import.meta.env.VITE_LIVE_WS_URL || DEFAULT_WS_URL,
    []
  );

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        setConnected(true);
        setError(null);
      });

      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (
            data?.type === "heart_rate" &&
            typeof data?.bpm === "number"
          ) {
            setSample({
              type: "heart_rate",
              bpm: data.bpm,
              timestamp: data.timestamp,
              baseline:
                typeof data.baseline === "number" ? data.baseline : null,
              z_score:
                typeof data.z_score === "number" ? data.z_score : 0,
              is_anomaly: Boolean(data.is_anomaly),
            });
          }
        } catch {
          // Ignore malformed messages so a bad packet does not kill the UI.
        }
      });

      socket.addEventListener("close", () => {
        setConnected(false);

        if (!cancelled) {
          retryTimer = window.setTimeout(connect, 1500);
        }
      });

      socket.addEventListener("error", () => {
        setError("실시간 신호 서버에 연결하지 못했습니다.");
        socket?.close();
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [wsUrl]);

  return { sample, connected, error };
};
