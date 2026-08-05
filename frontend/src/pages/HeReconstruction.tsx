import { useNavigate, useParams } from "react-router-dom";
import { Activity, Brain, Clock3, Footprints, Gauge, HeartPulse, Sparkles } from "lucide-react";

import Header from "../components/Header";
import SectionTitle from "../components/SectionTitle";
import SensorCard from "../components/SensorCard";
import SummaryCard from "../components/SummaryCard";
import VrReconstruction from "../components/VrReconstruction";
import { formatDate, formatTime, useHeEpisode, value } from "../data/heEpisodes";
import "../styles/heReconstruction.css";

const HeReconstruction = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { person, episode, error } = useHeEpisode(eventId);

  if (error) return <div className="he-message">{error}</div>;
  if (!person || !episode) return <div className="he-message">HE 생체 데이터를 불러오는 중입니다…</div>;

  return (
    <>
      <Header title="HE 개발 페르소나" subtitle="HE 생체 데이터 기반 이상치 재현" />
      <main className="page-container he-page">
        <section className="he-hero">
          <div>
            <span>HE · EPISODE #{episode.rank}</span>
            <h2>{formatDate(episode.start)} 심박 이상 후보</h2>
            <p>실제 심박이 시간대·활동 기준 기대 심박보다 높았던 구간입니다.</p>
          </div>
          <div className="he-score"><small>탐지 점수</small><strong>{value(episode.score, 1)}</strong></div>
        </section>

        <div className="summary-grid he-summary-grid">
          <SummaryCard icon={<HeartPulse size={28} />} title="최고 심박" value={`${value(episode.peak_hr)} bpm`} />
          <SummaryCard icon={<Gauge size={28} />} title="기대치 초과" value={`+${value(episode.excess_bpm)} bpm`} />
          <SummaryCard icon={<Clock3 size={28} />} title="지속 시간" value={`${value(episode.duration_min, 1)}분`} />
        </div>

        <section className="he-detail">
            <SectionTitle title="생체 신호" />
            <div className="sensor-grid">
              <SensorCard icon={<HeartPulse size={24} />} title="관측 최고 심박" value={`${value(episode.peak_hr)} bpm`} />
              <SensorCard icon={<Activity size={24} />} title="기대 심박" value={`${value(episode.expected_hr, 1)} bpm`} />
              <SensorCard icon={<Footprints size={24} />} title="직전 5분 걸음" value={`${value(episode.steps_5m)}걸음`} />
              <SensorCard icon={<Brain size={24} />} title="인근 HRV" value={episode.hrv_ms === null ? "측정 없음" : `${value(episode.hrv_ms, 1)} ms`} />
            </div>

            <SectionTitle title="재현 시간축" />
            <div className="he-timeline">
              <div><time>{formatTime(episode.start)}</time><span></span><article><b>에피소드 시작</b><p>기대 심박 대비 상승 구간이 탐지되었습니다.</p></article></div>
              <div><time>구간 내</time><span></span><article><b>최고 심박 {value(episode.peak_hr)} bpm</b><p>기대치보다 {value(episode.excess_bpm)} bpm 높았습니다.</p></article></div>
              <div><time>{formatTime(episode.end)}</time><span></span><article><b>에피소드 종료</b><p>{value(episode.duration_min, 1)}분 동안 {episode.n_samples}개 심박 샘플을 확인했습니다.</p></article></div>
            </div>

            <SectionTitle title="AI Reasoning" />
            <div className="he-evidence"><Sparkles size={22} /><div><b>{episode.arousal || "각성 패턴 확인"}</b><p>{episode.evidence || `잔차 z-score ${value(episode.peak_z, 2)} · 회복 기울기 ${value(episode.hrr_slope, 1)} bpm/분`}</p></div></div>
            <p className="he-caution">이 화면은 HE 생체 신호의 탐지 후보를 재현하는 개발용 화면이며, 감정이나 원인을 확정하는 진단이 아닙니다.</p>
            <VrReconstruction
              event={{
                id: episode.id,
                title: `HE 이벤트 #${episode.rank}`,
                description: `${formatDate(episode.start)} · 최고 심박 ${value(episode.peak_hr)} bpm`,
              }}
              onLaunch={() => navigate("/vr/he/event_001")}
            />
        </section>
      </main>
    </>
  );
};

export default HeReconstruction;
