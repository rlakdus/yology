import "../styles/moment.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  Heart,
  House,
  Plane,
  Presentation,
  Stethoscope,
  UsersRound,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type AgeGroup = "20s" | "30s" | "40s";

type MomentItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  demoSource?: string;
  eventId?: string;
};

const momentData: Record<AgeGroup, MomentItem[]> = {
  "20s": [
    {
      id: "first-career",
      title: "처음 시작한 일",
      description: "첫 출근이나 인턴처럼 새로운 시작이 기억에 남았던 순간",
      icon: BriefcaseBusiness,
      demoSource: "office",
    },
    {
      id: "important-exam",
      title: "중요한 시험",
      description: "긴장과 집중이 가장 높았던 시험 전후의 순간",
      icon: GraduationCap,
      demoSource: "student",
      eventId: "event_001",
    },
    {
      id: "trip-with-friends",
      title: "친구들과의 여행",
      description: "친구들과 함께해서 오래 기억하고 싶은 순간",
      icon: Plane,
    },
    {
      id: "new-relationship",
      title: "새로운 인연",
      description: "누군가와의 관계가 특별해지기 시작했던 순간",
      icon: Heart,
    },
  ],

  "30s": [
    {
      id: "important-work",
      title: "중요한 업무",
      description: "중요한 미팅이나 발표를 앞두고 몰입했던 순간",
      icon: Presentation,
      demoSource: "office",
    },
    {
      id: "first-home",
      title: "새로운 집",
      description: "새로운 공간에서 삶의 변화를 실감했던 순간",
      icon: House,
    },
    {
      id: "old-friends",
      title: "오랜만의 만남",
      description: "오랜만에 만난 사람들과 다시 추억을 나눴던 순간",
      icon: UsersRound,
    },
    {
      id: "special-memory",
      title: "잊고 싶지 않은 기억",
      description: "시간이 지나도 다시 떠올리고 싶은 특별한 순간",
      icon: Sparkles,
    },
  ],

  "40s": [
    {
      id: "health-check",
      title: "건강을 확인한 날",
      description: "건강검진 결과를 기다리며 여러 생각이 스쳤던 순간",
      icon: Stethoscope,
      demoSource: "caregiver",
    },
    {
      id: "parents",
      title: "부모님과의 순간",
      description: "시간이 흐를수록 더욱 소중하게 느껴지는 가족의 기억",
      icon: Heart,
    },
    {
      id: "family-trip",
      title: "가족과의 여행",
      description: "가족과 함께한 시간을 오래 간직하고 싶은 순간",
      icon: Plane,
    },
    {
      id: "child-milestone",
      title: "자녀의 새로운 시작",
      description: "입학이나 졸업처럼 가족에게 의미가 컸던 순간",
      icon: GraduationCap,
    },
  ],
};

const ageLabels: Record<AgeGroup, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
};

const Moment = () => {
  const navigate = useNavigate();

  const [selectedAge, setSelectedAge] =
    useState<AgeGroup>("20s");

  const moments = momentData[selectedAge];
  const handleMomentClick = (moment: MomentItem) => {
    navigate("/event", {
      state: {
        ageGroup: selectedAge,
        ageLabel: ageLabels[selectedAge],
        momentId: moment.id,
        momentTitle: moment.title,
        momentDescription: moment.description,
        demoSource: moment.demoSource,
        eventId: moment.eventId,
      },
    });
  };

  return (
    <div className="moment-page">

      <button
        className="moment-back"
        onClick={() => navigate("/")}
        aria-label="홈으로 돌아가기"
      >
        <ArrowLeft size={21} />
      </button>

      <main className="moment-container">

        <header className="moment-header">

          <span className="moment-chip">
            YOUR MOMENT
          </span>

          <h1>
            어떤 순간을
            <br />
            다시 보고 싶나요?
          </h1>

          <p>
            기억하고 싶은 순간을 선택해주세요.
            <br />
            FeelBack이 흩어진 기록을 연결해 그날의 경험을 재구성합니다.
          </p>

        </header>

        <div className="age-selector">

          {(Object.keys(ageLabels) as AgeGroup[]).map((age) => (

            <button
              key={age}
              className={
                selectedAge === age
                  ? "age-button active"
                  : "age-button"
              }
              onClick={() => setSelectedAge(age)}
            >
              {ageLabels[age]}
            </button>

          ))}

        </div>

        <section className="moment-section">

          <div className="moment-section-heading">

            <div>

              <span>
                {ageLabels[selectedAge]}의 순간
              </span>

              <h2>
                다시 경험하고 싶은 기억을 선택하세요.
              </h2>

            </div>

            <p>
              하나의 순간을 선택하면
              당시의 데이터를 기반으로 기억을 재구성합니다.
            </p>

          </div>

          <div className="moment-grid">

            {moments.map((moment) => {

              const Icon = moment.icon;

              return (

                <button
                  type="button"
                  className="moment-card"
                  key={moment.id}
                  onClick={() => handleMomentClick(moment)}
                >

                  <div className="moment-icon">
                    <Icon size={27} />
                  </div>

                  <div className="moment-card-content">

                    <h3>
                      {moment.title}
                    </h3>

                    <p>
                      {moment.description}
                    </p>

                  </div>

                  <div className="moment-card-bottom">

                    <span>
                      이 순간 선택하기
                    </span>

                    <ArrowRight
                      size={18}
                      className="moment-arrow"
                    />

                  </div>

                </button>

              );

            })}

          </div>

        </section>

      </main>

    </div>
  );
};

export default Moment;