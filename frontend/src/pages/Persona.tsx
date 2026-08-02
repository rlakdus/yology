import { Link } from "react-router-dom";
import Header from "../components/Header";

const personas = [
  {
    id: "caregiver",
    title: "Caregiver",
    description: "Support family members"
  },
  {
    id: "office",
    title: "Office Worker",
    description: "Workplace stress"
  },
  {
    id: "student",
    title: "Student",
    description: "Learning & exam"
  },
  {
    id: "driver",
    title: "Driver",
    description: "Driving situation"
  }
];

const Persona = () => {
  return (
    <>
      <Header title="Choose Persona" />

      <div className="page-container">

        <h2>Select Persona</h2>

        {personas.map((p) => (
          <Link
            key={p.id}
            to="/event"
            style={{ textDecoration: "none" }}
          >
            <div className="persona-card">

              <h3>{p.title}</h3>

              <p>{p.description}</p>

            </div>
          </Link>
        ))}

      </div>
    </>
  );
};

export default Persona;