import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  LinearFilter, Mesh, NoColorSpace, ShaderMaterial, SRGBColorSpace, Vector3, VideoTexture, type Texture,
} from "three";

import { DEPTH, mediaCueAt, type VrEvent, type VrMedia } from "../../data/vrEvent";
import DepthMesh from "./DepthMesh";
import type { PlaybackRefs } from "./ReconstructionScene";

const PANEL_DISTANCE = 4;
/** 넓힌 시야를 최대한 덮도록 키운다. 사진 해상도가 허용하는 한계에 가깝다. */
const PANEL_HEIGHT = 5.6;
const EYE_HEIGHT = 1.6;
const VIEW_ORIGIN = new Vector3(0, EYE_HEIGHT, 0);

/** useTexture는 빈 배열을 받을 수 없어, 이미지가 없을 때 넣어 두는 1×1 투명 GIF. */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type Layer = {
  media: VrMedia | null;
  texture: Texture | null;
  depth: Texture | null;
  fill: Texture | null;
  opacity: number;
};

/** 텍스처의 원본 비율. 영상은 videoWidth, 이미지는 width를 본다. */
const aspectOf = (texture: Texture) => {
  const source = texture.image as
    | { width?: number; height?: number; videoWidth?: number; videoHeight?: number }
    | undefined;
  const width = source?.videoWidth || source?.width || 0;
  const height = source?.videoHeight || source?.height || 0;
  return width > 0 && height > 0 ? width / height : 1;
};

/**
 * 부조가 찢어진 자리를 받치는 평면.
 *
 * 사진 한 장에는 가려진 영역의 정보가 없어 시점을 옮기면 반드시 구멍이 생긴다.
 * 그 구멍으로 배경이 비치면 회색 자국처럼 보이는데, 변위 없는 원본을 같은 자리에
 * 받쳐 두면 "깊이를 모르는 부분은 평면 그대로" 보이게 되어 훨씬 덜 거슬린다.
 *
 * 변위의 가장 먼 지점보다 더 뒤에 놓아야 부조의 안쪽이 가려지지 않는다.
 * 그만큼 멀어진 거리는 배율로 되돌려 화면상 크기를 맞춘다.
 */
const BACKING_GAP = DEPTH.relief / 2 + 0.05;
const BACKING_SCALE = (PANEL_DISTANCE + BACKING_GAP) / PANEL_DISTANCE;

const applyBacking = (mesh: Mesh, layer: Layer, tone: number) => {
  if (!layer.media || !layer.texture || layer.opacity <= 0.001) {
    mesh.visible = false;
    return;
  }

  mesh.visible = true;
  const uniforms = (mesh.material as ShaderMaterial).uniforms;
  // 가려진 영역이 채워진 판이 있으면 그것을 쓴다. 없으면 원본으로 버틴다.
  uniforms.map.value = layer.fill ?? layer.texture;
  uniforms.depthMap.value = layer.texture;
  uniforms.hasDepth.value = 0;
  uniforms.opacity.value = layer.opacity;
  // 전경과 밝기를 맞춰 배경 복원 경계가 검은 띠처럼 드러나지 않게 한다.
  uniforms.brightness.value = 0.96;
  uniforms.tone.value = tone;
  uniforms.parallax.value = 0;

  const aspect = aspectOf(layer.texture);
  mesh.scale.set(PANEL_HEIGHT * aspect * BACKING_SCALE, PANEL_HEIGHT * BACKING_SCALE, 1);
};

const applyLayer = (
  mesh: Mesh,
  layer: Layer,
  pulse: number,
  tone: number,
  parallax: number,
) => {
  if (!layer.media || !layer.texture || layer.opacity <= 0.001) {
    mesh.visible = false;
    return;
  }

  mesh.visible = true;
  const material = mesh.material as ShaderMaterial;
  const uniforms = material.uniforms;

  uniforms.map.value = layer.texture;
  uniforms.depthMap.value = layer.depth ?? layer.texture;
  // 깊이 맵이 없는 자산(영상)은 평면으로 렌더하되 페더링과 카메라 모션은 그대로 받는다.
  uniforms.hasDepth.value = layer.depth ? 1 : 0;
  uniforms.opacity.value = layer.opacity;
  // 심박 1회마다 아주 조금 밝아진다. 색은 입히지 않는다.
  uniforms.brightness.value = 1 + 0.04 * pulse;
  uniforms.tone.value = tone;
  uniforms.parallax.value = parallax;

  // 한 겹만 보일 때는 깊이를 기록해 부조가 스스로 가려지게 하고,
  // 크로스페이드 중에는 꺼서 두 겹이 제대로 섞이게 한다.
  material.depthWrite = layer.opacity > 0.99;

  const aspect = aspectOf(layer.texture);
  mesh.scale.set(PANEL_HEIGHT * aspect, PANEL_HEIGHT, 1);
};

interface SceneMediaPanelProps {
  event: VrEvent;
  playback: PlaybackRefs;
  videos: Map<string, HTMLVideoElement>;
  running: boolean;
}

