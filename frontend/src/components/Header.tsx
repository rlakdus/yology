import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import "../styles/header.css";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

const Header = ({
  title,
  subtitle,
  showBack = true,
}: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="header">

      <div className="header-top">

        {showBack ? (
          <button
            className="back-btn"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={22}/>
          </button>
        ) : (
          <div style={{width:42}}/>
        )}

      </div>

      <h1>{title}</h1>

      {subtitle && (
        <p>{subtitle}</p>
      )}

    </header>
  );
};

export default Header;