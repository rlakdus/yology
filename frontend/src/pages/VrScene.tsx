import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { ArrowLeft, Square } from "lucide-react";

import HeartbeatPrelude, {
  type HeartbeatPreludePhase,
} from "../components/vr/HeartbeatPrelude";
import ImmersiveStopControl from "../components/vr/ImmersiveStopControl";
import ReconstructionScene, { type PlaybackRefs } from "../components/vr/ReconstructionScene";
import SceneErrorBoundary from "../components/vr/SceneErrorBoundary";
import { heartbeatStats, mix, smoothstep } from "../heartbeat/heartbeatMapping";
import {
  readHeartRateInput,
  translateEventBpm,
  type HeartRateInputSnapshot,
} from "../heartbeat/heartRateInput";
import { createRecordedHeartbeatSource } from "../heartbeat/heartbeatSource";
import { playbackSeconds, useVrEvent } from "../data/vrEvent";
import { useEventVideos } from "../vr/useEventVideos";
import { useAmbienceAudio } from "../vr/useAmbienceAudio";
import { useBreathingAudio } from "../vr/useBreathingAudio";
import { useHeartbeatAudio } from "../vr/useHeartbeatAudio";
import { useHeartbeatHaptics } from "../vr/useHeartbeatHaptics";
import "../styles/vrScene.css";

const xrStore = createXRStore({
  // 중심 시야의 선명도는 유지하면서 주변부와 XR 프레임버퍼의 GPU 부하를 낮춘다.
  foveation: 1,
  frameBufferScaling: "mid",
});

const UI_INTERVAL = 100;
const INTRO_SECONDS = 4.2;
const DEFAULT_LEAD_IN_BEATS = 4;
const DEFAULT_CAMERA_FOV = 55;
const PANORAMA_VIDEO_CAMERA_FOV = 65;
/** 마지막 프레임에서 검은 화면까지 넘어가는 시간. 이후 퇴장 페이드까지 합쳐 1초 이내다. */
const EXIT_TO_BLACK_SECONDS = 0.55;
const EXIT_NAVIGATION_DELAY_MS = 250;
const NEUTRAL_COOLDOWN_BPM = 72;

type ExperiencePhase = HeartbeatPreludePhase;

const UNAVAILABLE_INPUT: HeartRateInputSnapshot = {
  status: "unavailable",
  baselineBpm: null,
};

/** 브라우저가 몰입형 VR 세션을 지원하는지 확인한다. */
const useImmersiveVrSupport = () => {
  const [supported, setSupported] = useState<boolean | null>(() => (navigator.xr ? null : false));

  useEffect(() => {
    const xr = navigator.xr;
    if (!xr) return;

    let cancelled = false;
    xr.isSessionSupported("immersive-vr")
      .then((result) => { if (!cancelled) setSupported(result); })
      .catch(() => { if (!cancelled) setSupported(false); });

    return () => { cancelled = true; };
  }, []);

  return supported;
};

