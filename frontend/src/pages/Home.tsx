import { Link } from "react-router-dom";
import Header from "../components/Header";

import "../styles/home.css";

const Home = () => {
  return (
    <>
      <Header
        title="FeelBack"
        showBack={false}
      />

      <div className="home">

        <div className="home-container">

          <p className="home-subtitle">
            AI-powered Event Reconstruction
          </p>

          <p className="home-description">
            Reconstruct situations
            <br />
            Understand emotions
            <br />
            Support better decisions
          </p>

          <Link to="/persona">
            <button className="start-btn">
              Start
            </button>
          </Link>

        </div>

      </div>
    </>
  );
};

export default Home;