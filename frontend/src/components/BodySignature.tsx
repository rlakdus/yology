import {
  Activity,
  Droplets,
  Gauge,
  HeartPulse,
  Move3D,
  Wind,
  Zap,
} from "lucide-react";
import "../styles/bodySignature.css";

type SignatureMetric = {
  label: string;
  value: number;
  hint: string;
};

type SnapshotItem = {
  label: string;
  value: string;
  note?: string;
  icon: "heart" | "deviation" | "motion" | "energy" | "oxygen" | "respiration";
  available?: boolean;
};

type BodySignatureProps = {
  metrics: SignatureMetric[];
  snapshot: SnapshotItem[];
  title?: string;
};

const iconMap = {
  heart: HeartPulse,
  deviation: Gauge,
  motion: Move3D,
  energy: Zap,
  oxygen: Droplets,
  respiration: Wind,
};

const anchorByIcon: Record<SnapshotItem["icon"], { x: number; y: number; side: "left" | "right" }> = {
  heart: { x: 49, y: 33, side: "right" },
  respiration: { x: 45, y: 39, side: "left" },
  oxygen: { x: 62, y: 48, side: "right" },
  motion: { x: 43, y: 68, side: "left" },
  energy: { x: 54, y: 57, side: "right" },
  deviation: { x: 51, y: 29, side: "left" },
};

const metricClass = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z-]/g, "");

const BodySignature = ({
  metrics,
  snapshot,
  title = "This moment's signature",
}: BodySignatureProps) => {
  const visibleSnapshot = snapshot.filter((item) => item.available !== false);
  const unavailableSnapshot = snapshot.filter((item) => item.available === false);

  return (
    <div className="bs-root">
      <section className="bs-snapshot-card">
        <header className="bs-section-title">
          <div>
            <span>BODY SNAPSHOT</span>
            <h3>그 순간, 몸은 이렇게 반응했습니다.</h3>
          </div>
          <p>한 시점의 숫자가 아니라 서로 다른 신체 신호를 같은 순간 위에 겹쳐 봅니다.</p>
        </header>

        <div className="bs-body-stage">
          <div className="bs-aura bs-aura-aqua" />
          <div className="bs-aura bs-aura-coral" />
          <div className="bs-body-grid" aria-hidden="true" />

          <div className="bs-human-wrap" aria-label="신체 신호가 표시된 인체 실루엣">
            <svg className="bs-human" viewBox="0 0 300 620" role="img">
              <defs>
                <linearGradient id="viviaBody" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="55%" stopColor="#e9edf2" />
                  <stop offset="100%" stopColor="#dfe5eb" />
                </linearGradient>
                <linearGradient id="viviaBodyStroke" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#68778b" />
                  <stop offset="100%" stopColor="#a4aebb" />
                </linearGradient>
                <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur stdDeviation="10" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <ellipse cx="150" cy="67" rx="38" ry="47" className="bs-human-fill" />
              <path
                d="M132 111 L130 137 C104 143 82 156 68 181 C58 199 54 224 51 253 L42 337 C40 352 51 359 61 349 L83 272 L92 222 L99 341 L88 434 L72 574 C70 596 97 603 105 580 L136 449 L150 363 L164 449 L195 580 C203 603 230 596 228 574 L212 434 L201 341 L208 222 L217 272 L239 349 C249 359 260 352 258 337 L249 253 C246 224 242 199 232 181 C218 156 196 143 170 137 L168 111 C158 116 142 116 132 111 Z"
                className="bs-human-fill"
              />
              <path
                d="M132 111 L130 137 C104 143 82 156 68 181 C58 199 54 224 51 253 L42 337 M168 111 L170 137 C196 143 218 156 232 181 C242 199 246 224 249 253 L258 337 M99 341 L88 434 L72 574 M201 341 L212 434 L228 574"
                className="bs-human-outline"
              />

              <path d="M150 116 L150 354" className="bs-anatomy-axis" />
              <path d="M108 166 C126 176 174 176 192 166 M99 204 C125 216 175 216 201 204 M97 248 C126 258 174 258 203 248" className="bs-scan-line" />
              <path d="M117 172 C128 160 139 158 150 171 C161 158 172 160 183 172" className="bs-shoulder-trace" />
              <circle cx="150" cy="204" r="34" className="bs-chest-ring" />
              <circle cx="159" cy="205" r="8" className="bs-heart-core" filter="url(#softGlow)" />
              <path d="M128 225 C138 207 143 187 146 171 M172 225 C162 207 157 187 154 171" className="bs-breath-line" />
              <path d="M105 342 C127 350 173 350 195 342" className="bs-motion-trace" />
            </svg>
          </div>

          {visibleSnapshot.map((item) => {
            const Icon = iconMap[item.icon];
            const anchor = anchorByIcon[item.icon];
            const side = anchor.side;
            return (
              <div
                className={`bs-signal bs-signal-${side} bs-signal-${item.icon}`}
                key={item.label}
                style={{ "--anchor-x": `${anchor.x}%`, "--anchor-y": `${anchor.y}%` } as React.CSSProperties}
              >
                <span className="bs-signal-connector" aria-hidden="true" />
                <span className="bs-signal-dot" aria-hidden="true" />
                <div className="bs-signal-card">
                  <div className="bs-signal-icon"><Icon size={16} /></div>
                  <div className="bs-signal-copy">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.note && <small>{item.note}</small>}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bs-body-caption">
            <span>VIVIA BODY TRACE</span>
            <strong>multi-signal snapshot</strong>
          </div>
        </div>

        {unavailableSnapshot.length > 0 && (
          <div className="bs-unavailable-row">
            {unavailableSnapshot.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <div key={item.label}>
                  <Icon size={14} />
                  <span>{item.label}</span>
                  <strong>측정 없음</strong>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bs-signature-card">
        <header className="bs-signature-header">
          <div>
            <span>BODY SIGNATURE</span>
            <h3>{title}</h3>
          </div>
          <Activity size={20} />
        </header>

        <div className="bs-signature-tags" aria-label="이 순간의 대표 신체 패턴">
          {metrics.map((metric) => (
            <div className={`bs-signature-tag bs-tag-${metricClass(metric.label)}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.hint}</strong>
            </div>
          ))}
        </div>

        <div className="bs-signature-bars">
          {metrics.map((metric) => (
            <div className="bs-signature-row" key={metric.label}>
              <div className="bs-signature-row-head">
                <span>{metric.label}</span>
                <strong>{Math.round(metric.value)}</strong>
              </div>
              <div className="bs-bar-track">
                <span style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bs-signature-summary">
          <span className="bs-summary-accent" />
          <p>
            이 시그니처는 감정을 판정하는 점수가 아니라, <strong>심박 변화·움직임·지속 시간·회복 패턴</strong>을 한눈에 보기 위한 순간의 신체 fingerprint입니다.
          </p>
        </div>
      </section>
    </div>
  );
};

export default BodySignature;
export type { SignatureMetric, SnapshotItem };
