import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Clock3,
  Gauge,
  HeartPulse,
  Sparkles,
  Waves,
} from "lucide-react";

import SiteNav from "../components/SiteNav";
import SummaryCard from "../components/SummaryCard";
import VitalSignalCard from "../components/VitalSignalCard";
import RankedBarChart from "../components/RankedBarChart";
import EpisodeScatterChart, { type ScatterCategory, type ScatterPoint } from "../components/EpisodeScatterChart";
import {
  formatDate,
  formatTime,
  interpolateTimestamps,
  parseTimestamp,
  useHeEpisode,
  value,
} from "../data/heEpisodes";
import { useVrEvent } from "../data/vrEvent";
import "../styles/insights.css";

const detectionSteps = [
  {
    step: "01",
    title: "기준선 학습",
    body: "시간대(circadian)와 직전 활동량을 함께 넣어, \"이 시간·이 활동량이면 심박이 몇이어야 정상인가\"를 회귀 모델로 학습합니다.",
    icon: BrainCircuit,
  },
  {
    step: "02",
    title: "잔차 계산",
    body: "관측된 심박에서 기대 심박을 뺀 편차를 robust z-score로 표준화해, 사람·시간대별 변동폭 차이를 보정합니다.",
    icon: Waves,
  },
  {
    step: "03",
    title: "임계값 판정",
    body: "z ≥ 2.5인 지점을 이상 후보로 표시하고, 연속된 후보 구간을 하나의 이벤트로 묶습니다.",
    icon: Gauge,
  },
  {
    step: "04",
    title: "점수화 & 정렬",
    body: "초과 폭, 지속 시간, 회복 속도(HRR), 활동량 대비 여부를 종합해 점수를 매기고 순위를 정합니다.",
    icon: Sparkles,
  },
] as const;

/** dataviz 팔레트 all-pairs 검증을 통과하는 앞 3슬롯(blue/orange/aqua) 그대로 사용. */
const AROUSAL_CATEGORIES: ScatterCategory[] = [
  { key: "지속성", label: "지속성 · 천천히 가라앉음", color: "#2a78d6" },
  { key: "위상성", label: "위상성 · 짧게 튀었다 회복", color: "#eb6834" },
  { key: "미분류", label: "미분류", color: "#1baf7a" },
];

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

