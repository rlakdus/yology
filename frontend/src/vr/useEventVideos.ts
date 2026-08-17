import { useEffect, useState } from "react";

import type { VrEvent } from "../data/vrEvent";

export type EventVideos = {
  elements: Map<string, HTMLVideoElement>;
  /** 파노라마 영상 또는 기존 타임라인 영상의 재현 길이. */
  totalSeconds: number;
  ready: boolean;
};

const EMPTY: EventVideos = { elements: new Map(), totalSeconds: 0, ready: false };

/**
 * 이벤트의 영상을 미리 만들어 두고 길이를 읽는다.
 *
 * 영상 길이는 파이썬에서 알아내지 않는다. ffmpeg 의존을 만들지 않으려고,
 * 시작 게이트가 떠 있는 동안 브라우저가 loadedmetadata에서 직접 읽는다.
 */
export const useEventVideos = (event: VrEvent | null): EventVideos => {
  const [videos, setVideos] = useState<EventVideos>(EMPTY);

  useEffect(() => {
    if (!event) return;

    let cancelled = false;
    const abortController = new AbortController();
    const elements = new Map<string, HTMLVideoElement>();
    const objectUrls = new Set<string>();

    const panoramaSource = event.panorama_video?.src;
    const panoramaPlaybackRate = event.panorama_video?.playback_rate ?? 1;
    // 파노라마 영상이 있으면 ReconstructionScene이 SceneMediaPanel을 아예 띄우지 않으므로
    // 원본 클립은 화면에 나올 일이 없다. 그런데도 여기서 같이 열면 수십 MB짜리 원본(.mov)의
    // 메타데이터를 기다리느라 시작 게이트가 늦게 뜨고, 브라우저가 그 컨테이너를 해석하지
    // 못하면(예: Apple APAC 오디오·mebx 트랙) loadedmetadata도 error도 오지 않아 게이트가
    // 영영 뜨지 않는다. 쓰지 않을 영상은 열지 않는다.
    const mediaSources = panoramaSource
      ? []
      : event.media.filter((entry) => entry.kind === "video").map((entry) => entry.src);
    const sources = [...new Set([
      ...(panoramaSource ? [panoramaSource] : []),
      ...mediaSources,
    ])];

    const load = async (src: string): Promise<[string, number]> => {
      let elementSource = src;

      if (src === panoramaSource) {
        try {
          // 짧은 파노라마는 사용자에게 시작 버튼을 열기 전에 전부 받는다.
          // Blob URL로 재생하면 네트워크 상태 때문에 VR 도중 버퍼링될 수 없다.
          const response = await fetch(src, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`파노라마 영상을 받지 못했습니다: ${response.status}`);
          }
          const objectUrl = URL.createObjectURL(await response.blob());
          objectUrls.add(objectUrl);
          elementSource = objectUrl;
        } catch (error) {
          if (abortController.signal.aborted) return [src, 0];
          // CDN 정책 등으로 fetch만 실패한 환경에서는 기존 직접 재생 경로를 남긴다.
          console.warn("파노라마 사전 버퍼링에 실패해 직접 재생합니다.", error);
        }
      }

      return new Promise<[string, number]>((resolve) => {
        const element = document.createElement("video");
        element.src = elementSource;
        element.preload = src === panoramaSource ? "auto" : "metadata";
        element.playsInline = true;
        element.crossOrigin = "anonymous";
        if (src === panoramaSource) {
          element.defaultPlaybackRate = panoramaPlaybackRate;
          element.playbackRate = panoramaPlaybackRate;
          element.preservesPitch = true;
        }
        // 파노라마에는 원본 현장음을 그대로 사용한다. 다만 시작 게이트에서 자동재생 잠금을
        // 푸는 프라이밍 재생까지 소리를 내면 안 되므로 음소거로 만들어 두고, 실제 재생이
        // 시작되는 순간 VrScene이 음소거를 푼다. 실제 볼륨은 ReconstructionScene이
        // 재생 시간에 맞춰 0.5초 동안 올리고 내린다.
        element.volume = src === panoramaSource ? 0 : 0.55;
        element.muted = src === panoramaSource;
        elements.set(src, element);

        element.addEventListener(
          "loadedmetadata",
          () => resolve([src, element.duration || 0]),
          { once: true },
        );
        element.addEventListener("error", () => resolve([src, 0]), { once: true });
        element.load();
      });
    };

    const loads = sources.map(load);

    // 영상이 없으면 Promise.all([])이 곧바로 resolve되어 ready만 켜진다.
    void Promise.all(loads).then((loaded) => {
      if (cancelled) return;
      const durations = new Map(loaded);
      setVideos({
        elements,
        totalSeconds: panoramaSource
          ? durations.get(panoramaSource) ?? 0
          : mediaSources.reduce((sum, src) => sum + (durations.get(src) ?? 0), 0),
        ready: true,
      });
    });

    return () => {
      cancelled = true;
      abortController.abort();
      elements.forEach((element) => {
        element.pause();
        element.removeAttribute("src");
        element.load();
      });
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [event]);

  return videos;
};
