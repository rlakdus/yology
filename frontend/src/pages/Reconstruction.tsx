import Header from "../components/Header";
import SectionTitle from "../components/SectionTitle";
import SensorCard from "../components/SensorCard";
import EvidenceCard from "../components/EvidenceCard";
import ReasoningFlow from "../components/ReasoningFlow";
import StatusBadge from "../components/StatusBadge";
import Timeline from "../components/Timeline";
import SummaryCard from "../components/SummaryCard";

import "../styles/reconstruction.css";

import {
  Heart,
  Activity,
  MapPin,
  Clock,
  Image,
  MessageCircle,
  Brain,
  GraduationCap,
  Glasses,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

const Reconstruction = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    momentTitle = "중요한 시험",
    momentDescription = "긴장과 집중이 가장 높았던 시험 전후의 순간",
    demoSource = "student",
    eventId = "event_001",
  } = location.state || {};

  const handleVrReplay = () => {
    navigate(`/vr/${demoSource}/${eventId}`);
  };

  return (
    <>
      <Header
        title="Event Reconstruction"
        subtitle="AI reconstructed context"
      />

      <div className="page-container">

        {/* Hero Cover */}

        <div className="hero">

          <img
            src="https://placehold.co/900x350/eaf3ff/0f6fff?text=Study+Session"
            className="cover-image"
            alt="Study Session"
          />

          <div className="hero-overlay">

            <h1 className="hero-title">
              {momentTitle}
            </h1>

            <p className="hero-sub">
              Study Session · Student
            </p>

            <div className="hero-info">

              <StatusBadge status="High" />

              <div className="badge">
                🕒 14:25
              </div>

            </div>

          </div>

        </div>

        {/* Summary */}

        <div className="summary-grid">

          <SummaryCard
            icon={<Image size={28} />}
            title="Evidence"
            value="3"
          />

          <SummaryCard
            icon={<Heart size={28} />}
            title="Sensors"
            value="4"
          />

          <SummaryCard
            icon={<Brain size={28} />}
            title="Confidence"
            value="91%"
          />

        </div>

        {/* Sensor */}

        <SectionTitle title="Sensor Data" />

        <div className="sensor-grid">

          <SensorCard
            icon={<Heart size={24} />}
            title="Heart Rate"
            value="112 bpm"
          />

          <SensorCard
            icon={<Activity size={24} />}
            title="Stress"
            value="High"
          />

          <SensorCard
            icon={<MapPin size={24} />}
            title="Context"
            value="Study Session"
          />

          <SensorCard
            icon={<Clock size={24} />}
            title="Time"
            value="14:25"
          />

        </div>

        {/* Evidence */}

        <SectionTitle title="Evidence" />

        <EvidenceCard
          icon={<Image size={26} />}
          title="Study Environment"
          subtitle="Captured Image"
        />

        <EvidenceCard
          icon={<MessageCircle size={26} />}
          title="Conversation Record"
          subtitle="Message Context"
        />

        <EvidenceCard
          icon={<GraduationCap size={26} />}
          title="Exam Context"
          subtitle="Academic Schedule"
        />

        {/* Timeline */}

        <SectionTitle title="Timeline" />

        <Timeline
          items={[
            {
              icon: <GraduationCap size={20} />,
              time: "14:03",
              title: "Study Session Started",
              description:
                "시험을 앞두고 집중 학습을 시작했습니다.",
            },
            {
              icon: <Heart size={20} />,
              time: "14:12",
              title: "Heart Rate Increased",
              description:
                "심박수가 평소보다 빠르게 증가하기 시작했습니다.",
            },
            {
              icon: <Activity size={20} />,
              time: "14:20",
              title: "Stress Level Increased",
              description:
                "집중과 긴장이 동시에 높아지며 스트레스 신호가 탐지되었습니다.",
            },
            {
              icon: <Brain size={20} />,
              time: "14:25",
              title: "Stress Peak Detected",
              description:
                "AI가 해당 구간을 중요한 스트레스 이벤트로 판단했습니다.",
            },
          ]}
        />

        {/* AI Reasoning */}

        <SectionTitle title="AI Reasoning" />

        <ReasoningFlow
          steps={[
            {
              icon: <Heart size={24} />,
              title: "Elevated Heart Rate",
            },
            {
              icon: <Activity size={24} />,
              title: "High Stress Signal",
            },
            {
              icon: <GraduationCap size={24} />,
              title: "Exam Context",
            },
            {
              icon: <Brain size={24} />,
              title: "AI Context Analysis",
            },
          ]}
          result="Exam Anxiety & High Focus"
        />

        {/* Reconstruction Summary */}

        <div className="reconstruction-summary-box">

          <span className="reconstruction-summary-label">
            RECONSTRUCTED MEMORY
          </span>

          <h3>
            AI가 이 순간을 이렇게 해석했습니다.
          </h3>

          <p>
            {momentDescription}
            {" "}
            심박과 스트레스 신호가 동시에 증가했고,
            시험이라는 상황적 맥락을 종합했을 때
            높은 긴장감과 집중이 공존했던 순간으로 추정됩니다.
          </p>

        </div>

        {/* VR */}

        <button
          className="primary-btn"
          onClick={handleVrReplay}
        >
          <Glasses size={20} />
          VR로 다시 경험하기
        </button>

      </div>
    </>
  );
};

export default Reconstruction;