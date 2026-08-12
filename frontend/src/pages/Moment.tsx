import "../styles/moment.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Heart,
  House,
  Music,
  Plane,
  Presentation,
  Sparkles,
  Stethoscope,
  UsersRound,
  Film,
  type LucideIcon,
} from "lucide-react";

type AgeGroup = "20s" | "30s" | "40s";

type MomentItem = {
  id: string;
  date?: string;
  title: string;
  subtitle: string;
  description: string;
  location?: string;
  icon: LucideIcon;
  available: boolean;
  demoSource?: string;
  eventId?: string;
};

const ageLabels: Record<AgeGroup, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
};

const momentData: Record<AgeGroup, MomentItem[]> = {
  /* =========================
     20대
     2026 실제 수집 기록
  ========================= */

  "20s": [
    {
      id: "exam-interview",
      date: "2026.04",
      title: "시험·면접 직전후",
      subtitle: "긴장과 몰입이 가장 높았던 순간",
      description:
        "시험과 면접을 앞두고 심박과 스트레스가 크게 변화했던 순간을 다시 살펴봅니다.",
      location: "Campus",
      icon: GraduationCap,
      available: true,
      demoSource: "student",
      eventId: "event_001",
    },

    {
      id: "first-concert",
      date: "2026.05",
      title: "대학 입학 후 첫 콘서트",
      subtitle: "처음 마주한 공연장의 열기",
      description:
        "좋아하는 음악과 사람들 사이에서 설렘과 몰입이 높아졌던 순간을 다시 떠올립니다.",
      location: "Seoul",
      icon: Music,
      available: true,
      demoSource: "student",
      eventId: "event_002",
    },

    {
      id: "mongolia-trip",
      date: "2026.07",
      title: "몽골 여행",
      subtitle: "초원을 달리던 여름",
      description:
        "끝없이 펼쳐진 초원에서 말을 타며 느꼈던 자유와 설렘을 몸의 신호와 함께 다시 경험합니다.",
      location: "Mongolia",
      icon: Plane,
      available: true,
      demoSource: "student",
      eventId: "event_003",
    },

    {
      id: "favorite-movie",
      date: "2026.08",
      title: "좋아하는 영화 관람",
      subtitle: "오래 기억하고 싶은 한 장면",
      description:
        "영화를 보며 느꼈던 몰입과 감정의 변화를 몸의 신호와 함께 다시 꺼내봅니다.",
      location: "Cinema",
      icon: Film,
      available: true,
      demoSource: "student",
      eventId: "event_004",
    },
  ],

  /* =========================
     30대
     Future Archive
  ========================= */

  "30s": [
    {
      id: "important-work",
      title: "중요한 업무",
      subtitle: "커리어의 중요한 전환점",
      description:
        "중요한 미팅이나 발표처럼 오래 기억에 남을 업무 순간입니다.",
      icon: Presentation,
      available: false,
    },

    {
      id: "first-home",
      title: "첫 집",
      subtitle: "새로운 삶의 공간",
      description:
        "처음 나만의 공간을 마련하며 느꼈던 감정을 기록합니다.",
      icon: House,
      available: false,
    },

    {
      id: "old-friends",
      title: "오랜만의 친구 모임",
      subtitle: "시간을 넘어 다시 만난 사람들",
      description:
        "오랜만에 만난 친구들과 다시 추억을 나누었던 순간입니다.",
      icon: UsersRound,
      available: false,
    },

    {
      id: "special-memory",
      title: "잊고 싶지 않은 기억",
      subtitle: "시간이 지나도 남는 순간",
      description:
        "나에게 특별했던 기억을 다시 꺼내볼 수 있습니다.",
      icon: Sparkles,
      available: false,
    },
  ],

  /* =========================
     40대
     Future Archive
  ========================= */

  "40s": [
    {
      id: "health-check",
      title: "건강을 확인한 날",
      subtitle: "결과를 기다리던 시간",
      description:
        "건강검진 결과를 기다리며 여러 생각이 스쳤던 순간입니다.",
      icon: Stethoscope,
      available: false,
    },

    {
      id: "parents",
      title: "부모님과의 순간",
      subtitle: "시간이 지날수록 소중해지는 기억",
      description:
        "부모님과 함께한 평범하지만 오래 남는 순간을 기록합니다.",
      icon: Heart,
      available: false,
    },

    {
      id: "family-trip",
      title: "가족과의 여행",
      subtitle: "함께해서 더 특별했던 시간",
      description:
        "가족과 함께한 여행의 분위기와 감정을 다시 경험합니다.",
      icon: Plane,
      available: false,
    },

    {
      id: "child-milestone",
      title: "가족의 새로운 시작",
      subtitle: "삶의 또 다른 전환점",
      description:
        "입학이나 졸업처럼 가족 모두에게 의미가 컸던 순간입니다.",
      icon: GraduationCap,
      available: false,
    },
  ],
};

