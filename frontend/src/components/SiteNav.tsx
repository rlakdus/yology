import { NavLink, useNavigate } from "react-router-dom";
import "./SiteNav.css";

const SiteNav = () => {
  const navigate = useNavigate();

  return (
    <header className="site-nav-wrap">
      <nav className="site-nav" aria-label="VIVIA main navigation">
        <button
          className="site-brand-image"
          onClick={() => navigate("/")}
          aria-label="VIVIA home"
        >
          <img src="/assets/logo.png" alt="VIVIA" />
        </button>

        <div className="site-nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "is-active" : "")}>Home</NavLink>
          <NavLink to="/how-it-works" className={({ isActive }) => (isActive ? "is-active" : "")}>How it works</NavLink>
          <NavLink to="/moment" className={({ isActive }) => (isActive ? "is-active" : "")}>My Moments</NavLink>
          <NavLink to="/live-demo" className={({ isActive }) => (isActive ? "is-active" : "")}>Live Demo</NavLink>
        </div>
      </nav>
    </header>
  );
};

export default SiteNav;
