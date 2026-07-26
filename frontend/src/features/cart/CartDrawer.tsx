/**
 * Header mini-basket — slides in from the right (420px desktop, full width
 * on narrow phones), rendered as a receipt-paper ticket with dashed line
 * separators between items, a "Free delivery unlocked at ₹699" progress
 * strip in the sticky footer, and a two-button footer (View full cart /
 * Checkout). Guests see a sign-in prompt; empty state uses a friendly
 * butcher-block emoji.
 */
import { useNavigate } from 'react-router-dom';

import { STORE, type CartItemDTO } from '@elite/shared';

import { Button, Drawer, QuantityStepper, Skeleton } from '@/components/ui';
import { useToast } from '@/components/ui/toast/ToastContext';
import { useAuth } from '@/features/auth/useAuth';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

import { useCartDrawer } from './CartDrawerContext';
import { useCart } from './useCart';

const FREE_SHIPPING_PAISE = STORE.FREE_SHIPPING_THRESHOLD * 100;

export function CartDrawer(): JSX.Element {
  const { isOpen, close } = useCartDrawer();
  const { isAuthenticated } = useAuth();
  const { cart, itemCount, isLoading, isMutating, updateItem, removeItem } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotalPaise ?? 0;
  const remaining = FREE_SHIPPING_PAISE - subtotal;
  const unlocked = remaining <= 0;
  const freeShipPct = unlocked
    ? 100
    : Math.max(6, Math.min(100, Math.round((subtotal / FREE_SHIPPING_PAISE) * 100)));
  const hasItems = items.length > 0;

  const go = (path: string): void => {
    close();
    navigate(path);
  };

  async function handleQty(item: CartItemDTO, next: number): Promise<void> {
    try {
      await updateItem(item.id, next);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update quantity'));
    }
  }

  async function handleRemove(item: CartItemDTO): Promise<void> {
    try {
      await removeItem(item.id);
      toast.info(`Removed ${item.name}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not remove item'));
    }
  }

  const title = (
    <span className="en-cd3__title-row">
      <span>Your basket</span>
      {itemCount > 0 && (
        <span className="en-cd3__count">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      )}
    </span>
  );

  const footer = hasItems ? (
    <div className="en-cd3__foot">
      {unlocked ? (
        <p className="en-cd3__free" role="status">
          <span aria-hidden>✓</span>
          <span>You&rsquo;ve unlocked free delivery</span>
        </p>
      ) : (
        <div className="en-cd3__free-pending" role="status">
          <span>
            Add <strong>{formatPaise(remaining)}</strong> more for free delivery at ₹699
          </span>
          <div className="en-freeship__track" aria-hidden>
            <div className="en-freeship__fill" style={{ width: `${freeShipPct}%` }} />
          </div>
        </div>
      )}
      <div className="en-cd3__foot-row">
        <span className="en-smallcaps">Subtotal</span>
        <span className="en-cd3__foot-total en-tabular">{formatPaise(subtotal)}</span>
      </div>
      <div className="en-cd3__ctas">
        <Button variant="outline" fullWidth onClick={() => go(paths.cart())}>
          View full cart
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => go(paths.checkout())}
          disabled={isMutating}
        >
          Checkout
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Drawer open={isOpen} onClose={close} title={title} footer={footer}>
      {!isAuthenticated ? (
        <div className="en-cd3__empty">
          <span className="en-cd3__empty-icon" aria-hidden>🔒</span>
          <p className="en-cd3__empty-title">Sign in to view your basket</p>
          <p className="en-cd3__empty-copy">
            Your basket lives on your account so pricing and stock stay accurate.
          </p>
          <Button variant="gold" onClick={() => go(paths.login())}>
            Sign in
          </Button>
        </div>
      ) : isLoading ? (
        <div className="d-flex flex-column gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={82} radius={14} />
          ))}
        </div>
      ) : !hasItems ? (
        <div className="en-cd3__empty">
          <span className="en-cd3__empty-icon" aria-hidden>🥩</span>
          <p className="en-cd3__empty-title">Your basket is empty</p>
          <p className="en-cd3__empty-copy">
            Fresh cuts, marinades and ready-to-cook — waiting for you.
          </p>
          <Button variant="gold" onClick={() => go(paths.home())}>
            Browse fresh cuts
          </Button>
        </div>
      ) : (
        <ul className="en-cd3__list">
          {items.map((item) => (
            <li key={item.id} className="en-cd3__row">
              <div className="en-cd3__thumb">
                {item.image ? (
                  <img src={item.image} alt={item.name} loading="lazy" />
                ) : (
                  <span aria-hidden>🥩</span>
                )}
              </div>
              <div className="en-cd3__meta">
                <p className="en-cd3__name">{item.name}</p>
                <p className="en-cd3__submeta">
                  {formatWeight(item.weightG)} pack · {formatPaise(item.pricePaise)} each
                </p>
                <QuantityStepper
                  value={item.quantity}
                  onChange={(next) => void handleQty(item, next)}
                  min={1}
                  disabled={isMutating}
                  ariaLabel={`Quantity of ${item.name}`}
                />
              </div>
              <div className="en-cd3__pricecol">
                <span className="en-cd3__price en-tabular">
                  {formatPaise(item.lineTotalPaise)}
                </span>
                <button
                  type="button"
                  className="en-cd3__rmv"
                  onClick={() => void handleRemove(item)}
                  disabled={isMutating}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
