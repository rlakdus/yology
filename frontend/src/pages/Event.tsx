import { Link } from "react-router-dom";
import "../styles/event.css";
import Header from "../components/Header";

const events = [
  {
    id: 1,
    title: "Hospital Visit",
    location: "Waiting Room",
    stress: "High Stress Detected",
    icon: "🏥",
    enabled: true,
  },
  {
    id: 2,
    title: "Home Meal",
    location: "Coming Soon",
    stress: "",
    icon: "🏡",
    enabled: false,
  },
  {
    id: 3,
    title: "Driving",
    location: "Coming Soon",
    stress: "",
    icon: "🚗",
    enabled: false,
  },
];

const Event = () => {
  return (
    <>
      <Header
        title="Choose Event"
        subtitle="Select reconstructed event"
      />

      <div className="page-container">
        <h2>Select an Event</h2>

        {events.map((event) =>
          event.enabled ? (
            <Link
              key={event.id}
              to="/reconstruction"
              style={{ textDecoration: "none" }}
            >
              <div className="event-card active">
                <h3>
                  {event.icon} {event.title}
                </h3>

                <p>{event.location}</p>

                <span>{event.stress}</span>
              </div>
            </Link>
          ) : (
            <div key={event.id} className="event-card disabled">
              <h3>
                {event.icon} {event.title}
              </h3>

              <p>{event.location}</p>
            </div>
          )
        )}
      </div>
    </>
  );
};

export default Event;