import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
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
    return next;
  }, [video]);

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

  return (
    <mesh
      ref={meshRef}
      material={material}
      rotation={[0, Math.PI / 2 + panorama.yaw_offset_deg * Math.PI / 180, 0]}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[PANORAMA_RADIUS, 128, 64]} />
    </mesh>
  );
};

export default PanoramaVideoEnvironment;
