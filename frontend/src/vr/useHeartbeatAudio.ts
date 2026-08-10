import { useCallback, useEffect, useRef } from "react";

interface HeartbeatOptions {
  /** 매 박동 직전에 호출되어 그 순간의 BPM을 알려준다. */
  getBpm: () => number;
  /** 박동이 울린 시점. vignette·패널 pulse가 소리와 붙도록 쓰인다. */
  onBeat?: (bpm: number) => void;
}

type Engine = {
  context: AudioContext;
  output: AudioNode;
  running: boolean;
  timer: number | null;
  getBpm: () => number;
  onBeat?: (bpm: number) => void;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** 저주파 sine 버스트 하나. 심음의 "덩" 한 번에 해당한다. */
const thump = (
  context: AudioContext,
  at: number,
  frequency: number,
  level: number,
  length: number,
  output: AudioNode,
) => {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, at + length);

  // exponentialRamp는 0을 다룰 수 없어 0에 가까운 값에서 시작하고 끝낸다.
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(level, at + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);

  oscillator.connect(envelope).connect(output);
  oscillator.start(at);
  oscillator.stop(at + length + 0.02);
};

/**
 * 한 박동을 울리고 다음 박동을 예약한다.
 *
 * 간격을 매번 그 순간의 BPM에서 새로 계산하므로, 재생 중 심박이 데이터를 따라
 * 빨라지고 느려진다. 음원 파일을 배속 재생해서는 얻을 수 없는 부분이다.
 */
const runBeat = (engine: Engine) => {
  if (!engine.running) return;

  const bpm = clamp(engine.getBpm(), 35, 200);
  const interval = 60 / bpm;
  const at = engine.context.currentTime + 0.02;

  // lub-dub. 두 번째 심음은 더 짧고 작으며, 심박이 빨라져도 간격이 벌어지지 않게 제한한다.
  thump(engine.context, at, 58, 0.9, 0.15, engine.output);
  thump(engine.context, at + Math.min(0.28 * interval, 0.3), 44, 0.5, 0.12, engine.output);

  engine.onBeat?.(bpm);
  engine.timer = window.setTimeout(() => runBeat(engine), interval * 1000);
};

/** 심박음을 Web Audio로 합성한다. 음원 파일에 의존하지 않는다. */
export const useHeartbeatAudio = ({ getBpm, onBeat }: HeartbeatOptions) => {
  const engineRef = useRef<Engine | null>(null);

  // 콜백이 바뀌어도 재생 중인 루프가 최신 값을 쓰도록 렌더가 끝난 뒤에 갈아 끼운다.
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.getBpm = getBpm;
    engineRef.current.onBeat = onBeat;
  });

  /** 사용자 제스처 안에서 호출해야 한다. 브라우저가 그 밖의 재생을 막는다. */
  const start = useCallback(() => {
    let engine = engineRef.current;

    if (!engine) {
      const context = new AudioContext();
      const master = context.createGain();
      const body = context.createBiquadFilter();

      master.gain.value = 0.6;
      body.type = "lowpass";
      body.frequency.value = 220;
      master.connect(body).connect(context.destination);

      engine = { context, output: master, running: false, timer: null, getBpm, onBeat };
      engineRef.current = engine;
    }

    if (engine.running) return;
    engine.getBpm = getBpm;
    engine.onBeat = onBeat;
    engine.running = true;
    void engine.context.resume();
    runBeat(engine);
  }, [getBpm, onBeat]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    if (engine.timer !== null) {
      window.clearTimeout(engine.timer);
      engine.timer = null;
    }
  }, []);

  useEffect(() => () => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.running = false;
    if (engine.timer !== null) window.clearTimeout(engine.timer);
    void engine.context.close();
    engineRef.current = null;
  }, []);

  return { start, stop };
};
