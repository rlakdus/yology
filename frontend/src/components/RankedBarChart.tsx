import { useState } from "react";
import "./RankedBarChart.css";

interface RankedBarChartProps {
  title: string;
  subtitle?: string;
  items: { label: string; value: number }[];
  unit?: string;
  color?: string;
  formatValue?: (raw: number) => string;
}

const VIEW_W = 600;
const HEIGHT = 200;
const PAD = { top: 26, right: 12, bottom: 26, left: 34 };

const defaultFormat = (raw: number) => raw.toFixed(0);

/** 위쪽만 4px 라운드, 바닥은 각진 막대 경로. */
const barPath = (x: number, yTop: number, width: number, yBase: number) => {
  const r = Math.min(4, width / 2, Math.max(0, yBase - yTop));
  if (yBase - yTop <= 0) return "";
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `L${x + width - r},${yTop}`,
    `Q${x + width},${yTop} ${x + width},${yTop + r}`,
    `L${x + width},${yBase}`,
    "Z",
  ].join(" ");
};

const RankedBarChart = ({
  title,
  subtitle,
  items,
  unit = "",
  color = "#2a78d6",
  formatValue = defaultFormat,
}: RankedBarChartProps) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;

  const maxValue = Math.max(...items.map((item) => item.value));
  const domainMax = maxValue * 1.15 || 1;

  const yAt = (v: number) => baseY - (v / domainMax) * plotH;

  const slot = plotW / items.length;
  const barWidth = Math.min(24, Math.max(3, slot - 6));

  const peakIndex = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0);
  const ticks = [domainMax, domainMax / 2, 0];

  const hover = hoverIndex !== null ? items[hoverIndex] : null;

  return (
    <div className="ranked-bar-chart">
      <div className="ranked-bar-head">
        <h4>{title}</h4>
        {subtitle && <span className="ranked-bar-subtitle">{subtitle}</span>}
      </div>

      <div className="ranked-bar-body">
        <svg
          viewBox={`0 0 ${VIEW_W} ${HEIGHT}`}
          className="ranked-bar-svg"
          role="img"
          aria-label={`${title}, ${items.length}개 항목`}
        >
          {ticks.map((tick, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yAt(tick)} y2={yAt(tick)} className="ranked-bar-grid" />
              <text x={PAD.left - 8} y={yAt(tick)} className="ranked-bar-tick" textAnchor="end" dy="0.32em">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {items.map((item, i) => {
            const x = PAD.left + i * slot + (slot - barWidth) / 2;
            const yTop = yAt(item.value);
            const isHover = hoverIndex === i;
            return (
              <g key={i}>
                <path
                  d={barPath(x, yTop, barWidth, baseY)}
                  fill={color}
                  opacity={isHover ? 1 : 0.82}
                  onPointerEnter={() => setHoverIndex(i)}
                  onPointerLeave={() => setHoverIndex(null)}
                />
                {i === peakIndex && (
                  <text x={x + barWidth / 2} y={yTop - 8} textAnchor="middle" className="ranked-bar-peak-label">
                    {formatValue(item.value)}
                    {unit}
                  </text>
                )}
              </g>
            );
          })}

          <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={baseY} y2={baseY} className="ranked-bar-axis" />
        </svg>

        {hover && (
          <div
            className="ranked-bar-tooltip"
            style={{ left: `${Math.min(94, Math.max(6, ((hoverIndex! + 0.5) / items.length) * 100))}%` }}
          >
            <strong>{formatValue(hover.value)}{unit}</strong>
            <span>{hover.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankedBarChart;
