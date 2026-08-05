import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  PlayCircle,
  Brain,
  Camera,
  MapPinned,
  Glasses,
  HeartPulse,
  MessagesSquare,
  Sparkles
} from "lucide-react";

import "../styles/home.css";

const Home = () => {

  const navigate = useNavigate();

  const features = [

    {
      icon:<Brain size={32}/>,
      title:"AI 추론",
      description:"센서와 행동 데이터를 하나의 이야기로 연결합니다."
    },

    {
      icon:<Camera size={32}/>,
      title:"멀티모달 분석",
      description:"사진, GPS, 대화 데이터를 함께 이해합니다."
    },

    {
      icon:<MapPinned size={32}/>,
      title:"Event Reconstruction",
      description:"시간의 흐름에 따라 사건을 복원합니다."
    },

    {
      icon:<Glasses size={32}/>,
      title:"XR Replay",
      description:"재구성된 경험을 다시 체험합니다."
    }

  ];

  return (

    <div className="home">

      {/* Hero */}

      <section className="hero">

        <div className="hero-chip">

          AI Event Reconstruction Platform

        </div>

        <h1 className="hero-logo">

          FeelBack

        </h1>

        <h2 className="hero-title">

          기억은 흐려져도,

          <br />

          <span>경험은 다시.</span>

        </h2>

        <p className="hero-description">

          FeelBack은 센서 데이터와 멀티모달 정보를 하나의 맥락으로 연결하여
          사건을 재구성하고 감정을 이해하는
          AI Event Reconstruction 플랫폼입니다.

        </p>

        <div className="hero-buttons">

          <button
            className="primary-btn"
            onClick={() => navigate("/persona")}
          >

            데모 시작하기

            <ArrowRight size={18} />

          </button>

          <button className="secondary-btn">

            <PlayCircle size={18} />

            프로젝트 소개

          </button>

        </div>

      </section>

      {/* Features */}

      <section className="features">

        <div className="section-title">

          AI가 하는 일

        </div>

        <h2>

          흩어진 데이터를
          하나의 경험으로 연결합니다.

        </h2>

        <p>

          생체신호, 위치, 이미지, 대화를 연결하여
          사건의 맥락을 이해합니다.

        </p>

        <div className="feature-grid">

          {

            features.map((item)=>(

              <div className="feature-card" key={item.title}>

                <div className="feature-icon">

                  {item.icon}

                </div>

                <h3>

                  {item.title}

                </h3>

                <span>

                  {item.description}

                </span>

              </div>

            ))

          }

        </div>

      </section>

      {/* Flow */}

      <section className="flow">

        <div className="section-title">

          Reconstruction Flow

        </div>

        <h2>

          AI가 사건을 이해하는 과정

        </h2>

        <div className="flow-grid">

          <div className="flow-card">

            <HeartPulse size={32}/>

            <h3>Sensor</h3>

            <span>

              Heart Rate

              <br/>

              Stress

              <br/>

              Motion

            </span>

          </div>

          <div className="flow-arrow">

            →

          </div>

          <div className="flow-card">

            <MessagesSquare size={32}/>

            <h3>Evidence</h3>

            <span>

              Photo

              <br/>

              GPS

              <br/>

              Chat

            </span>

          </div>

          <div className="flow-arrow">

            →

          </div>

          <div className="flow-card">

            <Sparkles size={32}/>

            <h3>AI Reasoning</h3>

            <span>

              Context

              <br/>

              Emotion

              <br/>

              Summary

            </span>

          </div>

          <div className="flow-arrow">

            →

          </div>

          <div className="flow-card">

            <Glasses size={32}/>

            <h3>XR Replay</h3>

            <span>

              Replay

              <br/>

              Visualization

            </span>

          </div>

        </div>

      </section>

    </div>

  );

};

export default Home;