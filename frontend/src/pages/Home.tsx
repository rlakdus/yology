import "../styles/home.css";

import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  HeartPulse,
  Sparkles,
  Route,
  LifeBuoy,
  Brain,
  Play,
  Search,
  RotateCcw,
  HandHeart,
  Moon,
} from "lucide-react";

import TopNav from "../components/TopNav";
import logo from "../assets/logo.png";

const moments = [
  {
    tag: "설렘의 순간",
    title: "데이트",
    date: "2026.07.31 · 11:44 PM",
    peak: 137,
    score: 7.4,
    duration: "짧은 급발현",
    accent: "orange",
  },
  {
    tag: "긴장의 파동",
    title: "시험 직전",
    date: "2026.07.27 · 01:39 PM",
    peak: 118,
    score: 6.0,
    duration: "18분 지속",
    accent: "blue",
  },
  {
    tag: "설렘 가득했던 첫 아침",
    title: "첫 인턴 출근일",
    date: "2026.07.20 · 08:18 AM",
    peak: 129,
    score: 6.3,
    duration: "출근 직전",
    accent: "blue",
  },
  {
    tag: "활동적인 하루",
    title: "친구들과 여행",
    date: "2026.07.25 · 08:53 PM",
    peak: 141,
    score: 3.3,
    duration: "걸음 많음",
    accent: "orange",
  },
];

