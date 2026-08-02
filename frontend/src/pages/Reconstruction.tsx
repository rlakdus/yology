import Header from "../components/Header";

const Reconstruction = () => {
  return (
    <>
      <Header title="Event Reconstruction" />

      <div className="page-container">

        <img
          src="https://placehold.co/900x350"
          className="cover-image"
          alt=""
        />

        <h2>Hospital Visit</h2>

        <p className="subtitle">
          Family Caregiver
        </p>

        <div className="section">

          <h3>Sensor Summary</h3>

          <div className="info-card">
            ❤️ Heart Rate
            <span>118 bpm</span>
          </div>

          <div className="info-card">
            😰 Stress
            <span>High</span>
          </div>

          <div className="info-card">
            📍 Location
            <span>Seoul Hospital</span>
          </div>

        </div>

        <div className="section">

          <h3>Evidence</h3>

          <div className="info-card">
            📷 Waiting Room Image
          </div>

          <div className="info-card">
            💬 Caregiver Chat
          </div>

          <div className="info-card">
            📍 Hospital GPS
          </div>

        </div>

        <div className="section">

          <h3>AI Reasoning</h3>

          <div className="reason-box">

            High Heart Rate

            <br />

            +

            <br />

            Hospital Location

            <br />

            +

            <br />

            Family Chat

            <br /><br />

            ↓

            <br /><br />

            <strong>
              Emotion Candidate :
              Anxiety
            </strong>

          </div>

        </div>

        <button className="start-btn">

          Start VR Reconstruction

        </button>

      </div>
    </>
  );
};

export default Reconstruction;