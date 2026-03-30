"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      staggerChildren: 0.08,
    },
  },
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

interface ViewportRevealProps {
  children: ReactNode;
  className?: string;
  /** Delay before the animation starts (seconds) */
  delay?: number;
  /** Custom tag — renders as the motion element */
  as?: "div" | "section";
}

export function ViewportReveal({
  children,
  className,
  delay = 0,
  as = "div",
}: ViewportRevealProps) {
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      transition={delay ? { delay } : undefined}
      className={className}
    >
      {children}
    </Comp>
  );
}

export function RevealChild({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={childVariants} className={className}>
      {children}
    </motion.div>
  );
}
