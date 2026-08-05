import "./Timeline.css";

interface TimelineItem {
  icon: React.ReactNode;
  time: string;
  title: string;
  description: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

const Timeline = ({ items }: TimelineProps) => {
  return (
    <div className="timeline">

      {items.map((item, index) => (

        <div
          key={index}
          className="timeline-item"
        >

          <div className="timeline-left">

            <div className="timeline-time">

              {item.time}

            </div>

            <div className="timeline-dot"></div>

            {index !== items.length - 1 && (
              <div className="timeline-line"></div>
            )}

          </div>

          <div className="timeline-content">

            <div className="timeline-header">

              <div className="timeline-icon">

                {item.icon}

              </div>

              <h3>{item.title}</h3>

            </div>

            <p>{item.description}</p>

          </div>

        </div>

      ))}

    </div>
  );
};

export default Timeline;