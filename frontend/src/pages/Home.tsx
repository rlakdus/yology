import "../styles/home.css";

import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  HeartPulse,
  Sparkles,
  Route,
  LifeBuoy,
  Brain,
} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

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
            VIVIA
          </h1>

          <h2 className="home-title">
            몸의 신호를 따라,
            <br />
            <span>기억은 다시 선명하게.</span>
          </h2>

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