const Home = () => {
  const navigate = useNavigate();

  const pillars = [
    {
      icon: <Search size={24} />,
      title: "발견",
      description: "몸이 보내는 미세한 신호를 정밀하게 감지하고, 숨겨진 패턴을 발견합니다.",
    },
    {
      icon: <RotateCcw size={24} />,
      title: "복원",
      description: "잃어버린 균형과 최적의 흐름을 되찾아, 내면의 안정을 복원합니다.",
    },
    {
      icon: <HandHeart size={24} />,
      title: "돌봄",
      description: "지속 가능한 건강 습관으로 맞춤형 인사이트를 통해 당신의 삶을 돌봅니다.",
    },
  ];

  const features = [
    {
      icon: <HeartPulse size={30} />,
      title: "몸의 신호를 기록",
      description:
        "심박, 스트레스, 활동량 등 일상 속 생체 신호를 시간과 함께 기록합니다.",
      accent: "blue",
    },
    {
      icon: <Route size={30} />,
      title: "흩어진 기록을 연결",
      description:
        "사진, 영상, 위치, 대화와 생체 데이터를 하나의 순간으로 이어봅니다.",
      accent: "orange",
    },
    {
      icon: <Brain size={30} />,
      title: "AI로 맥락을 재구성",
      description:
        "서로 다른 기록을 분석해 당시의 상황과 감정 변화를 추론합니다.",
      accent: "blue",
    },
    {
      icon: <Sparkles size={30} />,
      title: "기억을 다시 선명하게",
      description:
        "재구성된 순간을 시각적으로 되살려 오래된 경험을 다시 마주합니다.",
      accent: "orange",
    },
  ];

  return (
    <div className="home-page">
      <TopNav />

      {/* =========================
          HERO
      ========================= */}

      <section className="home-hero">
        <div className="home-hero-glow blue" />
        <div className="home-hero-glow orange" />

        <div className="home-hero-content">
          <span className="home-eyebrow">
            VIVID · VIA · VITA
          </span>

          <h1 className="home-brand">
            <img src={logo} alt="VIVIA" />
          </h1>

          <h2 className="home-title">
            몸의 신호를 따라,
            <br />
            <span>기억은 다시 선명하게.</span>
          </h2>

          <p className="home-slogan">
            <span className="via">Via</span> Signals,{" "}
            <span className="vivid">Vivid</span> Stories, for{" "}
            <span className="vita">Vita</span>.
          </p>

          <p className="home-description">
            VIVIA는 몸의 신호와 삶의 기록을 연결해
            <br />
            잊혀가는 순간의 맥락과 감정을 다시 재구성합니다.
          </p>

          <button
            className="home-primary-btn"
            onClick={() => navigate("/moment")}
          >
            나의 기록 보기

            <ArrowRight size={19} />
          </button>

          <div className="home-meaning">
            <div>
              <strong>Vivid</strong>
              <span>선명하게</span>
            </div>

            <span className="home-meaning-dot" />

            <div>
              <strong>Via</strong>
              <span>몸의 신호를 통해</span>
            </div>

            <span className="home-meaning-dot" />

            <div>
              <strong>Vita</strong>
              <span>삶을 이해하다</span>
            </div>
          </div>
        </div>

        <div className="home-hero-float float-signal">
          <HeartPulse size={17} />
          <div>
            <span>BODY SIGNAL</span>
            <strong>심박 변동 72bpm</strong>
          </div>
        </div>

        <div className="home-hero-float float-moment">
          <Sparkles size={17} />
          <div>
            <span>MOMENT DETECTED</span>
            <strong>첫 출근의 설렘 · 08:15 AM</strong>
          </div>
        </div>

        <div className="home-hero-float float-replay">
          <Play size={15} />
          <div>
            <span>REPLAY READY</span>
            <strong>이 순간을 다시 만나볼까요?</strong>
          </div>
        </div>
      </section>

      {/* =========================
          BRAND STORY
      ========================= */}

      <section className="home-story">
        <div className="home-story-inner">
          <div className="home-story-copy">
            <span className="home-section-label">
              WHY VIVIA
            </span>

            <h2>
              기억은 사라져도,
              <br />
              몸은 그 순간을 기억합니다.
            </h2>

            <p>
              우리는 하루 동안 수많은 순간을 지나지만
              그 감정과 맥락을 모두 기억하지는 못합니다.
              VIVIA는 몸에 남은 신호와 주변의 기록을 연결해
              시간이 지나도 다시 꺼내볼 수 있는 경험으로 만듭니다.
            </p>
          </div>

          <div className="home-story-visual">
            <div className="home-signal-line" />

            <div className="home-signal-card">
              <HeartPulse size={25} />

              <div>
                <span>BODY SIGNAL</span>
                <strong>112 bpm</strong>
              </div>
            </div>

            <div className="home-story-arrow">
              <ArrowRight size={21} />
            </div>

            <div className="home-memory-card">
              <Sparkles size={25} />

              <div>
                <span>MEMORY</span>
                <strong>2026.07 · Mongolia</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          PHILOSOPHY
      ========================= */}

      <section className="home-philosophy">
        <span className="home-section-label light">
          OUR PHILOSOPHY
        </span>

        <h2>우리가 믿는 변화의 방식</h2>

        <p>
          VIVIA는 신호를 해석하는 기술을 넘어, 삶을 이해하고 돌보는
          새로운 방식을 제안합니다.
        </p>

        <div className="home-pillars">
          {pillars.map((pillar, index) => (
            <div className="home-pillar-wrap" key={pillar.title}>
              <div className="home-pillar-card">
                <div className="home-pillar-icon">{pillar.icon}</div>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </div>

              {index < pillars.length - 1 && (
                <ArrowRight className="home-pillar-arrow" size={20} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* =========================
          MY MOMENTS PREVIEW
      ========================= */}

      <section className="home-moments">
        <div className="home-section-header">
          <span className="home-section-label">MY MOMENTS</span>

          <h2>
            실제로 감지된
            <br />
            생체 신호의 순간들
          </h2>

          <p>
            아래 4개는 실제 심박 데이터에서 감지된 이상 신호를 바탕으로
            재구성한 순간입니다.
          </p>
        </div>

        <div className="home-moments-grid">
          {moments.map((moment) => (
            <div className={`home-moment-card ${moment.accent}`} key={moment.title}>
              <span className="home-moment-tag">{moment.tag}</span>

              <h3>{moment.title}</h3>
              <span className="home-moment-date">{moment.date}</span>

              <div className="home-moment-stats">
                <span>
                  <HeartPulse size={13} /> {moment.peak} bpm
                </span>
                <span>
                  <Sparkles size={13} /> score {moment.score}
                </span>
                <span>
                  <Moon size={13} /> {moment.duration}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================
          FEATURES
      ========================= */}

      <section className="home-features">
        <div className="home-section-header">
          <span className="home-section-label">
            HOW VIVIA WORKS
          </span>

          <h2>
            흩어진 데이터가
            <br />
            하나의 삶의 기록이 되기까지
          </h2>

          <p>
            VIVIA는 생체 신호부터 주변의 멀티모달 기록까지
            단계적으로 연결합니다.
          </p>
        </div>

        <div className="home-feature-grid">
          {features.map((feature, index) => (
            <div
              className={`home-feature-card ${feature.accent}`}
              key={feature.title}
            >
              <span className="home-feature-number">
                0{index + 1}
              </span>

              <div className="home-feature-icon">
                {feature.icon}
              </div>

              <h3>{feature.title}</h3>

              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* =========================
    FINAL
========================= */}

      <section className="home-final">
        <div className="home-final-glow" />

        <div className="home-final-content">
          <div className="home-final-icon">
            <LifeBuoy size={30} />
          </div>

          <span>
            YOUR LIFE, VIVID AGAIN
          </span>

          <h2>
            순간은 지나가도,
            <br />
            삶의 흔적은 남습니다.
          </h2>

          <p>
            몸의 신호를 통해 잊힌 순간을 다시 선명하게.
            <br />
            VIVIA는 삶의 기록을 이어갑니다.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;