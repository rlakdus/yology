import { Link } from "react-router-dom";
import Header from "../components/Header";

import "../styles/home.css";

const Home = () => {
  return (
    <>
      <Header
        title="FeelBack"
        subtitle="AI-powered Event Reconstruction"
        showBack={false}
      />

      <div className="home">

        <div className="home-container">

          <p className="home-subtitle">
            AI-powered Event Reconstruction
          </p>

          <p className="home-description">

            Recover Context

            <br /><br />

            Understand Emotion

            <br /><br />

            Support Better Decisions

          </p>

          <Link to="/persona">
            <button className="primary-btn">

              Start

            </button>
          </Link>

        </div>

      </div>
    </>
  );
};

export default Home;