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
    const elements = new Map<string, HTMLVideoElement>();

    const mediaSources = event.media
      .filter((entry) => entry.kind === "video")
      .map((entry) => entry.src);
    const panoramaSource = event.panorama_video?.src;
    const sources = [...new Set([
      ...(panoramaSource ? [panoramaSource] : []),
      ...mediaSources,
    ])];

    const loads = sources.map((src) => new Promise<[string, number]>((resolve) => {
      const element = document.createElement("video");
      element.src = src;
      element.preload = src === panoramaSource ? "auto" : "metadata";
      element.playsInline = true;
      element.crossOrigin = "anonymous";
      // 파노라마에는 원본 현장음을 그대로 사용한다.
      element.volume = src === panoramaSource ? 1 : 0.55;
      elements.set(src, element);

      element.addEventListener(
        "loadedmetadata",
        () => resolve([src, element.duration || 0]),
        { once: true },
      );
      element.addEventListener("error", () => resolve([src, 0]), { once: true });
      element.load();
    }));

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
      elements.forEach((element) => {
        element.pause();
        element.removeAttribute("src");
        element.load();
      });
    };
  }, [event]);

  return videos;
};
