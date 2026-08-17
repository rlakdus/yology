import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  ClampToEdgeWrapping,
  BackSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";

import { EYE_HEIGHT, type VrEvent } from "../../data/vrEvent";
import type { PlaybackRefs } from "./ReconstructionScene";

// SceneMediaPanel과 같은 픽셀. 이전 값은 이미지 데이터 블록이 아예 없는 GIF라
// 디코드는 통과해도 WebGL 업로드에서 INVALID_VALUE(bad image data)가 났다.
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * 깊이 맵이 만들어내는 부조의 앞뒤 한계. 단위는 미터.
 *
 * 시각적 크기는 사진이 정하므로 이 값은 시차 세기만 좌우한다. 5.5cm 드리프트가
 * 만드는 시차는 1.8m에서 1.8°, 8m에서 0.4°다. 가까운 면을 더 당기면 시차는 세지지만
 * 실루엣 늘어짐이 같이 커지고, 4m에 놓인 미디어 패널을 방이 가리기 시작한다.
 */
const NEAR_RADIUS = 1.8;
const FAR_RADIUS = 8;

const vertexShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform float hasDepth;
  uniform float nearRadius;
  uniform float farRadius;

  varying vec2 vUv;

  /** 극점 행을 네 경도에서 평균 낸 값. 한 점에 모이는 자리의 대표 거리다. */
  float poleDepth(float y) {
    return 0.25 * (
      texture2D(depthMap, vec2(0.125, y)).r
      + texture2D(depthMap, vec2(0.375, y)).r
      + texture2D(depthMap, vec2(0.625, y)).r
      + texture2D(depthMap, vec2(0.875, y)).r
    );
  }

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

    // 극점은 모든 경도가 한 점에 모이는 자리라, 경도마다 깊이가 다르면 메시가 비틀린다.
    // 그렇다고 먼 거리 상수로 눌러버리면 정작 방에서 가장 가까운 천장과 바닥이 뒤로
    // 밀려 머리 위와 발밑이 우물처럼 열린다. 극점 자신의 거리로 구면 뚜껑을 덮어
    // 비틀림만 없앤다.
    float toPole = min(uv.y, 1.0 - uv.y);
    float capWeight = 1.0 - smoothstep(0.03, 0.09, toPole);
    inverseDepth = mix(inverseDepth, poleDepth(uv.y < 0.5 ? 0.004 : 0.996), capWeight);

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
  view?: VrEvent["view"];
};

const PanoramaEnvironment = ({ panorama, playback, view }: PanoramaEnvironmentProps) => {
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

  // x축을 뒤집어 구를 안쪽으로 향하게 한다. three.js SphereGeometry는 u가 커질 때
  // -X에서 +Z를 지나 +X로 도는데, 그 안쪽에서 보면 u가 오른쪽으로 갈수록 작아진다.
  // 뒤집지 않으면 파노라마가 좌우로 뒤집혀 보인다(창이 왼쪽인 방이 오른쪽이 된다).
  // 재질은 BackSide를 유지한다. 스케일로 뒤집으면 matrixWorld 행렬식이 음수가 되어
  // three.js가 renderBufferDirect에서 gl.frontFace를 알아서 뒤집어 준다. 여기서 side까지
  // FrontSide로 바꾸면 보정이 두 번 걸려 모든 면이 컬링되고 화면이 새까매진다.
  // (공식 예제가 FrontSide인 건 geometry.scale로 정점을 직접 뒤집어 행렬식이 그대로라서다.)
  // 회전은 -90°에서 시작해야 initial_yaw_deg=0이 파노라마 정중앙을 정면에 두고,
  // 양수 yaw가 이미지 오른쪽으로 도는 기존 의미를 유지한다.
  return (
    <group
      position={[0, EYE_HEIGHT, 0]}
      scale={[-1, 1, 1]}
      rotation={[
        -(view?.initial_pitch_deg ?? 0) * Math.PI / 180,
        -Math.PI / 2 + (view ? view.initial_yaw_deg : -panorama.anchor_yaw_deg) * Math.PI / 180,
        0,
      ]}
    >
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
