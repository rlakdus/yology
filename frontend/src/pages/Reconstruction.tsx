import "../styles/reconstruction.css";

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronRight,
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
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

type ReconstructionDetail = {
  category: string;
  icon: LucideIcon;

  confidence: number;

  interpretation: string;

  sensorItems: {
    label: string;
    value: string;
    icon: LucideIcon;
    accent: "blue" | "orange";
  }[];

  evidence: {
    type: string;
    title: string;
    description: string;
    icon: LucideIcon;
  }[];

  timeline: {
    time: string;
    title: string;
    description: string;
    accent: "blue" | "orange";
  }[];

  reasoning: {
    label: string;
    value: string;
  }[];

  result: string;
};

const reconstructionData: Record<
  string,
  ReconstructionDetail
> = {
  /* =========================
     시험 / 면접
  ========================= */

  "exam-interview": {
    category: "STUDY · HIGH FOCUS",
    icon: GraduationCap,

    confidence: 91,

    interpretation:
      "시험과 면접을 앞둔 상황에서 심박과 스트레스 지표가 동시에 증가했습니다. 일정 정보와 시간대, 생체 신호를 함께 분석했을 때 높은 긴장감과 집중이 공존했던 순간으로 추정됩니다.",

    sensorItems: [
      {
        label: "Heart Rate",
        value: "112 bpm",
        icon: HeartPulse,
        accent: "blue",
      },
      {
        label: "Stress",
        value: "High",
        icon: Activity,
        accent: "orange",
      },
      {
        label: "Time",
        value: "14:25",
        icon: Clock3,
        accent: "blue",
      },
      {
        label: "Context",
        value: "Campus",
        icon: MapPin,
        accent: "orange",
      },
    ],

    evidence: [
      {
        type: "Schedule",
        title: "시험 일정",
        description:
          "해당 시간대에 예정된 시험 및 일정 기록",
        icon: CalendarDays,
      },
      {
        type: "Sensor",
        title: "생체 신호 변화",
        description:
          "이벤트 전후 심박과 스트레스 상승 구간",
        icon: HeartPulse,
      },
      {
        type: "Message",
        title: "대화 기록",
        description:
          "시험 직전 상황을 확인할 수 있는 메시지 맥락",
        icon: MessageCircle,
      },
    ],

    timeline: [
      {
        time: "14:03",
        title: "집중 상태 시작",
        description:
          "시험 직전 학습 활동이 지속적으로 감지되었습니다.",
        accent: "blue",
      },
      {
        time: "14:12",
        title: "심박 상승",
        description:
          "평균 구간보다 높은 심박 변화가 나타났습니다.",
        accent: "orange",
      },
      {
        time: "14:20",
        title: "스트레스 증가",
        description:
          "심박과 활동 패턴을 기반으로 긴장도가 상승했습니다.",
        accent: "orange",
      },
      {
        time: "14:25",
        title: "이벤트 피크",
        description:
          "AI가 해당 시점을 핵심 기억 구간으로 탐지했습니다.",
        accent: "blue",
      },
    ],

    reasoning: [
      {
        label: "Signal",
        value: "Heart rate ↑",
      },
      {
        label: "Context",
        value: "Exam schedule",
      },
      {
        label: "State",
        value: "Stress high",
      },
      {
        label: "Inference",
        value: "Anxiety + Focus",
      },
    ],

    result:
      "높은 긴장감과 집중이 동시에 나타난 시험 직전의 순간",
  },

  /* =========================
     콘서트
  ========================= */

  "first-concert": {
    category: "MUSIC · HIGH AROUSAL",
    icon: Music,

    confidence: 94,

    interpretation:
      "공연이 시작된 직후 심박과 활동량이 빠르게 증가했습니다. 영상 기록과 주변 소리, 생체 신호를 종합했을 때 강한 설렘과 몰입이 나타난 순간으로 추정됩니다.",

    sensorItems: [
      {
        label: "Heart Rate",
        value: "126 bpm",
        icon: HeartPulse,
        accent: "blue",
      },
      {
        label: "Arousal",
        value: "High",
        icon: Activity,
        accent: "orange",
      },
      {
        label: "Time",
        value: "19:42",
        icon: Clock3,
        accent: "blue",
      },
      {
        label: "Location",
        value: "Seoul",
        icon: MapPin,
        accent: "orange",
      },
    ],

    evidence: [
      {
        type: "Video",
        title: "공연 영상",
        description:
          "무대와 관객의 움직임이 기록된 영상",
        icon: Video,
      },
      {
        type: "Sensor",
        title: "심박 변화",
        description:
          "공연 시작과 함께 급격히 상승한 심박 기록",
        icon: HeartPulse,
      },
      {
        type: "Media",
        title: "공연 사진",
        description:
          "해당 시간대 촬영된 현장 이미지",
        icon: Image,
      },
    ],

    timeline: [
      {
        time: "19:31",
        title: "공연장 입장",
        description:
          "위치와 움직임 기록을 통해 입장이 확인되었습니다.",
        accent: "blue",
      },
      {
        time: "19:38",
        title: "기대감 상승",
        description:
          "공연 시작 전 심박이 점차 증가했습니다.",
        accent: "orange",
      },
      {
        time: "19:42",
        title: "공연 시작",
        description:
          "심박과 활동량이 동시에 크게 상승했습니다.",
        accent: "orange",
      },
      {
        time: "19:46",
        title: "몰입 지속",
        description:
          "높은 각성 상태가 일정 시간 유지되었습니다.",
        accent: "blue",
      },
    ],

    reasoning: [
      {
        label: "Signal",
        value: "Heart rate ↑",
      },
      {
        label: "Media",
        value: "Concert video",
      },
      {
        label: "Activity",
        value: "Movement ↑",
      },
      {
        label: "Inference",
        value: "Excitement",
      },
    ],

    result:
      "음악과 현장 분위기에 강하게 몰입하며 설렘이 높아진 순간",
  },

  /* =========================
     몽골 여행
  ========================= */

  "mongolia-trip": {
    category: "TRAVEL · ACTIVE MEMORY",
    icon: Plane,

    confidence: 96,

    interpretation:
      "승마 영상과 높은 활동량, 심박 변화를 함께 분석했습니다. 넓은 야외 공간에서 지속적인 움직임과 긍정적 각성이 나타난 순간으로, 몰입형 재현에 적합한 기억으로 판단됩니다.",

    sensorItems: [
      {
        label: "Heart Rate",
        value: "118 bpm",
        icon: HeartPulse,
        accent: "blue",
      },
      {
        label: "Activity",
        value: "Peak",
        icon: Activity,
        accent: "orange",
      },
      {
        label: "Time",
        value: "16:18",
        icon: Clock3,
        accent: "blue",
      },
      {
        label: "Location",
        value: "Mongolia",
        icon: MapPin,
        accent: "orange",
      },
    ],

    evidence: [
      {
        type: "Video",
        title: "승마 영상",
        description:
          "초원에서 말을 타는 시점의 영상 기록",
        icon: Video,
      },
      {
        type: "Sensor",
        title: "활동량 기록",
        description:
          "승마 구간에서 크게 증가한 움직임 데이터",
        icon: Activity,
      },
      {
        type: "Media",
        title: "여행 이미지",
        description:
          "해당 시간대와 장소에서 촬영된 사진",
        icon: Image,
      },
    ],

    timeline: [
      {
        time: "16:02",
        title: "승마 시작",
        description:
          "움직임 패턴을 통해 승마 활동이 시작되었습니다.",
        accent: "blue",
      },
      {
        time: "16:10",
        title: "활동량 증가",
        description:
          "속도와 움직임이 증가하며 활동량이 높아졌습니다.",
        accent: "orange",
      },
      {
        time: "16:18",
        title: "활동 피크",
        description:
          "심박과 움직임이 동시에 가장 높은 구간에 도달했습니다.",
        accent: "orange",
      },
      {
        time: "16:25",
        title: "안정 구간",
        description:
          "활동 이후 생체 신호가 점차 안정되었습니다.",
        accent: "blue",
      },
    ],

    reasoning: [
      {
        label: "Media",
        value: "Riding video",
      },
      {
        label: "Signal",
        value: "Heart rate ↑",
      },
      {
        label: "Motion",
        value: "Activity peak",
      },
      {
        label: "Inference",
        value: "Joy + Freedom",
      },
    ],

    result:
      "넓은 초원을 달리며 강한 자유감과 활력을 느꼈던 순간",
  },

  /* =========================
     영화
  ========================= */

  "favorite-movie": {
    category: "CINEMA · EMOTIONAL MEMORY",
    icon: Film,

    confidence: 88,

    interpretation:
      "영화 관람 중 전체적인 생체 신호는 안정적이었지만 특정 구간에서 미세한 심박 변화가 반복적으로 나타났습니다. 관람 시간과 콘텐츠 맥락을 종합해 감정적 몰입이 있었던 순간으로 추정됩니다.",

    sensorItems: [
      {
        label: "Heart Rate",
        value: "82 bpm",
        icon: HeartPulse,
        accent: "blue",
      },
      {
        label: "State",
        value: "Stable",
        icon: Activity,
        accent: "orange",
      },
      {
        label: "Time",
        value: "20:31",
        icon: Clock3,
        accent: "blue",
      },
      {
        label: "Location",
        value: "Cinema",
        icon: MapPin,
        accent: "orange",
      },
    ],

    evidence: [
      {
        type: "Schedule",
        title: "영화 관람 기록",
        description:
          "상영 시간과 이벤트 시점이 일치하는 기록",
        icon: CalendarDays,
      },
      {
        type: "Sensor",
        title: "미세 심박 변화",
        description:
          "특정 장면 전후 반복적으로 나타난 생체 신호 변화",
        icon: HeartPulse,
      },
      {
        type: "Context",
        title: "콘텐츠 정보",
        description:
          "관람한 영화와 시간대를 기반으로 한 상황 맥락",
        icon: Film,
      },
    ],

    timeline: [
      {
        time: "20:05",
        title: "영화 시작",
        description:
          "관람 시간이 시작되며 안정적인 상태가 유지되었습니다.",
        accent: "blue",
      },
      {
        time: "20:24",
        title: "감정 변화 감지",
        description:
          "심박 패턴에서 작은 변화가 나타났습니다.",
        accent: "orange",
      },
      {
        time: "20:31",
        title: "몰입 구간",
        description:
          "반복적인 미세 변화가 나타난 핵심 구간입니다.",
        accent: "orange",
      },
      {
        time: "20:38",
        title: "안정 상태 복귀",
        description:
          "이후 심박이 다시 안정적인 범위로 돌아왔습니다.",
        accent: "blue",
      },
    ],

    reasoning: [
      {
        label: "Signal",
        value: "Subtle HR change",
      },
      {
        label: "Context",
        value: "Movie screening",
      },
      {
        label: "State",
        value: "Stable",
      },
      {
        label: "Inference",
        value: "Emotional focus",
      },
    ],

    result:
      "차분한 상태에서 특정 장면에 깊게 감정적으로 몰입한 순간",
  },
};

