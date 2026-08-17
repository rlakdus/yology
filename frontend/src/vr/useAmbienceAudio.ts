import { useCallback, useEffect, useRef } from "react";

type AmbienceOptions = {
  /** 룸 톤 파일. null이면 엔진을 아예 만들지 않는다. */
  src: string | null;
  /** 메타데이터가 정한 이 이벤트의 기준 세기 (0~1). */
  gain?: number;
  loop?: boolean;
  /** 단계별 등장·퇴장을 제어하는 값 (0~1). */
  getPresence: () => number;
};

type Engine = {
  context: AudioContext;
  master: GainNode;
  src: string;
  loop: boolean;
  gain: number;
  getPresence: () => number;
  running: boolean;
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer> | null;
  source: AudioBufferSourceNode | null;
  /** stop()이 페이드아웃만 걸어두고 아직 멈추지 않은 소스들. */
  retiring: Set<AudioBufferSourceNode>;
};

const stopNow = (source: AudioBufferSourceNode) => {
  try { source.stop(); } catch { /* 이미 종료된 소스는 무시한다. */ }
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * 심박 밑에 깔리는 상한. 룸 톤이 심박·호흡을 덮으면 안 된다.
 *
 * 베드 자체가 -24 LUFS로 이미 낮게 렌더링돼 있어 여기서는 더 눌러 깔기만 한다.
 */
const CEILING = 0.5;

/** 페이드 시상수. 켜고 끌 때 딸깍거리지 않을 만큼 느리다. */
const RAMP_SECONDS = 0.6;

const loadBuffer = (engine: Engine) => {
  if (engine.buffer) return Promise.resolve(engine.buffer);
  if (engine.loading) return engine.loading;

  engine.loading = fetch(engine.src)
    .then((response) => {
      if (!response.ok) throw new Error(`앰비언스를 불러오지 못했습니다: ${engine.src}`);
      return response.arrayBuffer();
    })
    .then((bytes) => engine.context.decodeAudioData(bytes))
    .then((buffer) => {
      engine.buffer = buffer;
      return buffer;
    });

  return engine.loading;
};

/**
 * 이벤트별 룸 톤을 루프로 깐다.
 *
 * 재생 진행도를 전혀 보지 않는 것이 이 훅의 요점이다. 진행도에 반응해야 하는 소리는
 * 전부 실시간 합성(useHeartbeatAudio·useBreathingAudio) 쪽에 있고, 여기서는 장면이
 * 놓인 공간의 바닥 소리만 유지한다. 그래서 루프 이음매만 깨끗하면 어디서 시작해도 된다.
 */
export const useAmbienceAudio = ({ src, gain = 1, loop = true, getPresence }: AmbienceOptions) => {
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.getPresence = getPresence;
    engine.gain = gain;
    engine.loop = loop;
    if (engine.source) engine.source.loop = loop;

    const target = engine.running
      ? clamp(getPresence(), 0, 1) * clamp(gain, 0, 1) * CEILING
      : 0;
    engine.master.gain.setTargetAtTime(target, engine.context.currentTime, RAMP_SECONDS / 3);
  });

  /** 사용자 클릭 안에서 호출해 오디오 권한을 먼저 확보한다. */
  const start = useCallback(() => {
    if (!src) return;
    let engine = engineRef.current;

    // 소스가 바뀌었으면 기존 엔진은 버린다. 이벤트 사이를 오갈 때 옛 톤이 남지 않도록.
    if (engine && engine.src !== src) {
      engine.running = false;
      if (engine.source) stopNow(engine.source);
      engine.retiring.forEach(stopNow);
      void engine.context.close();
      engine = null;
      engineRef.current = null;
    }

    if (!engine) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);

      engine = {
        context,
        master,
        src,
        loop,
        gain,
        getPresence,
        running: false,
        buffer: null,
        loading: null,
        source: null,
        retiring: new Set(),
      };
      engineRef.current = engine;
    }

    if (engine.running) return;
    // 페이드아웃 중이던 소스는 즉시 끊는다. 남겨두면 마스터 게인이 다시 올라가면서
    // 새 소스와 겹쳐 룸 톤이 두 겹으로 들린다.
    engine.retiring.forEach(stopNow);
    engine.retiring.clear();
    engine.running = true;
    engine.getPresence = getPresence;
    void engine.context.resume();

    const active = engine;
    void loadBuffer(active)
      .then((buffer) => {
        // 로딩이 끝나기 전에 나갔거나 엔진이 교체됐으면 재생하지 않는다.
        if (!active.running || engineRef.current !== active || active.source) return;

        const source = active.context.createBufferSource();
        source.buffer = buffer;
        source.loop = active.loop;
        source.connect(active.master);
        source.start();
        active.source = source;

        const target = clamp(active.getPresence(), 0, 1) * clamp(active.gain, 0, 1) * CEILING;
        active.master.gain.setTargetAtTime(
          target,
          active.context.currentTime,
          RAMP_SECONDS / 3,
        );
      })
      .catch(() => {
        // 룸 톤은 보조 레이어다. 못 불러와도 장면은 그대로 진행한다.
        active.running = false;
      });
  }, [gain, getPresence, loop, src]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    // 버퍼 소스는 한 번 멈추면 재사용할 수 없으므로 끊고 다음 start에서 새로 만든다.
    engine.master.gain.setTargetAtTime(0, engine.context.currentTime, RAMP_SECONDS / 3);
    const source = engine.source;
    engine.source = null;
    if (source) {
      engine.retiring.add(source);
      window.setTimeout(() => {
        stopNow(source);
        engine.retiring.delete(source);
      }, RAMP_SECONDS * 1000);
    }
  }, []);

  useEffect(() => () => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    if (engine.source) stopNow(engine.source);
    engine.retiring.forEach(stopNow);
    void engine.context.close();
    engineRef.current = null;
  }, []);

  return { start, stop };
};
