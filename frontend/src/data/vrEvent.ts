import { useEffect, useState } from "react";

export type VrMedia = {
  kind: "image" | "video";
  src: string;
  /** 재현 타임라인 위의 위치 (0~1). export 시점에 taken_at으로부터 계산된다. */
  at: number;
  /** estimate_depth.py가 만든 깊이 맵. 없으면 평면으로 렌더된다. */
  depth: string | null;
  /** inpaint_disocclusion.py가 가려진 영역을 채운 배경 레이어. */
  fill: string | null;
};

export type VrEvent = {
  event_id: string;
  persona: string;
  title: string;
  description: string;
  emotion: string;
  vr_scene: string;
  start_time: string | null;
  end_time: string | null;
  duration_min: number;
  media: VrMedia[];
  chats: string[];
  sensor: {
    heart_rate?: number[];
    eda?: number[];
    temperature?: number[];
  };
  experience?: {
    heartbeat?: {
      mode?: "recorded-relative" | "recorded-absolute";
      /** 원본 사건의 안정 구간에서 계산한 기준 심박. */
      source_baseline_bpm?: number;
      gain?: number;
      /** 기준 박동에 익숙해지는 시간. prelude_seconds는 구형 매니페스트 호환용이다. */
      adaptation_seconds?: number;
      prelude_seconds?: number;
      transition_seconds?: number;
      cooldown_seconds?: number;
    };
    breathing?: {
      /** 후보 기능 플래그. false면 오디오 엔진과 UI를 모두 시작하지 않는다. */
      enabled?: boolean;
      /** 합성 호흡 분위기의 전체 강도 (0~1). */
      gain?: number;
    };
  };
};

/**
 * 재생 길이.
 *
 * 사건 전체의 실제 길이를 재생하는 대신 핵심 순간을 짧게 재구성한다.
 * 타임스탬프가 없는 센서 배열은 이 구간에 균등 배치되므로 원속도 기록이 아니라
 * 상승→정점→완화의 상대 흐름을 표현하는 극적 보간이다.
 * 영상만은 압축할 수 없으므로 영상이 더 길면 거기에 맞춰 늘어난다.
 */
export const PLAYBACK = {
  seconds: 40,
  hardMaxSeconds: 90,
};

/**
 * 둘러볼 수 있는 범위.
 *
 * 사진 한 장이 덮을 수 있는 각도에는 한계가 있어, 넓힐수록 사진 바깥의 흐린 여백이
 * 시야에 들어온다. 여기서 더 넓히려면 사진 바깥을 생성해 채우는 수밖에 없다.
 */
export const LOOK = { yawDeg: 45, pitchDeg: 26 };

/**
 * 카메라 미세 이동. 단위는 미터.
 *
 * 광학중심 회전만으로는 장면의 깊이와 무관하게 같은 영상이 나온다(파노라마가 성립하는 이유).
 * 시차는 카메라가 평행이동할 때만 생기므로, 이 값들이 0이면 아무리 좋은 깊이 맵을 넣어도
 * 화면은 평면으로 보인다. 어지러우면 drift부터 낮춘다.
 */
export const MOTION = {
  drift: 0.02,
  swayYaw: 0.035,
  swayPitch: 0.02,
  handheldPosition: 0.004,
  handheldRotationDeg: 0.18,
  beatImpulse: 0.002,
};

/**
 * 깊이 변위 메시. relief는 미터, curvature는 패널 가장자리가 뒤로 물러나는 거리.
 *
 * relief를 키우면 시차가 뚜렷해지는 대신 물체 경계의 늘어짐(disocclusion)이 눈에 띈다.
 * 사진 한 장에는 가려진 영역의 정보가 애초에 없어 이 맞바꿈은 없앨 수 없다.
 * 경계가 지저분하면 이 값을 먼저 낮춘다.
 */
export const DEPTH = {
  relief: 0.45,
  curvature: 0.22,
  feather: 0.09,
  fogStrength: 0.08,
  // UV 한 칸당 깊이 변화 기준. 완만한 면은 1 안팎, 실루엣 경계는 수십에 이른다.
  stretchCut: 14,
  // 이 거리만큼 머리가 움직였을 때 실루엣 뒤의 복원 배경이 완전히 드러난다.
  revealDistance: 0.09,
};

/** 미디어 전환에 쓰는 크로스페이드 폭 (진행도 기준). */
const CROSSFADE = 0.05;

/** 채팅 한 줄이 톤에 영향을 주는 시간. 자막으로 띄우지는 않는다. */
const CHAT_HOLD_SECONDS = 4;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const playbackSeconds = (videoTotalSeconds = 0) =>
  clamp(Math.max(PLAYBACK.seconds, videoTotalSeconds), PLAYBACK.seconds, PLAYBACK.hardMaxSeconds);

