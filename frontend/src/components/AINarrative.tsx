import { useState } from "react";
import { BookOpenText, RefreshCw, Sparkles, Waves } from "lucide-react";

export type NarrativePayload = {
  momentId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  note?: string;
  heartRate: number;
  baseline: number;
  zScore: number;
  movement: string;
  motion: number;
  activeEnergy: number;
  oxygen?: number;
  respiration?: number;
  evidence: string[];
};

type NarrativeResult = {
  title: string;
  lead: string;
  paragraphs: string[];
  closing: string;
  mode: "openai" | "preview";
};

type Props = {
  payload: NarrativePayload;
  fallback: NarrativeResult;
};

const API_BASE = import.meta.env.VITE_LIVE_API_URL || "http://localhost:8000";

export default function AINarrative({ payload, fallback }: Props) {
  const [story, setStory] = useState<NarrativeResult>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const regenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/reconstruct/narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStory(data.narrative);
    } catch (err) {
      console.error(err);
      setStory(fallback);
      setError("AI 서버에 연결되지 않아 미리보기 서사를 보여드리고 있어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vivia-narrative-shell">
      <div className="vivia-narrative-ambient vivia-narrative-ambient-a" />
      <div className="vivia-narrative-ambient vivia-narrative-ambient-b" />

      <div className="vivia-narrative-topbar">
        <div className="vivia-narrative-mark">
          <Sparkles size={18} />
          <div>
            <span>VIVIA · AI NARRATIVE</span>
            <strong>Signals, translated into a memory.</strong>
          </div>
        </div>

        <button
          type="button"
          className="vivia-narrative-regenerate"
          onClick={regenerate}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "is-spinning" : ""} />
          {loading ? "이야기 구성 중" : "AI로 다시 쓰기"}
        </button>
      </div>

      <div className="vivia-narrative-layout">
        <aside className="vivia-narrative-margin">
          <div className="vivia-narrative-index">05</div>
          <div className="vivia-narrative-line" />
          <div className="vivia-narrative-source">
            <Waves size={15} />
            <span>BODY TRACE</span>
          </div>
          <div className="vivia-narrative-source">
            <BookOpenText size={15} />
            <span>CONTEXT</span>
          </div>
        </aside>

        <article className="vivia-narrative-paper">
          <div className="vivia-narrative-meta">
            <span>{payload.date}</span>
            <i />
            <span>{payload.time}</span>
            <i />
            <span>{payload.location}</span>
          </div>

          <h3>{story.title}</h3>
          <p className="vivia-narrative-lead">{story.lead}</p>

          <div className="vivia-narrative-prose">
            {story.paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
            ))}
          </div>

          <div className="vivia-narrative-closing">
            <span />
            <p>{story.closing}</p>
          </div>

          <div className="vivia-narrative-footnote">
            <span className={`vivia-narrative-mode ${story.mode}`}>
              {story.mode === "openai" ? "AI GENERATED" : "PREVIEW NARRATIVE"}
            </span>
            <p>
              신체 신호는 감정 그 자체를 의미하지 않습니다. 이 글은 관측된 변화와 사용자가 남긴 맥락을 바탕으로 재구성한 하나의 이야기입니다.
            </p>
          </div>

          {error && <div className="vivia-narrative-error">{error}</div>}
        </article>
      </div>
    </div>
  );
}
