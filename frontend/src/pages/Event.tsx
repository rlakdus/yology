import "../styles/event.css";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  HeartPulse,
  MapPin,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

const Event = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    momentTitle = "중요한 시험",
    momentDescription = "긴장과 집중이 가장 높았던 시험 전후의 순간",
    demoSource = "student",
    eventId = "event_001",
    ageLabel = "20대",
  } = location.state || {};

  const handleReconstruction = () => {
    navigate("/reconstruction", {
      state: {
        momentTitle,
        momentDescription,
        demoSource,
        eventId,
        ageLabel,
      },
    });
  };

  return (
    <div className="event-page">

      <button
        className="event-back"
        onClick={() => navigate("/moment")}
        aria-label="순간 선택으로 돌아가기"
      >
        <ArrowLeft size={20} />
      </button>

      <main className="event-container">

        <section className="event-hero">

          <span className="event-chip">
            SELECTED MOMENT
          </span>

          <h1>{momentTitle}</h1>

          <p>{momentDescription}</p>

        </section>

        <section className="event-preview-card">

          <div className="event-preview-top">

            <div>

              <span className="event-label">
                {ageLabel} · Reconstructed Memory
              </span>

              <h2>
                그날의 기록을 발견했습니다.
              </h2>

              <p>
                시간, 위치, 생체 신호와 주변 기록을 바탕으로
                해당 순간의 맥락을 다시 구성합니다.
              </p>

            </div>

            <div className="event-ai-badge">
              <Sparkles size={18} />
              AI Match
            </div>

          </div>

          <div className="event-info-grid">

            <div className="event-info-item">

              <div className="event-info-icon">
                <CalendarDays size={20} />
              </div>

              <div>
                <span>Date</span>
                <strong>2026.07.30</strong>
              </div>

            </div>

            <div className="event-info-item">

              <div className="event-info-icon">
                <Clock3 size={20} />
              </div>

              <div>
                <span>Time</span>
                <strong>14:25</strong>
              </div>

            </div>

            <div className="event-info-item">

              <div className="event-info-icon">
                <HeartPulse size={20} />
              </div>

              <div>
                <span>Signal</span>
                <strong>Stress Spike</strong>
              </div>

            </div>

            <div className="event-info-item">

              <div className="event-info-icon">
                <MapPin size={20} />
              </div>

              <div>
                <span>Context</span>
                <strong>Study Session</strong>
              </div>

            </div>

          </div>

          <div className="event-summary">

            <span>AI Summary</span>

            <p>
              시험을 앞둔 학습 상황에서 긴장과 집중도가 동시에 높아졌으며,
              생체 신호 변화가 뚜렷하게 나타난 순간으로 탐지되었습니다.
            </p>

          </div>

          <button
            className="event-primary-btn"
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