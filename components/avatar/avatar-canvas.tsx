"use client";

import { useEffect, useRef } from "react";
import { AVATAR_H, AVATAR_HEAD_ROOM, AVATAR_W, drawAvatar } from "@/lib/avatar-pixel";
import type { AvatarLook } from "@/lib/types";

type AvatarCanvasProps = {
  look: AvatarLook;
  /** Бір спрайт пикселінің экрандағы өлшемі (бүтін сан — пиксельдер анық болады) */
  scale?: number;
  className?: string;
  /** Ашылмаған киім: сұр түспен көрсетіледі */
  locked?: boolean;
  /** Анда-санда көзін жұмады */
  animate?: boolean;
  label?: string;
};

const PAD_X = 1;

/** Мини-персонажды canvas-қа салады; бақтағы сахнамен бірдей сызу функциясы */
export function AvatarCanvas({ look, scale = 4, className, locked = false, animate = false, label }: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const widthUnits = AVATAR_W + PAD_X * 2;
  const heightUnits = AVATAR_H + AVATAR_HEAD_ROOM + 1;
  const lookKey = `${look.base}|${look.hat}|${look.mask}|${look.top}|${look.bottom}|${look.shoes}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    const footY = (heightUnits - 1) * scale;

    const paint = (blink: boolean) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      // Табан астындағы көлеңке
      context.fillStyle = "rgba(15, 23, 42, 0.18)";
      context.fillRect((PAD_X + 6) * scale, footY, 20 * scale, scale);
      drawAvatar(
        (x, y, w, h, color) => {
          context.fillStyle = color;
          context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
        },
        PAD_X * scale,
        footY,
        look,
        { scale, blink }
      );
    };

    paint(false);

    if (!animate) {
      return;
    }

    let blinkTimer = 0;
    const interval = window.setInterval(() => {
      paint(true);
      blinkTimer = window.setTimeout(() => paint(false), 150);
    }, 3400);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(blinkTimer);
    };
    // lookKey мәні look өзгерісін толық сипаттайды
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, scale, animate, heightUnits]);

  return (
    <canvas
      ref={canvasRef}
      width={widthUnits * scale}
      height={heightUnits * scale}
      className={className}
      role="img"
      aria-label={label}
      style={{
        imageRendering: "pixelated",
        filter: locked ? "grayscale(1) brightness(0.92) opacity(0.7)" : undefined
      }}
    />
  );
}
