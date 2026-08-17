import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  HeartPulse,
  Play,
  UserRound,
  Waves,
} from "lucide-react";

import SiteNav from "../components/SiteNav";
import { useLiveHeartRate } from "../hooks/useLiveHeartRate";

import "../styles/home.css";

const Home = () => {
  const navigate = useNavigate();

  const [isFilmOpen, setIsFilmOpen] = useState(false);

  const {
    sample: liveHeartRate,
    connected: liveConnected,
  } = useLiveHeartRate();

  const liveBpm = liveHeartRate
    ? Math.round(liveHeartRate.bpm)
    : 72;

  const momentDetected =
    Boolean(liveHeartRate?.is_anomaly);

  const baselineBpm =
    typeof liveHeartRate?.baseline === "number"
      ? Math.round(liveHeartRate.baseline)
      : null;

  /* =========================
     SCROLL REVEAL
  ========================= */

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-reveal]"
      )
    );

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) =>
        el.classList.add("is-visible")
      );

      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add(
                "is-visible"
              );

              observer.unobserve(
                entry.target
              );
            }
          });
        },
        {
          threshold: 0.14,
        }
      );

    targets.forEach((el) =>
      observer.observe(el)
    );

    return () =>
      observer.disconnect();
  }, []);

  /* =========================
     FILM OVERLAY
  ========================= */

  useEffect(() => {
    if (!isFilmOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setIsFilmOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isFilmOpen]);

  /* =========================
     INTERACTIVE GLOW
  ========================= */

  const moveGlow = (
    event: React.MouseEvent<HTMLElement>
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect();

    event.currentTarget.style.setProperty(
      "--mx",
      `${event.clientX - rect.left}px`
    );

    event.currentTarget.style.setProperty(
      "--my",
      `${event.clientY - rect.top}px`
    );
  };

  return (
    <div className="vivia-home-v3">

      {/* =========================
          NAV
      ========================= */}

      <SiteNav />

      <main>

        {/* =========================
            HERO
        ========================= */}

        <section className="vh3-hero">

          <div className="vh3-hero-bg" />

          <div className="vh3-hero-grid shell">

            {/* HERO COPY */}

            <div
              className="vh3-hero-copy"
              data-reveal
            >

              <span className="vh3-eyebrow">
                VIA SIGNALS, VIVID STORIES,
                FOR VITA.
              </span>

              <h1 className="vh3-hero-title">

                <span className="vh3-hero-title-dark">
                  몸의 신호를 따라,
                </span>

                <span className="vh3-hero-title-accent">

                  기억은 다시 선명하게.

                  <span
                    className="vh3-title-underline"
                    aria-hidden="true"
                  />

                </span>

              </h1>

              <p>
                VIVIA는 생체신호의 변화와
                일상의 맥락을 연결해
                <br />
                의미 있는 순간을 발견하고,
                다시 경험할 수 있는 이야기로
                재구성합니다.
              </p>

              <div className="vh3-hero-actions">

                <button
                  className="vh3-btn primary"
                  onClick={() =>
                    navigate("/capture")
                  }
                >
                  나의 순간 시작하기

                  <ArrowRight size={17} />
                </button>

                <button
                  className="vh3-btn ghost"
                  onClick={() =>
                    navigate(
                      "/how-it-works"
                    )
                  }
                >
                  <Play size={15} />

                  How it works
                </button>

              </div>

            </div>

            {/* HERO VISUAL */}

            <div
              className="vh3-hero-media"
              data-reveal
            >

              <img
                src="/images/vivia-hero-clean.png"
                alt="일상의 순간을 바라보는 사람"
              />

              {/* Signal Wave */}

              <svg
                className="vh3-wave"
                viewBox="0 0 760 170"
                preserveAspectRatio="none"
                aria-hidden="true"
              >

                <defs>
                  <linearGradient
                    id="heroWaveV3"
                    x1="0"
                    x2="1"
                  >

                    <stop
                      offset="0"
                      stopColor="#35c8c5"
                    />

                    <stop
                      offset="0.55"
                      stopColor="#9b91e8"
                    />

                    <stop
                      offset="1"
                      stopColor="#ff7e73"
                    />

                  </linearGradient>
                </defs>

                <path
                  d="
                    M0,92
                    C130,70 190,118 290,92
                    C390,66 415,48 510,70
                    C600,91 640,122 760,70
                  "
                  fill="none"
                  stroke="url(#heroWaveV3)"
                  strokeWidth="2.5"
                />

              </svg>

              {/* =====================
                  VISUAL INFO CARDS
                  클릭 기능 없음
              ===================== */}

              <div
                className={`vh3-signal-card card-a ${liveConnected ? "is-live" : ""
                  }`}
              >
                <span>
                  {liveConnected
                    ? "BODY SIGNAL · LIVE"
                    : "BODY SIGNAL"}
                </span>

                <strong>
                  {liveBpm} <small>bpm</small>
                </strong>

                <HeartPulse size={19} />
              </div>

              <div
                className={`vh3-signal-card card-b ${momentDetected
                    ? "is-detected"
                    : ""
                  }`}
              >
                <span>
                  {momentDetected
                    ? "MOMENT DETECTED"
                    : liveConnected
                      ? "LISTENING"
                      : "DEMO MODE"}
                </span>

                <strong>
                  {momentDetected
                    ? "평소와 다른 신호 감지"
                    : liveConnected
                      ? baselineBpm
                        ? `baseline ${baselineBpm} bpm`
                        : "몸의 신호를 듣고 있어요"
                      : "변화 구간 감지"}
                </strong>

                <Activity size={19} />
              </div>

              <div className="vh3-signal-card card-c">
                <span>REPLAY READY</span>

                <strong>
                  이 순간 다시 보기
                </strong>

                <Play size={18} />
              </div>

            </div>

          </div>

          <div className="vh3-scroll-cue">
            <span>
              SCROLL TO DISCOVER
            </span>

            <i />
          </div>

        </section>

        {/* =========================
            ABOUT VIVIA
        ========================= */}

        <section
          className="vh3-about shell"
          data-reveal
        >

          <div className="vh3-section-heading">

            <div>

              <span className="vh3-section-label">

                <b>01</b>

                ABOUT VIVIA

              </span>

              <h2>
                <span>
                  VIVIA는 몸의 신호를 읽어
                </span>

                <span>
                  삶의 순간을 이야기로 전합니다.
                </span>
              </h2>

              <p>
                <span>
                  몸이 남긴 신호를 단서로,
                </span>

                <span>
                  지나간 순간을 더 선명하게 바라보고
                </span>

                <span>
                  삶의 맥락을 다시 연결하는 라이프 케어
                  플랫폼입니다.
                </span>
              </p>

            </div>

          </div>

          {/* VIVIA MEANING */}

          <div
            className="
              vh3-connect-panel
              vh3-interactive-surface
            "
            onMouseMove={moveGlow}
          >

            <div className="vh3-brand-line">

              <span className="aqua">
                Via Signals,
              </span>{" "}

              <span className="lav">
                Vivid Stories,
              </span>{" "}

              for{" "}

              <span className="coral">
                Vita.
              </span>

            </div>

            <div className="vh3-connect-grid">

              <div className="vh3-connect-item">

                <span className="vh3-icon aqua-bg">
                  <Waves />
                </span>

                <strong>
                  Signal ↔ Story
                </strong>

                <small>
                  몸의 신호가
                  <br />
                  이야기가 됩니다.
                </small>

              </div>

              <span className="vh3-link-arrow">
                ↔
              </span>

              <div className="vh3-connect-item">

                <span className="vh3-icon lav-bg">
                  <BookOpenText />
                </span>

                <strong>
                  Story ↔ Memory
                </strong>

                <small>
                  지나간 순간이
                  <br />
                  기억으로 연결됩니다.
                </small>

              </div>

              <span className="vh3-link-arrow">
                ↔
              </span>

              <div className="vh3-connect-item">

                <span className="vh3-icon coral-bg">
                  <UserRound />
                </span>

                <strong>
                  Memory ↔ Me
                </strong>

                <small>
                  기억의 이야기가
                  <br />
                  나를 이해하는 연결이 됩니다.
                </small>

              </div>

            </div>

          </div>

        </section>

        {/* =========================
            VIVIA FILM
        ========================= */}

        <section
          className="vh3-film-section"
          data-reveal
        >

          <div className="shell">

            <div className="vh3-film-heading">

              <div className="vh3-section-label">
                <b>02</b>
                VIVIA FILM
              </div>

              <h2>
                VIVIA가 그리는
                <br />
                새로운 기억의 경험
              </h2>

              <p>
                몸의 신호에서 시작해
                한 사람의 삶의 순간이
                <br />
                다시 이야기로 이어지는 과정을
                영상으로 소개합니다.
              </p>

            </div>

            {/* FILM PREVIEW */}

            <button
              type="button"
              className="vh3-film-frame"
              onClick={() =>
                setIsFilmOpen(true)
              }
              aria-label="VIVIA 소개 영상 재생"
            >

              <div className="vh3-film-preview-image">

                <video
                  src="/videos/vivia-intro.mp4"
                  preload="metadata"
                  muted
                  playsInline
                  tabIndex={-1}
                />

              </div>

              <div className="vh3-film-shade" />

              <div className="vh3-film-placeholder">

                <span className="vh3-film-play">
                  <Play
                    size={26}
                    fill="currentColor"
                  />
                </span>

                <strong>
                  VIVIA FILM
                </strong>

                <small>
                  PLAY FILM · 00:59
                </small>

              </div>

            </button>

          </div>

        </section>

      </main>

      {/* =========================
          FOOTER
      ========================= */}

      <footer className="vh3-footer">

        <div className="shell">

          <div className="vh3-footer-brand">

            <img
              src="/assets/logo.png"
              alt="VIVIA"
            />

            <p>
              몸의 신호가 삶의 이야기가 됩니다.
            </p>

          </div>

          <div className="vh3-footer-team">

            <strong>
              TEAM YOLOGY
            </strong>

            <span>
              Samsung Life Lifenology Lab
            </span>

            <span>
              2026
            </span>

          </div>

        </div>

      </footer>

      {/* =========================
          FULLSCREEN FILM
      ========================= */}

      {isFilmOpen && (

        <div
          className="vh3-film-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="VIVIA 소개 영상"
        >

          <button
            type="button"
            className="vh3-film-back"
            onClick={() =>
              setIsFilmOpen(false)
            }
            aria-label="영상 닫기"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="vh3-film-overlay-video">

            <video
              src="/videos/vivia-intro.mp4"
              controls
              autoPlay
              playsInline
            />

          </div>

        </div>

      )}

    </div>
  );
};

export default Home;