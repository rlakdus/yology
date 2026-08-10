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
  panorama: {
    src: string;
    generated: boolean;
    mode: "recorded_anchor" | "scenario_hypothesis";
    anchor_yaw_deg: number;
    source_note: string;
  } | null;
  media: VrMedia[];
  chats: string[];
  sensor: {
    heart_rate?: number[];
    eda?: number[];
    temperature?: number[];
  };
};

/**
 * 재생 길이.
 *
 * 사건의 실제 길이는 재현 길이에 반영하지 않는다. 배속 개념도 두지 않는다.
 * 모든 재현은 같은 길이로 흐르고, 센서 곡선이 그 위에 균등하게 펼쳐진다.
 * 영상만은 압축할 수 없으므로 영상이 더 길면 거기에 맞춰 늘어난다.
 */
export const PLAYBACK = {
  seconds: 90,
  hardMaxSeconds: 180,
};

/**
 * 둘러볼 수 있는 범위.
 *
 * 파노라마 이벤트는 수평 회전을 완전히 열고, 상하 극점의 불안정을 피하기 위해
 * pitch만 85°로 제한한다. 파노라마가 없는 이벤트도 기존 배경 셸 덕분에 안전하다.
 */
export const LOOK = { yawDeg: 180, pitchDeg: 85 };

/**
 * 카메라 미세 이동. 단위는 미터.
 *
 * 광학중심 회전만으로는 장면의 깊이와 무관하게 같은 영상이 나온다(파노라마가 성립하는 이유).
 * 시차는 카메라가 평행이동할 때만 생기므로, 이 값들이 0이면 아무리 좋은 깊이 맵을 넣어도
 * 화면은 평면으로 보인다. 어지러우면 drift부터 낮춘다.
 */
export const MOTION = {
  drift: 0.055,
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
          panorama: payload.panorama
            ? { ...payload.panorama, src: `${base}/${payload.panorama.src}` }
            : null,
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
