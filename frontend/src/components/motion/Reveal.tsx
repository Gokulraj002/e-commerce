/**
 * Reveal — reusable "fade + slide up" on scroll.
 *
 * Wrap any block that should gently arrive as it enters the viewport. Uses
 * framer-motion's `whileInView` with `once: true`, so the reveal fires a single
 * time per element and does not fight the user on the way back up.
 *
 * Respects `prefers-reduced-motion`: users who ask for reduced motion get the
 * final state immediately with no offset, no fade.
 */
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

export interface RevealProps {
  children: ReactNode;
  /** Delay in seconds before the reveal begins. */
  delay?: number;
  /** Vertical offset in px the content starts from (before easing in). */
  y?: number;
  /** Overall duration in seconds. */
  duration?: number;
  /** Rendered wrapper class. */
  className?: string;
  /** How much of the element must intersect before revealing (0–1). */
  amount?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 18,
  duration = 0.55,
  className,
  amount = 0.2,
}: RevealProps): JSX.Element {
  const reduce = useReducedMotion();

  const variants: Variants = reduce
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y }, visible: { opacity: 1, y: 0 } };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount, margin: '-40px 0px' }}
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
