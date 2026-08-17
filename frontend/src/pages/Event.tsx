import "../styles/event.css";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  HeartPulse,
  MapPin,
  Sparkles,
  Activity,
  Image,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

type EventDetail = {
  time: string;
  signal: string;
  heartRate: string;
  stress: string;
  aiSummary: string;
  evidenceCount: number;
};

const eventDetails: Record<string, EventDetail> = {
  "interview-result": {
    time: "14:25",
    signal: "Stress Spike",
    heartRate: "112 bpm",
    stress: "High",
    aiSummary:
      "면접 결과를 확인하는 동안 긴장과 안도가 교차하며 심박이 크게 상승한 순간으로 탐지되었습니다.",
    evidenceCount: 3,
  },

  "first-concert": {
    time: "19:42",
    signal: "High Arousal",
    heartRate: "126 bpm",
    stress: "Excited",
    aiSummary:
      "공연이 시작된 직후 심박과 활동량이 빠르게 증가하며 강한 설렘과 몰입이 나타난 순간으로 추정됩니다.",
    evidenceCount: 4,
  },

  "mongolia-trip": {
    time: "16:18",
    signal: "Activity Peak",
    heartRate: "118 bpm",
    stress: "Positive",
    aiSummary:
      "승마 활동 중 움직임과 심박이 크게 증가했으며, 높은 활동성과 긍정적 각성이 동시에 나타난 순간으로 탐지되었습니다.",
    evidenceCount: 5,
  },

  "favorite-movie": {
    time: "20:31",
    signal: "Emotional Shift",
    heartRate: "82 bpm",
    stress: "Stable",
    aiSummary:
      "영화의 특정 장면을 중심으로 심박 변화는 크지 않았지만 감정 상태의 미세한 변화가 지속적으로 나타났습니다.",
    evidenceCount: 2,
  },
};

const Event = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    ageLabel = "20대",

    momentId = "interview-result",

    momentTitle = "면접 결과 확인",

    momentSubtitle =
      "긴장과 몰입이 가장 높았던 순간",

    momentDescription =
      "면접 결과를 확인하며 긴장과 안도가 교차했던 순간을 다시 살펴봅니다.",

    /* Moment 카드용 월 단위 */
    momentDate = "2026.04",

    /* Event 상세용 정확한 날짜 */
    momentExactDate,

    momentLocation = "Campus",

    demoSource = "student",

    eventId = "event_001",
  } = location.state || {};

  const detail =
    eventDetails[momentId] ??
    eventDetails["interview-result"];

  /*
    정확한 날짜가 있으면 exactDate 사용
    없으면 월 단위 date 사용
  */
  const displayDate =
    momentExactDate || momentDate;

  const handleReconstruction = () => {
    navigate("/reconstruction", {
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

        eventTime: detail.time,

        eventSignal: detail.signal,

        eventHeartRate: detail.heartRate,

        eventStress: detail.stress,

        eventSummary: detail.aiSummary,

        evidenceCount:
          detail.evidenceCount,
      },
    });
  };

  return (
    <div className="vivia-event-page">

      {/* =====================
          BACK
      ===================== */}

      <button
        className="vivia-event-back"
        onClick={() => navigate("/moment")}
        aria-label="기록 목록으로 돌아가기"
      >
        <ArrowLeft size={20} />
      </button>

      <main className="vivia-event-container">

        {/* =====================
            HEADER
        ===================== */}

        <header className="vivia-event-header">

          <span className="vivia-event-eyebrow">
            VIVIA · SELECTED MEMORY
          </span>

          <h1>
            {momentTitle}
          </h1>

          <p>
            {momentSubtitle}
          </p>

        </header>

        {/* =====================
            MAIN CARD
        ===================== */}

        <section className="vivia-event-card">

          {/* TOP */}

          <div className="vivia-event-card-top">

            <div>

              <span className="vivia-event-date">
                {displayDate}
              </span>

              <h2>
                그날의 기록을 찾았습니다.
              </h2>

              <p>
                {momentDescription}
              </p>

            </div>

            <div className="vivia-event-match-badge">

              <Sparkles size={17} />

              AI MATCH

            </div>

          </div>

          {/* =====================
              BASIC INFO
          ===================== */}

          <div className="vivia-event-info-grid">

            {/* DATE */}

            <div className="vivia-event-info-item">

              <div className="vivia-event-info-icon blue">

                <CalendarDays size={20} />

              </div>

              <div>

                <span>
                  Date
                </span>

                <strong>
                  {displayDate}
                </strong>

              </div>

            </div>

            {/* TIME */}

            <div className="vivia-event-info-item">

              <div className="vivia-event-info-icon orange">

                <Clock3 size={20} />

              </div>

              <div>

                <span>
                  Time
                </span>

                <strong>
                  {detail.time}
                </strong>

              </div>

            </div>

            {/* HEART RATE */}

            <div className="vivia-event-info-item">

              <div className="vivia-event-info-icon blue">

                <HeartPulse size={20} />

              </div>

              <div>

                <span>
                  Heart Rate
                </span>

                <strong>
                  {detail.heartRate}
                </strong>

              </div>

            </div>

            {/* LOCATION */}

            <div className="vivia-event-info-item">

              <div className="vivia-event-info-icon orange">

                <MapPin size={20} />

              </div>

              <div>

                <span>
                  Location
                </span>

                <strong>
                  {momentLocation}
                </strong>

              </div>

            </div>

          </div>

          {/* =====================
              SIGNAL INFO
          ===================== */}

          <div className="vivia-event-signal-row">

            <div className="vivia-event-signal-card">

              <Activity size={21} />

              <div>

                <span>
                  Detected Signal
                </span>

                <strong>
                  {detail.signal}
                </strong>

              </div>

            </div>

            <div className="vivia-event-signal-card">

              <HeartPulse size={21} />

              <div>

                <span>
                  State
                </span>

                <strong>
                  {detail.stress}
                </strong>

              </div>

            </div>

            <div className="vivia-event-signal-card">

              <Image size={21} />

              <div>

                <span>
                  Evidence
                </span>

                <strong>
                  {detail.evidenceCount} records
                </strong>

              </div>

            </div>

          </div>

          {/* =====================
              AI SUMMARY
          ===================== */}

          <div className="vivia-event-summary">

            <div className="vivia-event-summary-icon">

              <Sparkles size={22} />

            </div>

            <div>

              <span>
                AI SUMMARY
              </span>

              <p>
                {detail.aiSummary}
              </p>

            </div>

          </div>

          {/* =====================
              RECONSTRUCTION CTA
          ===================== */}

          <button
            className="vivia-event-primary"
            onClick={handleReconstruction}
          >

            이 순간 재구성하기

            <ArrowRight size={19} />

          </button>

        </section>

      </main>

    </div>
  );
};

export default Event;