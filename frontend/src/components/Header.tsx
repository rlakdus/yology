import "../styles/header.css";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  title: string;
  showBack?: boolean;
}

const Header = ({ title, showBack = true }: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="header">
      {showBack ? (
        <button
          className="back-button"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
      ) : (
        <div style={{ width: "40px" }} />
      )}

      <h2>{title}</h2>

      <div style={{ width: "40px" }} />
    </header>
  );
};

export default Header;