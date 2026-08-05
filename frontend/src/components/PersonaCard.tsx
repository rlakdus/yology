import { ArrowRight, Heart, MapPin } from "lucide-react";
import "./PersonaCard.css";

interface PersonaProps {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  badge: string;
  stress: string;
  location: string;
  onClick: () => void;
}

const PersonaCard = ({
  title,
  subtitle,
  description,
  image,
  badge,
  stress,
  location,
  onClick,
}: PersonaProps) => {
  return (
    <div className="persona-card-v2" onClick={onClick}>

      <div className="persona-image">

        <img src={image} alt={title} />

        <div className="image-overlay"></div>

        <span className="persona-badge">
          {badge}
        </span>

      </div>

      <div className="persona-content">

        <h2>{title}</h2>

        <h4>{subtitle}</h4>

        <p>{description}</p>

        <div className="persona-info">

          <div>

            <Heart size={18} />

            <span>{stress}</span>

          </div>

          <div>

            <MapPin size={18} />

            <span>{location}</span>

          </div>

        </div>

        <button className="select-btn">

          시나리오 선택

          <ArrowRight size={18} />

        </button>

      </div>

    </div>
  );
};

export default PersonaCard;