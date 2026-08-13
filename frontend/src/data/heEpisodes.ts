import { useEffect, useMemo, useState } from "react";

export type Episode = {
  id: string;
  rank: number;
  start: string;
  end: string;
  duration_min: number;
  n_samples: number;
  peak_hr: number;
  expected_hr: number;
  excess_bpm: number;
  steps_5m: number;
  hrv_ms: number | null;
  hrr_slope: number | null;
  arousal: string;
  peak_z: number;
  score: number;
  evidence: string;
};

export type Person = {
  id: string;
  label: string;
  episode_count: number;
  low_condition_days: number;
  episodes: Episode[];
};

export const parseTimestamp = (value: string) => new Date(value.replace(" ", "T"));

export const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(parseTimestamp(value));

export const formatTime = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(parseTimestamp(value));

/** start~end 구간에 count개 샘플을 균등 배치했을 때 각 샘플의 시각 레이블(HH:mm:ss). */
export const interpolateTimestamps = (start: string, end: string, count: number) => {
  if (count <= 0) return [];
  const startMs = parseTimestamp(start).getTime();
  const endMs = parseTimestamp(end).getTime();
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? startMs : startMs + ((endMs - startMs) * i) / (count - 1);
    return formatter.format(new Date(t));
  });
};

export const value = (number: number | null, digits = 0) =>
  number === null ? "측정 없음" : number.toFixed(digits);

/** 에피소드 구간의 실제 길이(ms). duration_min이 0인 단일 샘플 이벤트는 최소 길이로 보정한다. */
export const episodeDurationMs = (episode: Episode) => {
  const span = parseTimestamp(episode.end).getTime() - parseTimestamp(episode.start).getTime();
  return span > 0 ? span : 60_000;
};

/** HE 탐지 결과를 불러와 eventId에 해당하는 에피소드를 찾는다. */
export const useHeEpisode = (eventId?: string) => {
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/data/he-anomaly-episodes.json")
      .then((response) => {
        if (!response.ok) throw new Error("HE 탐지 결과를 불러오지 못했습니다.");
        return response.json() as Promise<{ person: Person }>;
      })
      .then((payload) => {
        if (!cancelled) setPerson(payload.person);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "HE 탐지 결과를 불러오지 못했습니다.");
      });

    return () => { cancelled = true; };
  }, []);

  const episode = useMemo(
    () => person?.episodes.find((candidate) => candidate.id === eventId) ?? null,
    [person, eventId],
  );

  return { person, episode, error };
};
