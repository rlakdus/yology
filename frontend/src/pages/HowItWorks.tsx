import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, BrainCircuit, Clock3, HeartPulse, MapPin, Moon, Play, Search, Sparkles, Waves,
} from "lucide-react";
import SiteNav from "../components/SiteNav";
import "../styles/howItWorks.css";

const signalCards = [
  ["심박수", "72 bpm", HeartPulse], ["HRV", "58 ms", Waves], ["활동량", "320 kcal", Activity], ["수면", "7h 24m", Moon],
] as const;

const processNav = [
  ["01", "Sense", "신호 감지", HeartPulse], ["02", "Detect", "변화 탐지", Activity], ["03", "Explore", "맥락 확인", Search], ["04", "Reconstruct", "이야기 재구성", Sparkles], ["05", "Replay", "다시 경험", Play],
] as const;

const HowItWorks = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);

  const jumpToStep = (step: number) => {
    setActiveStep(step);
    document.getElementById(`hiw-step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    const nodes = processNav.map((_, i) => document.getElementById(`hiw-step-${i + 1}`)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveStep(Number((visible.target as HTMLElement).dataset.step || 1));
    }, { threshold: [0.28, 0.5, 0.7] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="hiw-page hiw-v6">
      <SiteNav />
      <main>
        <section className="hiw-hero shell">
          <div className="hiw-hero-copy">
            <span>HOW VIVIA WORKS</span>
            <h1>몸의 신호에서 시작해,<br/><em>다시 경험하는 이야기</em>까지.</h1>
            <p>현재 데모는 생체신호 변화 감지, 순간 상세 확인, AI 기반 상황 재구성, 몰입형 리플레이까지 하나의 흐름으로 연결합니다.</p>
            <div><button className="vh-primary" onClick={() => navigate("/moment")}>My Moments 시작하기 <ArrowRight size={17}/></button><button className="vh-secondary" onClick={() => jumpToStep(1)}>전체 과정 둘러보기</button></div>
          </div>
          <div className="hiw-dashboard interactive-panel">
            <div className="hiw-dashboard-glow" />
            <div className="hiw-dashboard-top"><span>실시간 신호 대시보드</span><b>● LIVE</b></div>
            <div className="hiw-dashboard-grid">
              {signalCards.map(([label,value,Icon], index) => <button key={label} onClick={() => jumpToStep(index < 2 ? 1 : 2)}><small>{label}</small><strong>{value}</strong><Icon size={20}/><i/></button>)}
              <button className="hiw-device" onClick={() => jumpToStep(1)}><span>VIVIA</span><b>signal source</b></button>
            </div>
          </div>
        </section>

        <section className="hiw-process-nav-wrap">
          <div className="hiw-process-nav shell">
            {processNav.map(([no,en,ko,Icon], i) => (
              <button key={en} className={activeStep === i + 1 ? "active" : ""} onClick={() => jumpToStep(i + 1)}>
                <span><Icon size={19}/></span><div><small>{no}</small><strong>{en}</strong><em>{ko}</em></div>
              </button>
            ))}
          </div>
        </section>

        <section id="hiw-step-1" data-step="1" className={`hiw-step shell ${activeStep===1?"is-active":""}`}><aside><span>01 · SENSE</span><h2>신호를 감지합니다.</h2><p>웨어러블 기반 심박, HRV, 활동량 등 현재 구현 범위의 생체 데이터를 읽습니다.</p><button onClick={() => navigate("/persona/he/events")}>신호 데이터 보기 <ArrowRight size={15}/></button></aside><div className="hiw-signal-panel">{signalCards.map(([label,value,Icon],index) => <article key={label}><Icon/><span>{label}</span><strong>{value}</strong><svg viewBox="0 0 100 30"><path d={index%2===0?"M0 20 C18 8 25 26 43 14 S70 3 100 15":"M0 17 C15 25 25 7 42 16 S70 25 100 8"}/></svg></article>)}</div></section>

        <section id="hiw-step-2" data-step="2" className={`hiw-step shell ${activeStep===2?"is-active":""}`}><aside><span>02 · DETECT</span><h2>의미 있는 변화를 찾습니다.</h2><p>개인의 평소 패턴과 비교해 눈에 띄는 변화 구간을 찾고, 사용자가 확인할 후보 순간으로 제안합니다.</p><button onClick={() => navigate("/persona/he/events")}>감지된 순간 보기 <ArrowRight size={15}/></button></aside><div className="hiw-timeline"><div className="hiw-time-line"/>{["09:12","12:47","15:33","21:10"].map((time,i)=><button key={time} className={i===1?"is-hot":""} onClick={() => setActiveStep(3)}><b>{time}</b><span>{["평온한 아침","집중이 높아진 시간","감정 변화 감지","수면 시작"][i]}</span><small>{["72 bpm · 낮음","102 bpm · 높음","92 bpm · 중간","61 bpm · 안정"][i]}</small></button>)}</div></section>

        <section id="hiw-step-3" data-step="3" className={`hiw-step shell ${activeStep===3?"is-active":""}`}><aside><span>03 · EXPLORE</span><h2>순간의 맥락을 확인합니다.</h2><p>이벤트 상세 화면에서 신호 변화와 시간·위치·상황 정보를 함께 확인합니다.</p><button onClick={() => navigate("/event")}>이벤트 상세 보기 <ArrowRight size={15}/></button></aside><div className="hiw-detail"><div><strong>집중이 높아진 시간</strong><small>12:47 · 2026.05.18</small><svg viewBox="0 0 500 130"><path d="M0 90 C40 85 55 65 90 76 S150 95 185 68 S242 50 276 58 S330 25 370 52 S430 92 500 60"/></svg></div><ul><li><HeartPulse/>심박 <b>102 bpm</b></li><li><Waves/>HRV <b>45 ms</b></li><li><MapPin/>위치 <b>Campus</b></li><li><Clock3/>지속 <b>23분</b></li></ul></div></section>

        <section id="hiw-step-4" data-step="4" className={`hiw-step shell ${activeStep===4?"is-active":""}`}><aside><span>04 · RECONSTRUCT</span><h2>신호와 맥락을 연결해 이야기를 재구성합니다.</h2><p>현재 구현된 reconstruction 흐름은 신호·주변 단서·상황 정보를 결합해 설명 가능한 스토리로 정리합니다.</p><button onClick={() => navigate("/reconstruction")}>재구성 보기 <ArrowRight size={15}/></button></aside><div className="hiw-reconstruct">{[[BrainCircuit,"신호 분석","생체 지표의 변화"],[Search,"맥락 연결","시간·위치·주변 단서"],[Sparkles,"스토리 생성","상황을 설명하는 문장"],[Play,"재구성 완료","다시 볼 이야기"]].map(([Icon,title,desc],i)=>{ const I = Icon as typeof HeartPulse; return <article key={title as string}><I/><strong>{title as string}</strong><span>{desc as string}</span>{i<3&&<ArrowRight/>}</article>})}</div></section>

        <section id="hiw-step-5" data-step="5" className={`hiw-step shell ${activeStep===5?"is-active":""}`}><aside><span>05 · REPLAY</span><h2>기록된 순간을 몰입형으로 다시 경험합니다.</h2><p>VR 페이지에서 360° 장면과 기록된 심박 기반 heartbeat audio, 지원 기기의 haptic 반응을 활용합니다.</p><button onClick={() => navigate("/vr/he/event_001")}>리플레이 시작하기 <ArrowRight size={15}/></button></aside><div className="hiw-replay"><img src="/images/driving.jpg" alt="몰입형 리플레이 예시"/><div className="hiw-replay-overlay"><span>재구성된 이야기</span><button onClick={() => navigate("/vr/he/event_001")}><Play/></button><div><b>360° scene</b><b>heartbeat audio</b><b>haptics</b></div></div></div></section>

        <section className="hiw-summary shell"><h2>한눈에 보는 VIVIA</h2><div>{processNav.map(([no,en,ko,Icon],i)=><button key={en} className={activeStep===i+1?"active":""} onClick={() => jumpToStep(i+1)}><Icon/><strong>{no}. {en}</strong><span>{ko}</span>{i<4&&<ArrowRight/>}</button>)}</div></section>

        <section className="hiw-final-band"><div className="shell"><div><span>FROM SIGNAL TO STORY</span><h2>작은 신호가, 다시 만나고 싶은 순간이 됩니다.</h2></div><div><button className="vh-primary" onClick={() => navigate("/moment")}>My Moments 시작하기 <ArrowRight size={17}/></button><button className="vh-secondary" onClick={() => navigate("/")}>Home</button></div></div></section>
      </main>
      <footer className="hiw-footer">
        <div className="shell hiw-footer-inner">
          <div className="hiw-footer-brand"><img src="/assets/logo.png" alt="VIVIA"/><p>몸의 신호가 삶의 이야기가 됩니다.</p></div>
          <div><strong>EXPLORE</strong><button onClick={() => navigate("/")}>Home</button><button onClick={() => navigate("/moment")}>My Moments</button></div>
          <div><strong>DEMO</strong><button onClick={() => navigate("/persona/he/events")}>Live Demo</button><button onClick={() => navigate("/vr/he/event_001")}>VR Replay</button></div>
          <div><strong>TEAM</strong><span>TEAM YOLOGY</span><span>Samsung Life Lifenology Lab · 2026</span></div>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorks;
