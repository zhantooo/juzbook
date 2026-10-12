"use client";

import { useEffect, useRef } from "react";
import { runGardenScene, type GardenSceneConfig } from "@/lib/garden-pixel";

type PixelSceneProps = {
  width: number;
  height: number;
  className?: string;
  config: Omit<GardenSceneConfig, "w" | "h">;
};

/**
 * Пиксель сахнаны canvas-қа салады. Экраннан шығып кеткенде анимация
 * тоқтатылады — бетте 11 сахна қатар жүргендіктен, бұл жүктемені азайтады.
 */
export function PixelScene({ width, height, className, config }: PixelSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const night = config.night;
  const treeKey = config.trees.map((tree) => `${tree.x}:${tree.idx}`).join(",");
  const houseKey = config.house ?? "none";
  const avatarKey = config.avatar
    ? `${config.avatar.x}:${config.avatar.look.base}|${config.avatar.look.hat}|${config.avatar.look.mask}|${config.avatar.look.top}|${config.avatar.look.bottom}|${config.avatar.look.shoes}`
    : "none";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let stop: (() => void) | null = null;
    const start = () => {
      if (!stop) {
        stop = runGardenScene(canvas, { ...configRef.current, w: width, h: height });
      }
    };
    const halt = () => {
      stop?.();
      stop = null;
    };

    // Бірден бастаймыз: IntersectionObserver кейде кешігіп іске қосылады да,
    // сахна бос болып тұрып қалады. Бақылаушы тек көрінбей қалғанда тоқтатады.
    start();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          start();
        } else {
          halt();
        }
      },
      { rootMargin: "160px" }
    );
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      halt();
    };
  }, [width, height, night, treeKey, houseKey, avatarKey]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
    />
  );
}
