import { ChevronRight } from "lucide-react";
import "./EvidenceCard.css";

interface EvidenceCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const EvidenceCard = ({
  icon,
  title,
  subtitle,
}: EvidenceCardProps) => {
  return (
    <div className="evidence-card">

      <div className="evidence-icon">
        {icon}
      </div>

      <div className="evidence-content">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      <div className="evidence-arrow">
        <ChevronRight size={22} />
      </div>

    </div>
  );
};

export default EvidenceCard;