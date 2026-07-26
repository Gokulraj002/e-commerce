/**
 * Ambient open/close state for the header cart mini-drawer.
 *
 * The drawer itself lives in `CartDrawer.tsx` and reads cart data via
 * `useCart()`; this tiny context only holds the open flag so any UI
 * (header cart button, "added to cart" toast, PDP add-to-cart handler…)
 * can pop the drawer without prop-drilling.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CartDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo<CartDrawerContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}

/** Access the mini-cart drawer state. Must be used inside `<CartDrawerProvider>`. */
export function useCartDrawer(): CartDrawerContextValue {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) throw new Error('useCartDrawer must be used within a <CartDrawerProvider>');
  return ctx;
}