const Reconstruction = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showVrModal, setShowVrModal] =
    useState(false);

  const {
    momentId = "exam-interview",

    momentTitle = "시험·면접 직전후",

    momentSubtitle =
      "긴장과 몰입이 가장 높았던 순간",

    momentDescription =
      "시험과 면접을 앞두고 심박과 스트레스가 크게 변화했던 순간을 다시 살펴봅니다.",

    momentDate = "2026.04",

    momentExactDate,

    momentLocation = "Campus",

    eventTime,

    eventHeartRate,

    eventSignal,

    eventStress,

    eventSummary,

    evidenceCount,
  } = location.state || {};

  const detail =
    reconstructionData[momentId] ??
    reconstructionData["exam-interview"];

  const displayDate =
    momentExactDate ||
    momentDate;

  const MomentIcon = detail.icon;

  return (
    <div className="vivia-reconstruction-page">

      {/* =========================
          BACK
      ========================= */}

      <button
        className="vivia-reconstruction-back"
        onClick={() => navigate(-1)}
        aria-label="이전 화면으로 돌아가기"
      >
        <ArrowLeft size={20} />
      </button>

      <main className="vivia-reconstruction-container">

        {/* =========================
            HEADER
        ========================= */}

        <header className="vivia-reconstruction-header">

          <span className="vivia-reconstruction-eyebrow">
            <Sparkles size={14} />
            VIVIA · AI RECONSTRUCTION
          </span>

          <h1>
            그 순간을
            <br />
            다시 구성했습니다.
          </h1>

          <p>
            몸의 신호와 주변의 기록을 연결해
            <br />
            당시의 맥락과 감정 변화를 복원했습니다.
          </p>

        </header>

        {/* =========================
            MOMENT HERO
        ========================= */}

        <section className="vivia-reconstruction-hero">

          <div className="vivia-reconstruction-hero-glow blue" />
          <div className="vivia-reconstruction-hero-glow orange" />

          <div className="vivia-reconstruction-hero-top">

            <div className="vivia-reconstruction-main-icon">
              <MomentIcon size={31} />
            </div>

            <span className="vivia-reconstruction-category">
              {detail.category}
            </span>

          </div>

          <div className="vivia-reconstruction-hero-content">

            <span className="vivia-reconstruction-date">
              {displayDate}
            </span>

            <h2>
              {momentTitle}
            </h2>

            <strong>
              {momentSubtitle}
            </strong>

            <p>
              {momentDescription}
            </p>

          </div>

          <div className="vivia-reconstruction-hero-meta">

            <div>
              <CalendarDays size={17} />
              {displayDate}
            </div>

            <div>
              <Clock3 size={17} />
              {eventTime ??
                detail.sensorItems[2].value}
            </div>

            <div>
              <MapPin size={17} />
              {momentLocation}
            </div>

          </div>

        </section>

        {/* =========================
            OVERVIEW
        ========================= */}

        <section className="vivia-reconstruction-section">

          <div className="vivia-reconstruction-section-head">

            <div>
              <span>01 · SIGNAL</span>

              <h2>
                몸에 남은 신호
              </h2>
            </div>

            <p>
              선택된 순간 전후의 생체 데이터와
              시간적 맥락입니다.
            </p>

          </div>

          <div className="vivia-reconstruction-sensor-grid">

            {detail.sensorItems.map(
              (item) => {

                const Icon = item.icon;

                return (
                  <div
                    className="vivia-reconstruction-sensor-card"
                    key={item.label}
                  >

                    <div
                      className={`vivia-reconstruction-sensor-icon ${item.accent}`}
                    >
                      <Icon size={22} />
                    </div>

                    <span>
                      {item.label}
                    </span>

                    <strong>
                      {item.label ===
                      "Heart Rate"
                        ? eventHeartRate ??
                          item.value
                        : item.value}
                    </strong>

                  </div>
                );
              }
            )}

          </div>

        </section>

        {/* =========================
            EVIDENCE
        ========================= */}

        <section className="vivia-reconstruction-section">

          <div className="vivia-reconstruction-section-head">

            <div>
              <span>02 · EVIDENCE</span>

              <h2>
                순간을 설명하는 기록
              </h2>
            </div>

            <p>
              생체 신호만으로 알 수 없는
              당시의 상황을 주변 기록으로 보완합니다.
            </p>

          </div>

          <div className="vivia-reconstruction-evidence-grid">

            {detail.evidence.map(
              (item) => {

                const Icon = item.icon;

                return (
                  <div
                    className="vivia-reconstruction-evidence-card"
                    key={item.title}
                  >

                    <div className="vivia-reconstruction-evidence-icon">
                      <Icon size={23} />
                    </div>

                    <span>
                      {item.type}
                    </span>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.description}
                    </p>

                    <div className="vivia-reconstruction-evidence-footer">

                      Evidence

                      <ChevronRight size={16} />

                    </div>

                  </div>
                );
              }
            )}

          </div>

          <div className="vivia-reconstruction-evidence-count">

            <Image size={17} />

            현재 데모에서{" "}
            <strong>
              {evidenceCount ??
                detail.evidence.length}
            </strong>
            개의 기록을 재구성 근거로 사용했습니다.

          </div>

        </section>

        {/* =========================
            TIMELINE
        ========================= */}

        <section className="vivia-reconstruction-section">

          <div className="vivia-reconstruction-section-head">

            <div>
              <span>03 · TIMELINE</span>

              <h2>
                그 순간까지의 흐름
              </h2>
            </div>

            <p>
              여러 데이터의 변화를 시간 순서대로
              하나의 사건으로 연결했습니다.
            </p>

          </div>

          <div className="vivia-reconstruction-timeline">

            {detail.timeline.map(
              (item, index) => (

                <div
                  className="vivia-reconstruction-timeline-item"
                  key={`${item.time}-${item.title}`}
                >

                  <div className="vivia-reconstruction-time">

                    {item.time}

                  </div>

                  <div className="vivia-reconstruction-timeline-axis">

                    <span
                      className={item.accent}
                    />

                    {index <
                      detail.timeline.length -
                        1 && <i />}

                  </div>

                  <div className="vivia-reconstruction-timeline-content">

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.description}
                    </p>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* =========================
            AI REASONING
        ========================= */}

        <section className="vivia-reconstruction-section">

          <div className="vivia-reconstruction-section-head">

            <div>
              <span>04 · AI REASONING</span>

              <h2>
                VIVIA가 기억을 이해한 과정
              </h2>
            </div>

            <p>
              서로 다른 데이터를 연결해
              당시의 감정과 상황을 추론합니다.
            </p>

          </div>

          <div className="vivia-reconstruction-reasoning">

            {detail.reasoning.map(
              (item, index) => (

                <div
                  className="vivia-reconstruction-reasoning-step"
                  key={item.label}
                >

                  <span className="vivia-reconstruction-reasoning-number">
                    0{index + 1}
                  </span>

                  <small>
                    {item.label}
                  </small>

                  <strong>
                    {item.value}
                  </strong>

                  {index <
                    detail.reasoning.length -
                      1 && (
                    <ArrowRight
                      size={18}
                      className="vivia-reconstruction-reasoning-arrow"
                    />
                  )}

                </div>
              )
            )}

          </div>

        </section>

        {/* =========================
            RESULT
        ========================= */}

        <section className="vivia-reconstruction-result">

          <div className="vivia-reconstruction-result-icon">
            <Brain size={27} />
          </div>

          <div className="vivia-reconstruction-result-content">

            <span>
              VIVIA · RECONSTRUCTED MEMORY
            </span>

            <h2>
              AI는 이 순간을
              <br />
              이렇게 해석했습니다.
            </h2>

            <p>
              {eventSummary ??
                detail.interpretation}
            </p>

            <div className="vivia-reconstruction-result-highlight">

              <Sparkles size={18} />

              <strong>
                {detail.result}
              </strong>

            </div>

            <div className="vivia-reconstruction-confidence">

              <div>

                <span>
                  Reconstruction Confidence
                </span>

                <strong>
                  {detail.confidence}%
                </strong>

              </div>

              <div className="vivia-reconstruction-confidence-track">

                <span
                  style={{
                    width: `${detail.confidence}%`,
                  }}
                />

              </div>

            </div>

          </div>

        </section>

        {/* =========================
            VR CTA
        ========================= */}

        <section className="vivia-reconstruction-vr">

          <div className="vivia-reconstruction-vr-glow" />

          <div className="vivia-reconstruction-vr-content">

            <div className="vivia-reconstruction-vr-icon">
              <Glasses size={32} />
            </div>

            <span>
              NEXT · IMMERSIVE REPLAY
            </span>

            <h2>
              이제 이 순간을
              <br />
              다시 경험해보세요.
            </h2>

            <p>
              재구성된 공간과 몸의 신호를
              몰입형 환경으로 확장합니다.
            </p>

            <button
              className="vivia-reconstruction-vr-button"
              onClick={() =>
                setShowVrModal(true)
              }
            >
              <Glasses size={20} />

              VR 재현 시작하기

              <ArrowRight size={18} />
            </button>

            <small>
              VR Reconstruction · Prototype
            </small>

          </div>

        </section>

      </main>

      {/* =========================
          VR MODAL
      ========================= */}

      {showVrModal && (

        <div
          className="vivia-reconstruction-modal-overlay"
          onClick={() =>
            setShowVrModal(false)
          }
        >

          <div
            className="vivia-reconstruction-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              className="vivia-reconstruction-modal-close"
              onClick={() =>
                setShowVrModal(false)
              }
            >
              <X size={18} />
            </button>

            <div className="vivia-reconstruction-modal-icon">
              <Glasses size={30} />
            </div>

            <span>
              VIVIA · VR RECONSTRUCTION
            </span>

            <h2>
              몰입형 재현을
              <br />
              준비하고 있습니다.
            </h2>

            <p>
              현재 VR Reconstruction 모듈을
              연결하는 중입니다.
              완성 후 이 버튼에서 바로
              재현 경험으로 이어집니다.
            </p>

            <button
              onClick={() =>
                setShowVrModal(false)
              }
            >
              확인
            </button>

          </div>

        </div>

      )}

    </div>
  );
};

export default Reconstruction;