import "./SectionTitle.css";

interface Props{
    title:string;
}

const SectionTitle = ({title}:Props)=>{

    return(

        <div className="section-title">

            <h2>{title}</h2>

            <div className="section-line"/>

        </div>

    );

};

export default SectionTitle;