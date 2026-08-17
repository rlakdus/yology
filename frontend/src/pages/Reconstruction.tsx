import "../styles/reconstruction.css";

import SiteNav from "../components/SiteNav";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Film,
  Glasses,
  GraduationCap,
  HeartPulse,
  MapPin,
  Music,
  Plane,
  Sparkles,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";


/* ========================================
   TYPES
======================================== */

type Accent =
  | "blue"
  | "aqua"
  | "orange"
  | "lavender";


type BodyMetric = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  accent: Accent;
};


type SignatureMetric = {
  label: string;
  value: number;
  hint: string;
};


type TimelineItem = {
  time: string;
  title: string;
  description: string;
  accent: Accent;
};


type StoryData = {
  title: string;
  lead: string;
  paragraphs: string[];
  closing: string;
};


type ReconstructionDetail = {
  category: string;
  icon: LucideIcon;

  bodyMetrics: BodyMetric[];

  signature: SignatureMetric[];

  timeline: TimelineItem[];

  story: StoryData;
};


/* ========================================
   DATA
======================================== */

const reconstructionData: Record<
  string,
  ReconstructionDetail
> = {
  /* ========================================
     01 · 면접 결과 확인
  ======================================== */

  "interview-result": {
    category:
      "CAREER · RESULT CHECK",

    icon: GraduationCap,

    bodyMetrics: [
      {
        label: "Heart Rate",
        value: "112 bpm",
        note: "개인 baseline 74 bpm",
        icon: HeartPulse,
        accent: "orange",
      },

      {
        label: "Deviation",
        value: "+2.4σ",
        note: "개인 기준선 대비 변화",
        icon: Waves,
        accent: "lavender",
      },

      {
        label: "Movement",
        value: "STILL",
        note: "0.024 g",
        icon: Activity,
        accent: "aqua",
      },

      {
        label: "Respiratory Rate",
        value: "22.0 /min",
        note: "가장 가까운 측정값",
        icon: Wind,
        accent: "aqua",
      },

      {
        label: "Blood Oxygen",
        value: "97%",
        note: "가장 가까운 측정값",
        icon: Waves,
        accent: "blue",
      },

      {
        label: "Active Energy",
        value: "1.8 kcal",
        note: "해당 구간 누적",
        icon: Zap,
        accent: "orange",
      },
    ],

    signature: [
      {
        label: "INTENSITY",
        value: 84,
        hint: "높은 변화",
      },
      {
        label: "MOVEMENT",
        value: 18,
        hint: "STILL",
      },
      {
        label: "PERSISTENCE",
        value: 76,
        hint: "지속 패턴",
      },
      {
        label: "RECOVERY",
        value: 42,
        hint: "완만한 회복",
      },
      {
        label: "STABILITY",
        value: 71,
        hint: "신호 안정도",
      },
    ],

    timeline: [
      {
        time: "14:03",
        title: "집중 상태 시작",
        description:
          "결과 발표 전 대기 상태가 지속적으로 감지되었습니다.",
        accent: "blue",
      },
      {
        time: "14:12",
        title: "심박 상승",
        description:
          "개인 기준선보다 높은 심박 변화가 나타나기 시작했습니다.",
        accent: "aqua",
      },
      {
        time: "14:20",
        title: "변화 지속",
        description:
          "움직임은 크지 않았지만 높은 심박 패턴이 계속되었습니다.",
        accent: "orange",
      },
      {
        time: "14:25",
        title: "핵심 순간",
        description:
          "여러 신호와 일정 맥락이 가장 선명하게 겹친 구간입니다.",
        accent: "orange",
      },
    ],

    story: {
      title:
        "문 앞에서, 몸이 먼저 알고 있던 것",

      lead:
        "14시 25분, 결과를 확인하기 직전 심박은 평소 기준선보다 뚜렷하게 올라가 있었습니다.",

      paragraphs: [
        "결과 발표를 기다리던 14시 3분 무렵부터 대기 상태가 먼저 감지되었습니다. 14시 12분을 지나면서 심박은 개인 기준선인 74 bpm보다 눈에 띄게 높은 구간으로 진입했고, 이후 결과를 확인하기까지 그 상태가 계속 이어졌습니다.",

        "14시 25분, 화면을 열기 직전 심박은 112 bpm, 기준선 대비 편차는 +2.4σ까지 커졌습니다. 같은 순간 움직임은 0.024g로 사실상 정지 상태(STILL)였고 호흡수도 22.0/min, 혈중 산소포화도도 97%로 크게 벗어나지 않았습니다. 몸은 움직이지 않았는데 심박만 뚜렷하게 뛰었다는 사실이, 이 변화가 신체 활동이 아니라 긴장과 기대가 만든 반응이라는 단서를 남깁니다.",

        "결과를 읽어 내려가는 몇 초 동안 심박은 쉽게 가라앉지 않았습니다. 회복 속도를 나타내는 RECOVERY 지표가 42로 완만하게 측정된 것도 같은 구간과 맞닿아 있습니다 — 안도감은 곧바로 찾아오지 않고, 문장을 하나씩 읽어 내려가며 서서히 평소 리듬으로 돌아오는 모양으로 나타났습니다.",
      ],

      closing:
        "기억은 장면으로만 남지 않습니다. 때로는 화면을 열기 직전, 몸이 먼저 남긴 작은 속도 차이로 남습니다.",
    },
  },


  /* ========================================
     02 · 콘서트
  ======================================== */

  "first-concert": {
    category:
      "MUSIC · HIGH AROUSAL",

    icon: Music,

    bodyMetrics: [
      {
        label: "Heart Rate",
        value: "126 bpm",
        note: "개인 baseline 76 bpm",
        icon: HeartPulse,
        accent: "orange",
      },
      {
        label: "Deviation",
        value: "+2.9σ",
        note: "개인 기준선 대비 변화",
        icon: Waves,
        accent: "lavender",
      },
      {
        label: "Movement",
        value: "ACTIVE",
        note: "0.138 g",
        icon: Activity,
        accent: "aqua",
      },
      {
        label: "Respiratory Rate",
        value: "24.0 /min",
        note: "가장 가까운 측정값",
        icon: Wind,
        accent: "aqua",
      },
      {
        label: "Blood Oxygen",
        value: "98%",
        note: "가장 가까운 측정값",
        icon: Waves,
        accent: "blue",
      },
      {
        label: "Active Energy",
        value: "6.7 kcal",
        note: "해당 구간 누적",
        icon: Zap,
        accent: "orange",
      },
    ],

    signature: [
      {
        label: "INTENSITY",
        value: 93,
        hint: "높은 변화",
      },
      {
        label: "MOVEMENT",
        value: 78,
        hint: "ACTIVE",
      },
      {
        label: "PERSISTENCE",
        value: 88,
        hint: "지속 패턴",
      },
      {
        label: "RECOVERY",
        value: 55,
        hint: "완만한 회복",
      },
      {
        label: "STABILITY",
        value: 67,
        hint: "신호 안정도",
      },
    ],

    timeline: [
      {
        time: "19:31",
        title: "공연장 입장",
        description:
          "위치와 활동 기록에서 공연장 입장 시점이 확인되었습니다.",
        accent: "blue",
      },
      {
        time: "19:38",
        title: "기대감이 커진 구간",
        description:
          "공연 시작 전부터 심박과 움직임이 점차 증가했습니다.",
        accent: "aqua",
      },
      {
        time: "19:42",
        title: "공연 시작",
        description:
          "음악이 시작되면서 심박과 활동량이 함께 크게 상승했습니다.",
        accent: "orange",
      },
      {
        time: "19:46",
        title: "높은 몰입 지속",
        description:
          "높아진 신체적 각성 상태가 일정 시간 이어졌습니다.",
        accent: "orange",
      },
    ],

    story: {
      title:
        "첫 소절이 시작되기 전부터",

      lead:
        "공연장 안에서 움직임과 심박이 함께 높아졌고, 무대가 시작된 뒤 몸의 리듬도 빠르게 달라졌습니다.",

      paragraphs: [
        "19시 31분 공연장에 들어선 순간부터 위치와 활동 기록이 함께 움직이기 시작했습니다. 아직 음악이 시작되지 않은 19시 38분 무렵에도 심박과 움직임은 조금씩 함께 높아지고 있었습니다.",

        "19시 42분, 첫 소절이 시작되자 심박은 126 bpm까지 뛰었고 기준선(76 bpm) 대비 편차는 +2.9σ로 벌어졌습니다. 같은 순간 움직임은 0.138g로 ACTIVE 상태, 호흡수는 24.0/min, 활동 에너지는 6.7kcal까지 누적되며 몸 전체가 함께 반응했습니다.",

        "19시 46분까지 이어진 구간에서도 높아진 리듬은 크게 떨어지지 않았습니다. PERSISTENCE 지표가 88로 높게 나타난 것처럼, 흥분은 한순간에 그치지 않고 첫 곡이 끝날 때까지 이어지는 패턴을 그렸습니다. 영상 속 환호와 흔들리는 화면에는 그 순간의 열기가 그대로 담겨 있었습니다.",
      ],

      closing:
        "영상은 무대를 기억하고, 몸은 그 순간의 리듬을 기억했습니다.",
    },
  },


  /* ========================================
     03 · 몽골 여행
  ======================================== */

  "mongolia-trip": {
    category:
      "TRAVEL · ACTIVE MEMORY",

    icon: Plane,

    bodyMetrics: [
      {
        label: "Heart Rate",
        value: "118 bpm",
        note: "개인 baseline 72 bpm",
        icon: HeartPulse,
        accent: "orange",
      },
      {
        label: "Deviation",
        value: "+2.5σ",
        note: "개인 기준선 대비 변화",
        icon: Waves,
        accent: "lavender",
      },
      {
        label: "Movement",
        value: "ACTIVE",
        note: "0.172 g",
        icon: Activity,
        accent: "aqua",
      },
      {
        label: "Respiratory Rate",
        value: "25.0 /min",
        note: "가장 가까운 측정값",
        icon: Wind,
        accent: "aqua",
      },
      {
        label: "Blood Oxygen",
        value: "96%",
        note: "가장 가까운 측정값",
        icon: Waves,
        accent: "blue",
      },
      {
        label: "Active Energy",
        value: "9.3 kcal",
        note: "해당 구간 누적",
        icon: Zap,
        accent: "orange",
      },
    ],

    signature: [
      {
        label: "INTENSITY",
        value: 88,
        hint: "높은 변화",
      },
      {
        label: "MOVEMENT",
        value: 94,
        hint: "ACTIVE",
      },
      {
        label: "PERSISTENCE",
        value: 81,
        hint: "지속 패턴",
      },
      {
        label: "RECOVERY",
        value: 64,
        hint: "완만한 회복",
      },
      {
        label: "STABILITY",
        value: 73,
        hint: "신호 안정도",
      },
    ],

    timeline: [
      {
        time: "16:02",
        title: "승마 시작",
        description:
          "움직임 패턴에서 승마 활동이 시작된 시점이 확인되었습니다.",
        accent: "blue",
      },
      {
        time: "16:10",
        title: "움직임 증가",
        description:
          "속도와 활동량이 함께 높아지며 신체 신호의 변화가 커졌습니다.",
        accent: "aqua",
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
          "승마 이후 생체 신호가 점차 안정되기 시작했습니다.",
        accent: "blue",
      },
    ],

    story: {
      title:
        "초원을 달리는 동안 몸에 남은 것",

      lead:
        "넓은 초원을 달리는 동안 움직임과 심박의 변화가 길게 이어졌습니다.",

      paragraphs: [
        "16시 2분, 움직임 패턴에서 승마가 시작된 시점이 뚜렷하게 확인되었습니다. 말에 오른 직후부터 활동량은 빠르게 늘어났고, 16시 10분을 지나며 속도와 움직임이 함께 커지는 구간으로 이어졌습니다.",

        "16시 18분 무렵, 심박과 움직임이 동시에 가장 높은 지점에 도달했습니다. 심박은 118 bpm, 기준선(72 bpm) 대비 편차는 +2.5σ였고, 움직임은 0.172g로 이번 순간 중 가장 활발한 ACTIVE 구간이었습니다. 호흡수도 25.0/min까지 오르며 9.3kcal의 활동 에너지가 이 구간에 집중적으로 누적되었습니다.",

        "말이 속도를 낼 때마다 심박도 함께 출렁였고, 16시 25분 이후로는 리듬이 서서히 가라앉기 시작했습니다. MOVEMENT 지표가 94로 이번 순간 중 가장 높게 나타난 것도 이 활동 구간과 정확히 겹칩니다.",
      ],

      closing:
        "그날의 풍경은 영상에 남았고, 달리던 리듬은 몸의 신호에 남았습니다.",
    },
  },


  /* ========================================
     04 · 영화
  ======================================== */

  "favorite-movie": {
    category:
      "CINEMA · EMOTIONAL MEMORY",

    icon: Film,

    bodyMetrics: [
      {
        label: "Heart Rate",
        value: "82 bpm",
        note: "개인 baseline 71 bpm",
        icon: HeartPulse,
        accent: "orange",
      },
      {
        label: "Deviation",
        value: "+1.4σ",
        note: "개인 기준선 대비 변화",
        icon: Waves,
        accent: "lavender",
      },
      {
        label: "Movement",
        value: "STILL",
        note: "0.012 g",
        icon: Activity,
        accent: "aqua",
      },
      {
        label: "Respiratory Rate",
        value: "20.0 /min",
        note: "가장 가까운 측정값",
        icon: Wind,
        accent: "aqua",
      },
      {
        label: "Blood Oxygen",
        value: "98%",
        note: "가장 가까운 측정값",
        icon: Waves,
        accent: "blue",
      },
      {
        label: "Active Energy",
        value: "0.5 kcal",
        note: "해당 구간 누적",
        icon: Zap,
        accent: "orange",
      },
    ],

    signature: [
      {
        label: "INTENSITY",
        value: 58,
        hint: "미세한 변화",
      },
      {
        label: "MOVEMENT",
        value: 9,
        hint: "STILL",
      },
      {
        label: "PERSISTENCE",
        value: 66,
        hint: "반복 패턴",
      },
      {
        label: "RECOVERY",
        value: 79,
        hint: "빠른 회복",
      },
      {
        label: "STABILITY",
        value: 91,
        hint: "높은 안정도",
      },
    ],

    timeline: [
      {
        time: "20:05",
        title: "관람 시작",
        description:
          "영화가 시작되고 안정적인 신체 상태가 유지되었습니다.",
        accent: "blue",
      },
      {
        time: "20:24",
        title: "작은 변화 감지",
        description:
          "움직임이 거의 없는 상태에서 심박의 미세한 변화가 나타났습니다.",
        accent: "aqua",
      },
      {
        time: "20:31",
        title: "핵심 몰입 구간",
        description:
          "작은 심박 변화가 반복적으로 나타나는 구간이 확인되었습니다.",
        accent: "orange",
      },
      {
        time: "20:38",
        title: "안정 상태 복귀",
        description:
          "이후 신호가 다시 안정적인 범위로 돌아왔습니다.",
        accent: "blue",
      },
    ],

    story: {
      title:
        "가만히 있었지만, 아주 조금 달라진 순간",

      lead:
        "움직임은 거의 없었지만 특정 구간에서 작은 심박 변화가 반복되었습니다.",

      paragraphs: [
        "20시 5분 영화가 시작된 직후에는 몸 대부분이 안정적인 범위에 머물렀습니다. 움직임은 0.012g로 거의 감지되지 않았고, 심박도 기준선(71 bpm)에서 크게 벗어나지 않았습니다.",

        "20시 24분을 지나면서 변화가 나타나기 시작했습니다. 자세와 움직임은 그대로였지만 심박만 조금씩 흔들렸고, 20시 31분 전후로는 82 bpm, 편차 +1.4σ의 작은 심박 변화가 반복적으로 나타났습니다. 같은 구간에서 호흡수는 20.0/min, 활동 에너지는 0.5kcal로 신체 활동으로는 설명되지 않는 수준이었습니다.",

        "화면 속 장면이 바뀌는 순간과 거의 겹쳐서, 몸은 그대로였지만 심박만 살짝 반응했습니다. 20시 38분 이후 신호는 다시 안정 범위로 돌아왔고, STABILITY 지표가 91로 가장 높게 나타난 것도 이 순간이 큰 동요 없이 조용히 지나갔다는 사실을 뒷받침합니다.",
      ],

      closing:
        "선명한 순간은 언제나 크게 뛰지 않습니다. 때로는 아주 작은 흔들림으로 남습니다.",
    },
  },
};


