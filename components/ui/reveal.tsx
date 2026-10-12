"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Төменнен қанша пиксель көтеріліп шығатыны */
  distance?: number;
  /** Пайда болғанда бұлыңғырлықтың тарау эффектісі */
  blur?: number;
  /** Элементтің қанша бөлігі көрінгенде анимация басталады (0-1) */
  amount?: number;
  /** Аздап үлкейіп орнына келу */
  scale?: boolean;
};

export function Reveal({
  children,
  delay = 0,
  className = "",
  distance = 34,
  blur = 6,
  amount = 0.18,
  scale = false
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance, filter: `blur(${blur}px)`, scale: scale ? 0.982 : 1 }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
      viewport={{ once: true, amount }}
      transition={{
        duration: 0.85,
        delay,
        ease: [0.22, 1, 0.36, 1],
        filter: { duration: 0.65, delay }
      }}
      style={{ willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.div>
  );
}
