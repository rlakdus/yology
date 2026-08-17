import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import "./VitalSignalCard.css";

interface Stat {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  average: string;
}

interface Alert {
  time: string;
  title: string;
  message: string;
}

interface VitalSignalCardProps {
  title: string;
  statusLabel: string;
  chartTitle: string;
  series: number[];
  timeLabels: string[];
  unit?: string;
  formatValue?: (raw: number) => string;
  /** 강조 구간(연속 인덱스). 기대치를 넘어선 구간을 옅은 배경으로 표시. */
  bandRange?: [number, number];
  peakIndex: number;
  peakLabel: string;
  stats: [Stat, Stat];
  alert: Alert;
}

const VIEW_W = 640;
const HEIGHT = 220;
const PAD = { top: 28, right: 20, bottom: 30, left: 40 };

const defaultFormat = (raw: number) => raw.toFixed(0);

const VitalSignalCard = ({
  title,
  statusLabel,
  chartTitle,
  series,
  timeLabels,
  unit = "",
  formatValue = defaultFormat,
  bandRange,
  peakIndex,
  peakLabel,
  stats,
  alert,
}: VitalSignalCardProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (series.length === 0) return null;

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const rawMin = Math.min(...series);
  const rawMax = Math.max(...series);
  const span = rawMax - rawMin || 1;
  const domainMin = rawMin - span * 0.25;
  const domainMax = rawMax + span * 0.2;

  const xAt = (i: number) => (series.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (series.length - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - ((v - domainMin) / (domainMax - domainMin)) * plotH;

  const points = series.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} ` +
    `L${points[0].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const ticks = [domainMax, (domainMax + domainMin) / 2, domainMin];
  const tickIdx = [0, Math.floor((series.length - 1) / 2), series.length - 1];
  // 재현 구간이 실제로는 같은 순간(단일 샘플)에서 확장된 값이면 시각 대신 상대 위치로 라벨링한다.
  const hasDistinctTimes = new Set(timeLabels).size > 1;
  const relativeAxisLabels = ["시작", "정점 부근", "종료"];
  const axisLabelAt = (i: number, tickPos: number) => (hasDistinctTimes ? timeLabels[i] : relativeAxisLabels[tickPos]);

  const peak = points[peakIndex];

  const handleMove: React.PointerEventHandler<SVGRectElement> = (event) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = VIEW_W / rect.width;
    const localX = (event.clientX - rect.left) * ratio;
    const fraction = (localX - PAD.left) / plotW;
    const index = Math.round(fraction * (series.length - 1));
    setHoverIndex(Math.min(series.length - 1, Math.max(0, index)));
  };

  const hover = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipPct = hover ? Math.min(92, Math.max(8, (hover.x / VIEW_W) * 100)) : 0;

  return (
    <div className="vital-card">
      <div className="vital-card-head">
        <h3>{title}</h3>
        <span className="vital-status-pill">
          <i />
          {statusLabel}
        </span>
      </div>

      <div className="vital-card-body">
        <div className="vital-stats-col">
          {stats.map((stat) => (
            <div className="vital-stat" key={stat.label}>
              <span className="vital-stat-label">{stat.label}</span>
              <div className="vital-stat-value-row">
                <strong>
                  {stat.value}
                  {stat.unit && <em>{stat.unit}</em>}
                </strong>
                {stat.delta && <span className="vital-stat-delta">▲ {stat.delta}</span>}
              </div>
              <span className="vital-stat-average">평균 {stat.average}</span>
            </div>
          ))}
        </div>

        <div className="vital-chart-col">
          <h4>{chartTitle}</h4>
          <div className="vital-chart-body">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${HEIGHT}`}
              className="vital-chart-svg"
              role="img"
              aria-label={`${chartTitle} 추이`}
            >
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yAt(tick)} y2={yAt(tick)} className="vital-grid" />
                  <text x={PAD.left - 8} y={yAt(tick)} className="vital-tick" textAnchor="end" dy="0.32em">
                    {formatValue(tick)}
                  </text>
                </g>
              ))}

              {tickIdx.map((i, tickPos) => (
                <text key={i} x={xAt(i)} y={HEIGHT - 8} className="vital-tick" textAnchor="middle">
                  {axisLabelAt(i, tickPos)}
                </text>
              ))}

              {bandRange && (
                <rect
                  x={xAt(bandRange[0])}
                  y={PAD.top}
                  width={Math.max(2, xAt(bandRange[1]) - xAt(bandRange[0]))}
                  height={plotH}
                  className="vital-band"
                />
              )}

              <path d={areaPath} className="vital-area" />
              <path d={linePath} className="vital-line" />

              <line x1={peak.x} y1={peak.y} x2={peak.x + 26} y2={peak.y - 26} className="vital-leader" />
              <circle cx={peak.x} cy={peak.y} r={6} className="vital-peak-dot" />
              <text x={peak.x + 30} y={peak.y - 26} className="vital-peak-label">
                {peakLabel}
              </text>

              {hover && (
                <g>
                  <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + plotH} className="vital-crosshair" />
                  <circle cx={hover.x} cy={hover.y} r={5} className="vital-hover-dot" />
                </g>
              )}

              <rect
                x={PAD.left} y={PAD.top} width={plotW} height={plotH}
                fill="transparent"
                onPointerMove={handleMove}
                onPointerLeave={() => setHoverIndex(null)}
              />
            </svg>

            {hover && (
              <div className="vital-tooltip" style={{ left: `${tooltipPct}%` }}>
                <strong>{formatValue(hover.v)}{unit}</strong>
                {hasDistinctTimes && timeLabels[hoverIndex ?? 0] && <span>{timeLabels[hoverIndex ?? 0]}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vital-alert">
        <Bell size={20} />
        <div>
          <p className="vital-alert-head">
            <strong>{alert.title}</strong>
            <span>{alert.time}</span>
          </p>
          <p className="vital-alert-body">{alert.message}</p>
        </div>
      </div>
    </div>
  );
};

export default VitalSignalCard;
