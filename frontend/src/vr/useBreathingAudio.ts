import { useCallback, useEffect, useRef } from "react";

type BreathingOptions = {
  enabled: boolean;
  /** EDA·장면 톤에서 얻은 느린 각성도 (0~1). */
  getArousal: () => number;
  /** 단계별 등장·퇴장을 제어하는 값 (0~1). */
  getPresence: () => number;
};

type Engine = {
  context: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
  running: boolean;
  timer: number | null;
  enabled: boolean;
  getArousal: () => number;
  getPresence: () => number;
  activeSources: Set<AudioBufferSourceNode>;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** 반복 티가 덜 나도록 충분히 긴 단일 채널 노이즈를 만든다. */
const createNoise = (context: AudioContext, seconds = 8) => {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let smoothed = 0;

  for (let index = 0; index < channel.length; index += 1) {
    smoothed = smoothed * 0.82 + (Math.random() * 2 - 1) * 0.18;
    channel[index] = smoothed;
  }

  return buffer;
};

/** 한 번의 들숨·날숨 질감을 예약한다. 실제 호흡 기록이 아닌 합성 분위기다. */
const scheduleBreath = (engine: Engine) => {
  if (!engine.running) return;

  const arousal = clamp(engine.getArousal(), 0, 1);
  const presence = clamp(engine.getPresence(), 0, 1);
  const breathsPerMinute = 8 + arousal * 8;
  const intervalSeconds = 60 / breathsPerMinute;

  if (engine.enabled && presence > 0.01) {
    const at = engine.context.currentTime + 0.03;
    const length = Math.min(5.8, intervalSeconds * 0.82);
    const source = engine.context.createBufferSource();
    const filter = engine.context.createBiquadFilter();
    const envelope = engine.context.createGain();
    const maxOffset = Math.max(0, engine.noise.duration - length);

    source.buffer = engine.noise;
    filter.type = "bandpass";
    filter.Q.value = 0.55;
    filter.frequency.setValueAtTime(520 + arousal * 120, at);
    filter.frequency.linearRampToValueAtTime(920 + arousal * 180, at + length * 0.32);
    filter.frequency.linearRampToValueAtTime(620 + arousal * 100, at + length);

    // 들숨 뒤의 짧은 틈과 조금 더 부드러운 날숨을 한 호흡 안에 만든다.
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.85, at + length * 0.28);
    envelope.gain.exponentialRampToValueAtTime(0.03, at + length * 0.46);
    envelope.gain.exponentialRampToValueAtTime(0.55, at + length * 0.64);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);

    source.connect(filter).connect(envelope).connect(engine.master);
    engine.activeSources.add(source);
    source.addEventListener("ended", () => engine.activeSources.delete(source), { once: true });
    source.start(at, Math.random() * maxOffset, length);
    source.stop(at + length + 0.02);
  }

  engine.timer = window.setTimeout(
    () => scheduleBreath(engine),
    intervalSeconds * 1000,
  );
};

/** EDA 기반 각성도에 따라 속도와 질감이 달라지는 합성 호흡 분위기. */
export const useBreathingAudio = ({ enabled, getArousal, getPresence }: BreathingOptions) => {
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.enabled = enabled;
    engine.getArousal = getArousal;
    engine.getPresence = getPresence;

    const target = enabled ? clamp(getPresence(), 0, 1) * 0.11 : 0;
    engine.master.gain.setTargetAtTime(target, engine.context.currentTime, 0.08);
  });

  /** 사용자 클릭 안에서 호출해 오디오 권한을 먼저 확보한다. */
  const start = useCallback(() => {
    let engine = engineRef.current;

    if (!engine) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);

      engine = {
        context,
        master,
        noise: createNoise(context),
        running: false,
        timer: null,
        enabled,
        getArousal,
        getPresence,
        activeSources: new Set(),
      };
      engineRef.current = engine;
    }

    if (engine.running) return;
    engine.enabled = enabled;
    engine.getArousal = getArousal;
    engine.getPresence = getPresence;
    engine.running = true;
    void engine.context.resume();
    scheduleBreath(engine);
  }, [enabled, getArousal, getPresence]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    engine.master.gain.setValueAtTime(0, engine.context.currentTime);
    if (engine.timer !== null) {
      window.clearTimeout(engine.timer);
      engine.timer = null;
    }
    for (const source of engine.activeSources) {
      try { source.stop(); } catch { /* 이미 종료된 소스는 무시한다. */ }
    }
    engine.activeSources.clear();
  }, []);

  useEffect(() => () => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    if (engine.timer !== null) window.clearTimeout(engine.timer);
    for (const source of engine.activeSources) {
      try { source.stop(); } catch { /* 이미 종료된 소스는 무시한다. */ }
    }
    void engine.context.close();
    engineRef.current = null;
  }, []);

  return { start, stop };
};
