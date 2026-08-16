import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  Camera,
  Check,
  CircleDot,
  Clock3,
  HeartPulse,
  ImagePlus,
  Radio,
  Save,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import SiteNav from "../components/SiteNav";
import { useLiveHeartRate } from "../hooks/useLiveHeartRate";
import type { LiveHeartRateSample } from "../hooks/useLiveHeartRate";
import "../styles/liveDemo.css";

type TraceSample = LiveHeartRateSample & { receivedAt: number };

type Moment = {
  id: string;
  created_at: string;
  updated_at?: string;
  source?: "apple_watch" | "web" | "preview";
  note?: string;
  photo?: string | null;
  photo_url?: string | null;
  status?: "captured" | "enriched";
  signal?: {
    bpm?: number | null;
    baseline?: number | null;
    z_score?: number | null;
    is_anomaly?: boolean;
    timestamp?: number | null;
    motion?: number | null;
    movement_state?: "still" | "light" | "active" | "unknown";
    active_energy_kcal?: number | null;
    distance_m?: number | null;
  };
  previewPhotoUrl?: string | null;
};

const API_BASE = import.meta.env.VITE_LIVE_API_URL || "http://localhost:8000";
const MAX_POINTS = 72;
const MAX_PHOTO_MB = 10;
const LIVE_STALE_MS = 5000;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const previewSeed: Moment[] = [
  {
    id: "preview_01",
    created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    source: "preview",
    status: "enriched",
    note: "발표를 마치고 자리로 돌아온 순간. 긴장이 풀리면서 웃음이 났다.",
    signal: { bpm: 96, baseline: 72, z_score: 2.1, is_anomaly: true, motion: 0.022, movement_state: "still", active_energy_kcal: 2.4, distance_m: 18 },
  },
  {
    id: "preview_02",
    created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
    source: "preview",
    status: "enriched",
    note: "오랜만에 듣던 노래가 우연히 카페에서 흘러나왔다.",
    signal: { bpm: 88, baseline: 71, z_score: 1.7, is_anomaly: true, motion: 0.061, movement_state: "light", active_energy_kcal: 1.1, distance_m: 42 },
  },
];

function makePreviewSample(index: number): LiveHeartRateSample {
  // Calm baseline → short rise → sustained elevated segment → recovery.
  const cycle = index % 46;
  const base = 72 + Math.sin(index / 4) * 1.6;
  let bpm = base;
  if (cycle >= 21 && cycle < 34) bpm += 15 + (cycle - 21) * 0.9;
  if (cycle >= 34 && cycle < 40) bpm += 21 - (cycle - 34) * 2.8;
  const baseline = 72.2;
  const z = Math.abs(bpm - baseline) / 7.2;
  const motionBase = 0.018 + Math.abs(Math.sin(index / 5)) * 0.012;
  const motion = cycle >= 12 && cycle < 20 ? 0.11 + Math.abs(Math.sin(index)) * 0.04 : motionBase;
  const movementState = motion < 0.035 ? "still" : motion < 0.12 ? "light" : "active";
  const activeEnergy = Math.max(0, index * 0.018 + (cycle >= 12 && cycle < 20 ? 0.18 : 0));
  const distance = Math.max(0, index * 0.55 + (cycle >= 12 && cycle < 20 ? (cycle - 12) * 1.8 : 0));
  return {
    type: "heart_rate",
    bpm: Math.round(bpm * 10) / 10,
    baseline,
    z_score: Math.round(z * 100) / 100,
    is_anomaly: z >= 1.5,
    motion: Math.round(motion * 1000) / 1000,
    movement_state: movementState,
    active_energy_kcal: Math.round(activeEnergy * 100) / 100,
    distance_m: Math.round(distance * 10) / 10,
    timestamp: Date.now() / 1000,
  };
}

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));

