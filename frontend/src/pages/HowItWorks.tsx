import { useEffect, useState } from "react";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Clock3,
  HeartPulse,
  MapPin,
  Moon,
  Play,
  Sparkles,
  Waves,
} from "lucide-react";

import SiteNav from "../components/SiteNav";

import "../styles/howItWorks.css";

const signalCards = [
  ["심박수", "72 bpm", HeartPulse],
  ["HRV", "58 ms", Waves],
  ["활동량", "320 kcal", Activity],
  ["수면", "7h 24m", Moon],
] as const;

const processNav = [
  [
    "01",
    "Capture",
    "순간 포착",
    HeartPulse,
  ],
  [
    "02",
    "Reconstruct",
    "맥락 복원",
    Sparkles,
  ],
  [
    "03",
    "Replay",
    "상황 재현",
    Play,
  ],
] as const;

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(1);

  /* =========================
     STEP NAVIGATION
  ========================= */

  const jumpToStep = (step: number) => {
    setActiveStep(step);

    document
      .getElementById(`hiw-step-${step}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  };

  /* =========================
     PAGE START
  ========================= */

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  /* =========================
     ACTIVE STEP SYNC
  ========================= */

  useEffect(() => {
    const nodes = processNav
      .map((_, index) =>
        document.getElementById(
          `hiw-step-${index + 1}`
        )
      )
      .filter(Boolean) as HTMLElement[];

    let frame = 0;

    const syncActiveStep = () => {
      window.cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        const readingLine =
          window.innerHeight * 0.42;

        const current = nodes.find((node) => {
          const rect =
            node.getBoundingClientRect();

          return (
            rect.top <= readingLine &&
            rect.bottom > readingLine
          );
        });

        if (current) {
          setActiveStep(
            Number(
              current.dataset.step || 1
            )
          );

          return;
        }

        const nearest = nodes.reduce(
          (best, node) => {
            const distance = Math.abs(
              node.getBoundingClientRect().top -
              readingLine
            );

            return distance < best.distance
              ? {
                node,
                distance,
              }
              : best;
          },
          {
            node: nodes[0],
            distance:
              Number.POSITIVE_INFINITY,
          }
        );

        if (nearest.node) {
          setActiveStep(
            Number(
              nearest.node.dataset.step || 1
            )
          );
        }
      });
    };

    syncActiveStep();

    window.addEventListener(
      "scroll",
      syncActiveStep,
      {
        passive: true,
      }
    );

    window.addEventListener(
      "resize",
      syncActiveStep
    );

    return () => {
      window.cancelAnimationFrame(frame);

      window.removeEventListener(
        "scroll",
        syncActiveStep
      );

      window.removeEventListener(
        "resize",
        syncActiveStep
      );
    };
  }, []);

  return (
    <div className="hiw-page hiw-v6">
      {/* =========================
          NAV
      ========================= */}

      <SiteNav />

      <main>
        {/* =========================
            HERO
        ========================= */}

        <section className="hiw-hero shell">
          <div className="hiw-hero-copy">
            <span>HOW VIVIA WORKS</span>

            <h1>
              몸의 신호에서 시작해,
              <br />

              <em>
                다시 경험하는 이야기
              </em>

              까지.
            </h1>

            <p>
              웨어러블 신호로 순간을
              포착하고, 흩어진 기록을
              연결해 맥락을 복원합니다.
              <br />
              재구성된 순간은
              360° VR과 심박 리듬으로
              다시 경험할 수 있습니다.
            </p>
          </div>

          {/* =====================
              LIVE DASHBOARD
          ===================== */}

          <div className="hiw-dashboard interactive-panel">
            <div className="hiw-dashboard-glow" />

            <div className="hiw-dashboard-top">
              <span>
                실시간 신호 대시보드
              </span>

              <b>● LIVE</b>
            </div>

            <div className="hiw-dashboard-grid">
              {signalCards.map(
                ([label, value, Icon]) => (
                  <div
                    className="hiw-dashboard-card"
                    key={label}
                  >
                    <div className="hiw-dashboard-card-copy">
                      <small>{label}</small>

                      <strong>
                        {value}
                      </strong>
                    </div>

                    <Icon size={20} />

                    <i
                      aria-hidden="true"
                      className="hiw-dashboard-bars"
                    />
                  </div>
                )
              )}

              {/* DEVICE */}

              <div className="hiw-device">
                <div className="hiw-device-body" />

                <span>VIVIA</span>

                <b>signal source</b>
              </div>
            </div>
          </div>
        </section>

        {/* =========================
            STICKY PROCESS NAV
        ========================= */}

        <section className="hiw-process-nav-wrap">
          <div className="hiw-process-nav shell">
            {processNav.map(
              (
                [no, en, ko, Icon],
                index
              ) => (
                <button
                  key={en}
                  className={
                    activeStep === index + 1
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    jumpToStep(index + 1)
                  }
                >
                  <span>
                    <Icon size={19} />
                  </span>

                  <div>
                    <small>{no}</small>

                    <strong>{en}</strong>

                    <em>{ko}</em>
                  </div>
                </button>
              )
            )}
          </div>
        </section>

        {/* =========================
            01 · CAPTURE
        ========================= */}

        <section
          id="hiw-step-1"
          data-step="1"
          className={`hiw-step shell ${activeStep === 1
              ? "is-active"
              : ""
            }`}
        >
          <aside>
            <span>
              01 · CAPTURE
            </span>

            <h2>
              몸의 신호로
              <br />
              순간을 포착합니다.
            </h2>

            <p>
              심박·활동량·산소포화도 등
              웨어러블 데이터를 수집하고,
              개인 baseline과 비교해 <br/>
              평소와 다른 신호 변화가
              이어지는 순간을 감지합니다.
            </p>
          </aside>

          <div className="hiw-capture">
            {/* SIGNAL AREA */}

            <div className="hiw-capture-signal">
              <div className="hiw-capture-heading">
                <div>
                  <small>
                    LIVE SIGNAL
                  </small>

                  <strong>
                    개인 baseline과
                    비교한 변화
                  </strong>
                </div>

                <span>
                  DETECTING
                </span>
              </div>

              <div className="hiw-capture-chart">
                <div className="hiw-baseline">
                  <span>
                    PERSONAL BASELINE
                  </span>
                </div>

                <svg
                  viewBox="0 0 600 170"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="captureGradient"
                      x1="0"
                      x2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#35c8c5"
                      />

                      <stop
                        offset="55%"
                        stopColor="#6f9de6"
                      />

                      <stop
                        offset="100%"
                        stopColor="#ff7e73"
                      />
                    </linearGradient>
                  </defs>

                  <path
                    className="hiw-chart-line"
                    d="
                      M0 112
                      C35 110 52 118 82 113
                      S135 104 165 108
                      S210 116 235 108
                      C255 100 260 67 280 62
                      C305 55 318 44 340 49
                      C360 54 370 85 392 91
                      C420 98 440 106 465 104
                      C495 102 505 69 528 61
                      C548 53 570 48 600 37
                    "
                  />

                  <circle
                    cx="340"
                    cy="49"
                    r="6"
                    className="hiw-chart-point"
                  />

                  <circle
                    cx="528"
                    cy="61"
                    r="6"
                    className="hiw-chart-point"
                  />
                </svg>
              </div>

              <div className="hiw-capture-status">
                <HeartPulse size={17} />

                <div>
                  <small>
                    MOMENT DETECTED
                  </small>

                  <strong>
                    평소와 다른 변화가
                    지속되고 있습니다.
                  </strong>
                </div>
              </div>
            </div>

            {/* SIGNAL CARDS */}

            <div className="hiw-capture-metrics">
              {[
                [
                  HeartPulse,
                  "HEART RATE",
                  "102",
                  "bpm",
                ],
                [
                  Waves,
                  "HRV",
                  "45",
                  "ms",
                ],
                [
                  Activity,
                  "MOVEMENT",
                  "LOW",
                  "",
                ],
                [
                  Clock3,
                  "DURATION",
                  "12",
                  "sec",
                ],
              ].map(
                ([
                  Icon,
                  label,
                  value,
                  unit,
                ]) => {
                  const MetricIcon =
                    Icon as typeof HeartPulse;

                  return (
                    <article
                      key={label as string}
                    >
                      <MetricIcon />

                      <small>
                        {label as string}
                      </small>

                      <strong>
                        {value as string}

                        {unit && (
                          <em>
                            {unit as string}
                          </em>
                        )}
                      </strong>
                    </article>
                  );
                }
              )}
            </div>
          </div>
        </section>

        {/* =========================
            02 · RECONSTRUCT
        ========================= */}

        <section
          id="hiw-step-2"
          data-step="2"
          className={`hiw-step shell ${activeStep === 2
              ? "is-active"
              : ""
            }`}
        >
          <aside>
            <span>
              02 · RECONSTRUCT
            </span>

            <h2>
              흩어진 기록을 연결해
              <br />
              그 순간의 맥락을
              복원합니다.
            </h2>

            <p>
              감지 시점의 생체신호와
              시간·위치·주변 기록을
              하나의 순간으로 결합해,
              <br/> 당시의 상황과 변화 흐름을
              다시 구성합니다.
            </p>
          </aside>

          <div className="hiw-reconstruct">
            {[
              [
                BrainCircuit,
                "신호 분석",
                "감지 시점의 생체 변화",
              ],

              [
                Clock3,
                "시간 연결",
                "변화 전후의 흐름",
              ],

              [
                MapPin,
                "맥락 복원",
                "위치·사진·주변 기록",
              ],

              [
                Sparkles,
                "기억 재구성",
                "하나의 순간으로 복원",
              ],
            ].map(
              (
                [Icon, title, desc],
                index
              ) => {
                const IconComp =
                  Icon as typeof HeartPulse;

                return (
                  <article
                    key={title as string}
                  >
                    <IconComp />

                    <small>
                      0{index + 1}
                    </small>

                    <strong>
                      {title as string}
                    </strong>

                    <span>
                      {desc as string}
                    </span>

                    {index < 3 && (
                      <ArrowRight />
                    )}
                  </article>
                );
              }
            )}
          </div>
        </section>

        {/* =========================
            03 · REPLAY
        ========================= */}

        <section
          id="hiw-step-3"
          data-step="3"
          className={`hiw-step shell ${activeStep === 3
              ? "is-active"
              : ""
            }`}
        >
          <aside>
            <span>
              03 · REPLAY
            </span>

            <h2>
              복원된 순간을
              <br />
              다시 경험합니다.
            </h2>

            <p>
              재구성된 장면을
              360° VR로 되살리고, <br/>
              당시의 심박 리듬까지 더해
              그 순간을 <br/> 몰입감 있게
              재현합니다.
            </p>
          </aside>

          <div className="hiw-replay">
            <div className="hiw-replay-orbit orbit-one" />
            <div className="hiw-replay-orbit orbit-two" />

            <div className="hiw-replay-placeholder">
              <div className="hiw-replay-play">
                <Play size={27} />
              </div>

              <span>
                IMMERSIVE REPLAY
              </span>

              <strong>
                그 순간을 다시
                바라보다
              </strong>

              <p>
                360° 장면과 기록된
                심박 리듬을 통해
                <br />
                재구성된 순간을
                다시 경험합니다.
              </p>

              <div className="hiw-replay-tags">
                <b>360° VR</b>

                <b>heartbeat</b>

                <b>immersive scene</b>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================
          FOOTER
      ========================= */}

      <footer className="hiw-footer">
        <div className="shell hiw-footer-inner">
          <div className="hiw-footer-brand">
            <img
              src="/assets/logo.png"
              alt="VIVIA"
            />

            <p>
              몸의 신호가 삶의 이야기가
              됩니다.
            </p>
          </div>

          <div className="hiw-footer-team">
            <strong>
              TEAM YOLOGY
            </strong>

            <span>
              Samsung Life Lifenology Lab
            </span>

            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorks;