import { NavLink, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import VividLogo from "./VividLogo";
import "./TopNav.css";

type Tab =
  | { label: string; to: string; soon?: false }
  | { label: string; to?: undefined; soon: true };

const TABS: Tab[] = [
  { label: "Home", to: "/" },
  { label: "How it works", to: "/how-it-works" },
  { label: "My Moments", soon: true },
  { label: "Experience", soon: true },
  { label: "Profile", soon: true },
];

const TopNav = () => {
  const navigate = useNavigate();

  return (
    <nav className="topnav">
      <NavLink to="/" className="topnav-brand" end>
        <VividLogo height={22} />
      </NavLink>

      <div className="topnav-tabs">
        {TABS.map((tab) =>
          tab.soon ? (
            <span className="topnav-tab soon" key={tab.label}>
              {tab.label}
            </span>
          ) : (
            <NavLink
              to={tab.to}
              key={tab.label}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `topnav-tab${isActive ? " active" : ""}`
              }
            >
              {tab.label}
            </NavLink>
          )
        )}
      </div>

      <button className="topnav-cta" onClick={() => navigate("/persona")}>
        <span>시작하기</span>
        <ArrowRight size={15} />
      </button>
    </nav>
  );
};

export default TopNav;
