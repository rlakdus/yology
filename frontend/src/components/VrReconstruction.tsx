import { Box, CircleDashed, Play } from "lucide-react";

import "../styles/vrReconstruction.css";

export type VrEventContext = {
  id: string;
  title: string;
  description: string;
};

interface VrReconstructionProps {
  event: VrEventContext;
  onLaunch?: (event: VrEventContext) => void;
}

const VrReconstruction = ({ event, onLaunch }: VrReconstructionProps) => {
  const isReady = Boolean(onLaunch);

  return (
    <section className="vr-reconstruction" aria-labelledby="vr-reconstruction-title">
      <div className="vr-icon"><Box size={28} /></div>
      <div className="vr-content">
        <p className="vr-eyebrow">DEVELOPMENT MODULE</p>
        <h3 id="vr-reconstruction-title">VR RECONSTRUCTION</h3>
        <p>{event.title}</p>
        <small>{event.description}</small>
      </div>
      <button
        className="vr-launch-button"
        disabled={!isReady}
        onClick={() => onLaunch?.(event)}
      >
        {isReady ? <Play size={18} /> : <CircleDashed size={18} />}
        {isReady ? "VR 시작" : "VR 모듈 준비 중"}
      </button>
    </section>
  );
};

export default VrReconstruction;
