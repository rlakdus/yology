import { useEffect, useState } from "react";

import type { VrEvent } from "../data/vrEvent";

export type EventVideos = {
  elements: Map<string, HTMLVideoElement>;
  /** 모든 영상 길이의 합. 재현 길이를 정하는 데 쓰인다. */
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

    const sources = event.media
      .filter((entry) => entry.kind === "video")
      .map((entry) => entry.src);

    const loads = sources.map((src) => new Promise<number>((resolve) => {
      const element = document.createElement("video");
      element.src = src;
      element.preload = "metadata";
      element.playsInline = true;
      element.crossOrigin = "anonymous";
      // 현장음은 합성 심박음 아래로 깔린다.
      element.volume = 0.55;
      elements.set(src, element);

      element.addEventListener("loadedmetadata", () => resolve(element.duration || 0), { once: true });
      element.addEventListener("error", () => resolve(0), { once: true });
    }));

    // 영상이 없으면 Promise.all([])이 곧바로 resolve되어 ready만 켜진다.
    void Promise.all(loads).then((durations) => {
      if (cancelled) return;
      setVideos({
        elements,
        totalSeconds: durations.reduce((sum, seconds) => sum + seconds, 0),
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
