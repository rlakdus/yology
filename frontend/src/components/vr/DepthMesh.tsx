import { useEffect, useMemo, type Ref } from "react";
import { Color, DoubleSide, Mesh, ShaderMaterial, Vector3 } from "three";

import { DEPTH } from "../../data/vrEvent";

/** 변위가 부드럽게 보일 만큼의 분할. 약 4.9만 정점으로 Quest에서도 여유롭다. */
const SEGMENTS = 220;

/** 배경 셸과 같은 색. 사진 안쪽 깊이가 주변 공간으로 이어져 보이게 한다. */
const FOG_COLOR = new Color("#0e1a2c").convertSRGBToLinear();

const vertexShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform float hasDepth;
  uniform float relief;
  uniform float curvature;
  uniform float depthTexel;
  uniform float stretchCut;

  varying vec2 vUv;
  varying float vDepth;
  varying float vStretch;

  void main() {
    vUv = uv;

    // 깊이 맵은 상대 역깊이라 가까울수록 값이 크다.
    float d = texture2D(depthMap, uv).r;
    vDepth = mix(0.5, d, hasDepth);

    // 국소 기울기를 잰다. 급한 곳은 조각 셰이더에서 지운다.
    // 샘플 간격으로 나눠 "UV 한 칸당 깊이 변화"로 정규화해야 한다. 그러지 않으면
    // 넓은 면이 완만하게 물러나는 것과 실루엣에서 뚝 끊기는 것을 구분할 수 없다.
    float dx = texture2D(depthMap, uv + vec2(depthTexel, 0.0)).r
             - texture2D(depthMap, uv - vec2(depthTexel, 0.0)).r;
    float dy = texture2D(depthMap, uv + vec2(0.0, depthTexel)).r
             - texture2D(depthMap, uv - vec2(0.0, depthTexel)).r;
    vStretch = (length(vec2(dx, dy)) / (2.0 * depthTexel)) * hasDepth;

    vec3 pos = position;

    // 가까운 픽셀을 시청자 쪽으로 밀어 올린다. 깊이가 갑자기 끊기는 실루엣에서는
    // 변위를 줄여 한 줄짜리 삼각형이 길게 찢어지는 것을 막는다. 깊이를 완전히
    // 평평하게 만들지는 않아 경계의 시차는 유지한다.
    float stableRelief = 1.0 - smoothstep(stretchCut * 0.35, stretchCut, vStretch);
    float reliefAtPixel = relief * mix(0.35, 1.0, stableRelief);
    pos.z += (vDepth - 0.5) * reliefAtPixel * hasDepth;

    // 양옆을 뒤로 굽혀 평면이 아니라 감싸는 면처럼 보이게 한다.
    // position.x는 -0.5~0.5라 아래 항은 가장자리에서 정확히 curvature만큼 물러난다.
    pos.z -= pos.x * pos.x * 4.0 * curvature;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float brightness;
  uniform float feather;
  uniform float fogStrength;
  uniform float stretchCut;
  uniform float parallax;
  uniform float tone;
  uniform vec3 fogColor;

  varying vec2 vUv;
  varying float vDepth;
  varying float vStretch;

  void main() {
    vec4 texel = texture2D(map, vUv);
    vec3 color = texel.rgb * brightness;

    // 먼 픽셀일수록 배경 색으로 섞는다.
    color = mix(color, fogColor, (1.0 - vDepth) * fogStrength);

    // 긴장도에 따른 전반적인 톤 보정. 색을 입히지 않고 채도와 밝기만 눌러
    // 화면이 서서히 가라앉게 한다.
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, vec3(lum), tone * 0.3);
    color *= 1.0 - tone * 0.12;

    // 네 변을 부드럽게 지운다. 직사각형 경계가 사라지는 것만으로 공간감이 크게 올라간다.
    float edge =
        smoothstep(0.0, feather, vUv.x) * smoothstep(1.0, 1.0 - feather, vUv.x)
      * smoothstep(0.0, feather, vUv.y) * smoothstep(1.0, 1.0 - feather, vUv.y);

    // 정면에서는 촬영된 원본을 온전히 보존한다. 카메라가 옆으로 움직여 실제로
    // 가려진 면이 드러날 때만 늘어난 삼각형을 걷어내고 뒤의 복원 레이어를 보인다.
    float reveal = smoothstep(0.08, 1.0, parallax);
    float stretch = 1.0 - smoothstep(
      stretchCut * 0.7,
      stretchCut,
      vStretch * reveal
    );

    gl_FragColor = vec4(color, texel.a * opacity * edge * stretch);

    #include <colorspace_fragment>
  }
`;

interface DepthMeshProps {
  ref?: Ref<Mesh>;
  renderOrder?: number;
  position?: [number, number, number];
}

/**
 * 사진을 깊이 맵으로 변위시킨 얕은 부조.
 *
 * 평면 한 장은 카메라가 움직여도 평면으로 보인다. 실제 지오메트리로 만들어 두면
 * 데스크톱에서는 카메라 미세 이동이, 헤드셋에서는 사용자의 실제 고개 움직임이
 * 곧바로 시차를 만든다.
 *
 * uniform은 부모(SceneMediaPanel)가 매 프레임 갱신한다.
 */
const DepthMesh = ({ ref, renderOrder = 0, position }: DepthMeshProps) => {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      map: { value: null },
      depthMap: { value: null },
      hasDepth: { value: 0 },
      relief: { value: DEPTH.relief },
      curvature: { value: DEPTH.curvature },
      depthTexel: { value: 0.004 },
      // 텍스처가 배정되기 전 첫 프레임이 흰색으로 번쩍이지 않도록 0에서 시작한다.
      opacity: { value: 0 },
      brightness: { value: 1 },
      feather: { value: DEPTH.feather },
      fogStrength: { value: DEPTH.fogStrength },
      stretchCut: { value: DEPTH.stretchCut },
      parallax: { value: 0 },
      tone: { value: 0 },
      fogColor: { value: new Vector3(FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b) },
    },
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  return (
    // visible을 JSX prop으로 두면 리렌더마다 false로 되돌아가 깜빡인다.
    // 가시성은 useFrame이 매 프레임 직접 정한다.
    <mesh ref={ref} material={material} renderOrder={renderOrder} position={position}>
      <planeGeometry args={[1, 1, SEGMENTS, SEGMENTS]} />
    </mesh>
  );
};

export default DepthMesh;
