import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CircleAlert,
  Footprints,
  Gauge,
  HeartPulse,
  Maximize2,
  Minimize2,
  MoonStar,
  ScanLine,
  Sparkles,
  Zap,
} from "lucide-react";
import SiteNav from "../components/SiteNav";
import "../styles/signalInsight.css";

type VitalPoint = { timestamp: string; value: number; unit: string };
type ActivityPoint = {
  timestamp: string;
  steps: number;
  distance_km: number;
  active_energy: number;
  flights: number;
  exercise_min: number;
  physical_effort: number;
};
type Episode = {
  start: string;
  end: string;
  duration_min: number | null;
  n_samples: number;
  peak_hr: number | null;
  expected_hr: number | null;
  excess_bpm: number | null;
  steps_5m: number | null;
  hrv_ms: number | null;
  hrr_slope: number | null;
  arousal: string | null;
  peak_z: number | null;
  score: number | null;
  evidence: string | null;
};
type Condition = {
  date: string;
  hrv_day_med: number | null;
  hrv_n: number;
  hrv_ratio: number | null;
  resting_hr: number | null;
  rhr_delta: number | null;
  low_condition: boolean;
  evidence: string | null;
};
type DataBundle = {
  subject: string;
  persona: string;
  source: string;
  description: string;
  default_date: string;
  series: {
    heart_rate: VitalPoint[];
    hrv: VitalPoint[];
    spo2: VitalPoint[];
    respiratory_rate: VitalPoint[];
    resting_hr: VitalPoint[];
    walking_hr: VitalPoint[];
  };
  activity_hourly: ActivityPoint[];
  episodes: Episode[];
  daily_condition: Condition[];
  available_metrics: string[];
};

type RangeKey = "6h" | "12h" | "24h";
type HoverInfo = { x: number; y: number; label: string; lines: string[] } | null;

const DATA_URL = "/data/signal-insight-rich.json";
const RANGE_HOURS: Record<RangeKey, number> = { "6h": 6, "12h": 12, "24h": 24 };
const HOUR_MS = 60 * 60 * 1000;

