import { ArrowLeft, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import "../styles/persona.css";

type PersonaProfile = {
  name: string;
  role: string;
  age: string;
  status: string;
  description: string;
  path?: string;
};

const personaMap: Record<string, PersonaProfile[]> = {
  hospital: [
    {
      name: "김하린",
      role: "Family Caregiver",
      age: "24세 · 사회초년생",
      status: "Stress High",
      description: "검사 결과를 기다리는 보호자",
    },
    {
      name: "이정순",
      role: "Patient",
      age: "72세 · 정기 검진",
      status: "Physical Condition",
      description: "입원 치료 중인 환자",
    },
    {
      name: "김현우",
      role: "Medical Staff",
      age: "31세 · 응급실 간호사",
      status: "Workload High",
      description: "응급실 근무 중",
    },
    {
      name: "HE 개발 페르소나",
      role: "Biometric Anomaly",
      age: "HE 생체 데이터",
      status: "Anomaly Detected",
      description: "탐지된 이상 이벤트를 재현합니다.",
      path: "/persona/he/events",
    },
  ],
  study: [
    {
      name: "정유진",
      role: "Student",
      age: "23세 · 컴퓨터공학",
      status: "Stress High",
      description: "시험기간을 보내는 대학생",
    },
    {
      name: "박소연",
      role: "Friend",
      age: "23세 · 같은 학과",
      status: "Stable",
      description: "함께 공부하는 친구",
    },
    {
      name: "최민석",
      role: "Professor",
      age: "48세 · 교수",
      status: "Busy",
      description: "시험 감독 중",
    },
  ],
  office: [
    {
      name: "이도현",
      role: "Office Worker",
      age: "25세 · 신입사원",
      status: "Fatigue High",
      description: "프로젝트 마감 주간",
    },
    {
      name: "박정우",
      role: "Team Leader",
      age: "39세 · 팀장",
      status: "Workload High",
      description: "프로젝트 총괄",
    },
    {
      name: "김은지",
      role: "Coworker",
      age: "27세 · 동료",
      status: "Normal",
      description: "같은 팀 구성원",
    },
  ],
};

const Persona = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const scenario = location.state?.scenario || "hospital";
  const title = location.state?.title || "Hospital Visit";
  const personas = personaMap[scenario] ?? personaMap.hospital;

  const vrPersona = {
    hospital: "he",
    study: "student",
    office: "office",
  }[scenario as "hospital" | "study" | "office"] ?? "he";

  return (
    <div className="persona">
      <button className="back-btn" onClick={() => navigate("/scenario")}>
        <ArrowLeft size={20} />
      </button>

      <div className="persona-header">
        <span className="persona-chip">{title}</span>
        <h1>Choose Persona</h1>
        <p>
          같은 상황에서도 사람마다 경험과 감정은 다릅니다.
          <br />
          재구성할 인물을 선택해주세요.
        </p>
      </div>

      <div className="persona-grid">
        {personas.map((person) => (
          <div className="persona-card" key={person.name}>
            <div className="persona-avatar">
              <UserRound size={42} />
            </div>
            <h2>{person.name}</h2>
            <h3>{person.role}</h3>
            <span className="persona-age">{person.age}</span>
            <p>{person.description}</p>
            <div className="persona-status">{person.status}</div>
            <div className="persona-actions">
              <button
                className="persona-btn persona-btn-secondary"
                onClick={() =>
                  person.path
                    ? navigate(person.path)
                    : navigate("/event", {
                        state: {
                          scenario,
                          persona: person.name,
                        },
                      })
                }
              >
                경험 재구성 →
              </button>
              <button
                className="persona-btn"
                onClick={() => navigate(`/vr/${vrPersona}/event_001`)}
              >
                VR 체험 →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Persona;
