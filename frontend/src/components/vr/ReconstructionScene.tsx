import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";

import { activeChat, chatCues, toneAt, type VrEvent } from "../../data/vrEvent";
import { useBlurredTextures } from "../../vr/useBlurredTextures";
import LookAroundControls from "./LookAroundControls";
import SceneMediaPanel from "./SceneMediaPanel";
import SurroundBackdrop from "./SurroundBackdrop";

/**
 * 씬 전체가 공유하는 재생 상태.
 *
 * 매 프레임 바뀌는 값이라 React state로 올리면 전체가 리렌더된다. ref로 흘리고
 * 각 컴포넌트가 자기 useFrame 안에서 읽는다.
 */
export type PlaybackRefs = {
  /** 0~1 재생 진행도. */
  progress: RefObject<number>;
  /** 심박마다 1로 튀었다가 감쇠하는 값. */
  pulse: RefObject<number>;
  /** 0~1 긴장도. 색온도와 vignette 강도가 따라간다. */
  tone: RefObject<number>;
};

/** 심박 pulse가 사그라드는 속도 (1/초). */
const PULSE_DECAY = 6;

interface ReconstructionSceneProps {
  event: VrEvent;
  seconds: number;
  playback: PlaybackRefs;
  videos: Map<string, HTMLVideoElement>;
  /** 재생 중일 때만 시계가 흐른다. */
  running: boolean;
  onFinish: () => void;
}

const ReconstructionScene = ({
  event, seconds, playback, videos, running, onFinish,
}: ReconstructionSceneProps) => {
  const blurred = useBlurredTextures(event);
  const cues = useMemo(() => chatCues(event, seconds), [event, seconds]);
  const finishedRef = useRef(false);

  // 음수 우선순위는 자동 렌더를 유지하면서 다른 useFrame보다 먼저 돈다.
  // 아래 컴포넌트들이 항상 갱신된 진행도를 읽도록 여기서 시계를 먼저 돌린다.
  useFrame((_, delta) => {
    playback.pulse.current = Math.max(0, playback.pulse.current - PULSE_DECAY * delta);

    if (running && seconds > 0) {
      const next = playback.progress.current + delta / seconds;
      playback.progress.current = Math.min(1, next);

      if (next >= 1 && !finishedRef.current) {
        finishedRef.current = true;
        onFinish();
      }
    }

    const chatting = activeChat(cues, playback.progress.current) !== null;
    playback.tone.current = toneAt(event, playback.progress.current, chatting);
  }, -10);

  return (
    <>
      <LookAroundControls playback={playback} />
      <SurroundBackdrop event={event} playback={playback} blurred={blurred} />
      <SceneMediaPanel event={event} playback={playback} videos={videos} />
    </>
  );
};

export default ReconstructionScene;
