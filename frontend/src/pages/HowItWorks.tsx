import {
  Watch,
  Sun,
  Cloud,
  Footprints,
  Flame,
  Moon,
  Activity,
  Target,
  Coffee,
  Briefcase,
  Radar,
  HeartPulse,
  Sparkles,
  ArrowRight,
  Waves,
  Search,
  Link2,
  BookOpen,
  BarChart3,
} from "lucide-react";

import TopNav from "../components/TopNav";
import "../styles/howItWorks.css";

const timeline = [
  {
    time: "08:15",
    label: "출근 직전 설렘 감지",
    detail: "심박 129bpm, 정지 상태",
    icon: <Sun size={16} />,
    tone: "orange",
  },
  {
    time: "13:39",
    label: "지속형 긴장 감지",
    detail: "심박 118bpm, HRV 10ms 눌림",
    icon: <Activity size={16} />,
    tone: "blue",
  },
  {
    time: "18:15",
    label: "위상성 각성 감지",
    detail: "빠른 회복, 짧은 급발현",
    icon: <Target size={16} />,
    tone: "orange",
  },
  {
    time: "20:53",
    label: "활동적인 순간",
    detail: "걸음 162/5분, 심박 141bpm",
    icon: <Footprints size={16} />,
    tone: "blue",
  },
  {
    time: "23:44",
    label: "야간 급발현",
    detail: "심박 137bpm, 위상성 각성",
    icon: <Moon size={16} />,
    tone: "orange",
  },
];

const contextNodes = [
  { icon: <Moon size={15} />, label: "수면 부족" },
  { icon: <Coffee size={15} />, label: "카페인" },
  { icon: <Briefcase size={15} />, label: "업무 스트레스" },
  { icon: <Cloud size={15} />, label: "날씨 변화" },
];

const factors = [
  { label: "수면 시간", value: 78 },
  { label: "업무 스트레스", value: 64 },
  { label: "운동 부족", value: 32 },
];

const reconstructionSteps = [
  { time: "13:24", label: "긴장 시작", icon: <Activity size={17} /> },
  { time: "13:39", label: "심박 최고점", icon: <Flame size={17} /> },
  { time: "13:45", label: "HRV 최저점", icon: <Waves size={17} /> },
  { time: "13:52", label: "서서히 진정", icon: <Moon size={17} /> },
  { time: "14:12", label: "평상시로 회복", icon: <Sparkles size={17} /> },
];

const insights = [
  {
    tone: "dark",
    eyebrow: "이번 주 인사이트",
    title: "목요일 오후에 긴장이 반복돼요",
    body: "평균 심박 스트레스 18% 상승",
    cta: "패턴 자세히 보기",
  },
  {
    tone: "light",
    eyebrow: "추천 케어",
    title: "마음 챙김 시간을 가져보세요",
    body: "하루 10분 명상으로 스트레스를 낮춰보세요",
    cta: "실천하기",
  },
  {
    tone: "coral",
    eyebrow: "주간 리포트",
    title: "이번 주의 나",
    body: "활동 목표 92% 달성 · 수면 효율 85%",
    cta: "리포트 보기",
  },
];

const flow = [
  { icon: <Search size={17} />, label: "신호 포착" },
  { icon: <Radar size={17} />, label: "순간 감지" },
  { icon: <Link2 size={17} />, label: "맥락 연결" },
  { icon: <BookOpen size={17} />, label: "기억 복원" },
  { icon: <BarChart3 size={17} />, label: "삶의 통찰" },
];

