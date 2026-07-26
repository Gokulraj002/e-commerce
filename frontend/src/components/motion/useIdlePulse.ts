/**
 * useIdlePulse — attach a subtle idle "come back" pulse to a CTA.
 *
 * The returned ref should be placed on the target element. Once the element is
 * in view AND the user has stayed idle for `idleMs` (default 3000ms), a
 * class-name is toggled on so a CSS keyframe (`.en-pulse-active`) can gently
 * pulse the button. Any interaction (pointer move, key, touch, scroll, wheel)
 * clears the pulse and restarts the idle timer.
 *
 * Respects `prefers-reduced-motion` — never pulses when the user has asked the
 * OS for reduced motion. Guarded at the top of the hook.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const DEFAULT_PULSE_CLASS = 'en-pulse-active';

export function useIdlePulse<T extends HTMLElement>(
  idleMs = 3000,
  pulseClass: string = DEFAULT_PULSE_CLASS,
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const [inView, setInView] = useState(false);
  const [idle, setIdle] = useState(false);

  // Track viewport intersection so we only pulse buttons the user can see.
  useEffect(() => {
    const node = ref.current;
    if (!node || reduce) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduce]);

  // Idle detection — reset the timer on any activity, fire once when quiet.
  useEffect(() => {
    if (reduce) return;
    let timer: number | undefined;
    const arm = (): void => {
      setIdle(false);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), idleMs);
    };
    arm();
    const events: (keyof WindowEventMap)[] = [
      'pointermove',
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [idleMs, reduce]);

  // Toggle the class only when both conditions are true.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (inView && idle && !reduce) node.classList.add(pulseClass);
    else node.classList.remove(pulseClass);
    return () => {
      node.classList.remove(pulseClass);
    };
  }, [inView, idle, reduce, pulseClass]);

  return ref;
}
