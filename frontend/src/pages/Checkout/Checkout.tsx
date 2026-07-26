import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import {
  PAYMENT_METHOD,
  STORE,
  type AddressDTO,
  type CartDTO,
  type DeliverySlotDTO,
  type PaymentMethod,
} from '@elite/shared';

import { Badge, Button, Card, Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useCart } from '@/features/cart';
import {
  AddressForm,
  MockPaymentModal,
  ToastStack,
  useAddresses,
  useCheckoutSummary,
  usePaymentInit,
  usePaymentVerify,
  usePlaceOrder,
  useServiceability,
  useSlots,
  useToasts,
  type CheckoutSummary,
  type PaymentInit,
} from '@/features/checkout';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

// ── Small helpers ───────────────────────────────────────────────────

function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dateLabel(d: Date, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const DATE_OPTIONS: { value: string; label: string }[] = Array.from({ length: 4 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return { value: toYmd(d), label: dateLabel(d, i) };
});

const PAYMENT_OPTIONS: {
  method: PaymentMethod;
  title: string;
  sub: string;
  icon: string;
}[] = [
  { method: PAYMENT_METHOD.RAZORPAY, title: 'Razorpay', sub: 'Cards, UPI & Netbanking', icon: '💳' },
  { method: PAYMENT_METHOD.PHONEPE, title: 'PhonePe', sub: 'UPI & wallet', icon: '📱' },
  { method: PAYMENT_METHOD.CASHFREE, title: 'Cashfree', sub: 'Cards, UPI & Netbanking', icon: '🏦' },
  { method: PAYMENT_METHOD.COD, title: 'Cash on Delivery', sub: 'Pay when it arrives', icon: '💵' },
];

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.RAZORPAY]: 'Razorpay',
  [PAYMENT_METHOD.PHONEPE]: 'PhonePe',
  [PAYMENT_METHOD.CASHFREE]: 'Cashfree',
  [PAYMENT_METHOD.COD]: 'Cash on Delivery',
};

const PROGRESS_STEPS = ['Address', 'Slot', 'Payment', 'Review'] as const;

// ── Page ────────────────────────────────────────────────────────────