const HowItWorks = () => {
  return (
    <div className="hiw-page">
      <TopNav />

      {/* HERO */}
      <section className="hiw-hero">
        <span className="hiw-eyebrow">FEATURES</span>
        <h1>
          신호를 이야기로
          <br />
          바꾸는 핵심 기능
        </h1>
        <p>
          VIVIA는 당신의 일상 속 수많은 신호를 포착하고, 의미 있는
          이야기와 인사이트로 연결합니다.
        </p>
      </section>

      {/* 01 SIGNAL CAPTURE */}
      <section className="hiw-section">
        <div className="hiw-section-grid reverse">
          <div className="hiw-copy">
            <span className="hiw-step">01</span>
            <h2>Signal Capture</h2>
            <h3>일상 속 신호를 정확하게 포착합니다</h3>
            <p>
              웨어러블, 환경, 행동 데이터를 실시간으로 수집하며 당신의
              몸과 마음이 보내는 신호를 놓치지 않습니다.
            </p>

            <div className="hiw-tags">
              <span><Watch size={14} /> Wearables</span>
              <span><Sun size={14} /> Environment</span>
              <span><Footprints size={14} /> Activity</span>
              <span><Activity size={14} /> Vitals</span>
              <span><Moon size={14} /> Sleep</span>
            </div>
          </div>

          <div className="hiw-visual">
            <div className="hiw-dashboard">
              <div className="hiw-dashboard-head">
                <span className="hiw-live-dot" /> Live Signals
                <span className="hiw-dashboard-date">Today</span>
              </div>

              <div className="hiw-dashboard-grid">
                <div className="hiw-stat">
                  <span>Heart Rate</span>
                  <strong>72 <em>bpm</em></strong>
                </div>
                <div className="hiw-stat">
                  <span>HRV</span>
                  <strong>68 <em>ms</em></strong>
                </div>
                <div className="hiw-stat">
                  <span>Stress Level</span>
                  <strong className="low">Low</strong>
                </div>
                <div className="hiw-stat">
                  <span>Sleep</span>
                  <strong>7h <em>30m</em></strong>
                </div>
              </div>

              <div className="hiw-dashboard-row">
                <div>
                  <span>Steps</span>
                  <strong>7,842 / 10,000</strong>
                  <div className="hiw-bar"><i style={{ width: "78%" }} /></div>
                </div>
                <div>
                  <span>Calories</span>
                  <strong>482 kcal</strong>
                </div>
                <div>
                  <span>Active Time</span>
                  <strong>62 min</strong>
                </div>
                <div>
                  <span>SpO₂</span>
                  <strong>98% <em>Normal</em></strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 MOMENT DETECTION */}
      <section className="hiw-section alt">
        <div className="hiw-section-grid">
          <div className="hiw-visual">
            <div className="hiw-timeline">
              {timeline.map((item) => (
                <div className={`hiw-timeline-item ${item.tone}`} key={item.time}>
                  <span className="hiw-timeline-time">{item.time}</span>
                  <div className="hiw-timeline-dot">{item.icon}</div>
                  <div className="hiw-timeline-card">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hiw-copy">
            <span className="hiw-step">02</span>
            <h2>Moment Detection</h2>
            <h3>의미 있는 순간을 스마트하게 감지합니다</h3>
            <p>
              AI가 당신의 패턴과 변화를 이해하고, 삶의 전환점이 되는
              순간을 찾아냅니다. 실제로 감지된 심박 이상 신호를 기반으로
              합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 03 CONTEXT WEAVING */}
      <section className="hiw-section">
        <div className="hiw-section-grid reverse">
          <div className="hiw-copy">
            <span className="hiw-step">03</span>
            <h2>Context Weaving</h2>
            <h3>신호를 맥락으로 연결해 이해를 확장합니다</h3>
            <p>
              시간, 장소, 상황, 감정 등 다양한 맥락을 엮어 왜 그 순간이
              일어났는지 이해할 수 있게 합니다.
            </p>
          </div>

          <div className="hiw-visual">
            <div className="hiw-context">
              <div className="hiw-context-map">
                <span className="hiw-context-title">Context Map</span>
                <div className="hiw-context-center">
                  <HeartPulse size={18} />
                </div>
                {contextNodes.map((node, i) => (
                  <div className={`hiw-context-node pos-${i}`} key={node.label}>
                    {node.icon}
                    <span>{node.label}</span>
                  </div>
                ))}
              </div>

              <div className="hiw-context-analysis">
                <span className="hiw-context-title">AI Analysis</span>
                <p>
                  오늘의 피로는 수면 부족과 높은 업무 스트레스가 주요
                  원인으로 분석되었습니다.
                </p>

                <span className="hiw-context-sub">Key Factors</span>
                {factors.map((f) => (
                  <div className="hiw-factor" key={f.label}>
                    <span>{f.label}</span>
                    <div className="hiw-factor-track">
                      <i style={{ width: `${f.value}%` }} />
                    </div>
                    <em>{f.value}%</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04 MEMORY RECONSTRUCTION */}
      <section className="hiw-section alt">
        <div className="hiw-recon-head">
          <div>
            <span className="hiw-step">04</span>
            <h2>Memory Reconstruction</h2>
            <h3>흩어진 조각을 연결해 기억을 복원합니다</h3>
          </div>
          <span className="hiw-recon-date">2026년 7월 27일, 월요일 · 시험 직전</span>
        </div>

        <div className="hiw-recon-strip">
          {reconstructionSteps.map((step) => (
            <div className="hiw-recon-tile" key={step.time}>
              <div className="hiw-recon-icon">{step.icon}</div>
              <span className="hiw-recon-time">{step.time}</span>
              <span className="hiw-recon-label">{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 05 LIFE INSIGHT */}
      <section className="hiw-section">
        <div className="hiw-copy center">
          <span className="hiw-step">05</span>
          <h2>Life Insight</h2>
          <h3>삶의 패턴을 통찰로 바꾸어 더 나은 선택을 돕습니다</h3>
        </div>

        <div className="hiw-insight-grid">
          {insights.map((insight) => (
            <div className={`hiw-insight-card ${insight.tone}`} key={insight.title}>
              <span>{insight.eyebrow}</span>
              <strong>{insight.title}</strong>
              <p>{insight.body}</p>
              <button>{insight.cta}</button>
            </div>
          ))}
        </div>
      </section>

      {/* FLOW STRIP */}
      <section className="hiw-flow">
        <h3>From Signal to Story</h3>
        <p>신호가 이야기가 완성되는 과정</p>

        <div className="hiw-flow-strip">
          {flow.map((step, i) => (
            <div className="hiw-flow-item" key={step.label}>
              <div className="hiw-flow-icon">{step.icon}</div>
              <span>{step.label}</span>
              {i < flow.length - 1 && <ArrowRight size={16} className="hiw-flow-arrow" />}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="hiw-cta">
        <h2>지금, 당신의 신호를 이야기로 바꿔보세요.</h2>
        <p>VIVIA가 당신의 더 나은 삶을 연결합니다.</p>
        <div className="hiw-cta-buttons">
          <button className="hiw-cta-primary">무료로 시작하기</button>
          <button className="hiw-cta-secondary">더 알아보기</button>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