const VrScene = () => {
  const { persona, eventId } = useParams();
  const navigate = useNavigate();
  const { event, error } = useVrEvent(persona, eventId);
  const videos = useEventVideos(event);
  const vrSupported = useImmersiveVrSupport();

  const [phase, setPhase] = useState<ExperiencePhase>("intro");
  const [leaving, setLeaving] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [phaseProgress, setPhaseProgress] = useState(0);

  const phaseRef = useRef<ExperiencePhase>("intro");
  const progressRef = useRef(0);
  const pulseRef = useRef(0);
  const toneRef = useRef(0.4);
  const targetBpmRef = useRef(72);
  const phaseStartedAtRef = useRef(0);
  const cooldownStartBpmRef = useRef(72);
  const breathingPresenceRef = useRef(0);
  const cooldownStartBreathingRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const mediaStartPendingRef = useRef(false);
  const leadInBeatCountRef = useRef(0);
  const startMediaRef = useRef<() => void>(() => undefined);
  const primingPromiseRef = useRef<Promise<void> | null>(null);
  const listenerInputRef = useRef<HeartRateInputSnapshot>(UNAVAILABLE_INPUT);

  const playback = useMemo<PlaybackRefs>(
    () => ({ progress: progressRef, pulse: pulseRef, tone: toneRef }),
    [],
  );

  const seconds = useMemo(() => playbackSeconds(videos.totalSeconds), [videos.totalSeconds]);
  const primaryVideoSource = event?.panorama_video?.src
    ?? event?.media.find((entry) => entry.kind === "video")?.src;
  const primaryVideo = primaryVideoSource
    ? videos.elements.get(primaryVideoSource)
    : undefined;
  const heartbeatConfig = event?.experience?.heartbeat;
  const heartbeatSource = useMemo(
    () => createRecordedHeartbeatSource(event?.sensor.heart_rate, seconds * 1000),
    [event?.sensor.heart_rate, seconds],
  );
  const sourceStats = useMemo(
    () => heartbeatStats(heartbeatSource.values(), heartbeatConfig?.source_baseline_bpm),
    [heartbeatConfig?.source_baseline_bpm, heartbeatSource],
  );
  const leadInBeats = Math.max(
    1,
    Math.round(event?.experience?.intro?.lead_in_beats ?? DEFAULT_LEAD_IN_BEATS),
  );
  const breathingEnabled = event?.experience?.breathing?.enabled ?? false;
  const breathingGain = Math.min(1, Math.max(0, event?.experience?.breathing?.gain ?? 0.8));

  const sourceBpmAt = useCallback(
    (progress: number) => heartbeatSource.sample(progress)?.bpm ?? sourceStats.baseline,
    [heartbeatSource, sourceStats.baseline],
  );
  const experienceBpmAt = useCallback(
    (progress: number) => translateEventBpm(
      sourceBpmAt(progress),
      sourceStats,
      listenerInputRef.current,
    ),
    [sourceBpmAt, sourceStats],
  );
  const firstSourceBpm = sourceBpmAt(0);

  const { pulse: pulseHaptics, stop: stopHaptics } = useHeartbeatHaptics(true);
  const { start: startHeartbeat, stop: stopHeartbeat } = useHeartbeatAudio({
    getBpm: () => targetBpmRef.current,
    onBeat: (bpm) => {
      pulseRef.current = 1;
      pulseHaptics(bpm);
      if (phaseRef.current === "prelude") {
        leadInBeatCountRef.current += 1;
        if (leadInBeatCountRef.current >= leadInBeats) {
          window.setTimeout(() => startMediaRef.current(), 0);
        }
      }
    },
  });
  const { start: startBreathing, stop: stopBreathing } = useBreathingAudio({
    enabled: breathingEnabled,
    getArousal: () => toneRef.current,
    getPresence: () => breathingPresenceRef.current * breathingGain,
  });
  // 룸 톤은 프리루드부터 깔린다. 심박보다 먼저 공간에 들어와 있어야 하기 때문에
  // 재생 진행도가 아니라 장면에 머무는 동안 계속 유지된다.
  const { start: startAmbience, stop: stopAmbience } = useAmbienceAudio({
    src: event?.ambience?.src ?? null,
    gain: event?.ambience?.gain ?? 1,
    loop: event?.ambience?.loop ?? true,
    getPresence: () => 1,
  });

  const enterPhase = useCallback((next: ExperiencePhase) => {
    phaseRef.current = next;
    phaseStartedAtRef.current = performance.now();
    setPhaseProgress(next === "waiting" || next === "vr" ? 1 : 0);
    setPhase(next);
  }, []);

  const pauseVideos = useCallback(() => {
    videos.elements.forEach((video) => {
      video.pause();
    });
  }, [videos.elements]);

  const resetVideos = useCallback(() => {
    pauseVideos();
    videos.elements.forEach((video) => {
      if (video.readyState > 0) video.currentTime = 0;
    });
    primingPromiseRef.current = null;
  }, [pauseVideos, videos.elements]);

  const completeExit = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    stopHeartbeat();
    stopBreathing();
    stopAmbience();
    stopHaptics();
    resetVideos();
    void xrStore.getState().session?.end().catch(() => undefined);
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => navigate(-1), EXIT_NAVIGATION_DELAY_MS);
  }, [leaving, navigate, resetVideos, stopAmbience, stopBreathing, stopHaptics, stopHeartbeat]);

  const abort = useCallback(() => {
    completeExit();
  }, [completeExit]);

  const failPlayback = useCallback((message: string) => {
    mediaStartPendingRef.current = false;
    setRetrying(false);
    stopHeartbeat();
    stopBreathing();
    stopAmbience();
    stopHaptics();
    resetVideos();
    void xrStore.getState().session?.end().catch(() => undefined);
    leadInBeatCountRef.current = 0;
    enterPhase("waiting");
    setPlaybackError(message);
  }, [enterPhase, resetVideos, stopAmbience, stopBreathing, stopHaptics, stopHeartbeat]);

  const markPlaybackStarted = useCallback(() => {
    mediaStartPendingRef.current = false;
    setRetrying(false);
    progressRef.current = 0;
    breathingPresenceRef.current = breathingEnabled ? 0.18 : 0;
    if (breathingEnabled) startBreathing();
    enterPhase("vr");
  }, [breathingEnabled, enterPhase, startBreathing]);

  const startMediaFromBeginning = useCallback(() => {
    if (mediaStartPendingRef.current || phaseRef.current !== "prelude") return;
    mediaStartPendingRef.current = true;
    progressRef.current = 0;

    if (!primaryVideo) {
      markPlaybackStarted();
      return;
    }

    const startVideo = async () => {
      try {
        await primingPromiseRef.current?.catch(() => undefined);
        if (phaseRef.current !== "prelude") return;
        if (primaryVideo.error) primaryVideo.load();
        if (primaryVideo.readyState > 0) primaryVideo.currentTime = 0;
        await primaryVideo.play();
        // 여기가 현장음이 처음 들려야 하는 지점이다. 프라이밍은 음소거로 지나갔고,
        // 재생이 실제로 시작된 뒤에 푸는 것이라 자동재생 정책에도 걸리지 않는다.
        primaryVideo.muted = false;
        if (phaseRef.current === "prelude") markPlaybackStarted();
      } catch {
        failPlayback("영상을 자동으로 이어가지 못했습니다.");
      }
    };

    void startVideo();
  }, [failPlayback, markPlaybackStarted, primaryVideo]);

  useEffect(() => {
    startMediaRef.current = startMediaFromBeginning;
  }, [startMediaFromBeginning]);

  const beginPrelude = useCallback(() => {
    if (!videos.ready) return;
    setPlaybackError("");
    setRetrying(false);
    leadInBeatCountRef.current = 0;
    progressRef.current = 0;
    pulseRef.current = 0;
    mediaStartPendingRef.current = false;
    listenerInputRef.current = readHeartRateInput();
    targetBpmRef.current = translateEventBpm(
      firstSourceBpm,
      sourceStats,
      listenerInputRef.current,
    );
    breathingPresenceRef.current = 0;
    resetVideos();
    enterPhase("prelude");

    // XR 세션과 미디어 권한 요청은 반드시 같은 사용자 입력 안에서 시작한다.
    if (vrSupported) void xrStore.enterVR().catch(() => undefined);

    if (primaryVideo) {
      // 자동재생 잠금을 푸는 재생일 뿐이라 소리는 나오면 안 된다. 음소거를 하지 않으면
      // 버튼을 누른 순간 현장음이 한 번 튀었다가 곧바로 멈춘다.
      primaryVideo.muted = true;
      const prime = primaryVideo.play();
      primingPromiseRef.current = prime;
      void prime.then(() => {
        if (phaseRef.current !== "prelude") return;
        primaryVideo.pause();
        if (primaryVideo.readyState > 0) primaryVideo.currentTime = 0;
      }).catch(() => undefined);
    }

    startHeartbeat();
    startAmbience();
  }, [
    enterPhase,
    firstSourceBpm,
    primaryVideo,
    resetVideos,
    sourceStats,
    startAmbience,
    startHeartbeat,
    videos.ready,
    vrSupported,
  ]);

  const retryPlayback = useCallback(() => {
    if (!videos.ready) return;
    setPlaybackError("");
    setRetrying(true);
    progressRef.current = 0;
    mediaStartPendingRef.current = true;
    listenerInputRef.current = readHeartRateInput();
    targetBpmRef.current = translateEventBpm(
      firstSourceBpm,
      sourceStats,
      listenerInputRef.current,
    );
    resetVideos();
    startHeartbeat();
    startAmbience();
    if (vrSupported) void xrStore.enterVR().catch(() => undefined);

    if (!primaryVideo) {
      markPlaybackStarted();
      return;
    }

    // 재시도는 사용자 탭 안에서 바로 재생하므로 프리루드를 거치지 않는다. 현장음도
    // 그 자리에서 같이 들어와야 한다.
    void primaryVideo.play()
      .then(() => {
        primaryVideo.muted = false;
        markPlaybackStarted();
      })
      .catch(() => failPlayback("영상 재생을 시작하지 못했습니다."));
  }, [
    failPlayback,
    firstSourceBpm,
    markPlaybackStarted,
    primaryVideo,
    resetVideos,
    sourceStats,
    startAmbience,
    startHeartbeat,
    videos.ready,
    vrSupported,
  ]);

  const beginCooldown = useCallback(() => {
    if (phaseRef.current === "cooldown" || leaving) return;
    cooldownStartBpmRef.current = targetBpmRef.current;
    cooldownStartBreathingRef.current = breathingPresenceRef.current;
    // 되감지 않고 현재 프레임에서 멈춘다. 검은 베일이 이 마지막 장면 위로 짧게 닫힌다.
    pauseVideos();
    enterPhase("cooldown");
  }, [enterPhase, leaving, pauseVideos]);

  useEffect(() => {
    if (!primaryVideo) return;
    const handleError = () => {
      if (phaseRef.current !== "vr") return;
      failPlayback("영상 연결이 중단되었습니다.");
    };
    primaryVideo.addEventListener("error", handleError);
    return () => primaryVideo.removeEventListener("error", handleError);
  }, [failPlayback, primaryVideo]);

  useEffect(() => {
    if (!event) return;
    if (phaseStartedAtRef.current === 0) phaseStartedAtRef.current = performance.now();

    const update = () => {
      const elapsedSeconds = (performance.now() - phaseStartedAtRef.current) / 1000;

      if (phaseRef.current === "intro") {
        const progress = Math.min(1, elapsedSeconds / INTRO_SECONDS);
        targetBpmRef.current = firstSourceBpm;
        breathingPresenceRef.current = 0;
        setPhaseProgress(progress);
        if (progress >= 1) enterPhase("waiting");
        return;
      }

      if (phaseRef.current === "waiting") {
        targetBpmRef.current = firstSourceBpm;
        return;
      }

      if (phaseRef.current === "prelude") {
        targetBpmRef.current = experienceBpmAt(0);
        return;
      }

      if (phaseRef.current === "vr") {
        targetBpmRef.current = experienceBpmAt(progressRef.current);
        breathingPresenceRef.current = 0.18 + toneRef.current * 0.42;
        return;
      }

      const progress = Math.min(1, elapsedSeconds / EXIT_TO_BLACK_SECONDS);
      targetBpmRef.current = mix(
        cooldownStartBpmRef.current,
        NEUTRAL_COOLDOWN_BPM,
        smoothstep(progress),
      );
      breathingPresenceRef.current = cooldownStartBreathingRef.current * (1 - smoothstep(progress));
      setPhaseProgress(progress);
      if (progress >= 1) completeExit();
    };

    update();
    const timer = window.setInterval(update, UI_INTERVAL);
    return () => window.clearInterval(timer);
  }, [
    completeExit,
    enterPhase,
    event,
    experienceBpmAt,
    firstSourceBpm,
  ]);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== "Escape") return;
      if (phaseRef.current === "vr") beginCooldown();
      else if (phaseRef.current !== "cooldown") abort();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [abort, beginCooldown]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    resetVideos();
  }, [resetVideos]);

  if (error) return <div className="vr-scene-message">{error}</div>;
  if (!event) return <div className="vr-scene-message">이벤트 자료를 불러오는 중입니다…</div>;

  const running = phase === "vr";

  return (
    <div className={`vr-scene${leaving ? " is-leaving" : ""}`}>
      <Canvas
        className="vr-scene-canvas"
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{
          position: [0, 1.6, 0],
          fov: event.panorama_video ? PANORAMA_VIDEO_CAMERA_FOV : DEFAULT_CAMERA_FOV,
        }}
      >
        <color attach="background" args={["#000000"]} />
        <XR store={xrStore}>
          <SceneErrorBoundary onError={setSceneError}>
            <Suspense fallback={null}>
              <ReconstructionScene
                event={event}
                seconds={seconds}
                playback={playback}
                videos={videos.elements}
                running={running}
                onFinish={beginCooldown}
              />
              <HeartbeatPrelude
                event={event}
                phase={phase}
                phaseProgress={phaseProgress}
                pulse={pulseRef}
              />
              <ImmersiveStopControl
                visible={!leaving}
                onStop={running ? beginCooldown : abort}
              />
            </Suspense>
          </SceneErrorBoundary>
        </XR>
      </Canvas>

      {(phase === "intro" || phase === "waiting") && (
        <button className="vr-spatial-back" onClick={abort} aria-label="체험 종료">
          <ArrowLeft size={21} />
        </button>
      )}

      {phase === "waiting" && videos.ready && !retrying && (
        <div className="vr-spatial-prompt">
          {playbackError && <p role="alert">{playbackError}</p>}
          <button onClick={playbackError ? retryPlayback : beginPrelude}>
            {!playbackError && <span className="vr-spatial-prompt-hint">click here</span>}
            <span>
              {playbackError ? "탭하여 이어가기" : "심장박동 느끼기"}
            </span>
          </button>
        </div>
      )}

      {sceneError && phase === "waiting" && (
        <p className="vr-scene-floating-error">장면을 불러오지 못했습니다. {sceneError}</p>
      )}

      <button
        className="vr-scene-stop-icon"
        onClick={running ? beginCooldown : abort}
        aria-label="VR 종료하기"
        title="VR 종료하기"
      >
        <Square size={15} aria-hidden="true" />
        <span>VR 종료하기</span>
      </button>
    </div>
  );
};

export default VrScene;
