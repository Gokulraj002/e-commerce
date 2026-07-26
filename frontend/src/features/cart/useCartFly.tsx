/**
 * useCartFly — animate a small floating thumbnail from the clicked "Add"
 * button toward the header cart icon.
 *
 * Callers get `flyToCart(startRect, imageUrl)` from the hook and invoke it at
 * the moment the user clicks Add. Multiple fly-ins can overlap (rapid taps or
 * bulk adds) — each gets its own portal element and cleans itself up on
 * animation complete.
 *
 * The cart destination is discovered at runtime via a stable
 * `[data-cart-target]` attribute on the header cart button, so the hook has no
 * hard dependency on Header internals. The legacy `[data-cart-icon]` name is
 * still honoured as a fallback so any downstream that pins to the old attr
 * keeps working.
 *
 * Respects `prefers-reduced-motion` — when reduced, the fly is skipped so
 * only the header count update remains.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Comma-joined so `querySelector` picks the first match — new pages tag with
 * `data-cart-target`, older code paths may still tag with `data-cart-icon`.
 */
export const CART_TARGET_SELECTOR = '[data-cart-target], [data-cart-icon]';
/** @deprecated Kept as an alias so existing imports still resolve. */
export const CART_ICON_SELECTOR = CART_TARGET_SELECTOR;

interface FlyItem {
  id: number;
  imageUrl: string | null;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  size: number;
}

export interface CartFlyContextValue {
  /**
   * Launch a fly-in from the caller's element rect toward the header cart icon.
   * Safe to call from anywhere; a no-op if the header target is not mounted or
   * the user has requested reduced motion.
   */
  flyToCart: (startRect: DOMRect, imageUrl: string | null) => void;
}

const CartFlyContext = createContext<CartFlyContextValue | null>(null);

/** Sensible thumb size — clamps very large / tiny call sites. */
function pickSize(rect: DOMRect): number {
  return Math.max(52, Math.min(rect.width, rect.height, 120));
}

export function CartFlyProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<FlyItem[]>([]);
  const reduce = useReducedMotion();
  const nextId = useRef(0);

  const flyToCart = useCallback(
    (startRect: DOMRect, imageUrl: string | null): void => {
      if (typeof document === 'undefined') return;
      if (reduce) return;
      const target = document.querySelector<HTMLElement>(CART_TARGET_SELECTOR);
      if (!target) return;

      const targetRect = target.getBoundingClientRect();
      const size = pickSize(startRect);
      const fromX = startRect.left + startRect.width / 2 - size / 2;
      const fromY = startRect.top + startRect.height / 2 - size / 2;
      const toX = targetRect.left + targetRect.width / 2 - size / 2;
      const toY = targetRect.top + targetRect.height / 2 - size / 2;

      const id = nextId.current;
      nextId.current += 1;
      setItems((prev) => [...prev, { id, imageUrl, fromX, fromY, toX, toY, size }]);
    },
    [reduce],
  );

  const remove = useCallback((id: number): void => {
    setItems((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const value = useMemo<CartFlyContextValue>(() => ({ flyToCart }), [flyToCart]);

  const layer =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="en-cart-fly-layer" aria-hidden>
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  className="en-cart-fly"
                  style={{ width: item.size, height: item.size }}
                  initial={{ x: item.fromX, y: item.fromY, opacity: 0.95, scale: 1, rotate: 0 }}
                  animate={{
                    x: item.toX,
                    y: item.toY,
                    opacity: 0.15,
                    scale: 0.2,
                    rotate: -12,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.55, 0.05, 0.4, 1] }}
                  onAnimationComplete={() => remove(item.id)}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span aria-hidden>🛒</span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body,
        )
      : null;

  return (
    <CartFlyContext.Provider value={value}>
      {children}
      {layer}
    </CartFlyContext.Provider>
  );
}

/** Access the cart-fly launcher. Must be used inside <CartFlyProvider>. */
export function useCartFly(): CartFlyContextValue {
  const ctx = useContext(CartFlyContext);
  if (!ctx) throw new Error('useCartFly must be used within a <CartFlyProvider>');
  return ctx;
}
