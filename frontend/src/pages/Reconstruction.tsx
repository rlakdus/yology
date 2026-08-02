import Header from "../components/Header";
import SectionTitle from "../components/SectionTitle";
import SensorCard from "../components/SensorCard";
import EvidenceCard from "../components/EvidenceCard";
import ReasoningFlow from "../components/ReasoningFlow";

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

        <img
          src="https://placehold.co/900x350"
          className="cover-image"
          alt="Hospital Visit"
        />

        <h2>Hospital Visit</h2>

        <p className="subtitle">
          Family Caregiver
        </p>

        {/* Sensor Data */}

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