export default function Checkout(): JSX.Element {
  const { isAuthenticated, user } = useAuth();
  const { cart, isLoading: cartLoading } = useCart();
  const navigate = useNavigate();
  const toasts = useToasts();

  const addressesQuery = useAddresses();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState<string>(DATE_OPTIONS[0].value);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHOD.COD);
  const [note, setNote] = useState('');

  const placeMutation = usePlaceOrder();
  const initMutation = usePaymentInit();
  const verifyMutation = usePaymentVerify();

  const [payInit, setPayInit] = useState<PaymentInit | null>(null);
  const [payProcessing, setPayProcessing] = useState(false);

  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const pincode = selectedAddress?.pincode ?? '';

  const serviceability = useServiceability(pincode);
  const slotsQuery = useSlots(deliveryDate, pincode || undefined);
  const summaryQuery = useCheckoutSummary(selectedAddressId, selectedSlotId ?? undefined);
  const selectedSlot =
    (slotsQuery.data ?? []).find((s) => s.id === selectedSlotId) ?? null;

  // Auto-select the default (or first) address once loaded.
  useEffect(() => {
    if (selectedAddressId || addresses.length === 0) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedAddressId(def.id);
  }, [addresses, selectedAddressId]);

  // A slot from a previous pincode/date must not leak into a new context.
  useEffect(() => {
    setSelectedSlotId(null);
  }, [deliveryDate, pincode]);

  if (!isAuthenticated) return <Navigate to={paths.login()} replace />;
  if (!cartLoading && cart && cart.items.length === 0) return <Navigate to={paths.cart()} replace />;

  const notServiceable = serviceability.data?.serviceable === false;
  const canPlace =
    Boolean(selectedAddressId) &&
    Boolean(selectedSlotId) &&
    !notServiceable &&
    !placeMutation.isPending;

  // Progress rail state — index of the current step.
  const stepIndex =
    !selectedAddressId ? 0 : !selectedSlotId ? 1 : !canPlace ? 2 : 3;

  async function runOnlinePayment(orderCode: string): Promise<void> {
    try {
      const init = await initMutation.mutateAsync(orderCode);
      setPayInit(init);
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Could not start payment'));
      toasts.info('Your order is saved as pending — complete payment from My Orders.');
    }
  }

  async function handlePlaceOrder(): Promise<void> {
    if (!selectedAddressId || !selectedSlotId) return;
    try {
      const result = await placeMutation.mutateAsync({
        addressId: selectedAddressId,
        slotId: selectedSlotId,
        paymentMethod,
        note: note.trim() || undefined,
      });

      if (result.paymentMethod === PAYMENT_METHOD.COD || !result.requiresPaymentInit) {
        navigate(paths.orderSuccess(result.order.code));
        return;
      }
      await runOnlinePayment(result.order.code);
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Could not place your order'));
    }
  }

  async function handleConfirmPayment(): Promise<void> {
    if (!payInit) return;
    setPayProcessing(true);
    try {
      const result = await verifyMutation.mutateAsync({
        orderCode: payInit.orderCode,
        gatewayPaymentId: `mock_pay_${payInit.orderCode}`,
        gatewayOrderId: payInit.gatewayOrderId,
        signature: 'mock_signature',
      });
      if (result.paymentStatus === 'PAID') {
        navigate(paths.orderSuccess(payInit.orderCode));
      } else {
        toasts.error('Payment could not be confirmed. Please try again.');
      }
    } catch (err) {
      toasts.error(getApiErrorMessage(err, 'Payment verification failed'));
    } finally {
      setPayProcessing(false);
    }
  }

  function handleAddressCreated(id: string): void {
    setSelectedAddressId(id);
    setShowAddressForm(false);
    toasts.success('Address saved');
  }

  const isPending = placeMutation.isPending || initMutation.isPending;
  const placeCta = paymentMethod === PAYMENT_METHOD.COD ? 'Place order' : 'Pay & place order';

  // Total shown inside the primary CTA — prefer server summary (authoritative);
  // fall back to the last known cart total so the button still reads intelligently
  // while the server pricing is loading.
  const ctaTotalPaise =
    summaryQuery.data?.pricing.totalPaise ?? cart?.totalPaise ?? 0;

  const supportPhone = STORE.SUPPORT_WHATSAPP.replace(/[^0-9]/g, '');
  const waHref = `https://wa.me/${supportPhone}`;

  return (
    <section className="en-container py-6">
      <div className="mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <span className="en-eyebrow d-block mb-1">{STORE.NAME}</span>
          <h1 className="en-display display-6 mb-0">Checkout</h1>
        </div>
        <Link to={paths.cart()} className="btn btn-ghost btn-sm">
          ← Back to cart
        </Link>
      </div>

      <ProgressRail current={stepIndex} />

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-7 d-flex flex-column gap-4">
          {/* 1. Address */}
          <Card padding="lg">
            <StepHeading step={1} title="Delivery address" />
            {addressesQuery.isLoading ? (
              <Spinner />
            ) : (
              <>
                {addresses.length > 0 && !showAddressForm && (
                  <div className="d-flex flex-column gap-2">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <label
                          key={addr.id}
                          className={`en-select-card p-3 d-flex gap-3 align-items-start${
                            isSelected ? ' is-selected' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            className="form-check-input mt-1"
                            name="address"
                            checked={isSelected}
                            onChange={() => setSelectedAddressId(addr.id)}
                          />
                          <span className="flex-grow-1">
                            <span className="d-inline-flex align-items-center gap-2 mb-1">
                              <span className="fw-semibold">{addr.label}</span>
                              {addr.isDefault && <Badge tone="neutral">Default</Badge>}
                            </span>
                            <span className="d-block en-text-dim small">
                              {addr.name} · {addr.phone}
                            </span>
                            <span className="d-block en-text-muted small">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city} − {addr.pincode}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {notServiceable && selectedAddress && !showAddressForm && (
                  <p className="text-danger small mb-0 mt-2">
                    We do not deliver to {selectedAddress.pincode} yet. Please choose another
                    address.
                  </p>
                )}

                {showAddressForm ? (
                  <div className="mt-3">
                    <AddressForm
                      defaultName={user?.name}
                      defaultPhone={user?.phone}
                      onCreated={(a) => handleAddressCreated(a.id)}
                      onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                    />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 px-0"
                    onClick={() => setShowAddressForm(true)}
                  >
                    + Add a new address
                  </Button>
                )}
              </>
            )}
          </Card>

          {/* 2. Delivery slot */}
          <Card padding="lg">
            <StepHeading step={2} title="Delivery slot" />
            {!selectedAddressId ? (
              <p className="en-text-muted small mb-0">Select an address to see delivery slots.</p>
            ) : (
              <>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {DATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`btn btn-sm ${deliveryDate === opt.value ? 'btn-gold' : 'btn-outline-cream'}`}
                      onClick={() => setDeliveryDate(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {slotsQuery.isLoading ? (
                  <Spinner />
                ) : (slotsQuery.data ?? []).length === 0 ? (
                  <p className="en-text-muted small mb-0">
                    {notServiceable
                      ? 'No slots — this pincode is not serviceable.'
                      : 'No slots available for this day. Try another date.'}
                  </p>
                ) : (
                  <div className="row row-cols-2 row-cols-md-3 g-2">
                    {(slotsQuery.data ?? []).map((slot) => (
                      <SlotChip
                        key={slot.id}
                        slot={slot}
                        selected={selectedSlotId === slot.id}
                        onSelect={() => setSelectedSlotId(slot.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* 3. Payment */}
          <Card padding="lg">
            <StepHeading step={3} title="Payment method" />
            <div className="d-flex flex-column gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const isSelected = paymentMethod === opt.method;
                return (
                  <label
                    key={opt.method}
                    className={`en-select-card p-3 d-flex gap-3 align-items-center${
                      isSelected ? ' is-selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      className="form-check-input"
                      name="payment"
                      checked={isSelected}
                      onChange={() => setPaymentMethod(opt.method)}
                    />
                    <span className="en-cp3__payicon" aria-hidden>
                      {opt.icon}
                    </span>
                    <span className="flex-grow-1">
                      <span className="fw-semibold d-block">{opt.title}</span>
                      <span className="en-text-muted small">{opt.sub}</span>
                    </span>
                    {opt.method !== PAYMENT_METHOD.COD && <Badge tone="gold">Online</Badge>}
                  </label>
                );
              })}
            </div>

            <div className="mt-3">
              <label className="form-label" htmlFor="order-note">
                Delivery note <span className="en-text-muted">(optional)</span>
              </label>
              <textarea
                id="order-note"
                className="form-control"
                rows={2}
                maxLength={500}
                placeholder="Gate code, landmark, cooking preference…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </Card>

          {/* 4. Review */}
          <ReviewBlock
            address={selectedAddress}
            slot={selectedSlot}
            paymentMethod={paymentMethod}
            note={note}
            cart={cart}
            canPlace={canPlace}
            isPending={isPending}
            placeCta={placeCta}
            totalPaise={ctaTotalPaise}
            onPlace={() => void handlePlaceOrder()}
          />
        </div>

        {/* Summary sidebar — receipt style */}
        <div className="col-12 col-lg-5">
          <div className="en-checkout-sidebar">
            <div className="en-receipt">
              <div className="text-center mb-2">
                <span className="en-receipt__eyebrow">Your receipt</span>
                <h2 className="en-receipt__title mt-1">Order summary</h2>
              </div>
              <hr className="en-receipt__rule" />
              <OrderSummary
                loading={summaryQuery.isLoading}
                error={summaryQuery.isError ? getApiErrorMessage(summaryQuery.error) : null}
                summary={summaryQuery.data ?? null}
                fallbackTotals={cart}
                selectedSlot={selectedSlot}
              />

              <button
                type="button"
                className="en-cp3__place mt-4"
                onClick={() => void handlePlaceOrder()}
                disabled={!canPlace}
                aria-busy={isPending || undefined}
              >
                <span className="d-inline-flex align-items-center gap-2">
                  {isPending && <Spinner size={16} />}
                  <span>{placeCta}</span>
                </span>
                {ctaTotalPaise > 0 && (
                  <span className="en-cp3__place-price">{formatPaise(ctaTotalPaise)}</span>
                )}
              </button>

              {!selectedSlotId && selectedAddressId && !notServiceable && (
                <p className="en-text-muted small text-center mb-0 mt-2">
                  Select a delivery slot to continue.
                </p>
              )}
            </div>

            <ul className="en-checkout-trust mt-3" aria-label="Order protections">
              <li>
                <span className="en-checkout-trust__icon" aria-hidden>🔒</span>
                <span>
                  <strong>Secure payment</strong>
                  <span className="en-text-muted d-block small">
                    UPI, cards & wallets — 256-bit encrypted.
                  </span>
                </span>
              </li>
              <li>
                <span className="en-checkout-trust__icon" aria-hidden>❄️</span>
                <span>
                  <strong>Cold-chain delivery</strong>
                  <span className="en-text-muted d-block small">
                    Insulated packaging, temperature logged.
                  </span>
                </span>
              </li>
              <li>
                <span className="en-checkout-trust__icon" aria-hidden>↩️</span>
                <span>
                  <strong>Cancel anytime</strong>
                  <span className="en-text-muted d-block small">
                    Full refund before dispatch — no questions asked.
                  </span>
                </span>
              </li>
            </ul>

            <p className="text-center mt-3 mb-0">
              <a
                className="en-cp3__wa"
                href={waHref}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span aria-hidden>💬</span>
                <span>Need help? WhatsApp support</span>
              </a>
            </p>
          </div>
        </div>
      </div>

      <MockPaymentModal
        open={payInit !== null}
        init={payInit}
        processing={payProcessing}
        onPay={() => void handleConfirmPayment()}
        onCancel={() => {
          if (payProcessing) return;
          setPayInit(null);
          toasts.info('Payment pending — you can complete it from My Orders.');
        }}
      />

      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </section>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ProgressRail({ current }: { current: number }): JSX.Element {
  return (
    <nav
      className="en-checkout-rail d-none d-md-flex"
      aria-label="Checkout progress"
    >
      {PROGRESS_STEPS.map((label, i) => {
        const state: 'done' | 'current' | 'pending' =
          i < current ? 'done' : i === current ? 'current' : 'pending';
        return (
          <div key={label} className="en-checkout-rail__step" data-state={state}>
            <span className="en-checkout-rail__dot" aria-hidden>
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className="en-checkout-rail__label">{label}</span>
            {i < PROGRESS_STEPS.length - 1 && (
              <span className="en-checkout-rail__seg" aria-hidden />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function StepHeading({ step, title }: { step: number; title: string }): JSX.Element {
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <span aria-hidden className="en-step-badge en-step-badge--gold">
        {step}
      </span>
      <h2 className="en-display h4 mb-0">{title}</h2>
    </div>
  );
}

function SlotChip({
  slot,
  selected,
  onSelect,
}: {
  slot: DeliverySlotDTO;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const classes = [
    'en-select-card en-slot-chip w-100 h-100',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="col">
      <button type="button" onClick={onSelect} disabled={!slot.available} className={classes}>
        <span className="d-block small fw-semibold">{slot.label}</span>
        <span className="d-block en-text-muted" style={{ fontSize: '0.75rem' }}>
          {slot.startTime}–{slot.endTime}
        </span>
      </button>
    </div>
  );
}

interface OrderSummaryProps {
  loading: boolean;
  error: string | null;
  summary: CheckoutSummary | null;
  fallbackTotals: CartDTO | null;
  selectedSlot: DeliverySlotDTO | null;
}

function OrderSummary({
  loading,
  error,
  summary,
  fallbackTotals,
  selectedSlot,
}: OrderSummaryProps): JSX.Element {
  if (loading) return <Spinner />;

  const pricing = summary?.pricing ?? fallbackTotals;
  if (!pricing) {
    return <p className="en-text-muted small mb-0">Select an address to see your total.</p>;
  }

  const items = fallbackTotals?.items ?? [];

  return (
    <>
      {error && <p className="text-danger small">{error}</p>}

      {items.length > 0 && (
        <ul className="list-unstyled mb-2">
          {items.map((it) => (
            <li key={it.id} className="en-receipt-line">
              <span className="en-receipt-line__name" title={it.name}>
                {it.name}
                <span className="en-receipt-line__qty">×{it.quantity}</span>
              </span>
              <span className="en-receipt-line__val">{formatPaise(it.lineTotalPaise)}</span>
              <span className="en-receipt-line__meta">{formatWeight(it.weightG)} pack</span>
            </li>
          ))}
        </ul>
      )}

      <hr className="en-receipt__rule" />

      <div className="en-receipt__row">
        <span className="en-receipt__row-label">Subtotal</span>
        <span className="en-receipt__row-value en-tabular">{formatPaise(pricing.subtotalPaise)}</span>
      </div>
      {pricing.discountPaise > 0 && (
        <div className="en-receipt__row">
          <span className="en-receipt__row-label">
            Discount{summary?.pricing.couponCode ? ` (${summary.pricing.couponCode})` : ''}
          </span>
          <span className="en-receipt__row-value--accent en-tabular">
            − {formatPaise(pricing.discountPaise)}
          </span>
        </div>
      )}
      <div className="en-receipt__row">
        <span className="en-receipt__row-label">Shipping</span>
        <span
          className={
            pricing.shippingPaise === 0
              ? 'en-receipt__row-value--accent en-tabular'
              : 'en-receipt__row-value en-tabular'
          }
        >
          {pricing.shippingPaise === 0 ? 'FREE' : formatPaise(pricing.shippingPaise)}
        </span>
      </div>
      {(summary?.slotLabel || selectedSlot) && (
        <div className="en-receipt__row">
          <span className="en-receipt__row-label">Slot</span>
          <span className="en-receipt__row-value">
            {summary?.slotLabel ?? selectedSlot?.label}
          </span>
        </div>
      )}
      <div className="en-receipt__row en-receipt__row--total">
        <span>Total</span>
        <span className="en-tabular">{formatPaise(pricing.totalPaise)}</span>
      </div>
    </>
  );
}

interface ReviewBlockProps {
  address: AddressDTO | null;
  slot: DeliverySlotDTO | null;
  paymentMethod: PaymentMethod;
  note: string;
  cart: CartDTO | null;
  canPlace: boolean;
  isPending: boolean;
  placeCta: string;
  totalPaise: number;
  onPlace: () => void;
}

function ReviewBlock({
  address,
  slot,
  paymentMethod,
  note,
  cart,
  canPlace,
  isPending,
  placeCta,
  totalPaise,
  onPlace,
}: ReviewBlockProps): JSX.Element {
  const items = cart?.items ?? [];
  const ready = Boolean(address && slot);

  return (
    <Card className="en-review" padding="lg">
      <StepHeading step={4} title="Review & place order" />

      {!ready ? (
        <p className="en-text-muted small mb-0">
          Pick your address and slot above — the full review will appear here.
        </p>
      ) : (
        <details className="en-review__details" open>
          <summary className="en-review__summary">
            <span className="fw-semibold">Everything look right?</span>
            <span className="en-text-muted small">Tap to expand or collapse</span>
          </summary>

          <div className="en-review__grid mt-3">
            <ReviewFact label="Delivering to">
              <span className="fw-semibold">{address!.label}</span>
              <br />
              <span className="small en-text-dim">
                {address!.name} · {address!.phone}
              </span>
              <br />
              <span className="small en-text-muted">
                {address!.line1}
                {address!.line2 ? `, ${address!.line2}` : ''}, {address!.city} − {address!.pincode}
              </span>
            </ReviewFact>

            <ReviewFact label="Delivery slot">
              <span className="fw-semibold">{slot!.label}</span>
              <br />
              <span className="small en-text-muted">
                {slot!.startTime}–{slot!.endTime}
              </span>
            </ReviewFact>

            <ReviewFact label="Payment">
              <span className="fw-semibold">{PAYMENT_LABEL[paymentMethod]}</span>
              <br />
              <span className="small en-text-muted">
                {paymentMethod === PAYMENT_METHOD.COD
                  ? 'Pay when your order arrives'
                  : 'Charged securely at place order'}
              </span>
            </ReviewFact>

            {note.trim() && (
              <ReviewFact label="Delivery note">
                <span className="small">{note.trim()}</span>
              </ReviewFact>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-3">
              <p className="en-eyebrow mb-2" style={{ paddingBottom: 0 }}>
                Items ({items.length})
              </p>
              <ul className="en-review__items list-unstyled mb-0">
                {items.map((it) => (
                  <li key={it.id} className="en-review__item">
                    <span className="en-review__thumb" aria-hidden>
                      {it.image ? <img src={it.image} alt="" /> : <span>🥩</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="d-block fw-semibold text-truncate">{it.name}</span>
                      <span className="en-text-muted small">
                        {formatWeight(it.weightG)} · ×{it.quantity}
                      </span>
                    </span>
                    <span className="fw-semibold ms-auto">
                      {formatPaise(it.lineTotalPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}

      <div className="d-flex flex-column flex-sm-row justify-content-end mt-4">
        <button
          type="button"
          className="en-cp3__place"
          onClick={onPlace}
          disabled={!canPlace}
          aria-busy={isPending || undefined}
          style={{ maxWidth: 'min(420px, 100%)' }}
        >
          <span className="d-inline-flex align-items-center gap-2">
            {isPending && <Spinner size={16} />}
            <span>{placeCta}</span>
          </span>
          {totalPaise > 0 && (
            <span className="en-cp3__place-price">{formatPaise(totalPaise)}</span>
          )}
        </button>
      </div>
    </Card>
  );
}

function ReviewFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="en-review__fact">
      <p className="en-eyebrow mb-1" style={{ paddingBottom: 0 }}>
        {label}
      </p>
      <div className="en-text-dim">{children}</div>
    </div>
  );
}
