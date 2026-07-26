/**
 * HeartBurst — six-particle radiating heart burst.
 *
 * A tiny visual flourish that plays whenever the parent flips `active` to
 * `true`. Six hearts fan out from the anchor along evenly-spaced angles,
 * fading in and out over ~650ms. The parent doesn't need to schedule the
 * removal: the component detects the false → true transition, mounts the
 * particles, and self-cleans once the animation window closes.
 *
 * Positioning is relative to the nearest positioned ancestor — drop this
 * inside a `position: relative` container (e.g. the wishlist heart button).
 * The container itself is `pointer-events: none`, so it never blocks clicks.
 *
 * Respects `prefers-reduced-motion` by rendering nothing at all — no DOM
 * nodes, no timers.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export interface HeartBurstProps {
  /**
   * Flip to `true` briefly to fire a burst. Only the false → true edge
   * matters — leaving it `true` (or toggling back to `false`) does not
   * queue additional bursts.
   */
  active: boolean;
  /** Radius in px the particles fly out to. Default 24. */
  radius?: number;
}

/** Six evenly-spread angles (degrees). The top of the ring is 12 o'clock. */
const BURST_ANGLES = [-90, -30, 30, 90, 150, -150] as const;

/** Kept roughly in sync with the longest particle transition below. */
const BURST_DURATION_MS = 700;

export function HeartBurst({ active, radius = 24 }: HeartBurstProps): JSX.Element | null {
  const reduce = useReducedMotion();
  // Monotonically increasing nonce — each burst gets a fresh AnimatePresence
  // key so a rapid double-tap doesn't get swallowed as "same element".
  const [nonce, setNonce] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevActive = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  // Fire on the false → true edge only. Reduced-motion users never trigger.
  useEffect(() => {
    if (active && !prevActive.current && !reduce) {
      setNonce((n) => n + 1);
      setVisible(true);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, BURST_DURATION_MS);
    }
    prevActive.current = active;
  }, [active, reduce]);

  // Guard against a stray timer on unmount.
  useEffect(
    () => (): void => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    },
    [],
  );

  if (reduce) return null;

  return (
    <span className="en-heart-burst" aria-hidden>
      <AnimatePresence>
        {visible && (
          <motion.span
            key={nonce}
            className="en-heart-burst__ring"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {BURST_ANGLES.map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const dx = Math.cos(rad) * radius;
              const dy = Math.sin(rad) * radius;
              return (
                <motion.span
                  key={i}
                  className="en-heart-burst__dot"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: dx,
                    y: dy,
                    scale: [0.6, 1, 0.7],
                  }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                >
                  {'♥'}
                </motion.span>
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
