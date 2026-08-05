import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";

import Header from "../components/Header";
import "../styles/event.css";

type Episode = {
  id: string;
  start: string;
  peak_hr: number;
  excess_bpm: number;
  score: number;
};

type Person = { episodes: Episode[] };

const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value.replace(" ", "T")));

const HeEvents = () => {
  const [event, setEvent] = useState<Episode | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/he-anomaly-episodes.json")
      .then((response) => {
        if (!response.ok) throw new Error("HE 이벤트 데이터를 불러오지 못했습니다.");
        return response.json() as Promise<{ person: Person }>;
      })
      .then((payload) => setEvent(payload.person.episodes[0] ?? null))
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "HE 이벤트 데이터를 불러오지 못했습니다.");
      });
  }, []);

  return (
    <>
      <Header title="HE 이벤트 선택" subtitle="개발용 생체 데이터 이벤트" />
      <main className="page-container">
        <h2>이벤트 선택</h2>
        {error && <p>{error}</p>}
        {!error && !event && <p>HE 이벤트를 불러오는 중입니다…</p>}
        {event && (
          <Link to={`/persona/he/reconstruction/${event.id}`}>
            <article className="event-card active">
              <h3><HeartPulse size={20} /> 심박 이상 이벤트</h3>
              <p>{formatDate(event.start)} · 최고 심박 {event.peak_hr} bpm</p>
              <span>기대치 대비 +{event.excess_bpm.toFixed(1)} bpm · 탐지 점수 {event.score.toFixed(1)}</span>
            </article>
          </Link>
        )}
      </main>
    </>
  );
};

export default HeEvents;