/** 센서 샘플 배열을 0~1 진행도에 균등 매핑한 뒤 선형 보간한다. */
export const sampleAt = (series: number[] | undefined, progress: number) => {
  if (!series || series.length === 0) return null;
  if (series.length === 1) return series[0];

  const position = clamp(progress, 0, 1) * (series.length - 1);
  const index = Math.floor(position);
  if (index >= series.length - 1) return series[series.length - 1];

  const weight = position - index;
  return series[index] * (1 - weight) + series[index + 1] * weight;
};

export type MediaCue = {
  current: VrMedia | null;
  next: VrMedia | null;
  /** 0이면 current만, 1이면 next만 보인다. */
  blend: number;
};

/** 현재 진행도에서 보여줄 미디어와 다음 미디어로의 전환 비중을 구한다. */
export const mediaCueAt = (event: VrEvent, progress: number): MediaCue => {
  const media = event.media;
  if (media.length === 0) return { current: null, next: null, blend: 0 };

  let index = 0;
  for (let i = 0; i < media.length; i += 1) {
    if (progress >= media[i].at) index = i;
  }

  const current = media[index];
  const next = media[index + 1] ?? null;
  if (!next) return { current, next: null, blend: 0 };

  const fadeStart = next.at - CROSSFADE;
  if (progress < fadeStart) return { current, next, blend: 0 };

  return { current, next, blend: clamp((progress - fadeStart) / CROSSFADE, 0, 1) };
};

export type ChatCue = {
  text: string;
  /** 진행도 기준 노출 구간. */
  from: number;
  to: number;
};

/**
 * 채팅 줄을 재현 구간의 20%~78% 사이에 고르게 배치한다.
 * 자막은 띄우지 않고, 그 구간에서 공간의 톤을 끌어올리는 데만 쓴다.
 */
export const chatCues = (event: VrEvent, seconds: number): ChatCue[] => {
  const lines = event.chats;
  if (lines.length === 0 || seconds <= 0) return [];

  const hold = CHAT_HOLD_SECONDS / seconds;
  return lines.map((text, index) => {
    const from = lines.length === 1
      ? 0.5
      : 0.2 + (0.58 * index) / (lines.length - 1);
    return { text, from, to: Math.min(1, from + hold) };
  });
};

export const activeChat = (cues: ChatCue[], progress: number) =>
  cues.find((cue) => progress >= cue.from && progress < cue.to) ?? null;

/**
 * 0~1 긴장도. 공간의 색온도와 vignette 강도가 이 값을 따른다.
 *
 * 지금은 EDA를 이벤트 자체의 범위로 정규화한 값에 채팅이 떠 있는 동안 가중치를 더한다.
 * 채팅 문장 자체의 상황분석은 아직 정해지지 않았으므로, 나중에 모델 출력으로 바꿀 때
 * 이 함수 하나만 교체하면 되도록 격리해 둔다.
 */
export const toneAt = (event: VrEvent, progress: number, chatting: boolean) => {
  const eda = event.sensor.eda;
  let base = 0.4;

  if (eda && eda.length > 1) {
    const low = Math.min(...eda);
    const high = Math.max(...eda);
    const current = sampleAt(eda, progress) ?? low;
    if (high > low) base = (current - low) / (high - low);
  }

  return clamp(base + (chatting ? 0.25 : 0), 0, 1);
};

/** 이벤트 매니페스트를 불러온다. heEpisodes.ts의 훅 패턴을 따른다. */
export const useVrEvent = (persona?: string, eventId?: string) => {
  const [event, setEvent] = useState<VrEvent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!persona || !eventId) return;

    let cancelled = false;
    const base = `/events/${persona}/${eventId}`;

    fetch(`${base}/vr-event.json`)
      .then((response) => {
        if (!response.ok) throw new Error("이벤트 자료를 불러오지 못했습니다.");
        return response.json() as Promise<VrEvent>;
      })
      .then((payload) => {
        if (cancelled) return;
        // 매니페스트의 경로는 이벤트 폴더 기준 상대 경로라, 서빙 경로로 바꿔 둔다.
        // depth를 빠뜨리면 SPA 폴백이 index.html을 돌려주고 텍스처 로더가 예외를 던진다.
        setEvent({
          ...payload,
          media: payload.media.map((entry) => ({
            ...entry,
            src: `${base}/${entry.src}`,
            depth: entry.depth ? `${base}/${entry.depth}` : null,
            fill: entry.fill ? `${base}/${entry.fill}` : null,
          })),
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "이벤트 자료를 불러오지 못했습니다.");
      });

    return () => { cancelled = true; };
  }, [persona, eventId]);

  return { event, error };
};
