import { useContext } from 'react';

import { CartContext, type CartContextValue } from './CartContext';

/** Access cart state + actions. Must be used within <CartProvider>. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
