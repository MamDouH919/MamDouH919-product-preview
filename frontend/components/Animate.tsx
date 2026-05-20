'use client';

import { ReactNode } from 'react';
import { motion, Variants, HTMLMotionProps } from 'framer-motion';

// ── Shared variants ──────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

// ── AnimateIn — triggers when element enters viewport ───────────────────────

interface AnimateInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variants?: Variants;
  delay?: number;
  once?: boolean;
  amount?: number;
}

export const AnimateIn = ({
  children,
  variants = fadeUp,
  delay = 0,
  once = true,
  amount = 0.2,
  ...rest
}: AnimateInProps) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once, amount }}
    variants={variants}
    transition={delay ? { delay } : undefined}
    {...rest}
  >
    {children}
  </motion.div>
);

// ── StaggerGroup — staggers direct children ─────────────────────────────────

export const StaggerGroup = ({
  children,
  once = true,
  amount = 0.15,
  ...rest
}: AnimateInProps) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once, amount }}
    variants={staggerContainer}
    {...rest}
  >
    {children}
  </motion.div>
);

// ── StaggerChild — must be inside StaggerGroup ──────────────────────────────

export const StaggerChild = ({
  children,
  variants = fadeUp,
  ...rest
}: AnimateInProps) => (
  <motion.div variants={variants} {...rest}>
    {children}
  </motion.div>
);