const dateKey = (iso: string) => iso.slice(0, 10);
const fmtDate = (date: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(
    new Date(`${date}T12:00:00+09:00`),
  );
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const n = (value: number | null | undefined, digits = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function lineGeometry(points: VitalPoint[], width: number, height: number, pad = 20) {
  if (!points.length) return { path: "", mapped: [] as Array<{ p: VitalPoint; x: number; y: number }>, min: 0, max: 1 };
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const mapped = points.map((p, i) => ({
    p,
    x: pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2),
    y: height - pad - ((p.value - min) / span) * (height - pad * 2),
  }));
  return {
    min,
    max,
    mapped,
    path: mapped.map((m, i) => `${i ? "L" : "M"}${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" "),
  };
}

const SignalInsight = () => {
  const [data, setData] = useState<DataBundle | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [range, setRange] = useState<RangeKey>("24h");
  const [windowStart, setWindowStart] = useState(0);
  const [showMedian, setShowMedian] = useState(true);
  const [showModel, setShowModel] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [hover, setHover] = useState<HoverInfo>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState("");
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => r.json())
      .then((payload: DataBundle) => {
        setData(payload);
        setSelectedDate(payload.default_date);
        setCalendarMonth(payload.default_date.slice(0, 7));
      })
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    if (!calendarOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) setCalendarOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [calendarOpen]);

  const dateOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.series.heart_rate.map((p) => dateKey(p.timestamp)))].sort();
  }, [data]);

  const availableDates = useMemo(() => new Set(dateOptions), [dateOptions]);

  const calendarCells = useMemo(() => {
    if (!calendarMonth) return [] as (number | null)[];
    const [y, m] = calendarMonth.split("-").map(Number);
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return cells;
  }, [calendarMonth]);

  const calendarMonthLabel = calendarMonth
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(`${calendarMonth}-01T00:00:00`))
    : "";

  const shiftCalendarMonth = (dir: -1 | 1) => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  const pickDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setWindowStart(0);
    setCalendarOpen(false);
  };

  const day = useMemo(() => {
    if (!data || !selectedDate) return null;
    const filter = (points: VitalPoint[]) => points.filter((p) => dateKey(p.timestamp) === selectedDate);
    return {
      hr: filter(data.series.heart_rate),
      hrv: filter(data.series.hrv),
      spo2: filter(data.series.spo2),
      resp: filter(data.series.respiratory_rate),
      resting: filter(data.series.resting_hr),
      walking: filter(data.series.walking_hr),
      activity: data.activity_hourly.filter((p) => dateKey(p.timestamp) === selectedDate),
      episodes: data.episodes.filter((p) => dateKey(p.start) === selectedDate),
      condition: data.daily_condition.find((p) => p.date === selectedDate) ?? null,
    };
  }, [data, selectedDate]);

  useEffect(() => {
    setSelectedEpisode(day?.episodes?.[0] ?? null);
  }, [selectedDate, day?.episodes]);

  const hours = RANGE_HOURS[range];
  const maxStart = 24 - hours;
  useEffect(() => setWindowStart((v) => clamp(v, 0, maxStart)), [maxStart]);

  const dayStart = selectedDate ? +new Date(`${selectedDate}T00:00:00+09:00`) : 0;
  const from = dayStart + windowStart * HOUR_MS;
  const to = from + hours * HOUR_MS;
  const visibleHr = day?.hr.filter((p) => {
    const t = +new Date(p.timestamp);
    return t >= from && t <= to;
  }) ?? [];
  const visibleEpisodes = day?.episodes.filter((p) => +new Date(p.start) >= from && +new Date(p.start) <= to) ?? [];

  const hrValues = day?.hr.map((p) => p.value) ?? [];
  const sortedHr = [...hrValues].sort((a, b) => a - b);
  const medianHr = sortedHr.length ? sortedHr[Math.floor(sortedHr.length / 2)] : null;
  const avgHr = avg(hrValues);
  const hrvAvg = avg(day?.hrv.map((p) => p.value) ?? []);
  const spo2Avg = avg(day?.spo2.map((p) => p.value) ?? []);
  const respAvg = avg(day?.resp.map((p) => p.value) ?? []);
  const totalSteps = sum(day?.activity.map((p) => p.steps) ?? []);
  const totalDistance = sum(day?.activity.map((p) => p.distance_km) ?? []);
  const totalEnergy = sum(day?.activity.map((p) => p.active_energy) ?? []);
  const exerciseMin = sum(day?.activity.map((p) => p.exercise_min) ?? []);
  const effortAvg = avg((day?.activity ?? []).filter((p) => p.physical_effort > 0).map((p) => p.physical_effort));
  const restingHr = day?.condition?.resting_hr ?? day?.resting.at(-1)?.value ?? null;
  const walkingHr = day?.walking.at(-1)?.value ?? null;

  const mainChart = useMemo(() => {
    const width = 1100;
    const height = 430;
    const left = 54;
    const right = 28;
    const top = 28;
    const bottom = 46;
    const episodeValues = visibleEpisodes.flatMap((e) => [e.peak_hr, e.expected_hr]).filter((v): v is number => typeof v === "number");
    const values = [...visibleHr.map((p) => p.value), ...episodeValues, ...(medianHr ? [medianHr] : [])];
    const minY = values.length ? Math.floor((Math.min(...values) - 8) / 10) * 10 : 50;
    const maxY = values.length ? Math.ceil((Math.max(...values) + 8) / 10) * 10 : 130;
    const span = Math.max(maxY - minY, 20);
    const xTime = (t: number) => left + ((t - from) / Math.max(to - from, 1)) * (width - left - right);
    const yVal = (v: number) => height - bottom - ((v - minY) / span) * (height - top - bottom);
    const path = visibleHr
      .map((p, i) => `${i ? "L" : "M"}${xTime(+new Date(p.timestamp)).toFixed(1)},${yVal(p.value).toFixed(1)}`)
      .join(" ");
    const ticks = [minY, minY + span * 0.25, minY + span * 0.5, minY + span * 0.75, maxY];
    return { width, height, left, right, top, bottom, minY, maxY, xTime, yVal, path, ticks };
  }, [visibleHr, visibleEpisodes, medianHr, from, to]);

  const hrvGeom = useMemo(() => lineGeometry(day?.hrv ?? [], 480, 160, 18), [day?.hrv]);
  const spo2Geom = useMemo(() => lineGeometry(day?.spo2 ?? [], 360, 118, 16), [day?.spo2]);
  const respGeom = useMemo(() => lineGeometry(day?.resp ?? [], 360, 118, 16), [day?.resp]);

  const changeDate = (dir: -1 | 1) => {
    const i = dateOptions.indexOf(selectedDate);
    if (i < 0) return;
    const next = clamp(i + dir, 0, dateOptions.length - 1);
    setSelectedDate(dateOptions[next]);
    setWindowStart(0);
  };

  if (!data || !day) {
    return (
      <main className="signal-page">
        <SiteNav />
        <div className="signal-loading">Signal Insight loading…</div>
      </main>
    );
  }

  return (
    <main className="signal-page">
      <SiteNav />

      <section className="signal-hero">
        <div className="signal-shell signal-hero-grid">
          <div>
            <span className="signal-eyebrow"><ScanLine size={14} /> SIGNAL INSIGHT</span>
            <h1>몸의 변화가<br /><em>Moment가 되는 지점.</em></h1>
            <p>실제 웨어러블 생체신호와 활동 맥락, residual anomaly 결과를 겹쳐 보며 “왜 이 순간이 포착되었는지” 탐색합니다.</p>
          </div>
          <div className="signal-dataset-card">
            <span>DATA SOURCE</span>
            <strong>{data.subject} · {data.source}</strong>
            <p>HR · HRV · SpO₂ · Respiration · Steps · Distance · Active Energy · Physical Effort · Residual Model</p>
            <div>{data.available_metrics.length} signals & derived features</div>
          </div>
        </div>
      </section>

      <section className="signal-shell signal-toolbar">
        <div className="signal-date-nav">
          <button onClick={() => changeDate(-1)} disabled={dateOptions.indexOf(selectedDate) <= 0}><ArrowLeft size={16} /></button>
          <div><small>SELECTED DAY</small><strong>{fmtDate(selectedDate)}</strong></div>
          <button onClick={() => changeDate(1)} disabled={dateOptions.indexOf(selectedDate) >= dateOptions.length - 1}><ArrowRight size={16} /></button>
        </div>
        <div className="signal-calendar-wrap" ref={calendarRef}>
          <button
            className="signal-calendar-trigger"
            onClick={() => {
              if (!calendarOpen) setCalendarMonth(selectedDate.slice(0, 7));
              setCalendarOpen((v) => !v);
            }}
          >
            <Calendar size={14} /> {selectedDate}
          </button>

          {calendarOpen && (
            <div className="signal-calendar-pop">
              <div className="signal-calendar-head">
                <button onClick={() => shiftCalendarMonth(-1)}><ArrowLeft size={13} /></button>
                <strong>{calendarMonthLabel}</strong>
                <button onClick={() => shiftCalendarMonth(1)}><ArrowRight size={13} /></button>
              </div>
              <div className="signal-calendar-weekdays">
                {["일", "월", "화", "수", "목", "금", "토"].map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="signal-calendar-grid">
                {calendarCells.map((cell, i) => {
                  if (cell === null) return <span key={i} className="signal-calendar-cell empty" />;
                  const dateStr = `${calendarMonth}-${String(cell).padStart(2, "0")}`;
                  const hasData = availableDates.has(dateStr);
                  const active = dateStr === selectedDate;
                  return (
                    <button
                      key={i}
                      className={`signal-calendar-cell${hasData ? " has-data" : ""}${active ? " active" : ""}`}
                      disabled={!hasData}
                      onClick={() => pickDate(dateStr)}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="signal-range-switch">
          {(Object.keys(RANGE_HOURS) as RangeKey[]).map((key) => (
            <button key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>
              {key === "24h" ? <Maximize2 size={13} /> : <Minimize2 size={13} />}{key}
            </button>
          ))}
        </div>
        <label className="signal-toggle"><input type="checkbox" checked={showMedian} onChange={(e) => setShowMedian(e.target.checked)} /><i />Personal median</label>
        <label className="signal-toggle coral"><input type="checkbox" checked={showModel} onChange={(e) => setShowModel(e.target.checked)} /><i />Model residual</label>
      </section>

      <section className="signal-shell signal-kpis">
        <article><div className="signal-kpi-icon blue"><HeartPulse /></div><span>HEART RATE</span><strong>{n(avgHr)}<small> bpm</small></strong><p>{hrValues.length ? `${Math.min(...hrValues).toFixed(0)}–${Math.max(...hrValues).toFixed(0)} bpm range` : "no sample"}</p></article>
        <article><div className="signal-kpi-icon purple"><BrainCircuit /></div><span>HRV SDNN</span><strong>{n(hrvAvg, 1)}<small> ms</small></strong><p>{day.hrv.length} samples · recovery context</p></article>
        <article><div className="signal-kpi-icon aqua"><Sparkles /></div><span>BLOOD OXYGEN</span><strong>{n(spo2Avg, 1)}<small> %</small></strong><p>{day.spo2.length} samples</p></article>
        <article><div className="signal-kpi-icon orange"><CircleAlert /></div><span>MODEL EPISODES</span><strong>{day.episodes.length}<small> moments</small></strong><p>{day.episodes.length ? `max z ${Math.max(...day.episodes.map((e) => e.peak_z ?? 0)).toFixed(2)}` : "no anomaly"}</p></article>
      </section>

      <section className="signal-shell signal-main-grid">
        <article className="signal-card signal-main-chart-card">
          <div className="signal-card-head">
            <div><span>01 · ACTIVITY-ADJUSTED RESIDUAL</span><h2>Actual HR vs. Expected HR</h2><p>심박 자체가 아니라, 활동량을 고려한 기대 심박보다 얼마나 벗어났는지를 함께 봅니다.</p></div>
            <div className="signal-legend"><span><i className="actual" />Actual HR</span><span><i className="median" />Personal median</span><span><i className="residual" />Expected → Peak</span></div>
          </div>

          <div className="signal-chart-wrap" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${mainChart.width} ${mainChart.height}`}>
              <defs>
                <linearGradient id="signalLine" x1="0" x2="1"><stop offset="0%" stopColor="#35c8c5" /><stop offset="58%" stopColor="#516fcb" /><stop offset="100%" stopColor="#ff7e73" /></linearGradient>
                <linearGradient id="signalBand" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff7e73" stopOpacity=".2" /><stop offset="100%" stopColor="#ff7e73" stopOpacity=".015" /></linearGradient>
              </defs>
              {mainChart.ticks.map((tick) => <g key={tick}><line className="signal-gridline" x1={mainChart.left} x2={mainChart.width-mainChart.right} y1={mainChart.yVal(tick)} y2={mainChart.yVal(tick)} /><text className="signal-axis-label" x="8" y={mainChart.yVal(tick)+4}>{Math.round(tick)}</text></g>)}
              {showMedian && medianHr && <line className="signal-median-line" x1={mainChart.left} x2={mainChart.width-mainChart.right} y1={mainChart.yVal(medianHr)} y2={mainChart.yVal(medianHr)} />}
              {showModel && visibleEpisodes.map((ep, idx) => {
                const t = +new Date(ep.start);
                const x = mainChart.xTime(t);
                const end = +new Date(ep.end);
                const x2 = mainChart.xTime(Math.max(end, t + 3 * 60_000));
                const expected = ep.expected_hr ?? ep.peak_hr ?? 0;
                const peak = ep.peak_hr ?? expected;
                return <g key={`${ep.start}-${idx}`} className="signal-residual-group" onClick={() => setSelectedEpisode(ep)} onMouseEnter={() => setHover({ x, y: mainChart.yVal(peak), label: fmtTime(ep.start), lines: [`Peak ${n(peak)} bpm`, `Expected ${n(expected,1)} bpm`, `Excess +${n(ep.excess_bpm,1)} bpm`, `z ${n(ep.peak_z,2)} · score ${n(ep.score,2)}`] })}>
                  <rect x={x-8} y={mainChart.top} width={Math.max(14,x2-x+16)} height={mainChart.height-mainChart.top-mainChart.bottom} rx="8" fill="url(#signalBand)" />
                  <line className="signal-residual-stem" x1={x} x2={x} y1={mainChart.yVal(expected)} y2={mainChart.yVal(peak)} />
                  <circle className="signal-expected-dot" cx={x} cy={mainChart.yVal(expected)} r="5" />
                  <circle className="signal-peak-dot" cx={x} cy={mainChart.yVal(peak)} r="7" />
                </g>;
              })}
              <path className="signal-hr-line" d={mainChart.path} />
              {visibleHr.map((p, idx) => {
                const x = mainChart.xTime(+new Date(p.timestamp));
                const y = mainChart.yVal(p.value);
                return idx % Math.max(1, Math.floor(visibleHr.length / 120)) === 0 ? <circle key={p.timestamp} className="signal-hover-dot" cx={x} cy={y} r="7" onMouseEnter={() => setHover({ x, y, label: fmtTime(p.timestamp), lines: [`Heart rate ${n(p.value)} bpm`, medianHr ? `Median Δ ${(p.value-medianHr).toFixed(1)} bpm` : ""].filter(Boolean) })} /> : null;
              })}
            </svg>
            {hover && <div className="signal-tooltip" style={{ left: `${(hover.x/mainChart.width)*100}%`, top: `${(hover.y/mainChart.height)*100}%` }}><small>{hover.label}</small>{hover.lines.map((line,i) => <span key={i}>{line}</span>)}</div>}
          </div>
          <div className="signal-chart-time"><span>{String(Math.floor(windowStart)).padStart(2,"0")}:00</span><span>{String(Math.min(24,Math.ceil(windowStart+hours))).padStart(2,"0")}:00</span></div>
          {hours < 24 && <div className="signal-brush"><span>ZOOM WINDOW</span><input type="range" min="0" max={maxStart} step=".25" value={windowStart} onChange={(e) => setWindowStart(Number(e.target.value))} /><strong>{windowStart.toFixed(1)}h – {(windowStart+hours).toFixed(1)}h</strong></div>}
        </article>

        <aside className="signal-card signal-evidence-panel">
          <div className="signal-card-head compact"><div><span>02 · WHY DETECTED?</span><h2>Model Evidence</h2><p>episode를 선택하면 탐지 근거를 풀어서 보여줍니다.</p></div></div>
          {selectedEpisode ? <>
            <div className="signal-selected-badge"><CircleAlert size={15} /> {fmtTime(selectedEpisode.start)} detected moment</div>
            <div className="signal-evidence-metrics">
              <div><small>Peak HR</small><b>{n(selectedEpisode.peak_hr)}<em>bpm</em></b></div>
              <div><small>Expected HR</small><b>{n(selectedEpisode.expected_hr,1)}<em>bpm</em></b></div>
              <div className="accent"><small>Excess</small><b>+{n(selectedEpisode.excess_bpm,1)}<em>bpm</em></b></div>
              <div><small>Peak Z</small><b>{n(selectedEpisode.peak_z,2)}</b></div>
              <div><small>Steps / 5m</small><b>{n(selectedEpisode.steps_5m)}</b></div>
              <div><small>HRV</small><b>{n(selectedEpisode.hrv_ms,1)}<em>ms</em></b></div>
            </div>
            <div className="signal-evidence-text"><span>MODEL REASONING</span><p>{selectedEpisode.evidence ?? "탐지 근거가 기록되지 않았습니다."}</p></div>
            <div className="signal-evidence-footer"><span><Gauge size={14} /> recovery {n(selectedEpisode.hrr_slope,1)} bpm/min</span><span><Zap size={14} /> {selectedEpisode.arousal ?? "pattern N/A"}</span></div>
          </> : <div className="signal-no-episode">이 날짜에는 residual anomaly episode가 없습니다.</div>}
        </aside>
      </section>

      <section className="signal-shell signal-context-grid">
        <article className="signal-card signal-activity-card">
          <div className="signal-card-head compact"><div><span>03 · ACTIVITY CONTEXT</span><h2>움직임과 함께 보기</h2><p>“심박이 높다 = 의미 있는 순간”이 되지 않도록 활동 맥락을 함께 확인합니다.</p></div></div>
          <div className="signal-activity-chart">
            {(day.activity.length ? day.activity : Array.from({length:24},(_,i)=>({timestamp:`${selectedDate}T${String(i).padStart(2,"0")}:00:00+09:00`,steps:0,distance_km:0,active_energy:0,flights:0,exercise_min:0,physical_effort:0}))).map((p, i) => {
              const maxSteps = Math.max(1,...day.activity.map((d)=>d.steps));
              const h = 12 + (p.steps/maxSteps)*112;
              return <div className="signal-activity-column" key={p.timestamp} onMouseEnter={() => setHover({x:0,y:0,label:fmtTime(p.timestamp),lines:[`Steps ${n(p.steps)}`,`Distance ${n(p.distance_km,2)} km`,`Energy ${n(p.active_energy,1)} kcal`,`Physical effort ${n(p.physical_effort,1)}`]})} title={`${fmtTime(p.timestamp)} · ${Math.round(p.steps)} steps`}>
                <i style={{height:`${h}px`}} /><span>{i%4===0 ? `${String(new Date(p.timestamp).getHours()).padStart(2,"0")}` : ""}</span>
              </div>;
            })}
          </div>
          <div className="signal-activity-summary">
            <span><Footprints /> <b>{Math.round(totalSteps).toLocaleString()}</b><small>steps</small></span>
            <span><Activity /> <b>{n(totalDistance,2)}</b><small>km</small></span>
            <span><Zap /> <b>{n(totalEnergy,0)}</b><small>kcal</small></span>
            <span><Gauge /> <b>{n(effortAvg,1)}</b><small>effort avg</small></span>
          </div>
        </article>

        <article className="signal-card signal-recovery-card">
          <div className="signal-card-head compact"><div><span>04 · RECOVERY CONTEXT</span><h2>HRV & Daily Condition</h2><p>그날의 회복 상태를 함께 봐야 같은 심박 변화도 다르게 해석할 수 있습니다.</p></div></div>
          <div className="signal-hrv-chart"><svg viewBox="0 0 480 160"><path d={hrvGeom.path} />{hrvGeom.mapped.map((m)=><circle key={m.p.timestamp} cx={m.x} cy={m.y} r="5" onMouseEnter={()=>setHover({x:0,y:0,label:fmtTime(m.p.timestamp),lines:[`HRV ${n(m.p.value,1)} ms`]})} />)}</svg></div>
          <div className="signal-condition-row">
            <div><small>HRV median</small><strong>{n(day.condition?.hrv_day_med ?? hrvAvg,1)}<em>ms</em></strong></div>
            <div><small>HRV ratio</small><strong>{n(day.condition?.hrv_ratio,2)}<em>x</em></strong></div>
            <div><small>Resting HR</small><strong>{n(restingHr)}<em>bpm</em></strong></div>
            <div><small>Walking HR</small><strong>{n(walkingHr)}<em>bpm</em></strong></div>
          </div>
          <div className={`signal-condition-state ${day.condition?.low_condition ? "low" : "stable"}`}><MoonStar size={15} />{day.condition?.low_condition ? "Lower-condition day" : "Condition within personal range"}</div>
        </article>
      </section>

      <section className="signal-shell signal-secondary-grid">
        <article className="signal-card signal-mini-card aqua">
          <div><span>05 · BLOOD OXYGEN</span><h3>SpO₂ Snapshot</h3><strong>{n(spo2Avg,1)}%</strong></div>
          <svg viewBox="0 0 360 118"><path d={spo2Geom.path} />{spo2Geom.mapped.map((m)=><circle key={m.p.timestamp} cx={m.x} cy={m.y} r="4" onMouseEnter={()=>setHover({x:0,y:0,label:fmtTime(m.p.timestamp),lines:[`SpO₂ ${n(m.p.value,1)}%`]})} />)}</svg>
          <p>{day.spo2.length ? `${n(spo2Geom.min,1)}–${n(spo2Geom.max,1)}% · ${day.spo2.length} samples` : "해당 일자 측정값 없음"}</p>
        </article>
        <article className="signal-card signal-mini-card lavender">
          <div><span>06 · RESPIRATION</span><h3>Respiratory Rhythm</h3><strong>{n(respAvg,1)} /min</strong></div>
          <svg viewBox="0 0 360 118"><path d={respGeom.path} />{respGeom.mapped.map((m)=><circle key={m.p.timestamp} cx={m.x} cy={m.y} r="4" onMouseEnter={()=>setHover({x:0,y:0,label:fmtTime(m.p.timestamp),lines:[`Respiration ${n(m.p.value,1)} /min`]})} />)}</svg>
          <p>{day.resp.length ? `${n(respGeom.min,1)}–${n(respGeom.max,1)} /min · ${day.resp.length} samples` : "해당 일자 측정값 없음"}</p>
        </article>
        <article className="signal-card signal-day-summary">
          <span>07 · DAY SNAPSHOT</span><h3>하루의 맥락</h3>
          <div className="signal-summary-list">
            <p><Footprints /><span>Steps</span><b>{Math.round(totalSteps).toLocaleString()}</b></p>
            <p><Activity /><span>Distance</span><b>{n(totalDistance,2)} km</b></p>
            <p><Zap /><span>Active energy</span><b>{n(totalEnergy,0)} kcal</b></p>
            <p><Gauge /><span>Exercise</span><b>{n(exerciseMin,0)} min</b></p>
          </div>
          <div className="signal-summary-note">신체신호 + 활동량 + 개인 baseline을 함께 사용해 “운동 때문에 오른 심박”과 “설명되지 않는 변화”를 구분합니다.</div>
        </article>
      </section>

      <section className="signal-shell signal-episode-strip">
        <div><span>DETECTED MOMENTS</span><h2>Residual Episode Timeline</h2></div>
        <div className="signal-episode-scroller">
          {day.episodes.length ? day.episodes.map((ep, idx) => <button key={ep.start} className={selectedEpisode?.start === ep.start ? "active" : ""} onClick={() => setSelectedEpisode(ep)}>
            <small>{fmtTime(ep.start)}</small><strong>+{n(ep.excess_bpm,1)} bpm</strong><span>z {n(ep.peak_z,2)} · {ep.arousal ?? "anomaly"}</span><b>{String(idx+1).padStart(2,"0")}</b>
          </button>) : <p className="signal-empty-strip">이 날짜에는 탐지된 episode가 없습니다.</p>}
        </div>
      </section>

      <footer className="signal-footer">
        <div className="signal-shell">
          <div className="signal-footer-brand">
            <img src="/assets/logo.png" alt="VIVIA" />
            <p>몸의 신호가 삶의 이야기가 됩니다.</p>
          </div>
          <div className="signal-footer-team">
            <strong>TEAM YOLOGY</strong>
            <span>Samsung Life Lifenology Lab</span>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default SignalInsight;
