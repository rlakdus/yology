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
  Search,
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
    "Sense",
    "신호와 변화 감지",
    HeartPulse,
  ],
  [
    "02",
    "Capture",
    "순간과 맥락 기록",
    Activity,
  ],
  [
    "03",
    "Reconstruct",
    "이야기 재구성",
    Sparkles,
  ],
  [
    "04",
    "Replay",
    "다시 경험",
    Play,
  ],
] as const;

const HowItWorks = () => {
  const [activeStep, setActiveStep] =
    useState(1);

  /* =========================
     STEP NAVIGATION
     페이지 내부 스크롤 전용
  ========================= */

  const jumpToStep = (
    step: number
  ) => {
    setActiveStep(step);

    document
      .getElementById(
        `hiw-step-${step}`
      )
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
    const nodes =
      processNav
        .map((_, index) =>
          document.getElementById(
            `hiw-step-${index + 1}`
          )
        )
        .filter(
          Boolean
        ) as HTMLElement[];

    let frame = 0;

    const syncActiveStep = () => {
      window.cancelAnimationFrame(
        frame
      );

      frame =
        window.requestAnimationFrame(
          () => {
            const readingLine =
              window.innerHeight *
              0.42;

            const current =
              nodes.find(
                (node) => {
                  const rect =
                    node.getBoundingClientRect();

                  return (
                    rect.top <=
                      readingLine &&
                    rect.bottom >
                      readingLine
                  );
                }
              );

            if (current) {
              setActiveStep(
                Number(
                  current.dataset
                    .step || 1
                )
              );

              return;
            }

            const nearest =
              nodes.reduce(
                (
                  best,
                  node
                ) => {
                  const distance =
                    Math.abs(
                      node
                        .getBoundingClientRect()
                        .top -
                        readingLine
                    );

                  return distance <
                    best.distance
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
                  nearest.node.dataset
                    .step || 1
                )
              );
            }
          }
        );
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
      window.cancelAnimationFrame(
        frame
      );

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

          {/* HERO COPY */}

          <div className="hiw-hero-copy">

            <span>
              HOW VIVIA WORKS
            </span>

            <h1>
              몸의 신호에서 시작해,
              <br />

              <em>
                다시 경험하는 이야기
              </em>

              까지.
            </h1>

            <p>
              현재 데모는 생체신호 변화
              감지, 순간 상세 확인,
              AI 기반 상황 재구성,
              <br/> 몰입형 리플레이까지
              하나의 흐름으로 연결합니다.
            </p>

          </div>

          {/* =====================
              LIVE DASHBOARD
              정보 표시용 UI
          ===================== */}

          <div className="hiw-dashboard interactive-panel">

            <div className="hiw-dashboard-glow" />

            <div className="hiw-dashboard-top">

              <span>
                실시간 신호 대시보드
              </span>

              <b>
                ● LIVE
              </b>

            </div>

            <div className="hiw-dashboard-grid">

              {signalCards.map(
                (
                  [
                    label,
                    value,
                    Icon,
                  ]
                ) => (

                  <div
                    className="hiw-dashboard-card"
                    key={label}
                  >

                    <div className="hiw-dashboard-card-copy">

                      <small>
                        {label}
                      </small>

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

                <span>
                  VIVIA
                </span>

                <b>
                  signal source
                </b>

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
                [
                  no,
                  en,
                  ko,
                  Icon,
                ],
                index
              ) => (

                <button
                  key={en}
                  className={
                    activeStep ===
                    index + 1
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    jumpToStep(
                      index + 1
                    )
                  }
                >

                  <span>
                    <Icon size={19} />
                  </span>

                  <div>

                    <small>
                      {no}
                    </small>

                    <strong>
                      {en}
                    </strong>

                    <em>
                      {ko}
                    </em>

                  </div>

                </button>

              )
            )}

          </div>

        </section>

        {/* =========================
            01 · SENSE
        ========================= */}

        <section
          id="hiw-step-1"
          data-step="1"
          className={`hiw-step shell ${
            activeStep === 1
              ? "is-active"
              : ""
          }`}
        >

          <aside>

            <span>
              01 · SENSE
            </span>

            <h2>
              몸의 신호와 변화를
              감지합니다.
            </h2>

            <p>
              웨어러블의 생체 데이터를
              개인 baseline과 비교해
              평소와 다른 변화가
              이어지는 순간을
              발견합니다.
            </p>

          </aside>

          <div className="hiw-signal-panel">

            {signalCards.map(
              (
                [
                  label,
                  value,
                  Icon,
                ],
                index
              ) => (

                <article key={label}>

                  <Icon />

                  <span>
                    {label}
                  </span>

                  <strong>
                    {value}
                  </strong>

                  <svg
                    viewBox="0 0 100 30"
                    aria-hidden="true"
                  >

                    <path
                      d={
                        index %
                          2 ===
                        0
                          ? "M0 20 C18 8 25 26 43 14 S70 3 100 15"
                          : "M0 17 C15 25 25 7 42 16 S70 25 100 8"
                      }
                    />

                  </svg>

                </article>

              )
            )}

          </div>

        </section>

        {/* =========================
            02 · CAPTURE
        ========================= */}

        <section
          id="hiw-step-2"
          data-step="2"
          className={`hiw-step shell ${
            activeStep === 2
              ? "is-active"
              : ""
          }`}
        >

          <aside>

            <span>
              02 · CAPTURE
            </span>

            <h2>
              순간과 맥락을
              기록합니다.
            </h2>

            <p>
              감지된 순간에 사진과
              메모를 더하고, <br/>
              시간·위치·생체신호를
              하나의 Moment로
              쌓아갑니다.
            </p>

          </aside>

          <div className="hiw-detail">

            <div>

              <strong>
                집중이 높아진 시간
              </strong>

              <small>
                12:47 · 2026.05.18
              </small>

              <svg
                viewBox="0 0 500 130"
                aria-hidden="true"
              >

                <path
                  d="
                    M0 90
                    C40 85 55 65 90 76
                    S150 95 185 68
                    S242 50 276 58
                    S330 25 370 52
                    S430 92 500 60
                  "
                />

              </svg>

            </div>

            <ul>

              <li>
                <HeartPulse />

                심박

                <b>
                  102 bpm
                </b>
              </li>

              <li>
                <Waves />

                HRV

                <b>
                  45 ms
                </b>
              </li>

              <li>
                <MapPin />

                위치

                <b>
                  Campus
                </b>
              </li>

              <li>
                <Clock3 />

                기록

                <b>
                  사진 · 메모
                </b>
              </li>

            </ul>

          </div>

        </section>

        {/* =========================
            03 · RECONSTRUCT
        ========================= */}

        <section
          id="hiw-step-3"
          data-step="3"
          className={`hiw-step shell ${
            activeStep === 3
              ? "is-active"
              : ""
          }`}
        >

          <aside>

            <span>
              03 · RECONSTRUCT
            </span>

            <h2>
              신호와 맥락을 연결해
              이야기를 재구성합니다.
            </h2>

            <p>
              신호·주변 단서·상황
              정보를 결합해 그 순간을
              설명하는 하나의 이야기로
              정리합니다.
            </p>

          </aside>

          <div className="hiw-reconstruct">

            {[
              [
                BrainCircuit,
                "신호 분석",
                "생체 지표의 변화",
              ],

              [
                Search,
                "맥락 연결",
                "시간·위치·주변 단서",
              ],

              [
                Sparkles,
                "스토리 생성",
                "상황을 설명하는 문장",
              ],

              [
                Play,
                "재구성 완료",
                "다시 볼 이야기",
              ],
            ].map(
              (
                [
                  Icon,
                  title,
                  desc,
                ],
                index
              ) => {

                const IconComp =
                  Icon as typeof HeartPulse;

                return (
                  <article
                    key={
                      title as string
                    }
                  >

                    <IconComp />

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
            04 · REPLAY
        ========================= */}

        <section
          id="hiw-step-4"
          data-step="4"
          className={`hiw-step shell ${
            activeStep === 4
              ? "is-active"
              : ""
          }`}
        >

          <aside>

            <span>
              04 · REPLAY
            </span>

            <h2>
              기록된 순간을
              몰입형으로 다시
              경험합니다.
            </h2>

            <p>
              360° 장면과 기록된
              심박 기반 오디오,
              <br/> 지원 기기의 haptic
              반응으로 재구성된 순간을
              다시 만납니다.
            </p>

          </aside>

          {/* =====================
              SAMPLE VIDEO AREA
              추후 영상 연결 예정
          ===================== */}

          <div className="hiw-replay">

            <div className="hiw-replay-placeholder">

              <div className="hiw-replay-play">

                <Play size={28} />

              </div>

              <span>
                RECONSTRUCTED STORY
              </span>

              <strong>
                재구성된 이야기
              </strong>

              <p>
                완성된 샘플 영상이
                이곳에 표시됩니다.
              </p>

              <div className="hiw-replay-tags">

                <b>
                  360° scene
                </b>

                <b>
                  heartbeat audio
                </b>

                <b>
                  haptics
                </b>

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* =========================
          FOOTER
          Home과 동일 구조
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
              Samsung Life
              Lifenology Lab
            </span>

            <span>
              2026
            </span>

          </div>

        </div>

      </footer>

    </div>
  );
};

export default HowItWorks;