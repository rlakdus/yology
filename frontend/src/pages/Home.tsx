import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  HeartPulse,
  MapPin,
  Play,
  RotateCcw,
  Sparkles,
  UserRound,
  Video,
  Waves,
} from "lucide-react";
import SiteNav from "../components/SiteNav";
import "../styles/home.css";

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const moveGlow = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };

  return (
    <div className="vivia-home-v3">
      <SiteNav />

      <aside className="vh-side-dock" aria-label="빠른 이동">
        <button onClick={() => navigate("/moment")}>
          <HeartPulse size={20} />
          <span>나의 순간</span>
        </button>
        <button onClick={() => navigate("/vr/he/event_001")}>
          <Play size={20} />
          <span>리플레이</span>
        </button>
      </aside>

      <main>
        <section className="vh3-hero">
          <div className="vh3-hero-bg" />
          <div className="vh3-hero-grid shell">
            <div className="vh3-hero-copy" data-reveal>
              <span className="vh3-eyebrow">VIA SIGNALS, VIVID STORIES, FOR VITA.</span>
              <h1>
                몸의 신호를 따라,<br />
                <span>놓쳤던 순간을 다시 만납니다.</span>
              </h1>
              <p>
                VIVIA는 생체신호의 변화와 일상의 맥락을 연결해<br />
                의미 있는 순간을 발견하고, 다시 경험할 수 있는 이야기로 재구성합니다.
              </p>
              <div className="vh3-hero-actions">
                <button className="vh3-btn primary" onClick={() => navigate("/moment")}>나의 순간 시작하기 <ArrowRight size={17} /></button>
                <button className="vh3-btn ghost" onClick={() => navigate("/how-it-works")}><Play size={15} /> How it works</button>
              </div>
            </div>

            <div className="vh3-hero-media" data-reveal>
              <img src="/images/vivia-hero-clean.png" alt="일상의 순간을 바라보는 사람" />
              <svg className="vh3-wave" viewBox="0 0 760 170" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="heroWaveV3" x1="0" x2="1">
                    <stop offset="0" stopColor="#35c8c5" />
                    <stop offset="0.55" stopColor="#9b91e8" />
                    <stop offset="1" stopColor="#ff7e73" />
                  </linearGradient>
                </defs>
                <path d="M0,92 C130,70 190,118 290,92 C390,66 415,48 510,70 C600,91 640,122 760,70" fill="none" stroke="url(#heroWaveV3)" strokeWidth="2.5" />
              </svg>
              <button className="vh3-signal-card card-a" onClick={() => navigate("/event")}>
                <span>BODY SIGNAL</span><strong>72 <small>bpm</small></strong><HeartPulse size={19} />
              </button>
              <button className="vh3-signal-card card-b" onClick={() => navigate("/event")}>
                <span>MOMENT DETECTED</span><strong>변화 구간 감지</strong><Activity size={19} />
              </button>
              <button className="vh3-signal-card card-c" onClick={() => navigate("/vr/he/event_001")}>
                <span>REPLAY READY</span><strong>이 순간 다시 보기</strong><Play size={18} />
              </button>
            </div>
          </div>
          <div className="vh3-scroll-cue"><span>SCROLL TO DISCOVER</span><i /></div>
        </section>

        {/* requested first section: current VIVIA concept */}
        <section className="vh3-about shell" data-reveal>
          <div className="vh3-section-heading">
            <span className="vh3-num">01</span>
            <div>
              <span className="vh3-kicker">ABOUT VIVIA</span>
              <h2>VIVIA는 몸의 신호를 읽어<br />삶의 순간을 이야기로 전하는<br />라이프 케어 플랫폼입니다.</h2>
              <p>몸이 남긴 신호를 단서로, 지나간 순간을 더 선명하게 바라보고 삶의 맥락을 다시 연결합니다.</p>
              <button className="vh3-text-link" onClick={() => navigate("/how-it-works")}>더 알아보기 <ArrowRight size={15} /></button>
            </div>
          </div>

          <div className="vh3-connect-panel" onMouseMove={moveGlow}>
            <div className="vh3-brand-line">
              <span className="aqua">Via Signals,</span> <span className="lav">Vivid Stories,</span> for <span className="coral">Vita.</span>
            </div>
            <div className="vh3-connect-grid">
              <button onClick={() => navigate("/event")}>
                <span className="vh3-icon aqua-bg"><Waves /></span>
                <strong>Signal ↔ Story</strong>
                <small>몸의 신호가<br />이야기가 됩니다.</small>
              </button>
              <span className="vh3-link-arrow">↔</span>
              <button onClick={() => navigate("/reconstruction")}>
                <span className="vh3-icon lav-bg"><BookOpenText /></span>
                <strong>Moment ↔ Memory</strong>
                <small>지나간 순간이<br />기억으로 연결됩니다.</small>
              </button>
              <span className="vh3-link-arrow">↔</span>
              <button onClick={() => navigate("/persona")}>
                <span className="vh3-icon coral-bg"><UserRound /></span>
                <strong>ME ↔ WE</strong>
                <small>나의 이야기가<br />우리의 연결이 됩니다.</small>
              </button>
            </div>
          </div>
        </section>

        {/* contents inspired by the user's fourth reference, adapted to implemented scope */}
        <section className="vh3-concept" data-reveal>
          <div className="shell vh3-concept-inner">
            <div className="vh3-concept-copy">
              <span className="vh3-kicker">VIVIA CONCEPT</span>
              <h2>몸은, 당신이 놓친<br />순간을 기억합니다.</h2>
              <p>우리는 많은 순간을 흘려보냅니다. VIVIA는 몸에 남은 변화와 주변의 기록을 함께 읽어, 다시 바라볼 수 있는 순간으로 연결합니다.</p>
            </div>
            <div className="vh3-concept-cards">
              {[
                ["기록되지 않은 순간", "일상의 수많은 장면은 기록되지 않고 지나갑니다.", Waves, "aqua"],
                ["신호로 남은 흔적", "그 순간 몸의 변화는 데이터의 흔적으로 남습니다.", BrainCircuit, "coral"],
                ["기억으로 재탄생", "AI가 신호와 맥락을 연결해 다시 만날 수 있는 이야기로 만듭니다.", Sparkles, "navy"],
              ].map(([title, desc, Icon, tone]) => {
                const IconComp = Icon as typeof Waves;
                return (
                  <article key={title as string} className={`vh3-concept-card ${tone}`} onMouseMove={moveGlow}>
                    <span className="vh3-orb"><IconComp /></span>
                    <h3>{title as string}</h3>
                    <p>{desc as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="vh3-how shell" data-reveal>
          <div className="vh3-inline-head">
            <span className="vh3-kicker">HOW IT WORKS</span>
            <h2>VIVIA는 이렇게 작동합니다.</h2>
            <button onClick={() => navigate("/how-it-works")}>전체 과정 보기 <ArrowRight size={15} /></button>
          </div>
          <div className="vh3-steps">
            {[
              ["01", "Capture", "웨어러블과 기록에서 신호를 수집합니다.", HeartPulse],
              ["02", "Detect", "평소와 다른 변화가 나타난 구간을 찾습니다.", Activity],
              ["03", "Reconstruct", "신호와 맥락을 연결해 이야기를 재구성합니다.", Sparkles],
              ["04", "Replay", "기록된 순간을 몰입형 경험으로 다시 만납니다.", RotateCcw],
            ].map(([no, title, desc, Icon], idx) => {
              const IconComp = Icon as typeof HeartPulse;
              return (
                <div className="vh3-step" key={title as string} onClick={() => idx < 2 ? navigate("/event") : idx === 2 ? navigate("/reconstruction") : navigate("/vr/he/event_001") }>
                  <span className="vh3-step-no">{no as string}</span>
                  <span className="vh3-step-icon"><IconComp /></span>
                  <strong>{title as string}</strong>
                  <small>{desc as string}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="vh3-dark-band" data-reveal>
          <div className="shell vh3-story-band">
            <div className="vh3-dark-copy">
              <span className="vh3-kicker light">YOUR STORY, RECONSTRUCTED</span>
              <h2>당신이 놓친<br />소중한 순간을 복원합니다.</h2>
              <p>현재 데모에서는 감지된 이벤트의 신호와 맥락, 사진·영상 데이터를 연결해 그 순간의 이야기를 다시 구성합니다.</p>
              <button onClick={() => navigate("/reconstruction")}>상황 재구성 보기 <ArrowRight size={16} /></button>
            </div>
            <button className="vh3-replay-preview" onClick={() => navigate("/vr/he/event_001")} onMouseMove={moveGlow}>
              <img src="/images/driving.jpg" alt="재구성된 순간 미리보기" />
              <div className="vh3-replay-overlay" />
              <div className="vh3-replay-copy">
                <span>RECONSTRUCTED MOMENT · 08:15</span>
                <h3>평온했던 아침,<br />다시 만나는 순간</h3>
                <div className="vh3-replay-stats"><span>심박수 <b>72 bpm</b></span><span>HRV <b>58 ms</b></span><span>상태 <b>안정</b></span></div>
              </div>
              <span className="vh3-big-play"><Play /></span>
            </button>
          </div>
        </section>

        <section className="vh3-insight shell" data-reveal>
          <div className="vh3-insight-copy">
            <span className="vh3-kicker">YOUR MOMENT INSIGHT</span>
            <h2>더 깊이 이해하고,<br />다시 경험합니다.</h2>
            <p>VIVIA는 이벤트마다 신호 변화와 맥락을 요약해, 왜 그 순간이 눈에 띄었는지 확인할 수 있도록 돕습니다.</p>
            <button className="vh3-text-link" onClick={() => navigate("/event")}>이벤트 상세 보기 <ArrowRight size={15} /></button>
          </div>
          <div className="vh3-insight-grid">
            <article onClick={() => navigate("/event") }><span>신호 변화</span><strong>+18%</strong><small>개인 baseline 대비</small><div className="mini-line aqua-line" /></article>
            <article onClick={() => navigate("/event") }><span>지속 시간</span><strong>23<em>분</em></strong><small>이상 구간 유지</small><div className="mini-bars" /></article>
            <article onClick={() => navigate("/event") }><span>맥락 연결</span><strong>4<em>개</em></strong><small>시간 · 위치 · 활동 · 기록</small><div className="mini-line lav-line" /></article>
            <article className="insight-accent" onClick={() => navigate("/reconstruction") }><span>Replay Ready</span><h3>이 순간의 이야기가<br />준비되었어요.</h3><button>재구성 보기</button></article>
          </div>
        </section>

        <section className="vh3-final-band" data-reveal>
          <div className="shell">
            <h2>VIVIA와 함께,<br />당신의 이야기를 더 가치 있게.</h2>
            <p>몸의 신호에서 시작되는 새로운 라이프 케어 경험</p>
            <div>
              <button className="vh3-btn aqua-button" onClick={() => navigate("/moment")}>지금 시작하기 <ArrowRight size={16} /></button>
              <button className="vh3-btn dark-ghost" onClick={() => navigate("/how-it-works")}>How it works</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="vh3-footer">
        <div className="shell">
          <div className="vh3-footer-brand">
            <img src="/assets/logo.png" alt="VIVIA" />
            <p>몸의 신호가 삶의 이야기가 됩니다.</p>
          </div>
          <div><strong>PRODUCT</strong><span onClick={() => navigate("/moment")}>My Moments</span><span onClick={() => navigate("/event")}>Event</span><span onClick={() => navigate("/reconstruction")}>Reconstruction</span></div>
          <div><strong>EXPERIENCE</strong><span onClick={() => navigate("/how-it-works")}>How it works</span><span onClick={() => navigate("/vr/he/event_001")}>VR Replay</span></div>
          <div><strong>TEAM YOLOGY</strong><span>Samsung Life Lifenology Lab</span><span>2026</span></div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
