import "../styles/moment.css";

import SiteNav from "../components/SiteNav";

import {
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  CalendarDays,
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
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";


/* ========================================
   TYPES
======================================== */

type AgeGroup =
  | "20s"
  | "30s"
  | "40s";


type MomentItem = {
  id: string;

  /* Moment 카드용 월 단위 */
  date?: string;

  /* Event 상세용 정확한 날짜 */
  exactDate?: string;

  title: string;
  subtitle: string;
  description: string;

  location?: string;

  icon: LucideIcon;

  available: boolean;

  demoSource?: string;
  eventId?: string;
};


/* ========================================
   AGE LABELS
======================================== */

const ageLabels: Record<
  AgeGroup,
  string
> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
};


/* ========================================
   MOMENT DATA
======================================== */

const momentData: Record<
  AgeGroup,
  MomentItem[]
> = {

  /* =========================
     20대
     2026 실제 수집 기록
  ========================= */

  "20s": [
    {
      id: "exam-interview",

      date: "2026.04",
      exactDate: "",

      title: "시험·면접 직전후",

      subtitle:
        "긴장과 몰입이 가장 높았던 순간",

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
      exactDate: "",

      title:
        "대학 입학 후 첫 콘서트",

      subtitle:
        "처음 마주한 공연장의 열기",

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
      exactDate: "",

      title: "몽골 여행",

      subtitle:
        "초원을 달리던 여름",

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
      exactDate: "",

      title:
        "좋아하는 영화 관람",

      subtitle:
        "오래 기억하고 싶은 한 장면",

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

      subtitle:
        "커리어의 중요한 전환점",

      description:
        "중요한 미팅이나 발표처럼 오래 기억에 남을 업무 순간입니다.",

      icon: Presentation,

      available: false,
    },

    {
      id: "first-home",

      title: "첫 집",

      subtitle:
        "새로운 삶의 공간",

      description:
        "처음 나만의 공간을 마련하며 느꼈던 감정을 기록합니다.",

      icon: House,

      available: false,
    },

    {
      id: "old-friends",

      title:
        "오랜만의 친구 모임",

      subtitle:
        "시간을 넘어 다시 만난 사람들",

      description:
        "오랜만에 만난 친구들과 다시 추억을 나누었던 순간입니다.",

      icon: UsersRound,

      available: false,
    },

    {
      id: "special-memory",

      title:
        "잊고 싶지 않은 기억",

      subtitle:
        "시간이 지나도 남는 순간",

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

      title:
        "건강을 확인한 날",

      subtitle:
        "결과를 기다리던 시간",

      description:
        "건강검진 결과를 기다리며 여러 생각이 스쳤던 순간입니다.",

      icon: Stethoscope,

      available: false,
    },

    {
      id: "parents",

      title:
        "부모님과의 순간",

      subtitle:
        "시간이 지날수록 소중해지는 기억",

      description:
        "부모님과 함께한 평범하지만 오래 남는 순간을 기록합니다.",

      icon: Heart,

      available: false,
    },

    {
      id: "family-trip",

      title:
        "가족과의 여행",

      subtitle:
        "함께해서 더 특별했던 시간",

      description:
        "가족과 함께한 여행의 분위기와 감정을 다시 경험합니다.",

      icon: Plane,

      available: false,
    },

    {
      id: "child-milestone",

      title:
        "가족의 새로운 시작",

      subtitle:
        "삶의 또 다른 전환점",

      description:
        "입학이나 졸업처럼 가족 모두에게 의미가 컸던 순간입니다.",

      icon: GraduationCap,

      available: false,
    },
  ],
};


/* ========================================
   MONTH PARSER
======================================== */

const monthNumber = (
  value?: string
) => {
  if (!value) {
    return 1;
  }

  const match =
    value.match(/\.(\d{2})$/);

  return match
    ? Number(match[1])
    : 1;
};


/* ========================================
   MOMENT PAGE
======================================== */

