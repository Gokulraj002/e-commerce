import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { STORE, type CartItemDTO } from '@elite/shared';

import { Badge, Button, EmptyState, QuantityStepper, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useCart } from '@/features/cart';
import { ToastStack, useToasts } from '@/features/checkout';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

const FREE_SHIPPING_PAISE = STORE.FREE_SHIPPING_THRESHOLD * 100;

export default function Cart(): JSX.Element {
  const { isAuthenticated } = useAuth();
  const { cart, isLoading, isMutating, updateItem, removeItem, applyCouponCode, clearCouponCode } =
    useCart();
  const navigate = useNavigate();
  const toasts = useToasts();

  const [couponInput, setCouponInput] = useState('');
  const [applying, setApplying] = useState(false);

  // Guests have no server cart — prompt sign-in.
  if (!isAuthenticated) {
    return (
      <section className="en-container py-6">
        <CartHeader />
        <EmptyState
          icon="🔒"
          title="Sign in to view your cart"
          description="Your cart is saved to your account so pricing and stock stay accurate."
          action={
            <Button variant="gold" onClick={() => navigate(paths.login())}>
              Sign in
            </Button>
          }
        />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="en-container py-6">
        <CartHeader />
        <div className="row g-4">
          <div className="col-12 col-lg-8 d-flex flex-column gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={148} radius={16} />
            ))}
          </div>
          <div className="col-12 col-lg-4">
            <Skeleton height={420} radius={16} />
          </div>
        </div>
      </section>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <section className="en-container py-6">
        <CartHeader />
        <EmptyState
          icon="🥩"
          title="Your cart is empty"
          description="Fresh cuts, ready-to-cook marinades and more are waiting."
          action={
            <Button variant="gold" onClick={() => navigate(paths.home())}>
              Browse the store
            </Button>
          }
        />
      </section>
    );
  }

  const subtotal = cart!.subtotalPaise;
  const total = cart!.totalPaise;
  const remainingForFreeShip = FREE_SHIPPING_PAISE - subtotal;
  const unlocked = remainingForFreeShip <= 0;
  const freeShipPct = unlocked
    ? 100
    : Math.max(6, Math.min(100, Math.round((subtotal / FREE_SHIPPING_PAISE) * 100)));

  async function handleQty(item: CartItemDTO, next: number): Promise<void> {
    try {
      await updateItem(item.id, next);
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Could not update quantity'));
    }
  }

  async function handleRemove(item: CartItemDTO): Promise<void> {
    try {
      await removeItem(item.id);
      toasts.info(`Removed ${item.name}`);
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Could not remove item'));
    }
  }

  async function handleApplyCoupon(): Promise<void> {
    const code = couponInput.trim();
    if (!code) return;
    setApplying(true);
    try {
      await applyCouponCode(code);
      toasts.success(`Coupon ${code.toUpperCase()} applied`);
      setCouponInput('');
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Coupon could not be applied'));
    } finally {
      setApplying(false);
    }
  }

  async function handleRemoveCoupon(): Promise<void> {
    try {
      await clearCouponCode();
      toasts.info('Coupon removed');
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Could not remove coupon'));
    }
  }

  return (
    <section className="en-container py-6">
      <CartHeader itemCount={items.length} />
      <div className="row g-4">
        {/* Line items */}
        <div className="col-12 col-lg-8 d-flex flex-column gap-3">
          {items.map((item) => (
            <article key={item.id} className="en-cart3__row">
              <div className="en-cart3__row-thumb">
                {item.image ? (
                  <img src={item.image} alt={item.name} loading="lazy" />
                ) : (
                  <span aria-hidden>🥩</span>
                )}
              </div>

              <div className="en-cart3__row-body">
                <div className="d-flex justify-content-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="en-cart3__row-name">{item.name}</p>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span className="en-cart3__row-chip">{formatWeight(item.weightG)} pack</span>
                      <span className="en-text-muted small en-tabular">
                        {formatPaise(item.pricePaise)} each
                      </span>
                    </div>
                  </div>
                  <span className="en-cart3__row-price">{formatPaise(item.lineTotalPaise)}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center gap-3 mt-3">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(next) => void handleQty(item, next)}
                    min={1}
                    disabled={isMutating}
                    ariaLabel={`Quantity of ${item.name}`}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm en-cart-remove px-2"
                    onClick={() => void handleRemove(item)}
                    disabled={isMutating}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}

          <div className="d-flex justify-content-start align-items-center mt-2">
            <Link to={paths.home()} className="btn btn-ghost btn-sm">
              ← Continue shopping
            </Link>
          </div>
        </div>

        {/* Receipt summary */}
        <div className="col-12 col-lg-4">
          <div className="en-cart-summary-wrap">
            <div className="en-receipt">
              <div className="text-center mb-2">
                <span className="en-receipt__eyebrow">Your receipt</span>
                <h2 className="en-receipt__title mt-1">{STORE.NAME}</h2>
              </div>
              <hr className="en-receipt__rule" />

              {/* Coupon */}
              <div className="mb-3">
                {cart!.couponCode ? (
                  <div className="en-cart3__coupon-applied">
                    <span className="d-inline-flex align-items-center gap-2">
                      <Badge tone="gold">{cart!.couponCode}</Badge>
                      <span className="en-text-dim small">applied</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm px-2"
                      onClick={() => void handleRemoveCoupon()}
                      disabled={isMutating}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    className="en-cart3__pill"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleApplyCoupon();
                    }}
                  >
                    <input
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      aria-label="Coupon code"
                      autoComplete="off"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={applying}
                      disabled={!couponInput.trim()}
                    >
                      Apply
                    </Button>
                  </form>
                )}
              </div>

              {/* Receipt totals */}
              <div className="en-receipt__row">
                <span className="en-receipt__row-label">Subtotal</span>
                <span className="en-receipt__row-value en-tabular">
                  {formatPaise(cart!.subtotalPaise)}
                </span>
              </div>
              {cart!.discountPaise > 0 && (
                <div className="en-receipt__row">
                  <span className="en-receipt__row-label">
                    Discount{cart!.couponCode ? ` (${cart!.couponCode})` : ''}
                  </span>
                  <span className="en-receipt__row-value--accent en-tabular">
                    − {formatPaise(cart!.discountPaise)}
                  </span>
                </div>
              )}
              <div className="en-receipt__row">
                <span className="en-receipt__row-label">Shipping</span>
                <span
                  className={
                    cart!.shippingPaise === 0
                      ? 'en-receipt__row-value--accent en-tabular'
                      : 'en-receipt__row-value en-tabular'
                  }
                >
                  {cart!.shippingPaise === 0 ? 'FREE' : formatPaise(cart!.shippingPaise)}
                </span>
              </div>

              <div className="en-receipt__row en-receipt__row--total">
                <span>Total</span>
                <span className="en-tabular">{formatPaise(total)}</span>
              </div>

              {/* Free-delivery progress */}
              <div
                className={`en-cart3__freeblock${
                  unlocked ? ' en-cart3__freeblock--unlocked' : ''
                }`}
              >
                <div className="en-cart3__freeblock-head">
                  {unlocked ? (
                    <strong>✓ You&rsquo;ve unlocked free delivery</strong>
                  ) : (
                    <>
                      <span>Free delivery at ₹699</span>
                      <span className="en-tabular">
                        <strong>{formatPaise(remainingForFreeShip)}</strong> to go
                      </span>
                    </>
                  )}
                </div>
                <div className="en-freeship__track" aria-hidden>
                  <div
                    className={`en-freeship__fill${unlocked ? ' is-full' : ''}`}
                    style={{ width: `${freeShipPct}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="en-cart3__cta mt-3"
                onClick={() => navigate(paths.checkout())}
                disabled={isMutating}
              >
                <span>Proceed to checkout</span>
                <span className="en-cart3__cta-arrow" aria-hidden>
                  →
                </span>
              </button>
              <p className="en-text-muted small text-center mb-0 mt-2">
                Taxes calculated at checkout. Prices in {STORE.CURRENCY_SYMBOL} (INR).
              </p>
            </div>

            <ul className="en-cart-assurances mt-3">
              <li>
                <span aria-hidden>❄️</span>
                <span>Cold-chain delivery, in premium insulated packs.</span>
              </li>
              <li>
                <span aria-hidden>🔒</span>
                <span>Secure payment — UPI, cards, wallets and COD.</span>
              </li>
              <li>
                <span aria-hidden>↩️</span>
                <span>Cancel anytime before dispatch — full refund.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </section>
  );
}

function CartHeader({ itemCount }: { itemCount?: number }): JSX.Element {
  return (
    <div className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
      <div>
        <span className="en-eyebrow d-block mb-1">{STORE.NAME}</span>
        <h1 className="en-display display-6 mb-0">Your cart</h1>
      </div>
      {itemCount !== undefined && itemCount > 0 && (
        <span className="en-text-dim small">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} ready to check out
        </span>
      )}
    </div>
  );
}
