import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Scenario from "./pages/Scenario";
import Persona from "./pages/Persona";
import Event from "./pages/Event";
import Reconstruction from "./pages/Reconstruction";
import HeEvents from "./pages/HeEvents";
import HeReconstruction from "./pages/HeReconstruction";
import VrScene from "./pages/VrScene";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/scenario"
          element={<Scenario />}
        />

        <Route
          path="/persona"
          element={<Persona />}
        />

        <Route
          path="/event"
          element={<Event />}
        />

        <Route
          path="/reconstruction"
          element={<Reconstruction />}
        />

        <Route
          path="/persona/he/events"
          element={<HeEvents />}
        />

        <Route
          path="/persona/he/reconstruction/:eventId"
          element={<HeReconstruction />}
        />

        <Route
          path="/vr/:persona/:eventId"
          element={<VrScene />}
        />

      </Routes>

    </BrowserRouter>

  );

}

export default App;
