import { useNavigate } from "react-router-dom";

import Header from "../components/Header";
import PersonaCard from "../components/PersonaCard";

import "../styles/persona.css";

const personas = [
  {
    title: "가족 돌봄",
    subtitle: "Family Caregiver",
    description: "병원 방문 중 발생한 상황을 AI가 재구성합니다.",
    image: "/images/hospital.jpg",
    badge: "Medical",
    stress: "High",
    location: "Hospital",
    path: "/event",
  },
  {
    title: "학생",
    subtitle: "Student",
    description: "시험 기간 동안의 스트레스 상황을 분석합니다.",
    image: "/images/student.jpg",
    badge: "Education",
    stress: "Medium",
    location: "Campus",
    path: "/event",
  },
  {
    title: "운전자",
    subtitle: "Driver",
    description: "교통 혼잡 환경에서의 이벤트를 재구성합니다.",
    image: "/images/driving.jpg",
    badge: "Mobility",
    stress: "High",
    location: "Downtown",
    path: "/event",
  },
  {
    title: "시니어",
    subtitle: "Senior",
    description: "일상 생활 속 이상 상황을 AI가 분석합니다.",
    image: "/images/caregiver.jpg",
    badge: "Healthcare",
    stress: "Normal",
    location: "Home",
    path: "/event",
  },
  {
    title: "HE 개발 페르소나",
    subtitle: "Biometric Anomaly",
    description: "HE 생체 데이터에서 탐지된 이상 이벤트를 재현합니다.",
    image: "/images/hospital.jpg",
    badge: "Development",
    stress: "Detected",
    location: "Biometric Data",
    path: "/persona/he/events",
  },
];

const Persona = () => {
  const navigate = useNavigate();

  return (
    <>
      <Header title="Persona" subtitle="AI가 분석할 시나리오를 선택하세요." />

      <div className="page">
        <section className="persona-hero">
          <span className="hero-chip">Scenario Selection</span>

          <h1>
            어떤 경험을
            <br />
            <span>재구성</span>하시겠습니까?
          </h1>

          <p>
            FeelBack은 다양한 페르소나의 행동과 상황 데이터를 분석하여 사건의 맥락을
            복원합니다.
          </p>
        </section>

        <section className="persona-grid">
          {personas.map(({ path, ...persona }) => (
            <PersonaCard
              key={persona.subtitle}
              {...persona}
              onClick={() => navigate(path)}
            />
          ))}
        </section>
      </div>
    </>
  );
};

export default Persona;
