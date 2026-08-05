import "./SensorCard.css";

interface SensorCardProps{

    icon: React.ReactNode;

    title:string;

    value:string;

}

const SensorCard = ({
    icon,
    title,
    value,
}:SensorCardProps)=>{

    return(

        <div className="sensor-card">

            <div className="sensor-icon">

                {icon}

            </div>

            <div>

                <p className="sensor-title">

                    {title}

                </p>

                <h3>

                    {value}

                </h3>

            </div>

        </div>

    );

};

export default SensorCard;