import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { HeartPulse, Square } from "lucide-react";

import PreExperienceFlow, { type PreludePhase } from "../components/vr/PreExperienceFlow";
import ReconstructionScene, { type PlaybackRefs } from "../components/vr/ReconstructionScene";
import SceneErrorBoundary from "../components/vr/SceneErrorBoundary";
import { heartbeatStats, mapRecordedBpm, mix, smoothstep } from "../heartbeat/heartbeatMapping";
import { createRecordedHeartbeatSource } from "../heartbeat/heartbeatSource";
import { playbackSeconds, useVrEvent } from "../data/vrEvent";
import { useEventVideos } from "../vr/useEventVideos";
import { useBreathingAudio } from "../vr/useBreathingAudio";
import { useHeartbeatAudio } from "../vr/useHeartbeatAudio";
import { useHeartbeatHaptics } from "../vr/useHeartbeatHaptics";
import "../styles/vrScene.css";

const xrStore = createXRStore();

/** HUD와 프리루드 상태는 초당 10회만 갱신한다. */
const UI_INTERVAL = 100;
const DEFAULT_ADAPTATION_SECONDS = 8;
const DEFAULT_TRANSITION_SECONDS = 10;
const DEFAULT_COOLDOWN_SECONDS = 8;

type ExperiencePhase = PreludePhase | "vr" | "cooldown";

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

  const [phase, setPhase] = useState<ExperiencePhase>("gate");
  const [leaving, setLeaving] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [baselineBpm, setBaselineBpm] = useState(72);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [breathingOptIn, setBreathingOptIn] = useState(true);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [hud, setHud] = useState({ progress: 0, bpm: 72 });

  const progressRef = useRef(0);
  const pulseRef = useRef(0);
  const toneRef = useRef(0.4);
  const targetBpmRef = useRef(72);
  const phaseStartedAtRef = useRef(0);
  const cooldownStartBpmRef = useRef(72);
  const breathingPresenceRef = useRef(0);
  const cooldownStartBreathingRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);

  const playback = useMemo<PlaybackRefs>(
    () => ({ progress: progressRef, pulse: pulseRef, tone: toneRef }),
    [],
  );

  const seconds = useMemo(() => playbackSeconds(videos.totalSeconds), [videos.totalSeconds]);
  const heartRate = event?.sensor.heart_rate;
  const heartbeatConfig = event?.experience?.heartbeat;
  const heartbeatSource = useMemo(
    () => createRecordedHeartbeatSource(heartRate, seconds * 1000),
    [heartRate, seconds],
  );
  const sourceStats = useMemo(
    () => heartbeatStats(heartbeatSource.values(), heartbeatConfig?.source_baseline_bpm),
    [heartbeatConfig?.source_baseline_bpm, heartbeatSource],
  );
  const selfSyncSeconds = heartbeatConfig?.adaptation_seconds
    ?? heartbeatConfig?.prelude_seconds
    ?? DEFAULT_ADAPTATION_SECONDS;
  const transitionSeconds = heartbeatConfig?.transition_seconds ?? DEFAULT_TRANSITION_SECONDS;
  const cooldownSeconds = heartbeatConfig?.cooldown_seconds ?? DEFAULT_COOLDOWN_SECONDS;
  const mappingGain = heartbeatConfig?.gain ?? 0.85;
  const breathingFeatureEnabled = event?.experience?.breathing?.enabled ?? false;
  const breathingEnabled = breathingFeatureEnabled && breathingOptIn;
  const breathingGain = Math.min(1, Math.max(0, event?.experience?.breathing?.gain ?? 0.8));

  const mappedBpmAt = useCallback((progress: number) => {
    const sourceBpm = heartbeatSource.sample(progress)?.bpm ?? sourceStats.baseline;
    if (heartbeatConfig?.mode === "recorded-absolute") return sourceBpm;
    return mapRecordedBpm(sourceBpm, sourceStats, {
      userBaseline: baselineBpm,
      gain: mappingGain,
    });
  }, [baselineBpm, heartbeatConfig?.mode, heartbeatSource, mappingGain, sourceStats]);

  const firstMappedBpm = mappedBpmAt(0);
  const {
    available: hapticsAvailable,
    label: hapticsLabel,
    pulse: pulseHaptics,
    stop: stopHaptics,
  } = useHeartbeatHaptics(hapticsEnabled);
  const { start: startHeartbeat, stop: stopHeartbeat } = useHeartbeatAudio({
    getBpm: () => targetBpmRef.current,
    onBeat: (bpm) => {
      pulseRef.current = 1;
      pulseHaptics(bpm);
    },
  });
  const { start: startBreathing, stop: stopBreathing } = useBreathingAudio({
    enabled: breathingEnabled,
    getArousal: () => toneRef.current,
    getPresence: () => breathingPresenceRef.current * breathingGain,
  });

  const enterPhase = useCallback((next: ExperiencePhase) => {
    phaseStartedAtRef.current = performance.now();
    setPhaseProgress(next === "ready" ? 1 : 0);
    setPhase(next);
  }, []);

  const completeExit = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    stopHeartbeat();
    stopBreathing();
    stopHaptics();
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => navigate(-1), 600);
  }, [leaving, navigate, stopBreathing, stopHaptics, stopHeartbeat]);

  const abort = useCallback(() => {
    void xrStore.getState().session?.end().catch(() => undefined);
    completeExit();
  }, [completeExit]);

  const beginPrelude = useCallback(() => {
    progressRef.current = 0;
    targetBpmRef.current = baselineBpm;
    breathingPresenceRef.current = 0;
    startHeartbeat();
    if (breathingEnabled) startBreathing();
    enterPhase("self-sync");
  }, [baselineBpm, breathingEnabled, enterPhase, startBreathing, startHeartbeat]);

  const beginVr = useCallback(() => {
    progressRef.current = 0;
    targetBpmRef.current = mappedBpmAt(0);
    enterPhase("vr");
    if (vrSupported) void xrStore.enterVR().catch(() => undefined);
  }, [enterPhase, mappedBpmAt, vrSupported]);

  const beginCooldown = useCallback(() => {
    if (phase === "cooldown" || leaving) return;
    cooldownStartBpmRef.current = targetBpmRef.current;
    cooldownStartBreathingRef.current = breathingPresenceRef.current;
    void xrStore.getState().session?.end().catch(() => undefined);
    enterPhase("cooldown");
  }, [enterPhase, leaving, phase]);

  useEffect(() => {
    if (phase === "gate") {
      targetBpmRef.current = baselineBpm;
      return;
    }

    if (phase === "ready") {
      targetBpmRef.current = firstMappedBpm;
      return;
    }

    const update = () => {
      const elapsedSeconds = (performance.now() - phaseStartedAtRef.current) / 1000;

      if (phase === "self-sync") {
        const progress = Math.min(1, elapsedSeconds / selfSyncSeconds);
        targetBpmRef.current = baselineBpm;
        breathingPresenceRef.current = 0;
        setPhaseProgress(progress);
        setHud({ progress: 0, bpm: baselineBpm });
        if (progress >= 1) enterPhase("transition");
        return;
      }

      if (phase === "transition") {
        const progress = Math.min(1, elapsedSeconds / transitionSeconds);
        const mapped = mix(baselineBpm, firstMappedBpm, smoothstep(progress));
        targetBpmRef.current = mapped;
        breathingPresenceRef.current = smoothstep(progress) * 0.18;
        setPhaseProgress(progress);
        setHud({ progress: 0, bpm: mapped });
        if (progress >= 1) enterPhase("ready");
        return;
      }

      if (phase === "vr") {
        const mapped = mappedBpmAt(progressRef.current);
        targetBpmRef.current = mapped;
        breathingPresenceRef.current = 0.18 + toneRef.current * 0.42;
        setHud({ progress: progressRef.current, bpm: mapped });
        return;
      }

      const progress = Math.min(1, elapsedSeconds / cooldownSeconds);
      const mapped = mix(cooldownStartBpmRef.current, baselineBpm, smoothstep(progress));
      targetBpmRef.current = mapped;
      breathingPresenceRef.current = cooldownStartBreathingRef.current * (1 - smoothstep(progress));
      setPhaseProgress(progress);
      setHud((current) => ({ ...current, bpm: mapped }));
      if (progress >= 1) completeExit();
    };

    update();
    const timer = window.setInterval(update, UI_INTERVAL);
    return () => window.clearInterval(timer);
  }, [
    baselineBpm,
    completeExit,
    cooldownSeconds,
    enterPhase,
    firstMappedBpm,
    mappedBpmAt,
    phase,
    selfSyncSeconds,
    transitionSeconds,
  ]);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
  }, []);

  if (error) return <div className="vr-scene-message">{error}</div>;
  if (!event) return <div className="vr-scene-message">이벤트 자료를 불러오는 중입니다…</div>;

  const running = phase === "vr";
  const displayedBpm = phase === "gate"
    ? baselineBpm
    : phase === "ready"
      ? firstMappedBpm
      : hud.bpm;
  const preludePhase = phase === "gate" || phase === "self-sync" || phase === "transition" || phase === "ready"
    ? phase
    : null;

  return (
    <div className={`vr-scene${leaving ? " is-leaving" : ""}`}>
      <Canvas
        className="vr-scene-canvas"
        camera={{ position: [0, 1.6, 0], fov: 55 }}
      >
        <color attach="background" args={["#0a1526"]} />
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
            </Suspense>
          </SceneErrorBoundary>
        </XR>
      </Canvas>

      {preludePhase && (
        <PreExperienceFlow
          phase={preludePhase}
          eventTitle={event.title}
          eventDescription={event.description}
          eventLabel={`${event.persona.toUpperCase()} · ${event.event_id}`}
          provenance={event.panorama?.generated
            ? event.panorama.mode === "recorded_anchor"
              ? "촬영된 정면을 기준으로 AI가 확장한 360° 추정 환경입니다."
              : "생체신호와 페르소나 패턴을 바탕으로 AI가 생성한 장면 가설이며 실제 장소 기록이 아닙니다."
            : undefined}
          seconds={seconds}
          mediaCount={event.media.length}
          chatCount={event.chats.length}
          mediaReady={videos.ready}
          vrSupported={vrSupported}
          baselineBpm={baselineBpm}
          currentBpm={displayedBpm}
          phaseProgress={phaseProgress}
          hapticsEnabled={hapticsEnabled}
          hapticsAvailable={hapticsAvailable}
          hapticsLabel={hapticsLabel}
          breathingEnabled={breathingEnabled}
          breathingAvailable={breathingFeatureEnabled}
          onBaselineChange={setBaselineBpm}
          onHapticsChange={setHapticsEnabled}
          onBreathingChange={setBreathingOptIn}
          onStartPrelude={beginPrelude}
          onEnterVr={beginVr}
          onBack={abort}
        />
      )}

      {sceneError && phase !== "vr" && <p className="vr-scene-floating-error">씬을 그리지 못했습니다 — {sceneError}</p>}

      {running && (
        <div className="vr-scene-hud">
          <div className="vr-scene-bpm">
            <HeartPulse size={18} />
            <strong>{Math.round(hud.bpm)}</strong>
            <small>체감 bpm</small>
          </div>

          <div className="vr-scene-progress">
            <span style={{ width: `${hud.progress * 100}%` }} />
          </div>

          <button className="vr-scene-stop" onClick={beginCooldown}>
            <Square size={16} /> 재현 종료
          </button>
        </div>
      )}

      {phase === "cooldown" && (
        <div className="vr-scene-gate vr-cooldown">
          <div className="vr-scene-gate-card vr-prelude-card">
            <p className="vr-scene-eyebrow">COOLDOWN</p>
            <h1>설정한 기준 박동으로 돌아옵니다</h1>
            <p className="vr-scene-desc">햅틱과 심음을 갑자기 끊지 않고 안정적으로 마무리합니다.</p>
            <div
              className="vr-prelude-heart"
              style={{ "--beat-duration": `${60 / Math.max(35, hud.bpm)}s` } as CSSProperties}
            >
              <span><HeartPulse size={36} /></span>
              <strong>{Math.round(hud.bpm)}</strong>
              <small>체감 bpm</small>
            </div>
            <div className="vr-prelude-progress"><span style={{ width: `${phaseProgress * 100}%` }} /></div>
            <button className="vr-scene-stop vr-cooldown-stop" onClick={completeExit}>바로 종료</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VrScene;
