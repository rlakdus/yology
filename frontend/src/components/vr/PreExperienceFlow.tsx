import {
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  Loader2,
  MonitorSmartphone,
  Play,
  Vibrate,
  Volume2,
  Wind,
} from "lucide-react";
import type { CSSProperties } from "react";

export type PreludePhase = "gate" | "self-sync" | "transition" | "ready";

type PreExperienceFlowProps = {
  phase: PreludePhase;
  eventTitle: string;
  eventDescription: string;
  eventLabel: string;
  seconds: number;
  mediaCount: number;
  chatCount: number;
  mediaReady: boolean;
  vrSupported: boolean | null;
  baselineBpm: number;
  currentBpm: number;
  phaseProgress: number;
  hapticsEnabled: boolean;
  hapticsAvailable: boolean;
  hapticsLabel: string;
  breathingEnabled: boolean;
  breathingAvailable: boolean;
  onBaselineChange: (bpm: number) => void;
  onHapticsChange: (enabled: boolean) => void;
  onBreathingChange: (enabled: boolean) => void;
  onStartPrelude: () => void;
  onEnterVr: () => void;
  onBack: () => void;
};

const phaseCopy = {
  "self-sync": {
    eyebrow: "1 · 기준 박동 적응",
    title: "먼저 설정한 박동으로 시작합니다",
    description: "실제 심박 측정값이 아닌 체감 기준 BPM에 햅틱과 심음이 맞춰집니다.",
  },
  transition: {
    eyebrow: "2 · 상대 심박 전환",
    title: "기록된 사람의 흐름으로 이동합니다",
    description: "절대 BPM이 아니라 평균 대비 상승·하강 패턴을 내 범위로 옮깁니다.",
  },
  ready: {
    eyebrow: "3 · VR 준비 완료",
    title: "박동을 유지한 채 장면으로 들어갑니다",
    description: "VR에서도 같은 박동 시계가 햅틱, 심음, 화면을 함께 움직입니다.",
  },
} as const;

const VrStatus = ({ supported }: { supported: boolean | null }) => (
  <p className="vr-scene-status">
    {supported === null && <><Loader2 size={14} /> VR 지원 확인 중</>}
    {supported === false && <><MonitorSmartphone size={14} /> 데스크톱 프리뷰 · 드래그로 둘러보세요</>}
    {supported === true && <><MonitorSmartphone size={14} /> 준비 후 헤드셋으로 전환됩니다</>}
  </p>
);

const PreExperienceFlow = (props: PreExperienceFlowProps) => {
  if (props.phase === "gate") {
    return (
      <div className="vr-scene-gate">
        <div className="vr-scene-gate-card vr-prelude-card">
          <button className="vr-scene-back" onClick={props.onBack} aria-label="돌아가기">
            <ArrowLeft size={20} />
          </button>

          <p className="vr-scene-eyebrow">{props.eventLabel} · HAPTIC PRELUDE</p>
          <h1>{props.eventTitle}</h1>
          <p className="vr-scene-desc">{props.eventDescription}</p>

          <dl className="vr-scene-facts">
            <div><dt>VR 재현</dt><dd>{Math.round(props.seconds)}초</dd></div>
            <div><dt>자료</dt><dd>{props.mediaCount}건</dd></div>
            <div><dt>대화</dt><dd>{props.chatCount}줄</dd></div>
          </dl>

          <section className="vr-prelude-setup" aria-label="햅틱 프리루드 설정">
            <div className="vr-prelude-setting-heading">
              <HeartPulse size={19} />
              <div><strong>체감 기준 BPM</strong><span>실시간 센서 연결 전 사용하는 수동 설정값</span></div>
              <output>{props.baselineBpm} bpm</output>
            </div>
            <input
              type="range"
              min="50"
              max="110"
              step="1"
              value={props.baselineBpm}
              onChange={(event) => props.onBaselineChange(Number(event.target.value))}
              aria-label="기준 심박"
            />

            <label className={`vr-prelude-haptic${props.hapticsAvailable ? " is-ready" : ""}`}>
              <Vibrate size={19} />
              <span><strong>햅틱 출력</strong><small>{props.hapticsLabel}</small></span>
              <input
                type="checkbox"
                checked={props.hapticsEnabled}
                onChange={(event) => props.onHapticsChange(event.target.checked)}
              />
            </label>

            <div className="vr-prelude-audio"><Volume2 size={18} /><span>심박음은 항상 함께 재생됩니다.</span></div>

            {props.breathingAvailable && (
              <label className="vr-prelude-haptic is-ready">
                <Wind size={19} />
                <span><strong>재구성 호흡 분위기</strong><small>실제 호흡 기록이 아닌 EDA 기반 합성음</small></span>
                <input
                  type="checkbox"
                  checked={props.breathingEnabled}
                  onChange={(event) => props.onBreathingChange(event.target.checked)}
                />
              </label>
            )}
          </section>

          <p className="vr-prelude-safety">
            이 체험은 심박 측정·제어 또는 의료 진단 기능이 아닙니다. 불편함이나 어지러움이 있으면 즉시 종료하세요.
          </p>

          <button className="vr-scene-start" onClick={props.onStartPrelude} disabled={!props.mediaReady}>
            {props.mediaReady ? <HeartPulse size={18} /> : <Loader2 size={18} />}
            {props.mediaReady ? "햅틱 프리루드 시작" : "자료 준비 중"}
          </button>

          <VrStatus supported={props.vrSupported} />
        </div>
      </div>
    );
  }

  const copy = phaseCopy[props.phase];
  return (
    <div className="vr-scene-gate vr-prelude-active">
      <div className="vr-scene-gate-card vr-prelude-card">
        <button className="vr-scene-back" onClick={props.onBack} aria-label="체험 종료">
          <ArrowLeft size={20} />
        </button>

        <p className="vr-scene-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="vr-scene-desc">{copy.description}</p>

        <div
          className="vr-prelude-heart"
          style={{ "--beat-duration": `${60 / Math.max(35, props.currentBpm)}s` } as CSSProperties}
        >
          <span><HeartPulse size={36} /></span>
          <strong>{Math.round(props.currentBpm)}</strong>
          <small>체감 bpm</small>
        </div>

        <div className="vr-prelude-progress" aria-label="현재 단계 진행도">
          <span style={{ width: `${props.phaseProgress * 100}%` }} />
        </div>

        <ol className="vr-prelude-steps">
          <li className="is-done"><CheckCircle2 size={15} /> 장치 확인</li>
          <li className={props.phase !== "self-sync" ? "is-done" : "is-current"}>기준 박동 적응</li>
          <li className={props.phase === "ready" ? "is-done" : props.phase === "transition" ? "is-current" : ""}>상대 패턴 전환</li>
        </ol>

        {props.phase === "ready" ? (
          <button className="vr-scene-start" onClick={props.onEnterVr}>
            <Play size={18} /> 박동을 유지하고 VR 시작
          </button>
        ) : (
          <p className="vr-prelude-wait"><Loader2 size={15} /> 박동을 느끼며 잠시 기다려 주세요</p>
        )}

        {props.phase === "ready" && <VrStatus supported={props.vrSupported} />}
      </div>
    </div>
  );
};

export default PreExperienceFlow;
