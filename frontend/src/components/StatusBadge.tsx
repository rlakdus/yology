import "./StatusBadge.css";

interface StatusBadgeProps {
  status: "High" | "Medium" | "Normal";
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const className = `status-badge ${status.toLowerCase()}`;

  return (
    <div className={className}>

      <div className="status-dot"></div>

      <span>{status} Stress</span>

    </div>
  );
};

export default StatusBadge;