const LiveDemo = () => {
  const live = useLiveHeartRate();
  const [lastLiveAt, setLastLiveAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [previewSample, setPreviewSample] = useState<LiveHeartRateSample>(() => makePreviewSample(0));
  const [trace, setTrace] = useState<TraceSample[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [anomalyStartedAt, setAnomalyStartedAt] = useState<number | null>(null);
  const [anomalySeconds, setAnomalySeconds] = useState(0);
  const anomalyTimer = useRef<number | null>(null);
  const previewCounter = useRef(0);

  useEffect(() => {
    if (live.sample) setLastLiveAt(Date.now());
  }, [live.sample]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const liveIsFresh = Boolean(live.connected && live.sample && lastLiveAt && clockTick - lastLiveAt < LIVE_STALE_MS);
  const previewMode = !liveIsFresh;
  const activeSample = previewMode ? previewSample : live.sample;

  useEffect(() => {
    if (!previewMode) return;
    const timer = window.setInterval(() => {
      previewCounter.current += 1;
      setPreviewSample(makePreviewSample(previewCounter.current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [previewMode]);

  useEffect(() => {
    if (!activeSample) return;
    setTrace((prev) => [
      ...prev,
      { ...activeSample, receivedAt: Date.now() },
    ].slice(-MAX_POINTS));
  }, [activeSample]);

  useEffect(() => {
    if (activeSample?.is_anomaly) {
      setAnomalyStartedAt((prev) => prev ?? Date.now());
    } else {
      setAnomalyStartedAt(null);
      setAnomalySeconds(0);
    }
  }, [activeSample?.is_anomaly]);

  useEffect(() => {
    if (anomalyTimer.current) window.clearInterval(anomalyTimer.current);
    if (!anomalyStartedAt) return;
    anomalyTimer.current = window.setInterval(() => {
      setAnomalySeconds((Date.now() - anomalyStartedAt) / 1000);
    }, 200);
    return () => {
      if (anomalyTimer.current) window.clearInterval(anomalyTimer.current);
    };
  }, [anomalyStartedAt]);

  const loadMoments = async () => {
    try {
      const response = await fetch(`${API_BASE}/moments`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setBackendAvailable(true);
      setMoments(Array.isArray(data.moments) ? data.moments : []);
    } catch {
      setBackendAvailable(false);
      setMoments((prev) => (prev.some((m) => m.source === "preview") ? prev : previewSeed));
    }
  };

  useEffect(() => {
    loadMoments();
    const poll = window.setInterval(loadMoments, 1800);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const currentBpm = activeSample ? Math.round(activeSample.bpm) : "--";
  const baseline = activeSample?.baseline ?? null;
  const zScore = activeSample?.z_score ?? 0;
  const motion = activeSample?.motion ?? null;
  const movementState = activeSample?.movement_state ?? "unknown";
  const activeEnergy = activeSample?.active_energy_kcal ?? null;
  const distanceM = activeSample?.distance_m ?? null;
  const movementLabel = movementState === "still" ? "STILL" : movementState === "light" ? "LIGHT" : movementState === "active" ? "ACTIVE" : "--";
  const isDetected = Boolean(activeSample?.is_anomaly && anomalySeconds >= 10);

  const chart = useMemo(() => {
    const width = 1080;
    const height = 360;
    const padX = 48;
    const padY = 34;
    const values = trace.map((d) => d.bpm);
    const baselineValues = trace.map((d) => d.baseline).filter((v): v is number => typeof v === "number");
    const all = [...values, ...baselineValues];
    const min = Math.floor(Math.min(60, ...(all.length ? all : [65])) / 5) * 5 - 5;
    const max = Math.ceil(Math.max(100, ...(all.length ? all : [95])) / 5) * 5 + 5;
    const range = Math.max(max - min, 1);
    const x = (i: number) => padX + (i / Math.max(trace.length - 1, 1)) * (width - padX * 2);
    const y = (value: number) => height - padY - ((value - min) / range) * (height - padY * 2);
    const path = trace.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.bpm).toFixed(1)}`).join(" ");
    const baselinePath = trace.map((d, i) => {
      const b = typeof d.baseline === "number" ? d.baseline : d.bpm;
      return `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b).toFixed(1)}`;
    }).join(" ");
    const anomalySegments = trace.map((d, i) => ({ d, cx: x(i), cy: y(d.bpm) })).filter(({ d }) => d.is_anomaly);
    const yTicks = [min, min + range / 2, max];
    return { width, height, path, baselinePath, anomalySegments, yTicks, y };
  }, [trace]);

  const motionChart = useMemo(() => {
    const width = 1080;
    const height = 96;
    const padX = 48;
    const padY = 14;
    const maxMotion = Math.max(0.18, ...trace.map((d) => d.motion ?? 0));
    const x = (i: number) => padX + (i / Math.max(trace.length - 1, 1)) * (width - padX * 2);
    const y = (value: number) => height - padY - (Math.min(value, maxMotion) / maxMotion) * (height - padY * 2);
    const path = trace.map((d, i) => {
      const value = d.motion ?? 0;
      return `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(value).toFixed(1)}`;
    }).join(" ");
    return { width, height, path };
  }, [trace]);

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError(null);
  };

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    clearPhoto();
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("JPG, PNG, WEBP 파일만 업로드할 수 있어요.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`사진은 ${MAX_PHOTO_MB}MB 이하로 올려주세요.`);
      event.target.value = "";
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const openRecorder = (moment?: Moment) => {
    setEditingMoment(moment ?? null);
    setNote(moment?.note ?? "");
    clearPhoto();
    setRecordOpen(true);
  };

  const resetRecorder = () => {
    setRecordOpen(false);
    setEditingMoment(null);
    setNote("");
    clearPhoto();
  };

  const addPreviewMoment = () => {
    const id = `preview_${Date.now()}`;
    const previewMoment: Moment = {
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: "preview",
      status: note || photoPreview ? "enriched" : "captured",
      note: note.trim(),
      previewPhotoUrl: photoPreview,
      signal: {
        bpm: activeSample?.bpm,
        baseline: activeSample?.baseline,
        z_score: activeSample?.z_score,
        is_anomaly: activeSample?.is_anomaly,
        timestamp: activeSample?.timestamp,
        motion: activeSample?.motion,
        movement_state: activeSample?.movement_state,
        active_energy_kcal: activeSample?.active_energy_kcal,
        distance_m: activeSample?.distance_m,
      },
    };
    // Preserve object URL because the card needs it after the modal closes.
    setPhotoPreview(null);
    setMoments((prev) => [previewMoment, ...prev]);
    setSavedMessage("미리보기 기록이 타임라인에 추가됐어요.");
    setRecordOpen(false);
    setNote("");
    setPhoto(null);
    window.setTimeout(() => setSavedMessage(null), 3500);
  };

  const saveMoment = async (event: FormEvent) => {
    event.preventDefault();
    if (photoError) return;

    if (!backendAvailable || previewMode) {
      addPreviewMoment();
      return;
    }

    setSaving(true);
    setSavedMessage(null);
    try {
      const form = new FormData();
      form.append("note", note);
      if (photo) form.append("photo", photo);

      let url = `${API_BASE}/moments`;
      let method = "POST";
      if (editingMoment && editingMoment.source !== "preview") {
        url = `${API_BASE}/moments/${editingMoment.id}`;
        method = "PATCH";
      } else {
        if (typeof activeSample?.bpm === "number") form.append("bpm", String(activeSample.bpm));
        if (typeof activeSample?.baseline === "number") form.append("baseline", String(activeSample.baseline));
        if (typeof activeSample?.z_score === "number") form.append("z_score", String(activeSample.z_score));
        form.append("is_anomaly", String(Boolean(activeSample?.is_anomaly)));
        if (typeof activeSample?.timestamp === "number") form.append("signal_timestamp", String(activeSample.timestamp));
        if (typeof activeSample?.motion === "number") form.append("motion", String(activeSample.motion));
        if (activeSample?.movement_state) form.append("movement_state", activeSample.movement_state);
        if (typeof activeSample?.active_energy_kcal === "number") form.append("active_energy_kcal", String(activeSample.active_energy_kcal));
        if (typeof activeSample?.distance_m === "number") form.append("distance_m", String(activeSample.distance_m));
      }

      const response = await fetch(url, { method, body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || `HTTP ${response.status}`);

      setSavedMessage(editingMoment ? "맥락을 기록에 추가했어요." : "이 순간을 저장했어요.");
      resetRecorder();
      await loadMoments();
      window.setTimeout(() => setSavedMessage(null), 4000);
    } catch (e) {
      setSavedMessage(`저장 실패 · ${e instanceof Error ? e.message : "서버를 확인해주세요."}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="live-demo-page">
      <SiteNav />

      <section className="live-demo-intro">
        <div className="shell live-intro-grid">
          <div>
            <span className="live-eyebrow"><Radio size={13} /> LIVE SIGNAL LAB</span>
            <h1>Signal, observed<br />in the moment.</h1>
            <p>Apple Watch의 실시간 심박을 개인 baseline과 비교해 평소와 다른 변화 구간을 관찰합니다. 신호는 감정의 정답이 아니라, 기록을 시작하는 단서입니다.</p>
          </div>
          <div className={`source-panel ${previewMode ? "preview" : "live"}`}>
            <span className="source-indicator" />
            <div>
              <small>{previewMode ? "PREVIEW MODE" : "LIVE SOURCE"}</small>
              <strong>{previewMode ? "Sample data playback" : "Apple Watch · Connected"}</strong>
              <p>{previewMode ? "실시간 데모가 아닙니다. 제출용 사이트에서는 예시 데이터가 재생됩니다." : "실제 Apple Watch 신호가 현재 페이지로 들어오고 있습니다."}</p>
            </div>
          </div>
        </div>
      </section>

      {previewMode && (
        <div className="shell preview-notice">
          <WifiOff size={16} />
          <div><strong>현재는 미리보기 데이터입니다.</strong><span>Apple Watch와 로컬 서버가 연결되면 별도 조작 없이 실제 신호로 자동 전환됩니다.</span></div>
        </div>
      )}

      <section className="shell live-workspace">
        <div className="signal-summary-row multisignal">
          <div className="current-signal">
            <span>HEART RATE</span>
            <strong>{currentBpm}<small>BPM</small></strong>
            <div className="signal-live-label"><span className={previewMode ? "preview-pulse" : "live-pulse"} />{previewMode ? "sample stream" : "live stream"}</div>
          </div>
          <div className="signal-stat"><span>MOVEMENT</span><strong>{movementLabel}</strong><small>{motion == null ? "sensor pending" : `${motion.toFixed(3)} g · dynamic accel.`}</small></div>
          <div className="signal-stat"><span>ACTIVE ENERGY</span><strong>{activeEnergy == null ? "--" : activeEnergy.toFixed(2)}</strong><small>kcal · session total</small></div>
          <div className="signal-stat"><span>PERSONAL BASELINE</span><strong>{baseline == null ? "--" : baseline.toFixed(1)}</strong><small>BPM · recent window</small></div>
          <div className={`signal-stat status ${activeSample?.is_anomaly ? "elevated" : ""}`}><span>SIGNAL STATE</span><strong>{isDetected ? "DETECTED" : activeSample?.is_anomaly ? "ELEVATED" : "STABLE"}</strong><small>{activeSample?.is_anomaly ? `${anomalySeconds.toFixed(1)} sec sustained` : `motion ${movementLabel.toLowerCase()}`}</small></div>
        </div>

        <div className={`signal-plot-section ${isDetected ? "detected" : ""}`}>
          <div className="plot-heading">
            <div><span>REAL-TIME TRACE</span><h2>Heart-rate deviation</h2></div>
            <div className="plot-legend"><span><i className="legend-current" />Heart rate</span><span><i className="legend-baseline" />Baseline</span><span><i className="legend-event" />Deviation</span></div>
          </div>

          <div className="plot-canvas">
            <svg className="signal-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="실시간 심박수와 개인 baseline">
              <defs>
                <linearGradient id="signalLine" x1="0" x2="1"><stop offset="0%" stopColor="#35C8C5" /><stop offset="58%" stopColor="#7B93E8" /><stop offset="100%" stopColor="#FF7E73" /></linearGradient>
              </defs>
              {chart.yTicks.map((tick) => (
                <g key={tick}>
                  <line x1="48" x2="1032" y1={chart.y(tick)} y2={chart.y(tick)} className="plot-grid-line" />
                  <text x="8" y={chart.y(tick) + 4} className="plot-y-label">{Math.round(tick)}</text>
                </g>
              ))}
              <path d={chart.baselinePath} className="plot-baseline" />
              <path d={chart.path} className="plot-heart" />
              {chart.anomalySegments.map(({ cx, cy }, i) => <circle key={`${cx}-${i}`} cx={cx} cy={cy} r="3.8" className="plot-anomaly" />)}
            </svg>
            <div className="plot-time-label"><span>−60 sec</span><span>now</span></div>
          </div>

          <div className="motion-trace-panel">
            <div className="motion-trace-copy">
              <span>MOVEMENT TRACE</span>
              <strong>{movementLabel}</strong>
              <small>가속도 기반 움직임 강도 · 심박 상승이 활동으로 설명되는지 함께 봅니다.</small>
            </div>
            <svg viewBox={`0 0 ${motionChart.width} ${motionChart.height}`} className="motion-chart" role="img" aria-label="실시간 움직임 강도 그래프">
              <defs>
                <linearGradient id="motionLine" x1="0" x2="1"><stop offset="0%" stopColor="#35C8C5" /><stop offset="100%" stopColor="#9B91E8" /></linearGradient>
              </defs>
              <line x1="48" x2="1032" y1="82" y2="82" className="motion-grid-line" />
              <path d={motionChart.path} className="motion-path" />
            </svg>
            <div className="session-context">
              <div><span>SESSION DISTANCE</span><strong>{distanceM == null ? "--" : distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(2)} km`}</strong></div>
              <div><span>ACTIVE ENERGY</span><strong>{activeEnergy == null ? "--" : `${activeEnergy.toFixed(2)} kcal`}</strong></div>
              <div><span>INTERPRETATION</span><strong>{activeSample?.is_anomaly && movementState === "still" ? "HR rise · low motion" : activeSample?.is_anomaly && movementState === "active" ? "HR rise · active motion" : "multisignal context"}</strong></div>
            </div>
          </div>

          {isDetected && (
            <div className="detected-strip">
              <div className="detected-mark"><CircleDot size={18} /></div>
              <div><small>MOMENT DETECTED</small><strong>평소와 다른 변화가 10초 이상 이어지고 있습니다.</strong><span>지금의 맥락을 더하면 이 신호가 하나의 기억으로 남습니다.</span></div>
              <button onClick={() => openRecorder()}>기록하기 <ArrowUpRight size={16} /></button>
            </div>
          )}
        </div>

        <section className="capture-section">
          <div className="capture-copy"><span className="live-eyebrow"><Activity size={13} /> SIGNAL TO STORY</span><h2>숫자에서 끝나지 않도록,<br />그 순간의 맥락을 남깁니다.</h2><p>Watch에서 ‘기록하기’를 누르면 즉시 하나의 Moment가 생성되고, 웹에서 메모와 사진을 이어 붙일 수 있습니다.</p></div>
          <button className="capture-button" onClick={() => openRecorder()}><Camera size={19} /><span><strong>지금 이 순간 기록</strong><small>current signal · memo · photo</small></span><ArrowUpRight size={17} /></button>
        </section>

        <section className="moment-stack-section">
          <div className="moment-stack-head">
            <div><span>CAPTURED MOMENTS</span><h2>Moments, accumulating over time.</h2><p>감지되고 기록된 순간이 하나씩 쌓이며 개인의 Life Archive가 됩니다.</p></div>
            <strong>{moments.length.toString().padStart(2, "0")}<small> moments</small></strong>
          </div>

          <div className="moment-stack">
            {moments.length === 0 ? (
              <div className="moment-empty"><Sparkles size={21} /><strong>아직 기록된 순간이 없습니다.</strong><span>Watch 또는 웹에서 첫 순간을 기록해보세요.</span></div>
            ) : moments.slice(0, 8).map((moment, index) => {
              const photoUrl = moment.previewPhotoUrl || (moment.photo_url ? `${API_BASE}${moment.photo_url}` : null);
              const needsContext = moment.status === "captured" && !moment.note && !moment.photo;
              return (
                <article className="moment-row" key={moment.id}>
                  <div className="moment-index">{String(moments.length - index).padStart(2, "0")}</div>
                  <div className="moment-time"><Clock3 size={14} /><span>{formatTime(moment.created_at)}</span></div>
                  <div className="moment-signal"><HeartPulse size={15} /><strong>{moment.signal?.bpm ? Math.round(moment.signal.bpm) : "--"}</strong><span>bpm</span></div>
                  <div className="moment-story">
                    <small>{moment.source === "apple_watch" ? "CAPTURED ON WATCH" : moment.source === "preview" ? "PREVIEW SAMPLE" : "WEB CAPTURE"}</small>
                    <strong>{moment.note || "이 순간의 맥락을 더해보세요."}</strong>
                  </div>
                  {photoUrl ? <img className="moment-thumb" src={photoUrl} alt="기록된 순간" /> : <div className="moment-thumb empty"><ImagePlus size={17} /></div>}
                  <button className={needsContext ? "context-button attention" : "context-button"} onClick={() => openRecorder(moment)}>{needsContext ? "맥락 추가" : "편집"}</button>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      {recordOpen && (
        <div className="record-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) resetRecorder(); }}>
          <form className="record-modal" onSubmit={saveMoment}>
            <div className="record-head">
              <div><span>{editingMoment ? "ENRICH THIS MOMENT" : "CAPTURE THIS MOMENT"}</span><h2>{editingMoment ? "이 순간에 맥락을 더해볼까요?" : "지금 이 순간, 무엇이 있었나요?"}</h2></div>
              <button type="button" onClick={resetRecorder} aria-label="닫기"><X /></button>
            </div>

            <div className="record-snapshot multisignal-snapshot">
              <div><span>HEART RATE</span><strong>{editingMoment?.signal?.bpm ? Math.round(editingMoment.signal.bpm) : currentBpm}<small> bpm</small></strong></div>
              <div><span>MOVEMENT</span><strong>{editingMoment?.signal?.movement_state?.toUpperCase?.() ?? movementLabel}</strong></div>
              <div><span>ACTIVE ENERGY</span><strong>{editingMoment?.signal?.active_energy_kcal?.toFixed?.(2) ?? (activeEnergy == null ? "--" : activeEnergy.toFixed(2))}<small> kcal</small></strong></div>
              <div><span>BASELINE</span><strong>{editingMoment?.signal?.baseline?.toFixed?.(1) ?? (baseline == null ? "--" : baseline.toFixed(1))}<small> bpm</small></strong></div>
              <div><span>STATE</span><strong>{editingMoment?.signal?.is_anomaly || activeSample?.is_anomaly ? "DEVIATION" : "CAPTURE"}</strong></div>
            </div>

            <label className="record-field"><span>메모</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="무엇을 하고 있었는지, 누구와 있었는지, 기억하고 싶은 감각이나 생각을 남겨보세요." rows={4} maxLength={500} /><small>{note.length}/500</small></label>

            <div className="photo-field">
              <div className="photo-field-title"><span>사진</span><small>JPG · PNG · WEBP / 최대 10MB</small></div>
              <label className={`photo-drop ${photoError ? "has-error" : ""}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} />
                {photoPreview ? <img src={photoPreview} alt="업로드 미리보기" /> : <><ImagePlus size={25} /><strong>사진 선택</strong><span>클릭해서 이 순간과 함께 남길 이미지를 추가하세요.</span></>}
              </label>
              {photoError && <p className="photo-error">{photoError}</p>}
            </div>

            <div className="record-actions"><button type="button" onClick={resetRecorder}>취소</button><button type="submit" disabled={saving || Boolean(photoError)}>{saving ? "저장 중…" : editingMoment ? "맥락 저장" : "Moment 저장"}<Save size={15} /></button></div>
          </form>
        </div>
      )}

      {savedMessage && <div className={`save-toast ${savedMessage.startsWith("저장 실패") ? "error" : ""}`}><Check size={16} />{savedMessage}</div>}
    </main>
  );
};

export default LiveDemo;
