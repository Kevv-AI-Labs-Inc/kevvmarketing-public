"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SpringHoverCardProps {
  children: ReactNode;
  className?: string;
  /** Index for stagger delay in parent orchestration */
  index?: number;
}

/**
 * Card with spring-physics hover lift.
 * Replaces CSS `animate-stagger` with Framer Motion spring.
 */
export function SpringHoverCard({
  children,
  className,
  index = 0,
}: SpringHoverCardProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring",
            stiffness: 100,
            damping: 20,
            delay: index * 0.06,
          },
        },
      }}
      whileHover={{
        y: -4,
        boxShadow:
          "0 8px 24px hsl(40 30% 50% / 0.08), 0 24px 48px hsl(40 30% 50% / 0.06)",
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