const Moment = () => {
  const navigate =
    useNavigate();

  const timelineRef =
    useRef<HTMLDivElement>(null);


  /* =========================
     STATE
  ========================= */

  const [
    selectedAge,
    setSelectedAge,
  ] = useState<AgeGroup>("20s");


  const [
    selectedId,
    setSelectedId,
  ] = useState(
    momentData["20s"][0].id
  );


  const [
    showComingSoon,
    setShowComingSoon,
  ] = useState(false);


  const [
    timelineZoom,
    setTimelineZoom,
  ] = useState(1);


  /* =========================
     CURRENT DATA
  ========================= */

  const moments =
    momentData[selectedAge];


  const activeMoment =
    moments.find(
      (item) =>
        item.id === selectedId
    ) ?? moments[0];


  /* =========================
     AGE CHANGE
  ========================= */

  const changeAge = (
    age: AgeGroup
  ) => {
    setSelectedAge(age);

    setSelectedId(
      momentData[age][0].id
    );

    setShowComingSoon(false);
  };


  /* =========================
     TIMELINE SCROLL
  ========================= */

  const scrollTimeline = (
    direction:
      | "left"
      | "right"
  ) => {
    timelineRef.current?.scrollBy(
      {
        left:
          direction === "left"
            ? -520
            : 520,

        behavior: "smooth",
      }
    );
  };


  /* =========================
     TIMELINE ZOOM
  ========================= */

  const changeTimelineZoom = (
    delta: number
  ) => {
    setTimelineZoom(
      (current) =>
        Math.min(
          1.35,

          Math.max(
            0.85,

            Number(
              (
                current +
                delta
              ).toFixed(2)
            )
          )
        )
    );
  };


  /* =========================
     OPEN MOMENT
  ========================= */

  const openMoment = (
    moment: MomentItem
  ) => {
    setSelectedId(moment.id);

    if (!moment.available) {
      setShowComingSoon(true);

      return;
    }

    navigate("/event", {
      state: {
        ageGroup:
          selectedAge,

        ageLabel:
          ageLabels[
            selectedAge
          ],

        momentId:
          moment.id,

        momentTitle:
          moment.title,

        momentSubtitle:
          moment.subtitle,

        momentDescription:
          moment.description,

        momentDate:
          moment.date,

        momentExactDate:
          moment.exactDate,

        momentLocation:
          moment.location,

        demoSource:
          moment.demoSource,

        eventId:
          moment.eventId,
      },
    });
  };


  /* ========================================
     RENDER
  ========================================= */

  return (
    <div className="life-moment-page">

      {/* =========================
          NAV
      ========================= */}

      <SiteNav />


      {/* =========================
          MAIN
      ========================= */}

      <main className="life-moment-container">

        {/* =====================
            HEADER
        ===================== */}

        <header className="life-moment-header">

          <span className="life-moment-eyebrow">

            MY MOMENTS · LIFE ARCHIVE

          </span>

          <h1>

            당신의 삶을 따라,
            <br />

            순간들이 쌓여갑니다.

          </h1>

          <p>

            몸의 신호와 함께
            남겨진 순간을
            탐색하고,

            <br />

            다시 만나고 싶은
            장면을 선택해보세요.

          </p>

        </header>


        {/* =====================
            AGE SWITCH
        ===================== */}

        <section
          className="life-age-switch"
          aria-label="연령대 선택"
        >

          {(
            Object.keys(
              ageLabels
            ) as AgeGroup[]
          ).map((age) => (

            <button
              key={age}
              className={
                age ===
                selectedAge
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeAge(age)
              }
            >

              <span>
                {ageLabels[age]}
              </span>

              <small>

                {age === "20s"
                  ? "NOW"
                  : "FUTURE"}

              </small>

            </button>

          ))}

        </section>


        {/* ========================================
            20대 · ACTUAL ARCHIVE
        ======================================== */}

        {selectedAge === "20s" ? (

          <section className="life-year-panel">

            {/* =====================
                TITLE
            ===================== */}

            <div className="life-year-title">

              <div>

                <span>
                  2026 · YOUR LIFE TIMELINE
                </span>

                <h2>
                  어떤 순간을 다시 보시겠습니까?
                </h2>

              </div>


              {/* =====================
                  TIMELINE TOOLS
              ===================== */}

              <div className="life-timeline-tools">

                <div className="life-year-status">

                  <CalendarDays
                    size={17}
                  />

                  <span>

                    {moments.length}
                    {" "}
                    moments archived

                  </span>

                </div>


                <div
                  className="life-timeline-nav"
                  aria-label="타임라인 탐색 도구"
                >

                  <button
                    type="button"
                    onClick={() =>
                      scrollTimeline(
                        "left"
                      )
                    }
                    aria-label="이전 시점"
                  >

                    <ChevronLeft
                      size={17}
                    />

                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      changeTimelineZoom(
                        -0.1
                      )
                    }
                    aria-label="타임라인 축소"
                  >

                    <Minus
                      size={16}
                    />

                  </button>


                  <span>

                    {Math.round(
                      timelineZoom *
                        100
                    )}
                    %

                  </span>


                  <button
                    type="button"
                    onClick={() =>
                      changeTimelineZoom(
                        0.1
                      )
                    }
                    aria-label="타임라인 확대"
                  >

                    <Plus
                      size={16}
                    />

                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      scrollTimeline(
                        "right"
                      )
                    }
                    aria-label="다음 시점"
                  >

                    <ChevronRight
                      size={17}
                    />

                  </button>

                </div>

              </div>

            </div>


            {/* =====================
                TIMELINE
            ===================== */}

            <div className="life-timeline-viewport">

              <div
                className="life-year-track"
                ref={timelineRef}
                aria-label="2026 월별 타임라인"
                style={
                  {
                    "--timeline-zoom":
                      timelineZoom,
                  } as CSSProperties
                }
              >

                {/* LINE */}

                <div className="life-year-line" />


                {/* MONTH TICKS */}

                {Array.from(
                  {
                    length: 12,
                  },
                  (_, index) =>
                    index + 1
                ).map((month) => (

                  <div
                    className="life-month-tick"
                    key={month}
                    style={{
                      gridColumn:
                        month,
                    }}
                  >

                    <i />

                    <span>
                      {month}월
                    </span>

                  </div>

                ))}


                {/* EVENTS */}

                {moments.map(
                  (
                    moment,
                    index
                  ) => {

                    const Icon =
                      moment.icon;

                    const month =
                      monthNumber(
                        moment.date
                      );

                    const selected =
                      activeMoment.id ===
                      moment.id;

                    return (

                      <button
                        key={
                          moment.id
                        }
                        className={`
                          life-timeline-event
                          ${
                            index %
                              2 ===
                            0
                              ? "event-top"
                              : "event-bottom"
                          }
                          ${
                            selected
                              ? "active"
                              : ""
                          }
                          event-${index + 1}
                        `}
                        style={{
                          gridColumn:
                            `${month} / span 2`,
                        }}
                        onMouseEnter={() =>
                          setSelectedId(
                            moment.id
                          )
                        }
                        onFocus={() =>
                          setSelectedId(
                            moment.id
                          )
                        }
                        onClick={() =>
                          openMoment(
                            moment
                          )
                        }
                      >

                        {/* PIN */}

                        <span className="life-timeline-pin">

                          <Icon
                            size={18}
                          />

                        </span>


                        {/* MONTH */}

                        <small>

                          {moment.date?.replace(
                            "2026.",
                            ""
                          )}
                          월

                        </small>


                        {/* TITLE */}

                        <strong>

                          {moment.title}

                        </strong>


                        {/* DESCRIPTION */}

                        <em>

                          {moment.subtitle}

                        </em>


                        {/* OPEN */}

                        <span className="life-timeline-open">

                          자세히 보기

                          <ArrowRight
                            size={14}
                          />

                        </span>

                      </button>

                    );
                  }
                )}

              </div>

            </div>


            {/* =====================
                HINT
            ===================== */}

            <p className="life-timeline-hint">

              좌우로 스와이프해
              시간대를 이동하고,
              + / − 버튼으로
              타임라인을
              확대·축소해보세요.

            </p>

          </section>

        ) : (

          /* ========================================
             30대 / 40대
             FUTURE ARCHIVE
          ======================================== */

          <section className="life-future-panel">

            <div className="life-future-heading">

              <span>

                VIVIA · FUTURE ARCHIVE

              </span>

              <h2>

                {ageLabels[
                  selectedAge
                ]}
                의 삶에도 기록은
                계속됩니다.

              </h2>

              <p>

                아직 오지 않은
                삶의 순간들을
                VIVIA의 미래
                아카이브로
                미리 만나보세요.

              </p>

            </div>


            {/* =====================
                FUTURE CARDS
            ===================== */}

            <div className="life-future-grid">

              {moments.map(
                (moment) => {

                  const Icon =
                    moment.icon;

                  return (

                    <button
                      key={
                        moment.id
                      }
                      onClick={() =>
                        openMoment(
                          moment
                        )
                      }
                    >

                      <div>

                        <Icon
                          size={24}
                        />

                      </div>

                      <span>

                        FUTURE MOMENT

                      </span>

                      <h3>

                        {moment.title}

                      </h3>

                      <p>

                        {
                          moment.description
                        }

                      </p>

                      <small>

                        Coming soon

                      </small>

                    </button>

                  );
                }
              )}

            </div>

          </section>

        )}

      </main>


      {/* ========================================
          FOOTER
          Home과 동일한 구성
      ======================================== */}

      <footer className="life-footer">

        <div className="life-footer-inner">

          {/* BRAND */}

          <div className="life-footer-brand">

            <img
              src="/assets/logo.png"
              alt="VIVIA"
            />

            <p>

              몸의 신호가
              삶의 이야기가 됩니다.

            </p>

          </div>


          {/* TEAM */}

          <div className="life-footer-team">

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


      {/* ========================================
          COMING SOON TOAST
      ======================================== */}

      {showComingSoon && (

        <div
          className="life-coming-toast"
          role="status"
        >

          <Sparkles
            size={18}
          />

          <span>

            이 순간은
            Future Archive
            데모입니다.

          </span>

          <button
            onClick={() =>
              setShowComingSoon(
                false
              )
            }
          >

            닫기

          </button>

        </div>

      )}

    </div>
  );
};

export default Moment;