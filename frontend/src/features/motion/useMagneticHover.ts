/**
 * Magnetic hover — the element gently pulls toward the cursor while the
 * pointer is inside it, then springs back on `mouseleave`. Purely presentational
 * polish for large CTAs; guards on `prefers-reduced-motion: reduce`.
 *
 * The pull is applied via `translate3d(...)` written to `element.style.transform`,
 * so any CSS `transition: transform ...` on the target smooths the follow.
 * Because we write inline styles, the caller should not also set
 * `element.style.transform` from elsewhere (use CSS transforms instead).
 *
 * Usage:
 *   const ref = useMagneticHover<HTMLButtonElement>({ strength: 0.25 });
 *   return <button ref={ref} className="btn-primary">Add to cart</button>;
 */
import { useEffect, useRef, type RefObject } from 'react';

export interface UseMagneticHoverOptions {
  /**
   * How strongly the element follows the cursor. `~0.15–0.35` reads as
   * subtle premium polish; `1` would pin the element to the pointer.
   * Defaults to `0.25`.
   */
  strength?: number;
  /**
   * Hard clamp for the translation along each axis, in pixels. Prevents
   * the element from wandering far outside its own bounds on wide targets.
   * Defaults to `24`.
   */
  maxTranslate?: number;
}

/**
 * Returns a ref you attach to the element you want magnetically drawn
 * toward the cursor on hover.
 */
export function useMagneticHover<T extends HTMLElement>(
  options: UseMagneticHoverOptions = {},
): RefObject<T> {
  const { strength = 0.25, maxTranslate = 24 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced-motion users get no listeners and no transform writes —
    // the effect is pure decoration.
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const clamp = (value: number, limit: number): number =>
      Math.max(-limit, Math.min(limit, value));

    const handleMove = (event: MouseEvent): void => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clamp((event.clientX - cx) * strength, maxTranslate);
      const dy = clamp((event.clientY - cy) * strength, maxTranslate);
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    const reset = (): void => {
      el.style.transform = '';
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', reset);
    // Belt-and-braces: if focus moves away while the pointer is still on
    // the element (e.g. a keyboard shortcut steals focus) we should not
    // leave the target shifted from centre.
    el.addEventListener('blur', reset);

    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', reset);
      el.removeEventListener('blur', reset);
      el.style.transform = '';
    };
  }, [strength, maxTranslate]);

  return ref;
}
