import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

import type { VrEvent } from "../../data/vrEvent";

export type HeartbeatPreludePhase = "intro" | "waiting" | "prelude" | "vr" | "cooldown";

const INTRO_SECONDS = 4.2;
const REVEAL_SECONDS = 1.2;
const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 512;
const BLACK = new Color("#000000");
const PULSE_GLOW = new Color("#19070c");
const veilColor = new Color();
const viewerPosition = new Vector3();

const DEFAULT_GUIDANCE: [string, string] = [
  "잠시 숨을 고르고, 몸 안에 남은 박동에 귀 기울여 봅니다.",
  "네 번의 박동을 따라가면, 그 순간의 공간이 천천히 열립니다.",
];

const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));

const smoothstep = (value: number) => {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
};

const fadeWindow = (
  time: number,
  start: number,
  fadeInEnd: number,
  fadeOutStart: number,
  end: number,
) => {
  if (time <= start || time >= end) return 0;
  if (time < fadeInEnd) return smoothstep((time - start) / (fadeInEnd - start));
  if (time > fadeOutStart) return 1 - smoothstep((time - fadeOutStart) / (end - fadeOutStart));
  return 1;
};

const createTextTexture = (text: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("공간 텍스트 캔버스를 만들지 못했습니다.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#edf1f5";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '500 66px Pretendard, "Noto Sans KR", sans-serif';

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= 1660 || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);

  const lineHeight = 88;
  const firstY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, canvas.width / 2, firstY + index * lineHeight));

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
};

type HeartbeatPreludeProps = {
  event: VrEvent;
  phase: HeartbeatPreludePhase;
  phaseProgress: number;
  pulse: RefObject<number>;
};

const HeartbeatPrelude = ({ event, phase, phaseProgress, pulse }: HeartbeatPreludeProps) => {
  const veilRef = useRef<Mesh>(null);
  const textGroupRef = useRef<Group>(null);
  const firstMaterialRef = useRef<MeshBasicMaterial>(null);
  const secondMaterialRef = useRef<MeshBasicMaterial>(null);
  const phaseElapsedRef = useRef(0);
  const previousPhaseRef = useRef(phase);
  const gl = useThree((state) => state.gl);
  const reducedMotion = useReducedMotion();
  const guidance = event.experience?.intro?.guidance_lines ?? DEFAULT_GUIDANCE;

  const firstTexture = useMemo(() => createTextTexture(guidance[0]), [guidance]);
  const secondTexture = useMemo(() => createTextTexture(guidance[1]), [guidance]);

  useEffect(() => () => {
    firstTexture.dispose();
    secondTexture.dispose();
  }, [firstTexture, secondTexture]);

  useFrame(({ camera }, delta) => {
    if (phase !== previousPhaseRef.current) {
      previousPhaseRef.current = phase;
      phaseElapsedRef.current = 0;
    } else {
      phaseElapsedRef.current += delta;
    }

    const viewerCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const introTime = clamp(phaseProgress) * INTRO_SECONDS;
    const reveal = phase === "vr" ? smoothstep(phaseElapsedRef.current / REVEAL_SECONDS) : 0;
    const cooldownOpacity = phase === "cooldown" ? smoothstep(phaseProgress) : 0;

    if (veilRef.current) {
      viewerCamera.getWorldPosition(veilRef.current.position);
      const material = veilRef.current.material as MeshBasicMaterial;
      const pulseStrength = reducedMotion || phase !== "prelude" ? 0 : pulse.current * 0.42;
      material.color.copy(veilColor.copy(BLACK).lerp(PULSE_GLOW, pulseStrength));
      material.opacity = phase === "vr"
        ? 1 - reveal
        : phase === "cooldown"
          ? cooldownOpacity
          : 1;
      veilRef.current.visible = material.opacity > 0.002;
    }

    const firstOpacity = phase === "intro"
      ? fadeWindow(introTime, 0.6, 1.02, 1.9, 2.55)
      : 0;
    const secondOpacity = phase === "intro"
      ? smoothstep((introTime - 2.1) / 0.5) * 0.82
      : phase === "waiting"
        ? 0.82
        : phase === "prelude"
          ? 0.82 * (1 - smoothstep(phaseElapsedRef.current / 1.4))
          : 0;

    if (firstMaterialRef.current) firstMaterialRef.current.opacity = firstOpacity;
    if (secondMaterialRef.current) secondMaterialRef.current.opacity = secondOpacity;

    if (textGroupRef.current) {
      viewerCamera.getWorldPosition(viewerPosition);
      textGroupRef.current.position.copy(viewerPosition);
      textGroupRef.current.quaternion.copy(viewerCamera.quaternion);
      textGroupRef.current.translateZ(-3);
      textGroupRef.current.visible = firstOpacity > 0.002 || secondOpacity > 0.002;
    }
  });

  return (
    <>
      <mesh ref={veilRef} renderOrder={90} frustumCulled={false}>
        <sphereGeometry args={[0.45, 32, 16]} />
        <meshBasicMaterial
          color="#000000"
          side={BackSide}
          transparent
          opacity={1}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      <group ref={textGroupRef} renderOrder={100}>
        <mesh renderOrder={100}>
          <planeGeometry args={[5.4, 1.35]} />
          <meshBasicMaterial
            ref={firstMaterialRef}
            map={firstTexture}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={101}>
          <planeGeometry args={[5.4, 1.35]} />
          <meshBasicMaterial
            ref={secondMaterialRef}
            map={secondTexture}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
};

export default HeartbeatPrelude;
