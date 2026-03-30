"use client";

import { motion } from "framer-motion";

/**
 * Perpetual breathing pulse ring — "the page is alive" signal.
 * §4 / §9: Perpetual micro-interaction (infinite loop, memoised).
 */
export function PulseIndicator({
  color = "currentColor",
  size = 8,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size * 2.5, height: size * 2.5 }}
    >
      <motion.span
        className="absolute rounded-full"
        style={{
          width: size * 2.5,
          height: size * 2.5,
          backgroundColor: color,
          opacity: 0.3,
        }}
        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />
    </span>
  );
}
