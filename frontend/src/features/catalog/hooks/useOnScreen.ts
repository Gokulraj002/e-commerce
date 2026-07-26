/**
 * Small React wrapper around the `IntersectionObserver` API.
 *
 * Returns a `[ref, isOnScreen]` tuple — attach the ref to any DOM element and
 * `isOnScreen` will re-render as it enters / leaves the viewport. Passing
 * `once: true` disconnects the observer after the first intersection so the
 * flag latches to `true` (handy for "reveal on scroll" style effects).
 *
 * The primary consumer on the product page is the sticky add-to-cart bar:
 * observe the inline buy box, show the sticky bar when it goes off screen.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseOnScreenOptions {
  /** Root element for the observer; defaults to the viewport. */
  root?: Element | Document | null;
  /** Margins applied to the root's bounding box (CSS length string). */
  rootMargin?: string;
  /** Ratio(s) of the target's visibility that trigger the callback. */
  threshold?: number | number[];
  /** Latch to `true` on the first intersection and stop observing. */
  once?: boolean;
}

/**
 * Attach the returned ref to any element; the boolean flips as it enters /
 * leaves the viewport (or the supplied `root`).
 */
export function useOnScreen<T extends Element>(
  options: UseOnScreenOptions = {},
): [RefObject<T>, boolean] {
  const { root = null, rootMargin, threshold, once = false } = options;
  const ref = useRef<T>(null);
  const [isOnScreen, setIsOnScreen] = useState(false);

  // Stringify array thresholds so referential churn does not re-create the
  // observer on every render — the values are what matter, not the array.
  const thresholdKey = Array.isArray(threshold) ? threshold.join(',') : threshold;

  useEffect(() => {
    const target = ref.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsOnScreen(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { root, rootMargin, threshold },
    );

    observer.observe(target);
    return () => observer.disconnect();
    // `threshold` is deliberately excluded — its value is captured by `thresholdKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, rootMargin, thresholdKey, once]);

  return [ref, isOnScreen];
}
