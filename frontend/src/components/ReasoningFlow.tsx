import "./ReasoningFlow.css";
import { ChevronDown } from "lucide-react";

interface Step {
  icon: React.ReactNode;
  title: string;
}

interface ReasoningFlowProps {
  steps: Step[];
  result: string;
}

const ReasoningFlow = ({
  steps,
  result,
}: ReasoningFlowProps) => {
  return (
    <div className="reasoning-flow">

      {steps.map((step, index) => (
        <div key={index}>

          <div className="flow-card">

            <div className="flow-icon">
              {step.icon}
            </div>

            <span>{step.title}</span>

          </div>

          {index !== steps.length - 1 && (
            <div className="flow-arrow">
              <ChevronDown size={26} />
            </div>
          )}

        </div>
      ))}

      <div className="flow-result">

        <h4>Predicted Emotion</h4>

        <h2>{result}</h2>

        <p>Confidence 91%</p>

      </div>

    </div>
  );
};

export default ReasoningFlow;