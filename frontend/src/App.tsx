import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Scenario from "./pages/Scenario";
import Persona from "./pages/Persona";
import Event from "./pages/Event";
import Reconstruction from "./pages/Reconstruction";

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

      </Routes>

    </BrowserRouter>

  );

}

export default App;