/**
 * 시야의 주역. 진행도에 따라 영상과 이미지를 크로스페이드한다.
 *
 * 각 레이어는 깊이 맵으로 변위된 부조라, 카메라가 움직이면 앞쪽 사물이 뒤쪽보다
 * 크게 밀리는 진짜 시차가 생긴다. 균일 확대(Ken Burns)는 쓰지 않는다 —
 * 카메라 모션이 그 역할을 대신하고, 둘을 겹치면 어지럽다.
 */
const SceneMediaPanel = ({ event, playback, videos, running }: SceneMediaPanelProps) => {
  const camera = useThree((state) => state.camera);
  const backingRef = useRef<Mesh>(null);
  const backRef = useRef<Mesh>(null);
  const frontRef = useRef<Mesh>(null);
  const playingRef = useRef<string | null>(null);

  const imageSources = useMemo(
    () => [
      ...event.media.filter((entry) => entry.kind === "image").map((entry) => entry.src),
      ...event.media.map((entry) => entry.fill).filter((src) => src !== null),
    ],
    [event],
  );

  const depthSources = useMemo(
    () => event.media.map((entry) => entry.depth).filter((src) => src !== null),
    [event],
  );

  const loadedImages = useTexture(imageSources.length > 0 ? imageSources : [TRANSPARENT_PIXEL]);
  const loadedDepths = useTexture(depthSources.length > 0 ? depthSources : [TRANSPARENT_PIXEL]);

  const imageTextures = useMemo(() => {
    const list = Array.isArray(loadedImages) ? loadedImages : [loadedImages];
    const map = new Map<string, Texture>();
    imageSources.forEach((src, index) => {
      const texture = list[index];
      if (!texture) return;
      texture.colorSpace = SRGBColorSpace;
      // colorSpace를 바꾸면 GPU 내부 포맷이 달라지므로 다시 올려야 한다.
      texture.needsUpdate = true;
      map.set(src, texture);
    });
    return map;
  }, [loadedImages, imageSources]);

  const depthTextures = useMemo(() => {
    const list = Array.isArray(loadedDepths) ? loadedDepths : [loadedDepths];
    const map = new Map<string, Texture>();
    depthSources.forEach((src, index) => {
      const texture = list[index];
      if (!texture) return;
      // 깊이는 색이 아니라 데이터다. sRGB로 해석되면 변위가 왜곡된다.
      texture.colorSpace = NoColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      map.set(src, texture);
    });
    return map;
  }, [loadedDepths, depthSources]);

  const videoTextures = useMemo(() => {
    const map = new Map<string, VideoTexture>();
    videos.forEach((element, src) => {
      const texture = new VideoTexture(element);
      texture.colorSpace = SRGBColorSpace;
      map.set(src, texture);
    });
    return map;
  }, [videos]);

  useEffect(() => () => {
    videoTextures.forEach((texture) => texture.dispose());
  }, [videoTextures]);

  const layerFor = (media: VrMedia | null, opacity: number): Layer => {
    if (!media) return { media: null, texture: null, depth: null, fill: null, opacity: 0 };
    const texture = (media.kind === "video" ? videoTextures.get(media.src) : imageTextures.get(media.src)) ?? null;
    const depth = media.depth ? depthTextures.get(media.depth) ?? null : null;
    const fill = media.fill ? imageTextures.get(media.fill) ?? null : null;
    return { media, texture, depth, fill, opacity };
  };

  useFrame(() => {
    const backing = backingRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    if (!backing || !back || !front) return;

    if (!running) {
      videos.forEach((video) => video.pause());
      playingRef.current = null;
    }

    const pulse = playback.pulse.current;
    const tone = playback.tone.current;
    const cue = mediaCueAt(event, playback.progress.current);
    const parallax = Math.min(1, camera.position.distanceTo(VIEW_ORIGIN) / DEPTH.revealDistance);

    // 크로스페이드 중에는 앞선 미디어가 주도하는 쪽을 받친다.
    applyBacking(backing, layerFor(cue.blend > 0.5 ? cue.next : cue.current, 1), tone);
    applyLayer(back, layerFor(cue.current, 1), pulse, tone, parallax);
    applyLayer(front, layerFor(cue.next, cue.blend), pulse, tone, parallax);

    // 화면을 차지한 영상만 정속으로 재생하고, 벗어난 영상은 멈춘다.
    const active = cue.blend > 0.5 ? cue.next : cue.current;
    const wanted = running && active?.kind === "video" ? active.src : null;
    if (wanted !== playingRef.current) {
      const previous = playingRef.current ? videos.get(playingRef.current) : null;
      previous?.pause();

      const next = wanted ? videos.get(wanted) : null;
      if (next) {
        if (next.ended) next.currentTime = 0;
        void next.play().catch(() => undefined);
      }
      playingRef.current = wanted;
    }
  });

  return (
    <group position={[0, EYE_HEIGHT, -PANEL_DISTANCE]}>
      {/* renderOrder는 배경(음수)보다 뒤, 부조보다 앞이어야 한다. 모두 깊이를 기록하지
          않는 반투명이라, 순서가 어긋나면 배경이 받침을 덮어버린다. */}
      <DepthMesh ref={backingRef} position={[0, 0, -BACKING_GAP]} renderOrder={0} />
      <DepthMesh ref={backRef} renderOrder={1} />
      <DepthMesh ref={frontRef} renderOrder={2} />
    </group>
  );
};

export default SceneMediaPanel;