const Insights = () => {
  const { person, error } = useHeEpisode();
  const { event: vrEvent } = useVrEvent("he", "event_001");

  const featured = useMemo(
    () => person?.episodes.find((candidate) => candidate.id === "he-1") ?? person?.episodes[0] ?? null,
    [person],
  );

  const stats = useMemo(() => {
    if (!person || person.episodes.length === 0) return null;
    const episodes = person.episodes;
    const starts = episodes.map((e) => parseTimestamp(e.start).getTime());
    return {
      count: person.episode_count,
      avgExcess: mean(episodes.map((e) => e.excess_bpm)),
      maxPeakHr: Math.max(...episodes.map((e) => e.peak_hr)),
      rangeStart: new Date(Math.min(...starts)).toISOString(),
      rangeEnd: new Date(Math.max(...starts)).toISOString(),
    };
  }, [person]);

  const topEpisodes = useMemo(() => person?.episodes.slice(0, 8) ?? [], [person]);

  const distributionItems = useMemo(
    () =>
      person
        ? [...person.episodes]
            .sort((a, b) => b.excess_bpm - a.excess_bpm)
            .slice(0, 20)
            .map((e) => ({ label: `${formatDate(e.start)} · 탐지점수 ${value(e.score, 1)}`, value: e.excess_bpm }))
        : [],
    [person],
  );

  const scatterPoints = useMemo<ScatterPoint[]>(
    () =>
      person
        ? person.episodes
            .filter((e) => e.hrr_slope !== null)
            .map((e) => ({
              id: e.id,
              x: e.excess_bpm,
              y: e.hrr_slope as number,
              size: e.steps_5m,
              category: e.arousal || "미분류",
              label: `${formatDate(e.start)} · #${e.rank}`,
            }))
        : [],
    [person],
  );

  const heartRateSeries = vrEvent?.sensor.heart_rate ?? [];
  const edaSeries = vrEvent?.sensor.eda ?? [];
  const pointLabels = featured ? interpolateTimestamps(featured.start, featured.end, heartRateSeries.length) : [];

  const vitalCard = useMemo(() => {
    if (!featured || heartRateSeries.length === 0) return null;

    const peakIndex = heartRateSeries.reduce(
      (best, v, i) => (v > heartRateSeries[best] ? i : best),
      0,
    );

    // 기대 심박을 넘어선 연속 구간을 "이상 구간"으로 강조한다.
    let bandStart = peakIndex;
    let bandEnd = peakIndex;
    while (bandStart > 0 && heartRateSeries[bandStart - 1] > featured.expected_hr) bandStart -= 1;
    while (bandEnd < heartRateSeries.length - 1 && heartRateSeries[bandEnd + 1] > featured.expected_hr) bandEnd += 1;

    const edaAvg = edaSeries.length > 0 ? mean(edaSeries) : null;
    const edaMax = edaSeries.length > 0 ? Math.max(...edaSeries) : null;

    return {
      peakIndex,
      peakLabel: `이상치 +${value(featured.excess_bpm)}bpm`,
      bandRange: [bandStart, bandEnd] as [number, number],
      stats: [
        {
          label: "심박수 (BPM)",
          value: value(featured.peak_hr),
          unit: " bpm",
          delta: `${value(featured.excess_bpm)}bpm`,
          average: `${value(featured.expected_hr, 1)} bpm`,
        },
        {
          label: "피부반응 (EDA)",
          value: edaMax !== null ? edaMax.toFixed(2) : "측정 없음",
          unit: edaMax !== null ? " µS" : "",
          average: edaAvg !== null ? `${edaAvg.toFixed(2)} µS` : "측정 없음",
        },
      ] as [
        { label: string; value: string; unit?: string; delta?: string; average: string },
        { label: string; value: string; unit?: string; delta?: string; average: string },
      ],
      alert: {
        time: formatTime(featured.start),
        title: "이상 신호 감지",
        message: `기대 심박 대비 +${value(featured.excess_bpm)}bpm 높은 변동이 감지됐어요 · 탐지 점수 ${value(featured.score, 1)}`,
      },
    };
  }, [featured, heartRateSeries, edaSeries]);

  return (
    <div className="insights-page">
      <SiteNav />

      <main className="insights-container">
        <section className="insights-hero shell">
          <span className="insights-eyebrow">DATA &amp; DETECTION</span>
          <h1>우리 데이터는 이렇게 보이고, 이상 신호는 이렇게 찾아냅니다</h1>
          <p>
            VIVIA가 갖고 있는 생체 데이터를 어떻게 그래프로 옮기는지, 그리고 이상 심박 이벤트를 어떤 기준으로
            탐지하는지 실제 데이터로 보여드립니다.
          </p>
        </section>

        {error && <p className="insights-status shell">{error}</p>}
        {!error && !person && <p className="insights-status shell">데이터를 불러오는 중입니다…</p>}

        {person && stats && (
          <>
            <section className="shell insights-section">
              <h2 className="insights-section-title">데이터 개요</h2>
              <div className="summary-grid">
                <SummaryCard icon={<HeartPulse size={28} />} title="탐지된 이상 이벤트" value={`${stats.count}건`} />
                <SummaryCard icon={<Gauge size={28} />} title="평균 초과 심박" value={`+${stats.avgExcess.toFixed(1)} bpm`} />
                <SummaryCard icon={<Activity size={28} />} title="최고 관측 심박" value={`${stats.maxPeakHr} bpm`} />
                <SummaryCard icon={<Clock3 size={28} />} title="컨디션 저하일" value={`${person.low_condition_days}일`} />
              </div>
              <p className="insights-caption">
                {formatDate(stats.rangeStart)} ~ {formatDate(stats.rangeEnd)} 사이 {person.label} 페르소나의 심박
                데이터를 분석한 결과입니다.
              </p>
            </section>

            <section className="shell insights-section">
              <h2 className="insights-section-title">이렇게 시각화합니다</h2>
              <p className="insights-lead">
                아래는 실제로 탐지된 이벤트 하나를 그대로 그린 카드입니다. 붉게 칠해진 구간이 기대 심박을 넘어선
                순간이고, 점선이 가리키는 지점이 탐지된 피크입니다.
              </p>

              {vitalCard && (
                <VitalSignalCard
                  title="HE 생체 신호"
                  statusLabel="탐지됨 · 이벤트 재현"
                  chartTitle="심박수 추이"
                  series={heartRateSeries}
                  timeLabels={pointLabels}
                  unit=" bpm"
                  bandRange={vitalCard.bandRange}
                  peakIndex={vitalCard.peakIndex}
                  peakLabel={vitalCard.peakLabel}
                  stats={vitalCard.stats}
                  alert={vitalCard.alert}
                />
              )}
            </section>

            <section className="shell insights-section">
              <h2 className="insights-section-title">이렇게 이상치를 탐지합니다</h2>
              <div className="insights-steps">
                {detectionSteps.map(({ step, title, body, icon: Icon }) => (
                  <div className="insights-step-card" key={step}>
                    <span className="insights-step-number">{step}</span>
                    <Icon size={22} />
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </section>

            {scatterPoints.length > 0 && (
              <section className="shell insights-section">
                <h2 className="insights-section-title">이벤트 성격 비교 — 초과폭 × 회복속도 × 활동량</h2>
                <p className="insights-lead">
                  같은 "이상 이벤트"도 성격이 다릅니다. 가로는 기대치 대비 얼마나 튀었는지, 세로는 그 뒤 얼마나
                  빨리 가라앉았는지(아래쪽일수록 빠른 회복), 점 크기는 이벤트 직전 5분간 걸음 수입니다. HRV·회복
                  기울기가 함께 기록된 {scatterPoints.length}건만 표시합니다.
                </p>
                <EpisodeScatterChart
                  title="초과 심박 vs 회복 기울기"
                  points={scatterPoints}
                  categories={AROUSAL_CATEGORIES}
                  xLabel="초과 심박"
                  yLabel="회복 기울기(bpm/분)"
                  formatX={(v) => `${v.toFixed(0)}bpm`}
                  formatY={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                  formatSize={(v) => `${v.toFixed(0)}걸음`}
                  sizeLabel="직전 5분 활동량"
                />
              </section>
            )}

            {distributionItems.length > 0 && (
              <section className="shell insights-section">
                <h2 className="insights-section-title">탐지 강도 분포</h2>
                <p className="insights-lead">
                  전체 {stats.count}건 중 초과 심박이 가장 큰 상위 {distributionItems.length}건을 정렬한
                  그래프입니다.
                </p>
                <RankedBarChart title="초과 심박 (bpm)" items={distributionItems} unit=" bpm" color="#2a78d6" />
              </section>
            )}

            <section className="shell insights-section">
              <h2 className="insights-section-title">최근 탐지된 이벤트</h2>
              <div className="insights-episode-list">
                {topEpisodes.map((episode) => {
                  const categoryKey = episode.arousal || "미분류";
                  const categoryColor = AROUSAL_CATEGORIES.find((c) => c.key === categoryKey)?.color ?? "#717989";
                  return (
                    <Link key={episode.id} to={`/persona/he/reconstruction/${episode.id}`} className="insights-episode-row">
                      <span className="insights-episode-rank">#{episode.rank}</span>
                      <div className="insights-episode-main">
                        <strong>{formatDate(episode.start)}</strong>
                        <span className="insights-episode-tag">
                          <i style={{ background: categoryColor }} />
                          {categoryKey}
                        </span>
                      </div>
                      <div className="insights-episode-metrics">
                        <span>최고 {value(episode.peak_hr)} bpm</span>
                        <span>+{value(episode.excess_bpm)} bpm</span>
                        <span>{episode.steps_5m}걸음</span>
                        <span>점수 {value(episode.score, 1)}</span>
                      </div>
                      <ArrowRight size={18} />
                    </Link>
                  );
                })}
              </div>
            </section>

            <p className="insights-caution shell">
              이 분석은 감정을 판정하는 진단이 아니라, 평소와 다른 신체 신호 변화를 찾는 탐지 모델입니다.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default Insights;