/* ========================================
   PAGE
======================================== */

const Reconstruction = () => {
  const navigate =
    useNavigate();

  const location =
    useLocation();


  const {
    momentId = "interview-result",

    momentTitle = "면접 결과 확인",

    momentDate = "2026.04",

    momentExactDate,

    momentLocation =
    "Campus",

    eventTime,

    demoSource = "student",

    eventId = "event_001",
  } = location.state || {};

  const openVr = () => {
    navigate(`/vr/${demoSource}/${eventId}`);
  };


  const detail =
    reconstructionData[momentId] ??
    reconstructionData["interview-result"];

  const displayDate =
    momentExactDate ||
    momentDate;


  const displayTime =
    eventTime ||
    detail.timeline[
      detail.timeline.length - 1
    ].time;


  return (
    <div className="recon-page">

      {/* ========================================
          SAME HEADER
      ======================================== */}

      <SiteNav />


      <main className="recon-shell">

        {/* BACK */}
        <button
          className="recon-back"
          onClick={() =>
            navigate(-1)
          }
          aria-label="Event로 돌아가기"
        >
          <ArrowLeft size={18} />
        </button>


        {/* ========================================
            HERO
        ======================================== */}

        <div className="recon-context-bar">

          <div className="recon-context-title">

            <Sparkles size={15} />

            <span>
              AI RECONSTRUCTION
            </span>

            <strong>
              {momentTitle}
            </strong>

          </div>


          <div className="recon-context-meta">

            <span>
              <CalendarDays size={14} />
              {displayDate}
            </span>

            <span>
              <Clock3 size={14} />
              {displayTime}
            </span>

            <span>
              <MapPin size={14} />
              {momentLocation}
            </span>

          </div>

        </div>


        {/* ========================================
            01 · BODY TRACE
        ======================================== */}

        <section className="recon-section">

          <div className="recon-section-head">

            <div>
              <span>
                01 · BODY TRACE
              </span>

              <h2>
                그 순간,
                몸에 남은 흔적
              </h2>
            </div>

            <p>
              서로 다른 생체 신호를 같은 시간 위에 겹쳐
              이 순간만의 패턴으로 정리했습니다.
            </p>

          </div>


          {/* BODY SNAPSHOT */}

          <div className="body-trace-card">

            <div className="body-trace-heading">

              <div>
                <span>
                  BODY SNAPSHOT
                </span>

                <h3>
                  그 순간, 몸은 이렇게 반응했습니다.
                </h3>
              </div>

              <p>
                한 시점의 숫자가 아니라
                여러 신체 신호를 함께 살펴봅니다.
              </p>

            </div>


            <div className="body-trace-stage">

              {/* LEFT METRICS */}

              <div className="body-trace-column">

                {detail.bodyMetrics
                  .slice(0, 3)
                  .map(
                    (metric) => {

                      const Icon =
                        metric.icon;

                      return (
                        <article
                          className="body-metric-card"
                          key={metric.label}
                        >

                          <div
                            className={`body-metric-icon ${metric.accent}`}
                          >
                            <Icon
                              size={19}
                            />
                          </div>

                          <div>
                            <span>
                              {metric.label}
                            </span>

                            <strong>
                              {metric.value}
                            </strong>

                            <small>
                              {metric.note}
                            </small>
                          </div>

                        </article>
                      );
                    }
                  )}

              </div>


              {/* BODY */}

              <div className="body-figure-wrap">

                <div className="body-heart-pulse" />

                <svg
                  className="body-figure"
                  viewBox="0 0 260 500"
                  aria-label="신체 신호 시각화"
                >

                  {/* HEAD */}

                  <ellipse
                    cx="130"
                    cy="62"
                    rx="38"
                    ry="49"
                  />


                  {/* NECK */}

                  <path
                    d="
                      M112 105
                      L111 132
                      L94 142
                    "
                  />

                  <path
                    d="
                      M148 105
                      L149 132
                      L166 142
                    "
                  />


                  {/* BODY */}

                  <path
                    d="
                      M94 142
                      C71 153 58 180 56 221
                      L53 292
                      C52 306 60 316 70 315
                      C78 314 82 306 83 294
                      L88 221
                      L95 335
                      L93 453
                      C92 469 101 478 112 477
                      C122 476 127 468 128 455
                      L130 350
                      L132 455
                      C133 468 138 476 148 477
                      C159 478 168 469 167 453
                      L165 335
                      L172 221
                      L177 294
                      C178 306 182 314 190 315
                      C200 316 208 306 207 292
                      L204 221
                      C202 180 189 153 166 142
                      C145 153 115 153 94 142
                      Z
                    "
                  />


                  {/* CHEST GUIDE */}

                  <circle
                    className="body-guide"
                    cx="130"
                    cy="198"
                    r="46"
                  />

                  <circle
                    className="body-guide body-guide-two"
                    cx="130"
                    cy="198"
                    r="30"
                  />


                  {/* HEART */}

                  <circle
                    className="body-heart"
                    cx="137"
                    cy="202"
                    r="8"
                  />

                </svg>


                <span className="body-figure-caption">
                  VIVIA BODY TRACE
                </span>

              </div>


              {/* RIGHT METRICS */}

              <div className="body-trace-column">

                {detail.bodyMetrics
                  .slice(3)
                  .map(
                    (metric) => {

                      const Icon =
                        metric.icon;

                      return (
                        <article
                          className="body-metric-card"
                          key={metric.label}
                        >

                          <div
                            className={`body-metric-icon ${metric.accent}`}
                          >
                            <Icon
                              size={19}
                            />
                          </div>

                          <div>
                            <span>
                              {metric.label}
                            </span>

                            <strong>
                              {metric.value}
                            </strong>

                            <small>
                              {metric.note}
                            </small>
                          </div>

                        </article>
                      );
                    }
                  )}

              </div>

            </div>

          </div>


          {/* SIGNATURE */}

          <div className="body-signature-card">

            <div className="signature-head">

              <div>
                <span>
                  BODY SIGNATURE
                </span>

                <h3>
                  This moment's signature
                </h3>
              </div>

              <Waves size={24} />

            </div>


            <div className="signature-layout">

              <div className="signature-tags">

                {detail.signature.map(
                  (metric) => (
                    <div
                      key={
                        metric.label
                      }
                    >
                      <span>
                        {metric.label}
                      </span>

                      <strong>
                        {metric.hint}
                      </strong>
                    </div>
                  )
                )}

              </div>


              <div className="signature-bars">

                {detail.signature.map(
                  (metric) => (
                    <div
                      className="signature-row"
                      key={
                        metric.label
                      }
                    >

                      <div className="signature-label">
                        <span>
                          {metric.label}
                        </span>

                        <strong>
                          {metric.value}
                        </strong>
                      </div>

                      <div className="signature-track">
                        <i
                          style={{
                            width:
                              `${metric.value}%`,
                          }}
                        />
                      </div>

                    </div>
                  )
                )}

              </div>

            </div>


            <p className="signature-note">
              이 시그니처는 감정을 판정하는 점수가 아니라,
              심박·움직임·지속 시간·회복 패턴을 한눈에 보기 위한
              순간의 신체 fingerprint입니다.
            </p>

          </div>

        </section>


        {/* ========================================
            02 · TIMELINE
        ======================================== */}

        <section className="recon-section">

          <div className="recon-section-head">

            <div>
              <span>
                02 · RECONSTRUCTED TIMELINE
              </span>

              <h2>
                기억이 만들어진 흐름
              </h2>
            </div>

            <p>
              하나의 피크만 보는 것이 아니라
              앞뒤의 변화까지 이어 하나의 순간으로 복원했습니다.
            </p>

          </div>


          <div className="recon-timeline">

            {detail.timeline.map(
              (
                item,
                index
              ) => (
                <article
                  className="recon-timeline-item"
                  key={`${item.time}-${item.title}`}
                >

                  <time>
                    {item.time}
                  </time>


                  <div className="recon-timeline-axis">

                    <span
                      className={
                        item.accent
                      }
                    />

                    {index <
                      detail.timeline.length -
                      1 && <i />}

                  </div>


                  <div className="recon-timeline-copy">

                    <small>
                      0{index + 1}
                    </small>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.description}
                    </p>

                  </div>

                </article>
              )
            )}

          </div>

        </section>


        {/* ========================================
            03 · STORY
        ======================================== */}

        <section className="recon-section">

          <div className="recon-section-head">

            <div>
              <span>
                03 · RECONSTRUCTED STORY
              </span>

              <h2>
                신호가 하나의
                기억이 되는 순간
              </h2>
            </div>

            <p>
              관측된 신호와 시간의 흐름을 연결해
              다시 읽을 수 있는 하나의 이야기로 구성했습니다.
            </p>

          </div>


          <article className="recon-story">

            <div className="recon-story-top">

              <div>
                <Sparkles
                  size={18}
                />

                <span>
                  VIVIA · RECONSTRUCTED MEMORY
                </span>
              </div>

              <small>
                Signals, translated into a memory.
              </small>

            </div>


            <div className="recon-story-layout">

              <aside>

                <strong>
                  03
                </strong>

                <i />

                <span>
                  BODY TRACE
                </span>

                <span>
                  TIMELINE
                </span>

              </aside>


              <div className="recon-story-paper">

                <div className="recon-story-meta">

                  <span>
                    {displayDate}
                  </span>

                  <i />

                  <span>
                    {displayTime}
                  </span>

                  <i />

                  <span>
                    {momentLocation}
                  </span>

                </div>


                <h3>
                  {detail.story.title}
                </h3>


                <p className="recon-story-lead">
                  {detail.story.lead}
                </p>


                <div className="recon-story-divider" />


                {detail.story.paragraphs.map(
                  (
                    paragraph,
                    index
                  ) => (
                    <p
                      className="recon-story-paragraph"
                      key={index}
                    >
                      {paragraph}
                    </p>
                  )
                )}


                <div className="recon-story-closing">

                  <span />

                  <strong>
                    {detail.story.closing}
                  </strong>

                </div>


                <p className="recon-story-disclaimer">
                  신체 신호는 감정 그 자체를 의미하지 않습니다.
                  이 이야기는 관측된 변화와 시간적 맥락을 기반으로
                  재구성한 기억의 한 표현입니다.
                </p>

              </div>

            </div>

          </article>


          {/* ========================================
              CTA · VR
          ======================================== */}

          <div className="recon-actions">

            <button
              className="recon-vr-button"
              onClick={openVr}
            >

              <Glasses size={19} />

              VR로 이 순간 재현하기

              <ArrowRight size={17} />

            </button>

          </div>

        </section>

      </main>


      {/* ========================================
          SAME FOOTER AS HOME
      ======================================== */}

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

    </div>
  );
};

export default Reconstruction;