import { useState } from "react";
import "./EpisodeScatterChart.css";

export interface ScatterCategory {
  key: string;
  label: string;
  color: string;
}

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  /** 세 번째 변량 — 점 크기로 인코딩 (예: 활동량). */
  size: number;
  category: string;
  label: string;
}

interface EpisodeScatterChartProps {
  title: string;
  subtitle?: string;
  points: ScatterPoint[];
  categories: ScatterCategory[];
  xLabel: string;
  yLabel: string;
  formatX: (raw: number) => string;
  formatY: (raw: number) => string;
  formatSize: (raw: number) => string;
  sizeLabel: string;
}

const VIEW_W = 600;
const HEIGHT = 320;
const PAD = { top: 16, right: 24, bottom: 44, left: 46 };

const RADIUS = { min: 5, max: 16 };

const EpisodeScatterChart = ({
  title,
  subtitle,
  points,
  categories,
  xLabel,
  yLabel,
  formatX,
  formatY,
  formatSize,
  sizeLabel,
}: EpisodeScatterChartProps) => {
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (points.length === 0) return null;

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const sizes = points.map((p) => p.size);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xSpan = xMax - xMin || 1;
  const xDomain: [number, number] = [xMin - xSpan * 0.1, xMax + xSpan * 0.1];

  const yRawMin = Math.min(0, ...ys);
  const yRawMax = Math.max(0, ...ys);
  const ySpan = yRawMax - yRawMin || 1;
  const yDomain: [number, number] = [yRawMin - ySpan * 0.15, yRawMax + ySpan * 0.15];

  const sizeMin = Math.min(...sizes);
  const sizeMax = Math.max(...sizes);

  const xAt = (v: number) => PAD.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
  const yAt = (v: number) => PAD.top + plotH - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
  const rAt = (v: number) =>
    sizeMax === sizeMin
      ? (RADIUS.min + RADIUS.max) / 2
      : RADIUS.min + Math.sqrt((v - sizeMin) / (sizeMax - sizeMin)) * (RADIUS.max - RADIUS.min);

  const colorOf = (category: string) => categories.find((c) => c.key === category)?.color ?? "#717989";

  const xTicks = [xDomain[0] + xSpan * 0.1, (xMin + xMax) / 2, xDomain[1] - xSpan * 0.1];
  const yTicks = Array.from(new Set([yDomain[0] + ySpan * 0.15, 0, yDomain[1] - ySpan * 0.15]));

  const hover = points.find((p) => p.id === hoverId) ?? null;

  return (
    <div className="scatter-chart">
      <div className="scatter-chart-head">
        <h4>{title}</h4>
        {subtitle && <span className="scatter-chart-subtitle">{subtitle}</span>}
      </div>

      <div className="scatter-chart-legend">
        {categories.map((cat) => (
          <span key={cat.key} className="scatter-chart-legend-item">
            <i style={{ background: cat.color }} />
            {cat.label}
          </span>
        ))}
        <span className="scatter-chart-legend-item scatter-chart-legend-size">
          <i className="scatter-chart-legend-bubble" />
          점 크기 = {sizeLabel}
        </span>
      </div>

      <div className="scatter-chart-body">
        <svg
          viewBox={`0 0 ${VIEW_W} ${HEIGHT}`}
          className="scatter-chart-svg"
          role="img"
          aria-label={`${title} 산점도, ${points.length}개 이벤트`}
        >
          {yTicks.map((tick, i) => (
            <g key={`y${i}`}>
              <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yAt(tick)} y2={yAt(tick)} className="scatter-chart-grid" />
              <text x={PAD.left - 8} y={yAt(tick)} className="scatter-chart-tick" textAnchor="end" dy="0.32em">
                {formatY(tick)}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left} x2={VIEW_W - PAD.right}
            y1={yAt(0)} y2={yAt(0)}
            className="scatter-chart-zero"
          />

          {xTicks.map((tick, i) => (
            <text key={`x${i}`} x={xAt(tick)} y={HEIGHT - PAD.bottom + 20} className="scatter-chart-tick" textAnchor="middle">
              {formatX(tick)}
            </text>
          ))}

          {points.map((p) => {
            const isHover = hoverId === p.id;
            const r = rAt(p.size);
            const hitR = Math.max(r, 12);
            return (
              <g key={p.id}>
                <circle
                  cx={xAt(p.x)} cy={yAt(p.y)} r={r}
                  fill={colorOf(p.category)}
                  opacity={isHover ? 0.95 : 0.7}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <circle
                  cx={xAt(p.x)} cy={yAt(p.y)} r={hitR}
                  fill="transparent"
                  onPointerEnter={() => setHoverId(p.id)}
                  onPointerLeave={() => setHoverId((current) => (current === p.id ? null : current))}
                />
              </g>
            );
          })}

          <text x={VIEW_W - PAD.right} y={HEIGHT - 6} textAnchor="end" className="scatter-chart-axis-label">
            {xLabel} →
          </text>
          <text x={PAD.left} y={PAD.top - 4} textAnchor="start" className="scatter-chart-axis-label">
            ↑ {yLabel}
          </text>
        </svg>

        {hover && (
          <div
            className="scatter-chart-tooltip"
            style={{
              left: `${Math.min(88, Math.max(12, (xAt(hover.x) / VIEW_W) * 100))}%`,
              top: `${Math.min(80, Math.max(6, (yAt(hover.y) / HEIGHT) * 100))}%`,
            }}
          >
            <strong>{hover.label}</strong>
            <span>{xLabel} {formatX(hover.x)}</span>
            <span>{yLabel} {formatY(hover.y)}</span>
            <span>{sizeLabel} {formatSize(hover.size)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EpisodeScatterChart;
