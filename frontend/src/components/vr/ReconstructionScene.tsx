import { useEffect, useMemo, useRef, type RefObject } from "react";
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
/** 짧은 파노라마 영상의 시작과 끝에 적용할 오디오 전환 시간. */
const PANORAMA_AUDIO_FADE_SECONDS = 0.5;

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
  const panoramaVideo = event.panorama_video
    ? videos.get(event.panorama_video.src)
    : undefined;

  useEffect(() => {
    if (running) finishedRef.current = false;
  }, [running]);

  // 음수 우선순위는 자동 렌더를 유지하면서 다른 useFrame보다 먼저 돈다.
  // 아래 컴포넌트들이 항상 갱신된 진행도를 읽도록 여기서 시계를 먼저 돌린다.
  useFrame((_, delta) => {
    playback.pulse.current = Math.max(0, playback.pulse.current - PULSE_DECAY * delta);

    if (panoramaVideo) {
      const duration = panoramaVideo.duration;
      const fadeMediaSeconds = PANORAMA_AUDIO_FADE_SECONDS
        * Math.max(0.01, panoramaVideo.playbackRate);
      const fadeIn = panoramaVideo.currentTime / fadeMediaSeconds;
      const fadeOut = Number.isFinite(duration) && duration > 0
        ? (duration - panoramaVideo.currentTime) / fadeMediaSeconds
        : 1;
      const volume = running
        ? Math.max(0, Math.min(1, fadeIn, fadeOut))
        : 0;

      // 프라이밍 중에는 0을 유지하고, 실제 재생 시간의 앞뒤 0.5초에서만 볼륨을 바꾼다.
      if (Math.abs(panoramaVideo.volume - volume) > 0.001) {
        panoramaVideo.volume = volume;
      }
    }

    if (running && seconds > 0) {
      const videoDuration = panoramaVideo?.duration;
      const next = panoramaVideo && typeof videoDuration === "number"
        && Number.isFinite(videoDuration) && videoDuration > 0
        ? panoramaVideo.currentTime / videoDuration
        : playback.progress.current + delta / seconds;
      playback.progress.current = Math.min(1, next);

      if ((panoramaVideo?.ended || next >= 1) && !finishedRef.current) {
        finishedRef.current = true;
        onFinish();
      }
    }

    const chatting = activeChat(cues, playback.progress.current) !== null;
    playback.tone.current = toneAt(event, playback.progress.current, chatting);
  }, -10);

  return (
    <>
      <LookAroundControls
        playback={playback}
        continuous={Boolean(event.panorama || event.panorama_video)}
        motionEnabled={!event.panorama_video}
      />
      <SurroundBackdrop
        event={event}
        playback={playback}
        blurred={blurred}
        videos={videos}
      />
      {!event.panorama_video && event.media.length > 0 ? (
        <SceneMediaPanel
          event={event}
          playback={playback}
          videos={videos}
          running={running}
        />
      ) : null}
    </>
  );
};

export default ReconstructionScene;
