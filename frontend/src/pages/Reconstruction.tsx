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
} from "lucide-react";

const Reconstruction = () => {
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
            src="https://placehold.co/900x350"
            className="cover-image"
            alt="Hospital Visit"
          />

          <div className="hero-overlay">

            <h1 className="hero-title">
              Hospital Visit
            </h1>

            <p className="hero-sub">
              Family Caregiver
            </p>

            <div className="hero-info">

              <StatusBadge status="High" />

              <div className="badge">
                🕒 12:15 PM
              </div>

            </div>

          </div>

        </div>

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
            value="118 bpm"
          />

          <SensorCard
            icon={<Activity size={24} />}
            title="Stress"
            value="High"
          />

          <SensorCard
            icon={<MapPin size={24} />}
            title="Location"
            value="Seoul Hospital"
          />

          <SensorCard
            icon={<Clock size={24} />}
            title="Time"
            value="12:15 PM"
          />

        </div>

        {/* Evidence */}

        <SectionTitle title="Evidence" />

        <EvidenceCard
          icon={<Image size={26} />}
          title="Waiting Room Image"
          subtitle="Hospital Camera"
        />

        <EvidenceCard
          icon={<MessageCircle size={26} />}
          title="Caregiver Chat"
          subtitle="KakaoTalk Conversation"
        />

        <EvidenceCard
          icon={<MapPin size={26} />}
          title="Hospital GPS"
          subtitle="Location History"
        />

        <SectionTitle title="Timeline" />

        <Timeline
          items={[
            {
              icon: <Heart size={20} />,
              time: "12:03",
              title: "Heart Rate Increased",
              description: "Heart rate rose above the normal range.",
            },
            {
              icon: <MapPin size={20} />,
              time: "12:07",
              title: "Entered Hospital",
              description: "GPS detected arrival at Seoul Hospital.",
            },
            {
              icon: <MessageCircle size={20} />,
              time: "12:10",
              title: "Family Conversation",
              description: "Caregiver exchanged messages with family.",
            },
            {
              icon: <Activity size={20} />,
              time: "12:15",
              title: "Stress Peak",
              description: "Stress level reached its highest point.",
            },
          ]}
        />

        {/* AI Reasoning */}

        <SectionTitle title="AI Reasoning" />

        <ReasoningFlow
          steps={[
            {
              icon: <Heart size={24} />,
              title: "Heart Rate 118 bpm",
            },
            {
              icon: <MapPin size={24} />,
              title: "Hospital Location",
            },
            {
              icon: <MessageCircle size={24} />,
              title: "Caregiver Conversation",
            },
            {
              icon: <Brain size={24} />,
              title: "AI Context Analysis",
            },
          ]}
          result="Anxiety"
        />

        <button className="primary-btn">
          Start VR Reconstruction
        </button>

      </div>
    </>
  );
};

export default Reconstruction;