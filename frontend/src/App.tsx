import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import Moment from "./pages/Moment";
import Persona from "./pages/Persona";
import Event from "./pages/Event";
import Reconstruction from "./pages/Reconstruction";
import HeEvents from "./pages/HeEvents";
import HeReconstruction from "./pages/HeReconstruction";
import VrScene from "./pages/VrScene";
import LiveDemo from "./pages/LiveDemo";
import SignalInsight from "./pages/SignalInsight";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />

        <Route path="/moment" element={<Moment />} />
        <Route path="/live-demo" element={<LiveDemo />} />
        <Route path="/signal-insight" element={<SignalInsight />} />

        {/* Journey aliases keep shared/demo links readable and stable. */}
        <Route path="/sense" element={<Navigate to="/live-demo" replace />} />
        <Route path="/capture" element={<Navigate to="/moment" replace />} />
        <Route path="/reconstruct" element={<Navigate to="/reconstruction" replace />} />
        <Route path="/replay" element={<Navigate to="/vr/he/event_001" replace />} />

        <Route path="/persona" element={<Persona />} />

        <Route path="/event" element={<Event />} />

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
