import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { ArrowLeft, HeartPulse, Loader2, MonitorSmartphone, Play, Square } from "lucide-react";

import ReconstructionScene, { type PlaybackRefs } from "../components/vr/ReconstructionScene";
import SceneErrorBoundary from "../components/vr/SceneErrorBoundary";
import { playbackSeconds, sampleAt, useVrEvent } from "../data/vrEvent";
import { useEventVideos } from "../vr/useEventVideos";
import { useHeartbeatAudio } from "../vr/useHeartbeatAudio";
import "../styles/vrScene.css";

const xrStore = createXRStore();

/** HUD는 초당 10회만 갱신한다. 매 프레임 리렌더할 이유가 없다. */
const HUD_INTERVAL = 100;

/** 브라우저가 몰입형 VR 세션을 지원하는지 확인한다. (헤드셋이 없으면 false) */
const useImmersiveVrSupport = () => {
  // WebXR API 자체가 없으면 확인할 것도 없이 미지원이다.
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

  const [running, setRunning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [hud, setHud] = useState({ progress: 0, bpm: 0 });

  const progressRef = useRef(0);
  const pulseRef = useRef(0);
  const toneRef = useRef(0.4);
  const playback = useMemo<PlaybackRefs>(
    () => ({ progress: progressRef, pulse: pulseRef, tone: toneRef }),
    [],
  );

  // 사건 길이와 무관하게 고정 길이로 흐른다. 영상만은 압축할 수 없어 예외다.
  const seconds = useMemo(() => playbackSeconds(videos.totalSeconds), [videos.totalSeconds]);

  const heartRate = event?.sensor.heart_rate;
  const heartbeat = useHeartbeatAudio({
    getBpm: () => sampleAt(heartRate, progressRef.current) ?? 72,
    onBeat: () => { pulseRef.current = 1; },
  });

  const finish = useCallback(() => {
    setRunning(false);
    setLeaving(true);
    heartbeat.stop();
    void xrStore.getState().session?.end().catch(() => undefined);
    window.setTimeout(() => navigate(-1), 700);
  }, [heartbeat, navigate]);

  const begin = () => {
    // 이 클릭 하나가 오디오 잠금 해제와 영상 재생 허가, VR 진입을 함께 처리한다.
    progressRef.current = 0;
    heartbeat.start();
    if (vrSupported) void xrStore.enterVR().catch(() => undefined);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setHud({
        progress: progressRef.current,
        bpm: sampleAt(heartRate, progressRef.current) ?? 0,
      });
    }, HUD_INTERVAL);
    return () => window.clearInterval(timer);
  }, [running, heartRate]);

  if (error) return <div className="vr-scene-message">{error}</div>;
  if (!event) return <div className="vr-scene-message">이벤트 자료를 불러오는 중입니다…</div>;

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
                onFinish={finish}
              />
            </Suspense>
          </SceneErrorBoundary>
        </XR>
      </Canvas>

      {!running && !leaving && (
        <div className="vr-scene-gate">
          <div className="vr-scene-gate-card">
            <button className="vr-scene-back" onClick={() => navigate(-1)} aria-label="돌아가기">
              <ArrowLeft size={20} />
            </button>

            <p className="vr-scene-eyebrow">{event.persona.toUpperCase()} · {event.event_id}</p>
            <h1>{event.title}</h1>
            <p className="vr-scene-desc">{event.description}</p>

            <dl className="vr-scene-facts">
              <div><dt>재현 길이</dt><dd>{Math.round(seconds)}초</dd></div>
              <div><dt>자료</dt><dd>{event.media.length}건</dd></div>
              <div><dt>대화</dt><dd>{event.chats.length}줄</dd></div>
            </dl>

            <button className="vr-scene-start" onClick={begin} disabled={!videos.ready}>
              {videos.ready ? <Play size={18} /> : <Loader2 size={18} />}
              {videos.ready ? "재현 시작" : "자료 준비 중"}
            </button>

            {sceneError && <p className="vr-scene-error">씬을 그리지 못했습니다 — {sceneError}</p>}

            <p className="vr-scene-status">
              {vrSupported === null && <><Loader2 size={14} /> VR 지원 확인 중</>}
              {vrSupported === false && <><MonitorSmartphone size={14} /> 데스크톱 프리뷰 · 드래그로 주위를 둘러보세요</>}
              {vrSupported === true && <><MonitorSmartphone size={14} /> 시작하면 헤드셋으로 전환됩니다</>}
            </p>
          </div>
        </div>
      )}

      {running && (
        <div className="vr-scene-hud">
          <div className="vr-scene-bpm">
            <HeartPulse size={18} />
            <strong>{Math.round(hud.bpm)}</strong>
            <small>bpm</small>
          </div>

          <div className="vr-scene-progress">
            <span style={{ width: `${hud.progress * 100}%` }} />
          </div>

          <button className="vr-scene-stop" onClick={finish}>
            <Square size={16} /> 재현 종료
          </button>
        </div>
      )}
    </div>
  );
};

export default VrScene;
