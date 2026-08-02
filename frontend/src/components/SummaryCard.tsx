import "../styles/summaryCard.css";

interface SummaryCardProps{

    icon:React.ReactNode;

    title:string;

    value:string;

}

const SummaryCard=({

    icon,

    title,

    value,

}:SummaryCardProps)=>{

    return(

        <div className="summary-card">

            <div className="summary-icon">

                {icon}

            </div>

            <div>

                <p>{title}</p>

                <h2>{value}</h2>

            </div>

        </div>

    )

}

export default SummaryCard;