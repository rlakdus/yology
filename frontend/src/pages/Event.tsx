import "../styles/event.css";

import { useLocation, useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Film,
  Glasses,
  GraduationCap,
  HeartPulse,
  Image,
  MapPin,
  MessageCircle,
  Music,
  Plane,
  Sparkles,
  Ticket,
  Video,
  type LucideIcon,
} from "lucide-react";

import SiteNav from "../components/SiteNav";


type Accent =
  | "aqua"
  | "orange"
  | "blue"
  | "lavender";


type EventDetail = {
  category: string;

  icon: LucideIcon;

  time: string;

  heartRate: string;

  signal: string;

  state: string;

  confidence: number;

  summary: string;

  insight: string;

  context: {
    title: string;
    description: string;
    icon: LucideIcon;
    accent: Accent;
  }[];
};


const eventDetails: Record<
  string,
  EventDetail
> = {

  /* ========================================
     01 · 시험 / 면접
  ======================================== */

  "exam-interview": {
    category:
      "STUDY · HIGH FOCUS",

    icon: GraduationCap,

    time: "14:25",

    heartRate: "112 bpm",

    signal: "Stress Spike",

    state: "High Focus",

    confidence: 91,

    summary:
      "시험과 면접을 앞두고 긴장도가 높아지며 심박과 스트레스 신호가 동시에 상승한 순간으로 탐지되었습니다.",

    insight:
      "평소보다 높은 심박과 긴장 상태가 이어졌고, 시간과 장소의 맥락을 함께 분석했을 때 시험 또는 면접 직전의 높은 집중 상태로 판단되었습니다.",

    context: [
      {
        title: "시험 일정",
        description:
          "해당 시간대에 등록된 학업 일정과 감지 시점이 일치합니다.",

        icon: CalendarDays,

        accent: "blue",
      },

      {
        title: "대화 기록",
        description:
          "시험 직전의 상황을 확인할 수 있는 메시지 맥락이 존재합니다.",

        icon: MessageCircle,

        accent: "orange",
      },

      {
        title: "생체 변화",
        description:
          "이벤트 직전 심박과 스트레스 지표가 함께 상승했습니다.",

        icon: HeartPulse,

        accent: "aqua",
      },
    ],
  },


  /* ========================================
     02 · 첫 콘서트
  ======================================== */

  "first-concert": {
    category:
      "MUSIC · HIGH AROUSAL",

    icon: Music,

    time: "19:42",

    heartRate: "126 bpm",

    signal: "Arousal Peak",

    state: "Excited",

    confidence: 94,

    summary:
      "공연이 시작된 직후 심박과 활동량이 빠르게 증가하며 강한 설렘과 몰입이 나타난 순간으로 탐지되었습니다.",

    insight:
      "공연 기록과 시간 정보, 생체 신호를 연결했을 때 공연 시작과 함께 신체적 각성이 빠르게 증가하고 높은 몰입 상태가 유지된 순간으로 해석됩니다.",

    context: [
      {
        title: "공연 영상",
        description:
          "해당 시간대에 직접 촬영된 공연 영상 기록이 존재합니다.",

        icon: Video,

        accent: "orange",
      },

      {
        title: "공연 일정",
        description:
          "공연 시간과 생체 신호가 변화한 시점이 일치합니다.",

        icon: Ticket,

        accent: "blue",
      },

      {
        title: "활동량 변화",
        description:
          "공연 시작 이후 움직임과 심박이 동시에 증가했습니다.",

        icon: Activity,

        accent: "aqua",
      },
    ],
  },


  /* ========================================
     03 · 몽골 여행
  ======================================== */

  "mongolia-trip": {
    category:
      "TRAVEL · ACTIVE MEMORY",

    icon: Plane,

    time: "16:18",

    heartRate: "118 bpm",

    signal: "Activity Peak",

    state: "Positive",

    confidence: 96,

    summary:
      "승마 활동 중 움직임과 심박이 크게 증가했으며 높은 활동성과 긍정적 각성이 함께 나타난 순간으로 탐지되었습니다.",

    insight:
      "승마 영상과 활동 데이터가 같은 시간대에 나타났습니다. 지속적인 움직임과 심박 증가를 기반으로 강한 활력과 몰입이 있었던 순간으로 재구성할 수 있습니다.",

    context: [
      {
        title: "승마 영상",
        description:
          "초원에서 말을 타던 순간의 실제 영상 기록이 존재합니다.",

        icon: Video,

        accent: "orange",
      },

      {
        title: "여행 이미지",
        description:
          "같은 장소와 시간대에 촬영된 여행 이미지가 확인되었습니다.",

        icon: Image,

        accent: "blue",
      },

      {
        title: "활동량 기록",
        description:
          "승마 구간에서 움직임 데이터가 뚜렷하게 증가했습니다.",

        icon: Activity,

        accent: "aqua",
      },
    ],
  },


  /* ========================================
     04 · 영화 관람
  ======================================== */

  "favorite-movie": {
    category:
      "CINEMA · EMOTIONAL MEMORY",

    icon: Film,

    time: "20:31",

    heartRate: "82 bpm",

    signal: "Emotional Shift",

    state: "Immersed",

    confidence: 88,

    summary:
      "영화 관람 중 전체 생체 상태는 비교적 안정적이었지만 특정 구간에서 반복적인 심박 변화가 나타나 감정적 몰입 순간으로 탐지되었습니다.",

    insight:
      "큰 활동 변화는 없었지만 특정 시간대에서 미세한 심박 변화가 반복되었습니다. 관람 기록과 시간 정보를 연결해 특정 장면에 깊게 몰입한 순간으로 추정했습니다.",

    context: [
      {
        title: "관람 기록",
        description:
          "영화 상영 시간과 감지 이벤트가 같은 시간대에 존재합니다.",

        icon: Ticket,

        accent: "orange",
      },

      {
        title: "시간 맥락",
        description:
          "관람 시작 이후 특정 구간에서 반복적인 신호 변화가 나타났습니다.",

        icon: Clock3,

        accent: "blue",
      },

      {
        title: "감정 변화",
        description:
          "안정 상태 안에서 미세한 심박 변화가 지속되었습니다.",

        icon: HeartPulse,

        accent: "lavender",
      },
    ],
  },
};


