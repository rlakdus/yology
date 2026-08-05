import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

import type { VrEvent } from "../data/vrEvent";

/** 작은 캔버스에 그린 뒤 확대해 쓰면 blur 필터가 조금만 있어도 충분히 뭉개진다. */
const SIZE = 128;

const blur = (src: string) => new Promise<CanvasTexture>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = "anonymous";

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("2D 컨텍스트를 만들 수 없습니다."));
      return;
    }

    context.filter = "blur(6px)";
    context.drawImage(image, 0, 0, SIZE, SIZE);

    // 패널이 배경보다 확실히 앞서 보이도록 어둡게 눌러 둔다.
    context.filter = "none";
    context.fillStyle = "rgba(8, 16, 30, 0.45)";
    context.fillRect(0, 0, SIZE, SIZE);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    resolve(texture);
  };

  image.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
  image.src = src;
});

/** 이벤트의 이미지마다 흐린 배경용 텍스처를 만들어 둔다. */
export const useBlurredTextures = (event: VrEvent | null) => {
  const [textures, setTextures] = useState<Map<string, Texture>>(new Map());

  useEffect(() => {
    if (!event) return;

    let cancelled = false;
    const sources = event.media
      .filter((entry) => entry.kind === "image")
      .map((entry) => entry.src);

    const loads = sources.map((src) =>
      blur(src)
        .then((texture) => [src, texture] as const)
        .catch(() => null),
    );

    void Promise.all(loads).then((entries) => {
      if (cancelled) return;
      setTextures(new Map(entries.filter((entry) => entry !== null)));
    });

    return () => { cancelled = true; };
  }, [event]);

  useEffect(() => () => {
    textures.forEach((texture) => texture.dispose());
  }, [textures]);

  return textures;
};
