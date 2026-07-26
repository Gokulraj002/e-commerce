import { motion, useReducedMotion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';

import { STORE } from '@elite/shared';

import { Badge, EmptyState, Spinner } from '@/components/ui';
import { useOrder } from '@/features/checkout';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

export default function OrderSuccess(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const orderQuery = useOrder(code);
  const reduce = useReducedMotion();

  if (orderQuery.isLoading) {
    return (
      <section className="en-container py-6 d-flex justify-content-center">
        <Spinner size={32} />
      </section>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <section className="en-container py-6">
        <EmptyState
          icon="⚠️"
          title="We couldn't load this order"
          description={orderQuery.error ? getApiErrorMessage(orderQuery.error) : undefined}
          action={
            <Link to={paths.orders()} className="btn btn-gold">
              Go to my orders
            </Link>
          }
        />
      </section>
    );
  }

  const order = orderQuery.data;
  const isCod = order.paymentMethod === 'COD';
  const arrivalWindow = order.slotLabel ?? 'to be scheduled';

  // Framer's `useReducedMotion` returns true when the OS-level "reduce motion"
  // flag is set; skip the cinematic scale/spring in that case.
  const heroInitial = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 };
  const heroAnimate = reduce ? { opacity: 1 } : { opacity: 1, scale: 1 };
  const heroTransition = reduce
    ? { duration: 0.2 }
    : { type: 'spring' as const, stiffness: 220, damping: 18, mass: 0.9 };

  const shareText = encodeURIComponent(
    `Just placed an order at ${STORE.NAME}! Order ${order.code} — ${formatPaise(order.totalPaise)}.`,
  );
  const shareHref = `https://wa.me/?text=${shareText}`;

  return (
    <section className="en-container py-6">
      <div className="mx-auto en-os3__hero" style={{ maxWidth: 780 }}>
        {/* Cinematic tick */}
        <motion.div
          className="en-os3__tick"
          initial={heroInitial}
          animate={heroAnimate}
          transition={heroTransition}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.32, duration: 0.5 }}
          className="text-center mt-4"
        >
          <span className="en-eyebrow d-block mb-2">Order confirmed</span>
          <h1 className="en-display display-5 mb-3">Your order is on the way</h1>
          <p className="en-text-dim mb-3">
            Order <code className="en-code">{order.code}</code> · estimated arrival
          </p>
          <div className="en-os3__eta">
            <span aria-hidden>🚚</span>
            <span>
              <strong>{arrivalWindow}</strong>
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.46, duration: 0.4 }}
          className="en-os3__actions mt-4"
        >
          <Link to={paths.orderTracking(order.code)} className="btn btn-primary px-4">
            Track order
          </Link>
          <Link to={paths.home()} className="btn btn-outline-cream px-4">
            Order again
          </Link>
        </motion.div>

        <p className="text-center mt-3 mb-5">
          <a
            className="en-cp3__wa"
            href={shareHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span aria-hidden>💬</span>
            <span>Share on WhatsApp</span>
          </a>
        </p>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.6, duration: 0.5 }}
          className="en-receipt text-start"
        >
          <div className="text-center mb-2">
            <span className="en-receipt__eyebrow">Your receipt</span>
            <h2 className="en-receipt__title mt-1">{STORE.NAME}</h2>
          </div>
          <hr className="en-receipt__rule" />

          {/* Meta */}
          <div className="row g-3 mb-2">
            <div className="col-6 col-md-4">
              <p className="en-eyebrow mb-1" style={{ paddingBottom: 0 }}>Order</p>
              <p className="fw-semibold mb-0">
                <code className="en-code">{order.code}</code>
              </p>
            </div>
            <div className="col-6 col-md-4">
              <p className="en-eyebrow mb-1" style={{ paddingBottom: 0 }}>Payment</p>
              <p className="mb-0 d-inline-flex align-items-center gap-2 flex-wrap">
                <span className="fw-semibold">{order.paymentMethod}</span>
                <Badge tone={order.paymentStatus === 'PAID' ? 'fresh' : 'neutral'}>
                  {isCod ? 'Pay on delivery' : order.paymentStatus}
                </Badge>
              </p>
            </div>
            {order.slotLabel && (
              <div className="col-12 col-md-4">
                <p className="en-eyebrow mb-1" style={{ paddingBottom: 0 }}>Delivery slot</p>
                <p className="fw-semibold mb-0">{order.slotLabel}</p>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="en-well p-3 mb-3">
            <p className="en-eyebrow mb-1" style={{ paddingBottom: 0 }}>Delivering to</p>
            <p className="mb-0 small">
              <span className="fw-semibold">{order.address.name}</span> · {order.address.phone}
              <br />
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city} −{' '}
              {order.address.pincode}
            </p>
          </div>

          <hr className="en-receipt__rule" />

          {/* Line items */}
          <ul className="list-unstyled mb-0">
            {order.items.map((item) => (
              <li key={item.id} className="en-receipt-line">
                <span className="en-receipt-line__name">
                  {item.productName}
                  <span className="en-receipt-line__qty">×{item.quantity}</span>
                </span>
                <span className="en-receipt-line__val">
                  {formatPaise(item.lineTotalPaise)}
                </span>
                <span className="en-receipt-line__meta">{formatWeight(item.weightG)} pack</span>
              </li>
            ))}
          </ul>

          <hr className="en-receipt__rule" />

          <div className="en-receipt__row">
            <span className="en-receipt__row-label">Subtotal</span>
            <span className="en-receipt__row-value en-tabular">
              {formatPaise(order.subtotalPaise)}
            </span>
          </div>
          {order.discountPaise > 0 && (
            <div className="en-receipt__row">
              <span className="en-receipt__row-label">Discount</span>
              <span className="en-receipt__row-value--accent en-tabular">
                − {formatPaise(order.discountPaise)}
              </span>
            </div>
          )}
          <div className="en-receipt__row">
            <span className="en-receipt__row-label">Shipping</span>
            <span
              className={
                order.shippingPaise === 0
                  ? 'en-receipt__row-value--accent en-tabular'
                  : 'en-receipt__row-value en-tabular'
              }
            >
              {order.shippingPaise === 0 ? 'FREE' : formatPaise(order.shippingPaise)}
            </span>
          </div>
          <div className="en-receipt__row en-receipt__row--total">
            <span>Total</span>
            <span className="en-tabular">{formatPaise(order.totalPaise)}</span>
          </div>
        </motion.div>

        <p className="en-text-muted small text-center mt-4 mb-0">
          A confirmation is on the way. Need help? WhatsApp us at {STORE.SUPPORT_WHATSAPP}.
        </p>
      </div>
    </section>
  );
}
