import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  ClampToEdgeWrapping,
  BackSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  VideoTexture,
} from "three";

import type { VrEvent } from "../../data/vrEvent";
import type { PlaybackRefs } from "./ReconstructionScene";

const PANORAMA_RADIUS = 7.8;

type PanoramaVideoEnvironmentProps = {
  panorama: NonNullable<VrEvent["panorama_video"]>;
  playback: PlaybackRefs;
  video: HTMLVideoElement;
};

/**
 * A mono equirectangular video projected onto the inside of a sphere.
 *
 * The sphere follows only the viewer position. Its rotation stays fixed in the
 * world so head rotation explores the generated view while headset translation
 * cannot introduce false parallax into a 3DoF recording.
 */
const PanoramaVideoEnvironment = ({
  panorama,
  playback,
  video,
}: PanoramaVideoEnvironmentProps) => {
  const meshRef = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);

  const texture = useMemo(() => {
    const next = new VideoTexture(video);
    next.colorSpace = SRGBColorSpace;
    next.minFilter = LinearFilter;
    next.magFilter = LinearFilter;
    next.generateMipmaps = false;
    next.wrapS = RepeatWrapping;
    next.wrapT = ClampToEdgeWrapping;
    next.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return next;
  }, [gl, video]);

  const material = useMemo(() => new MeshBasicMaterial({
    map: texture,
    side: BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), [texture]);

  useEffect(() => () => {
    material.dispose();
    texture.dispose();
  }, [material, texture]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const viewerCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewerCamera.getWorldPosition(mesh.position);

    const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && video.error === null;
    material.opacity = hasFrame ? 1 : 0;
    material.color.setScalar(1 - playback.tone.current * 0.08);
  });

  // PanoramaEnvironment와 같은 이유로 x축을 뒤집는다. 뒤집지 않으면 구 안쪽에서
  // equirect의 u가 오른쪽으로 갈수록 작아져 영상 전체가 좌우 반전으로 보인다.
  // 재질은 BackSide를 유지한다 — 이유는 PanoramaEnvironment의 주석 참고.
  //
  // 정지 파노라마와 달리 여기서는 view의 initial_yaw/pitch를 쓰지 않는다. 합성이
  // 녹화 정면을 항상 경도 0°(이미지 정중앙)에 재투영하므로(generation.json의
  // roll_pitch_yaw="fixed_zero") -90° 회전만으로 실제 기록이 정면에 온다. 시작
  // 시선을 고르는 initial_yaw는 정면이 따로 없는 정지 360용 값이고, 영상에 그대로
  // 쓰면 진짜 기록이 시야 밖으로 밀린다. 정중앙이 아닌 합성물이 나올 때만
  // yaw_offset_deg로 보정한다.
  return (
    <mesh
      ref={meshRef}
      material={material}
      scale={[-1, 1, 1]}
      rotation={[0, -Math.PI / 2 - panorama.yaw_offset_deg * Math.PI / 180, 0]}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[PANORAMA_RADIUS, 128, 64]} />
    </mesh>
  );
};

export default PanoramaVideoEnvironment;
