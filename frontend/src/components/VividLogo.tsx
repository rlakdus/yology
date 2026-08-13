import logo from "../assets/logo.png";

interface Props {
  height?: number;
  className?: string;
}

const VividLogo = ({ height = 24, className }: Props) => {
  return (
    <img
      src={logo}
      alt="VIVIA"
      className={`vivid-logo-img${className ? ` ${className}` : ""}`}
      style={{ height }}
    />
  );
};

export default VividLogo;
