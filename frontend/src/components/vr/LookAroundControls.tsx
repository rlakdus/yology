import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { MathUtils } from "three";

import { EYE_HEIGHT, LOOK, MOTION } from "../../data/vrEvent";
import type { PlaybackRefs } from "./ReconstructionScene";

/** 시선이 정면으로 돌아오는 속도 (1/초). */
const RECENTER_RATE = 0.9;
/** 드래그 1px이 만드는 회전량(라디안). */
const SENSITIVITY = 0.0022;
/** 한계에 얼마나 가까워졌을 때부터 저항이 붙는지. */
const RESISTANCE_START = 0.8;

/**
 * 바깥으로 밀수록 저항이 붙는다. 한계에서 딱 멈추면 벽에 부딪히는 느낌이 나서,
 * 마지막 20% 구간에서 서서히 감속시킨다.
 */
const resist = (current: number, delta: number, limit: number) => {
  const outward = current === 0 || Math.sign(delta) === Math.sign(current);
  if (!outward) return delta;

  const reach = Math.min(1, Math.abs(current) / limit);
  if (reach < RESISTANCE_START) return delta;

  const remaining = (1 - reach) / (1 - RESISTANCE_START);
  return delta * Math.max(0, remaining);
};

/**
 * 주기가 서로 어긋나는 사인 셋을 겹친 값 노이즈.
 *
 * 무리수에 가까운 진동수 비를 써서 눈에 띄는 반복 주기가 생기지 않게 한다.
 * 노이즈 라이브러리를 들일 만큼의 일이 아니다.
 */
const wobble = (time: number, seed: number) =>
  (Math.sin(time * 1.37 + seed) * 0.55
    + Math.sin(time * 2.71 + seed * 2.3) * 0.3
    + Math.sin(time * 4.13 + seed * 3.7) * 0.15);

interface LookAroundControlsProps {
  playback: PlaybackRefs;
  continuous?: boolean;
  motionEnabled?: boolean;
}

/**
 * 1인칭 고정 시점. 걸어다닐 수는 없고 정면 근처만 둘러본다.
 *
 * 다만 위치를 완전히 못박으면 시차가 원리적으로 0이 되어 깊이 맵이 무의미해진다.
 * 광학중심을 축으로 회전만 하면 장면의 깊이와 무관하게 같은 영상이 나오기 때문이다.
 * 그래서 카메라를 몇 cm 범위에서 떠다니게 한다 — 공간을 걸어다니는 것이 아니라
 * 그 자리에서 머리를 움직이는 정도이고, 이 움직임이 핸드헬드 흔들림이자 시차가 된다.
 *
 * XR 세션 중에는 아무것도 하지 않는다. 헤드셋이 카메라를 소유하고, VR에서 카메라를
 * 인공적으로 움직이면 벡션으로 멀미가 난다. 대신 사용자의 실제 고개 움직임이
 * 진짜 6DoF 시차를 만든다 — 부조가 실제 지오메트리라 그대로 동작한다.
 */
const LookAroundControls = ({
  playback,
  continuous = false,
  motionEnabled = true,
}: LookAroundControlsProps) => {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const session = useXR((state) => state.session);

  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragging = useRef(false);
  const elapsed = useRef(0);

  useEffect(() => {
    if (session) return;

    const yawLimit = MathUtils.degToRad(LOOK.yawDeg);
    const pitchLimit = MathUtils.degToRad(LOOK.pitchDeg);

    const onPointerDown = (event: PointerEvent) => {
      dragging.current = true;
      domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      yaw.current = continuous
        ? yaw.current - event.movementX * SENSITIVITY
        : MathUtils.clamp(
            yaw.current + resist(yaw.current, -event.movementX * SENSITIVITY, yawLimit),
            -yawLimit, yawLimit,
          );
      pitch.current = MathUtils.clamp(
        pitch.current + resist(pitch.current, -event.movementY * SENSITIVITY, pitchLimit),
        -pitchLimit, pitchLimit,
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false;
      if (domElement.hasPointerCapture(event.pointerId)) {
        domElement.releasePointerCapture(event.pointerId);
      }
    };

    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerup", onPointerUp);
    domElement.addEventListener("pointercancel", onPointerUp);

    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerup", onPointerUp);
      domElement.removeEventListener("pointercancel", onPointerUp);
    };
  }, [continuous, domElement, session]);

  useFrame((_, delta) => {
    if (session) return;

    elapsed.current += delta;
    const time = elapsed.current;

    const yawLimit = MathUtils.degToRad(LOOK.yawDeg);
    const pitchLimit = MathUtils.degToRad(LOOK.pitchDeg);

    // 손을 떼면 미디어가 시야 한가운데로 돌아온다.
    if (!dragging.current && !continuous) {
      const decay = 1 - Math.exp(-RECENTER_RATE * delta);
      yaw.current += (0 - yaw.current) * decay;
      pitch.current += (0 - pitch.current) * decay;
    }

    // 반경 7cm의 리사주. 세 축의 주기가 어긋나 있어 반복이 눈에 띄지 않는다.
    const drift = motionEnabled ? MOTION.drift : 0;
    let x = Math.sin(time * 0.11) * drift;
    let y = Math.sin(time * 0.17 + 1.3) * drift * 0.6;
    let z = Math.sin(time * 0.07 + 2.1) * drift * 0.5;

    // 누군가 그 자리에서 들고 찍는 듯한 미세 흔들림.
    if (motionEnabled) {
      x += wobble(time, 0) * MOTION.handheldPosition;
      y += wobble(time, 4.2) * MOTION.handheldPosition;
      z += wobble(time, 8.7) * MOTION.handheldPosition * 0.5;
    }

    // 둘러보는 행위 자체가 시차를 만든다. 시야를 오른쪽으로 돌리면 머리도 오른쪽으로 옮겨간다.
    if (motionEnabled) {
      x -= (continuous ? Math.sin(yaw.current) : yaw.current / yawLimit) * MOTION.swayYaw;
      y -= (pitch.current / pitchLimit) * MOTION.swayPitch;
    }

    // 심박마다 아주 작은 충격이 들어갔다 감쇠한다.
    if (motionEnabled) y += playback.pulse.current * MOTION.beatImpulse;

    camera.position.set(x, EYE_HEIGHT + y, z);

    const shake = motionEnabled ? MathUtils.degToRad(MOTION.handheldRotationDeg) : 0;
    camera.rotation.order = "YXZ";
    camera.rotation.set(
      pitch.current + wobble(time, 1.9) * shake,
      yaw.current + wobble(time, 6.4) * shake,
      wobble(time, 11.5) * shake * 0.5,
    );
  });

  return null;
};

export default LookAroundControls;
