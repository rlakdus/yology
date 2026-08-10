import "../styles/scenario.css";

import {
  ArrowLeft,
  ChevronRight,
  Hospital,
  GraduationCap,
  Briefcase,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const Scenario = () => {

  const navigate = useNavigate();

  const scenarios = [

    {
      icon: <Hospital size={28} />,
      title: "Hospital Visit",
      subtitle: "병원 방문",
      description: "보호자 · 환자 · 의료진",
      scenario: "hospital",
    },

    {
      icon: <GraduationCap size={28} />,
      title: "Study Session",
      subtitle: "시험기간",
      description: "학생 · 친구 · 교수",
      scenario: "study",
    },

    {
      icon: <Briefcase size={28} />,
      title: "Office Day",
      subtitle: "회사 업무",
      description: "직장인 · 팀장 · 동료",
      scenario: "office",
    },

  ];

  return (

    <div className="scenario">

      <button
        className="back-btn"
        onClick={() => navigate("/")}
      >

        <ArrowLeft size={20} />

      </button>

      <div className="scenario-header">

        <span className="scenario-chip">

          Choose Scenario

        </span>

        <h1>

          어떤 상황을
          <br />
          재구성하시겠습니까?

        </h1>

        <p>

          AI는 하나의 상황 속에서도
          <br />
          사람마다 다른 경험을 이해합니다.

        </p>

      </div>

      <div className="scenario-list">

        {

          scenarios.map((item) => (

            <div

              key={item.title}

              className="scenario-card"

              onClick={() =>

                navigate("/persona", {

                  state: {

                    scenario: item.scenario,

                    title: item.title,

                  },

                })

              }

            >

              <div className="scenario-left">

                <div className="scenario-icon">

                  {item.icon}

                </div>

                <div>

                  <h3>

                    {item.title}

                  </h3>

                  <h4>

                    {item.subtitle}

                  </h4>

                  <span>

                    {item.description}

                  </span>

                </div>

              </div>

              <ChevronRight className="scenario-arrow" />

            </div>

          ))

        }

      </div>

    </div>

  );

};

export default Scenario;