const Event = () => {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  /* ========================================
     DATA FROM MY MOMENTS
  ======================================== */

  const {
    ageLabel = "20대",

    momentId =
    "exam-interview",

    momentTitle =
    "시험·면접 직전후",

    momentSubtitle =
    "긴장과 몰입이 가장 높았던 순간",

    momentDescription =
    "시험과 면접을 앞두고 심박과 스트레스가 크게 변화했던 순간을 다시 살펴봅니다.",

    momentDate =
    "2026.04",

    momentExactDate,

    momentLocation =
    "Campus",

    demoSource =
    "student",

    eventId =
    "event_001",
  } = location.state || {};


  const detail =
    eventDetails[momentId] ??
    eventDetails[
    "exam-interview"
    ];


  const EventIcon =
    detail.icon;


  const displayDate =
    momentExactDate ||
    momentDate;


  /* ========================================
     RECONSTRUCTION
  ======================================== */

  const openReconstruction =
    () => {
      navigate(
        "/reconstruction",
        {
          state: {
            ageLabel,

            momentId,

            momentTitle,

            momentSubtitle,

            momentDescription,

            momentDate,

            momentExactDate,

            momentLocation,

            demoSource,

            eventId,

            eventTime:
              detail.time,

            eventHeartRate:
              detail.heartRate,

            eventSignal:
              detail.signal,

            eventStress:
              detail.state,

            eventSummary:
              detail.summary,

            reconstructionConfidence:
              detail.confidence,
          },
        }
      );
    };


  /* ========================================
     VR
  ======================================== */

  const openVr = () => {
    navigate(
      `/vr/${demoSource}/${eventId}`
    );
  };


  return (
    <div className="vivia-event-page">

      {/* ========================================
          GLOBAL NAV
      ======================================== */}

      <SiteNav />


      <main className="vivia-event-shell">

        {/* ========================================
            BACK
        ======================================== */}

        <button
          className="vivia-event-back"
          onClick={() =>
            navigate("/moment")
          }
          aria-label="My Moments로 돌아가기"
        >
          <ArrowLeft size={18} />
        </button>


        {/* ========================================
            HERO
        ======================================== */}

        <section className="vivia-event-hero">

          <div className="vivia-event-hero-copy">

            <span className="vivia-event-eyebrow">

              VIVIA · SELECTED MOMENT

            </span>


            <div className="vivia-event-category">

              <EventIcon size={18} />

              {detail.category}

            </div>


            <h1>

              {momentTitle}

            </h1>


            <h2>

              {momentSubtitle}

            </h2>


            <p>

              {momentDescription}

            </p>


            {/* =====================
                META
            ===================== */}

            <div className="vivia-event-meta">

              <span>

                <CalendarDays
                  size={15}
                />

                {displayDate}

              </span>


              <span>

                <Clock3
                  size={15}
                />

                {detail.time}

              </span>


              <span>

                <MapPin
                  size={15}
                />

                {momentLocation}

              </span>


              <span>

                <HeartPulse
                  size={15}
                />

                {detail.heartRate}

              </span>

            </div>


            {/* =====================
                MAIN ACTIONS
            ===================== */}

            <div className="vivia-event-actions">

              <button
                className="vivia-event-vr-button"
                onClick={openVr}
              >

                <Glasses size={19} />

                VR로 이 순간 재현하기

                <ArrowRight size={17} />

              </button>


              <button
                className="vivia-event-reconstruction-button"
                onClick={
                  openReconstruction
                }
              >

                <BrainCircuit
                  size={18}
                />

                AI 재구성 보기

              </button>

            </div>

          </div>


          {/* ========================================
              HERO VISUAL
          ======================================== */}

          <div className="vivia-event-hero-visual">

            <div className="vivia-event-orbit orbit-one" />

            <div className="vivia-event-orbit orbit-two" />


            <div className="vivia-event-core">

              <EventIcon
                size={38}
              />

            </div>


            <span className="vivia-event-chip chip-signal">

              Signal

            </span>


            <span className="vivia-event-chip chip-context">

              Context

            </span>


            <span className="vivia-event-chip chip-memory">

              Memory

            </span>

          </div>

        </section>


        {/* ========================================
            01 · SIGNAL
        ======================================== */}

        <section className="vivia-event-section">

          <div className="vivia-event-section-heading">

            <div>

              <span>

                01 · SIGNAL

              </span>

              <h2>

                몸에 남은 변화

              </h2>

            </div>


            <p>

              선택된 순간 전후에서
              평소와 다른 생체 신호가
              감지되었습니다.

            </p>

          </div>


          <div className="vivia-event-signal-grid">

            <article>

              <div className="signal-icon aqua">

                <HeartPulse
                  size={23}
                />

              </div>

              <span>
                Heart Rate
              </span>

              <strong>

                {detail.heartRate}

              </strong>

            </article>


            <article>

              <div className="signal-icon orange">

                <Activity
                  size={23}
                />

              </div>

              <span>
                Detected Signal
              </span>

              <strong>

                {detail.signal}

              </strong>

            </article>


            <article>

              <div className="signal-icon lavender">

                <Sparkles
                  size={23}
                />

              </div>

              <span>
                State
              </span>

              <strong>

                {detail.state}

              </strong>

            </article>

          </div>

        </section>


        {/* ========================================
            02 · CONTEXT
        ======================================== */}

        <section className="vivia-event-section">

          <div className="vivia-event-section-heading">

            <div>

              <span>

                02 · CONTEXT

              </span>

              <h2>

                이 순간을 설명하는 기록

              </h2>

            </div>


            <p>

              생체 신호만으로 알 수 없는
              당시의 상황을 주변 기록과
              연결했습니다.

            </p>

          </div>


          <div className="vivia-event-context-grid">

            {detail.context.map(
              (
                item,
                index
              ) => {

                const Icon =
                  item.icon;

                return (
                  <article
                    key={
                      item.title
                    }
                  >

                    <span className="context-number">

                      0{index + 1}

                    </span>


                    <div
                      className={`context-icon ${item.accent}`}
                    >

                      <Icon
                        size={23}
                      />

                    </div>


                    <h3>

                      {item.title}

                    </h3>


                    <p>

                      {
                        item.description
                      }

                    </p>

                  </article>
                );
              }
            )}

          </div>

        </section>


        {/* ========================================
            03 · VIVIA INSIGHT
        ======================================== */}

        <section className="vivia-event-insight">

          <div className="vivia-event-insight-icon">

            <BrainCircuit
              size={27}
            />

          </div>


          <div className="vivia-event-insight-content">

            <span>

              03 · VIVIA INSIGHT

            </span>


            <h2>

              신호와 맥락이
              <br />

              하나의 순간으로
              연결되었습니다.

            </h2>


            <p>

              {detail.insight}

            </p>


            <div className="vivia-event-summary">

              <Sparkles
                size={18}
              />

              <p>

                {detail.summary}

              </p>

            </div>


            <div className="vivia-event-confidence">

              <div>

                <span>

                  Reconstruction
                  Confidence

                </span>

                <strong>

                  {detail.confidence}%

                </strong>

              </div>


              <div className="vivia-event-confidence-track">

                <span
                  style={{
                    width:
                      `${detail.confidence}%`,
                  }}
                />

              </div>

            </div>

          </div>

        </section>

      </main>


      {/* ========================================
          FOOTER
      ======================================== */}

      <footer className="vivia-event-footer">

        <div className="vivia-event-footer-inner">

          <div className="vivia-event-footer-brand">

            <img
              src="/assets/logo.png"
              alt="VIVIA"
            />

            <p>

              몸의 신호가
              삶의 이야기가 됩니다.

            </p>

          </div>


          <div className="vivia-event-footer-team">

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

export default Event;