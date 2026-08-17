import { useEffect, useMemo, useRef, useState } from "react";
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
  /** 구가 실제 프레임을 그리기 시작했는지 알린다. 정지 파노라마 폴백이 이 값으로 비켜난다. */
  onLiveChange?: (live: boolean) => void;
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
  onLiveChange,
}: PanoramaVideoEnvironmentProps) => {
  const meshRef = useRef<Mesh>(null);
  const liveRef = useRef(false);
  const gl = useThree((state) => state.gl);

  // VideoTexture는 useMemo가 아니라 effect에서 만든다. VideoTexture는 생성자에서
  // requestVideoFrameCallback 체인을 걸고 dispose()가 그 체인을 영구히 끊는데,
  // StrictMode의 mount→unmount→remount 시뮬레이션은 cleanup(dispose)만 다시 실행하고
  // useMemo 값은 그대로 재사용한다. 그 결과 죽은 텍스처로 계속 렌더링해 프레임이
  // 한 장도 올라가지 않는 검은 구가 된다. effect에서 만들면 remount가 체인이 살아
  // 있는 새 텍스처를 다시 만든다.
  const [texture, setTexture] = useState<VideoTexture | null>(null);

  useEffect(() => {
    const next = new VideoTexture(video);
    next.colorSpace = SRGBColorSpace;
    next.minFilter = LinearFilter;
    next.magFilter = LinearFilter;
    next.generateMipmaps = false;
    next.wrapS = RepeatWrapping;
    next.wrapT = ClampToEdgeWrapping;
    // 360 영상은 구 안쪽을 거의 정면으로 샘플링한다. 높은 이방성 필터링은
    // 체감 화질 차이보다 모바일 VR GPU의 샘플링 비용을 더 키운다.
    next.anisotropy = Math.min(2, gl.capabilities.getMaxAnisotropy());
    // 첫 프레임의 presentation은 대개 이 텍스처가 생기기 전에 지나갔다. rVFC는
    // 다음 새 프레임에만 오므로, 이미 디코드된 프레임은 기다리지 않고 바로 올린다.
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) next.needsUpdate = true;
    setTexture(next);
    return () => next.dispose();
  }, [gl, video]);

  const material = useMemo(() => texture && new MeshBasicMaterial({
    map: texture,
    side: BackSide,
    // 화면 전체를 덮는 구를 transparent로 그리면 양안 전체 픽셀에 알파
    // 블렌딩이 발생한다. 프레임 준비 여부는 mesh.visible로 전환한다.
    transparent: false,
    depthWrite: false,
    toneMapped: false,
  }), [texture]);

  useEffect(() => () => {
    material?.dispose();
  }, [material]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh || !material) return;

    const viewerCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewerCamera.getWorldPosition(mesh.position);

    const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && video.error === null;
    mesh.visible = hasFrame;
    material.color.setScalar(1 - playback.tone.current * 0.08);

    if (hasFrame !== liveRef.current) {
      liveRef.current = hasFrame;
      onLiveChange?.(hasFrame);
    }
  });

  // 언마운트되면 더 이상 프레임을 내놓지 않는다. 폴백이 계속 숨어 있지 않게 알려 둔다.
  useEffect(() => () => {
    if (liveRef.current) onLiveChange?.(false);
  }, [onLiveChange]);

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
  if (!material) return null;

  return (
    <mesh
      ref={meshRef}
      material={material}
      scale={[-1, 1, 1]}
      rotation={[0, -Math.PI / 2 - panorama.yaw_offset_deg * Math.PI / 180, 0]}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[PANORAMA_RADIUS, 64, 32]} />
    </mesh>
  );
};

export default PanoramaVideoEnvironment;
