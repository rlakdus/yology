import { Suspense, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Mesh, MeshBasicMaterial, type Texture } from "three";

import { mediaCueAt, type VrEvent } from "../../data/vrEvent";
import PanoramaEnvironment from "./PanoramaEnvironment";
import PanoramaVideoEnvironment from "./PanoramaVideoEnvironment";
import SceneErrorBoundary from "./SceneErrorBoundary";
import type { PlaybackRefs } from "./ReconstructionScene";

/** 시야가 흔들려도 빈 공간이 보이지 않을 만큼만 감싼다. */
const SHELL_RADIUS = 12;

const CALM = new Color("#0e1a2c");
const TENSE = new Color("#2a1119");
const shellColor = new Color();

const FallbackShell = () => (
  <mesh renderOrder={-20}>
    <sphereGeometry args={[SHELL_RADIUS, 24, 16]} />
    <meshBasicMaterial side={BackSide} color={CALM} />
  </mesh>
);

interface SurroundBackdropProps {
  event: VrEvent;
  playback: PlaybackRefs;
  blurred: Map<string, Texture>;
  videos: Map<string, HTMLVideoElement>;
}

/**
 * 패널 뒤를 받치는 배경.
 *
 * 360° 환경을 복원하지 않으므로 역할이 작다. 다만 헤드셋에서는 사용자가 실제로
 * 고개 돌리는 것을 코드로 막을 수 없어, 뒤를 봤을 때 빈 공간이 보이지 않도록
 * 감싸는 껍데기는 남긴다. 껍데기에는 사진을 늘려 붙이지 않고 톤 색만 입힌다.
 */
const SurroundBackdrop = ({ event, playback, blurred, videos }: SurroundBackdropProps) => {
  const shellRef = useRef<Mesh>(null);
  const backRef = useRef<Mesh>(null);
  const frontRef = useRef<Mesh>(null);
  const [videoLive, setVideoLive] = useState(false);
  const panoramaVideo = event.panorama_video;
  const panoramaVideoElement = panoramaVideo ? videos.get(panoramaVideo.src) : undefined;

  const stillPanorama = event.panorama ?? (panoramaVideo?.fallback_image
    ? {
        src: panoramaVideo.fallback_image,
        depth: null,
        generated: true,
        mode: "recorded_anchor" as const,
        anchor_yaw_deg: panoramaVideo.yaw_offset_deg,
        source_note: "Static fallback for the generated panorama video",
      }
    : null);

  // 두 파노라마를 동시에 띄우면 반지름이 20cm밖에 차이 나지 않는 두 구가 같은 깊이 버퍼를
  // 다투게 되고, 어느 쪽이 보이는지가 영상 버퍼링·머리 위치에 따라 실행마다 달라진다.
  // 정지 파노라마는 영상이 아직(또는 다시) 프레임을 못 내놓을 때만 자리를 지킨다.
  const showStill = Boolean(stillPanorama) && !videoLive;

  useFrame(() => {
    const progress = playback.progress.current;
    const tone = playback.tone.current;

    const shell = shellRef.current;
    if (shell) {
      const material = shell.material as MeshBasicMaterial;
      material.color.copy(shellColor.copy(CALM).lerp(TENSE, tone));
    }

    // 흐린 배경도 패널과 같은 크로스페이드를 따라간다.
    const cue = mediaCueAt(event, progress);
    const layers = [
      { mesh: backRef.current, src: cue.current?.src },
      { mesh: frontRef.current, src: cue.next?.src },
    ];

    layers.forEach(({ mesh, src }, index) => {
      if (!mesh) return;
      const texture = src ? blurred.get(src) : undefined;
      if (!texture) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const material = mesh.material as MeshBasicMaterial;
      if (material.map !== texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
      material.opacity = index === 0 ? 1 : cue.blend;
    });
  });

  return (
    <>
      {/* 배경은 반드시 패널보다 먼저 그려져야 한다. 모두 깊이를 기록하지 않는
          반투명이라 순서만이 앞뒤를 정한다. */}
      {showStill && stillPanorama ? (
        <SceneErrorBoundary fallback={<FallbackShell />}>
          <Suspense fallback={<FallbackShell />}>
            <PanoramaEnvironment panorama={stillPanorama} playback={playback} view={event.view} />
          </Suspense>
        </SceneErrorBoundary>
      ) : (
        <mesh ref={shellRef} renderOrder={-20}>
          <sphereGeometry args={[SHELL_RADIUS, 24, 16]} />
          <meshBasicMaterial side={BackSide} color={CALM} />
        </mesh>
      )}

      {panoramaVideo && panoramaVideoElement && (
        <PanoramaVideoEnvironment
          panorama={panoramaVideo}
          playback={playback}
          video={panoramaVideoElement}
          onLiveChange={setVideoLive}
        />
      )}

      {/* 패널 가장자리가 배경으로 번지도록 정면에만 넓게 깐다. */}
      {!stillPanorama && !panoramaVideo && <group position={[0, 1.6, -7.5]}>
        <mesh ref={backRef} renderOrder={-11}>
          <planeGeometry args={[34, 20]} />
          <meshBasicMaterial transparent depthWrite={false} />
        </mesh>
        <mesh ref={frontRef} position={[0, 0, 0.02]} renderOrder={-10}>
          <planeGeometry args={[34, 20]} />
          <meshBasicMaterial transparent depthWrite={false} />
        </mesh>
      </group>}
    </>
  );
};

export default SurroundBackdrop;
