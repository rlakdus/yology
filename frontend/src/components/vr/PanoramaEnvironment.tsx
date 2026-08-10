import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  BackSide,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";

import type { VrEvent } from "../../data/vrEvent";
import type { PlaybackRefs } from "./ReconstructionScene";

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const NEAR_RADIUS = 2.4;
const FAR_RADIUS = 8;

const vertexShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform float hasDepth;
  uniform float nearRadius;
  uniform float farRadius;

  varying vec2 vUv;

  float wrappedDepth(vec2 uv) {
    float center = texture2D(depthMap, uv).r;
    float seamDistance = min(uv.x, 1.0 - uv.x);
    float seamWeight = smoothstep(0.0, 0.035, seamDistance);
    float acrossSeam = 0.5 * (
      texture2D(depthMap, vec2(fract(uv.x + 0.012), uv.y)).r
      + texture2D(depthMap, vec2(fract(uv.x - 0.012), uv.y)).r
    );
    return mix(acrossSeam, center, seamWeight);
  }

  void main() {
    vUv = uv;

    float inverseDepth = wrappedDepth(uv);
    float poleWeight = smoothstep(0.02, 0.12, uv.y)
      * (1.0 - smoothstep(0.88, 0.98, uv.y));
    inverseDepth = mix(0.18, inverseDepth, poleWeight);

    float radius = mix(
      farRadius,
      nearRadius,
      smoothstep(0.04, 0.96, inverseDepth) * hasDepth
    );
    vec3 displaced = normalize(position) * radius;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float tone;

  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(map, vUv);
    float luminance = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
    vec3 color = mix(texel.rgb, vec3(luminance), tone * 0.2);
    color *= 1.0 - tone * 0.08;
    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`;

type PanoramaEnvironmentProps = {
  panorama: NonNullable<VrEvent["panorama"]>;
  playback: PlaybackRefs;
};

const PanoramaEnvironment = ({ panorama, playback }: PanoramaEnvironmentProps) => {
  const meshRef = useRef<Mesh>(null);
  const gl = useThree((state) => state.gl);
  const colorTexture = useTexture(panorama.src);
  const depthTexture = useTexture(panorama.depth ?? TRANSPARENT_PIXEL);

  useEffect(() => {
    colorTexture.colorSpace = SRGBColorSpace;
    colorTexture.wrapS = RepeatWrapping;
    colorTexture.wrapT = ClampToEdgeWrapping;
    colorTexture.minFilter = LinearMipmapLinearFilter;
    colorTexture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    colorTexture.needsUpdate = true;

    depthTexture.colorSpace = NoColorSpace;
    depthTexture.wrapS = RepeatWrapping;
    depthTexture.wrapT = ClampToEdgeWrapping;
    depthTexture.minFilter = LinearFilter;
    depthTexture.magFilter = LinearFilter;
    depthTexture.generateMipmaps = false;
    depthTexture.needsUpdate = true;
  }, [colorTexture, depthTexture, gl]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: BackSide,
    uniforms: {
      map: { value: colorTexture },
      depthMap: { value: depthTexture },
      hasDepth: { value: panorama.depth ? 1 : 0 },
      nearRadius: { value: NEAR_RADIUS },
      farRadius: { value: FAR_RADIUS },
      tone: { value: 0 },
    },
  }), [colorTexture, depthTexture, panorama.depth]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    material.uniforms.tone.value = playback.tone.current;
  });

  return (
    <group rotation={[0, Math.PI / 2 + panorama.anchor_yaw_deg * Math.PI / 180, 0]}>
      <mesh renderOrder={-21}>
        <sphereGeometry args={[FAR_RADIUS + 0.2, 128, 64]} />
        <meshBasicMaterial map={colorTexture} side={BackSide} />
      </mesh>

      <mesh ref={meshRef} material={material} renderOrder={-20}>
        <sphereGeometry args={[1, 192, 96]} />
      </mesh>
    </group>
  );
};

export default PanoramaEnvironment;