const Moment = () => {
  const navigate = useNavigate();

  const [selectedAge, setSelectedAge] =
    useState<AgeGroup>("20s");

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [showComingSoon, setShowComingSoon] =
    useState(false);

  const moments = momentData[selectedAge];

  const activeMoment = moments[activeIndex];

  const previousMoment =
    activeIndex > 0
      ? moments[activeIndex - 1]
      : null;

  const nextMoment =
    activeIndex < moments.length - 1
      ? moments[activeIndex + 1]
      : null;

  /* =========================
     CAROUSEL
  ========================= */

  const goPrevious = () => {
    setActiveIndex((current) =>
      Math.max(current - 1, 0)
    );
  };

  const goNext = () => {
    setActiveIndex((current) =>
      Math.min(
        current + 1,
        moments.length - 1
      )
    );
  };

  /* =========================
     AGE CHANGE
  ========================= */

  const changeAge = (age: AgeGroup) => {
    setSelectedAge(age);
    setActiveIndex(0);
    setShowComingSoon(false);
  };

  /* =========================
     MOMENT SELECT
  ========================= */

  const handleMomentClick = (
    moment: MomentItem
  ) => {
    if (!moment.available) {
      setShowComingSoon(true);
      return;
    }

    navigate("/event", {
      state: {
        ageGroup: selectedAge,
        ageLabel: ageLabels[selectedAge],

        momentId: moment.id,
        momentTitle: moment.title,
        momentSubtitle: moment.subtitle,
        momentDescription:
          moment.description,

        momentDate: moment.date,
        momentLocation: moment.location,

        demoSource: moment.demoSource,
        eventId: moment.eventId,
      },
    });
  };

  const ActiveIcon = activeMoment.icon;

  const PreviousIcon =
    previousMoment?.icon;

  const NextIcon =
    nextMoment?.icon;

  return (
    <div className="life-moment-page">

      {/* Back */}

      <button
        className="life-moment-back"
        onClick={() => navigate("/")}
        aria-label="홈으로 돌아가기"
      >
        <ArrowLeft size={20} />
      </button>

      <main className="life-moment-container">

        {/* =====================
            HEADER
        ===================== */}

        <header className="life-moment-header">

          <span className="life-moment-eyebrow">
            VIVIA · LIFE ARCHIVE
          </span>

          <h1>
            나의 순간들이
            <br />
            시간 속에 쌓여갑니다.
          </h1>

          <p>
            몸의 신호와 함께 기록된 순간을 따라가며
            <br />
            다시 경험하고 싶은 기억을 선택해보세요.
          </p>

        </header>

        {/* =====================
            AGE TIMELINE
        ===================== */}

        <section className="life-age-timeline">

          {(
            Object.keys(
              ageLabels
            ) as AgeGroup[]
          ).map((age, index) => {

            const active =
              age === selectedAge;

            return (
              <div
                className="life-age-node-wrap"
                key={age}
              >

                <button
                  className={
                    active
                      ? "life-age-node active"
                      : "life-age-node"
                  }
                  onClick={() =>
                    changeAge(age)
                  }
                >

                  <span className="life-age-dot" />

                  <strong>
                    {ageLabels[age]}
                  </strong>

                </button>

                {index < 2 && (
                  <div className="life-age-line" />
                )}

              </div>
            );
          })}

        </section>

        {/* =====================
            AGE HEADING
        ===================== */}

        <div className="life-age-heading">

          <span>
            {selectedAge === "20s"
              ? "2026 · 직접 기록된 순간들"
              : "VIVIA · FUTURE ARCHIVE"}
          </span>

          <h2>
            {selectedAge === "20s"
              ? "20대의 기록"
              : `${ageLabels[selectedAge]}의 기록`}
          </h2>

          <p>
            {selectedAge === "20s"
              ? "2026년, 몸의 신호와 함께 남겨진 순간을 시간 순서대로 살펴보세요."
              : "시간이 흐르며 새로운 기록이 이곳에 계속 쌓여갑니다."}
          </p>

        </div>

        {/* =====================
            CAROUSEL
        ===================== */}

        <section className="life-carousel">

          {/* PREVIOUS */}

          {previousMoment ? (

            <button
              className="life-side-card previous"
              onClick={goPrevious}
              aria-label="이전 기억"
            >

              <div className="life-side-icon">

                {PreviousIcon && (
                  <PreviousIcon size={25} />
                )}

              </div>

              <span>
                {previousMoment.date ??
                  "Future Archive"}
              </span>

              <h3>
                {previousMoment.title}
              </h3>

            </button>

          ) : (

            <div className="life-side-placeholder" />

          )}

          {/* =====================
              ACTIVE MOMENT
          ===================== */}

          <div className="life-main-wrap">

            <button
              className={
                activeMoment.available
                  ? "life-main-card"
                  : "life-main-card unavailable"
              }
              onClick={() =>
                handleMomentClick(
                  activeMoment
                )
              }
            >

              {!activeMoment.available && (

                <span className="life-coming-badge">
                  COMING SOON
                </span>

              )}

              <div className="life-main-top">

                <div className="life-main-icon">
                  <ActiveIcon size={30} />
                </div>

                <span className="life-main-year">
                  {activeMoment.date ??
                    "FUTURE"}
                </span>

              </div>

              <div className="life-main-content">

                <span>
                  {activeMoment.subtitle}
                </span>

                <h2>
                  {activeMoment.title}
                </h2>

                <p>
                  {activeMoment.description}
                </p>

                {activeMoment.location && (

                  <div className="life-location">
                    {activeMoment.location}
                  </div>

                )}

              </div>

              <div className="life-main-footer">

                <span>
                  {activeMoment.available
                    ? "이 순간 다시 보기"
                    : "아직 기록되지 않은 순간"}
                </span>

                <ArrowRight
                  size={19}
                  className="life-main-arrow"
                />

              </div>

            </button>

          </div>

          {/* NEXT */}

          {nextMoment ? (

            <button
              className="life-side-card next"
              onClick={goNext}
              aria-label="다음 기억"
            >

              <div className="life-side-icon">

                {NextIcon && (
                  <NextIcon size={25} />
                )}

              </div>

              <span>
                {nextMoment.date ??
                  "Future Archive"}
              </span>

              <h3>
                {nextMoment.title}
              </h3>

            </button>

          ) : (

            <div className="life-side-placeholder" />

          )}

        </section>

        {/* =====================
            CAROUSEL CONTROLS
        ===================== */}

        <div className="life-carousel-controls">

          <button
            onClick={goPrevious}
            disabled={activeIndex === 0}
            aria-label="이전"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="life-carousel-position">

            <div className="life-carousel-dots">

              {moments.map(
                (moment, index) => (

                  <button
                    key={moment.id}
                    className={
                      index === activeIndex
                        ? "life-carousel-dot active"
                        : "life-carousel-dot"
                    }
                    onClick={() =>
                      setActiveIndex(index)
                    }
                    aria-label={`${index + 1}번째 기억`}
                  />

                )
              )}

            </div>

            <span className="life-carousel-count">

              <strong>
                {activeIndex + 1}
              </strong>

              <span>/</span>

              {moments.length}

            </span>

          </div>

          <button
            onClick={goNext}
            disabled={
              activeIndex ===
              moments.length - 1
            }
            aria-label="다음"
          >
            <ArrowRight size={18} />
          </button>

        </div>

      </main>

      {/* =====================
          COMING SOON MODAL
      ===================== */}

      {showComingSoon && (

        <div
          className="life-coming-overlay"
          onClick={() =>
            setShowComingSoon(false)
          }
        >

          <div
            className="life-coming-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="life-coming-icon">
              <Sparkles size={27} />
            </div>

            <span>
              VIVIA · FUTURE ARCHIVE
            </span>

            <h2>
              아직 기록되지 않은
              <br />
              미래의 순간이에요.
            </h2>

            <p>
              시간이 흐르고 몸의 신호와 삶의 기록이
              쌓이면, VIVIA는 이곳에 새로운 순간들을
              계속 이어갑니다.
            </p>

            <button
              onClick={() =>
                setShowComingSoon(false)
              }
            >
              돌아가기
            </button>

          </div>

        </div>

      )}

    </div>
  );
};

export default Moment;