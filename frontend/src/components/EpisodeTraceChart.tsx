import { useRef, useState } from "react";
import "./EpisodeTraceChart.css";

interface Baseline {
  value: number;
  label: string;
}

interface EpisodeTraceChartProps {
  title: string;
  series: number[];
  startLabel: string;
  endLabel: string;
  unit?: string;
  color: string;
  formatValue?: (raw: number) => string;
  baseline?: Baseline;
  peakLabel?: string;
  pointLabels?: string[];
  height?: number;
}

const VIEW_W = 600;
const PAD = { top: 20, right: 16, bottom: 28, left: 40 };

const defaultFormat = (raw: number) => raw.toFixed(0);

const EpisodeTraceChart = ({
  title,
  series,
  startLabel,
  endLabel,
  unit = "",
  color,
  formatValue = defaultFormat,
  baseline,
  peakLabel,
  pointLabels,
  height = 160,
}: EpisodeTraceChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (series.length === 0) return null;

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const domainValues = baseline ? [...series, baseline.value] : series;
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const span = rawMax - rawMin || 1;
  const domainMin = rawMin - span * 0.15;
  const domainMax = rawMax + span * 0.15;

  const xAt = (i: number) =>
    series.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (series.length - 1)) * plotW;
  const yAt = (v: number) =>
    PAD.top + plotH - ((v - domainMin) / (domainMax - domainMin)) * plotH;

  const points = series.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} ` +
    `L${points[0].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const peakIndex = series.reduce((best, v, i) => (v > series[best] ? i : best), 0);

  const ticks = [domainMax, (domainMax + domainMin) / 2, domainMin];

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
    <div className="trace-chart">
      <div className="trace-chart-head">
        <h4>{title}</h4>
        <span className="trace-chart-range">{startLabel} – {endLabel}</span>
      </div>

      <div className="trace-chart-body">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${height}`}
          className="trace-chart-svg"
          role="img"
          aria-label={`${title} 추이, ${startLabel}부터 ${endLabel}까지`}
        >
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD.left} x2={VIEW_W - PAD.right}
                y1={yAt(tick)} y2={yAt(tick)}
                className="trace-chart-grid"
              />
              <text x={PAD.left - 8} y={yAt(tick)} className="trace-chart-tick" textAnchor="end" dy="0.32em">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {baseline && (
            <>
              <line
                x1={PAD.left} x2={VIEW_W - PAD.right}
                y1={yAt(baseline.value)} y2={yAt(baseline.value)}
                className="trace-chart-baseline"
              />
              <text x={VIEW_W - PAD.right} y={yAt(baseline.value) - 6} className="trace-chart-baseline-label" textAnchor="end">
                {baseline.label}
              </text>
            </>
          )}

          <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          <circle cx={points[peakIndex].x} cy={points[peakIndex].y} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          {peakLabel && (
            <text
              x={points[peakIndex].x}
              y={points[peakIndex].y - 12}
              textAnchor={peakIndex === series.length - 1 ? "end" : peakIndex === 0 ? "start" : "middle"}
              className="trace-chart-peak-label"
            >
              {peakLabel}
            </text>
          )}

          {hover && (
            <g>
              <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + plotH} className="trace-chart-crosshair" />
              <circle cx={hover.x} cy={hover.y} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
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
          <div className="trace-chart-tooltip" style={{ left: `${tooltipPct}%` }}>
            <strong>{formatValue(hover.v)}{unit}</strong>
            {pointLabels?.[hoverIndex ?? 0] && <span>{pointLabels[hoverIndex ?? 0]}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodeTraceChart;
