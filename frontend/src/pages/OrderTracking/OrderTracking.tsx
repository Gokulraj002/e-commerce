import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PAYMENT_STATUS, type OrderStatus } from '@elite/shared';

import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import {
  AccountLayout,
  buildTrackSteps,
  isCancellable,
  isTerminated,
  orderStatusLabel,
  orderStatusTone,
  useCancelOrder,
  useOrder,
  type TrackStep,
} from '@/features/account';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const PAYMENT_LABEL: Record<string, string> = {
  [PAYMENT_STATUS.PENDING]: 'Payment pending',
  [PAYMENT_STATUS.PAID]: 'Paid',
  [PAYMENT_STATUS.FAILED]: 'Payment failed',
  [PAYMENT_STATUS.REFUNDED]: 'Refunded',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'Partially refunded',
};

function StepDot({ step }: { step: TrackStep }): JSX.Element {
  // Past = crimson (progression complete); current = gold ring; future = cream.
  const modifier = step.current
    ? ' en-order-track__dot--current'
    : step.done
      ? ' en-order-track__dot--done'
      : '';
  return (
    <div className={`en-order-track__dot${modifier}`} aria-hidden>
      {step.done ? '✓' : ''}
    </div>
  );
}

function Stepper({ status }: { status: OrderStatus }): JSX.Element {
  const steps = buildTrackSteps(status);
  return (
    <div className="en-order-track" role="list" aria-label="Order progress">
      {steps.map((step, index) => {
        const leftClass =
          index === 0
            ? 'en-order-track__seg en-order-track__seg--edge'
            : steps[index].done
              ? 'en-order-track__seg en-order-track__seg--filled'
              : 'en-order-track__seg';
        const rightClass =
          index === steps.length - 1
            ? 'en-order-track__seg en-order-track__seg--edge'
            : steps[index + 1].done
              ? 'en-order-track__seg en-order-track__seg--filled'
              : 'en-order-track__seg';
        const captionClass = `en-order-track__caption${
          step.done ? ' en-order-track__caption--done' : ''
        }${step.current ? ' en-order-track__caption--current' : ''}`;
        return (
          <div
            key={step.status}
            role="listitem"
            className="en-order-track__step"
            aria-current={step.current ? 'step' : undefined}
          >
            <div className="en-order-track__row">
              <span className={leftClass} />
              <StepDot step={step} />
              <span className={rightClass} />
            </div>
            <div className={captionClass}>{step.caption}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTracking(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const { data: order, isLoading, isError, error } = useOrder(code);
  const cancel = useCancelOrder(code ?? '');
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel(): Promise<void> {
    setCancelError(null);
    try {
      await cancel.mutateAsync(undefined);
    } catch (err) {
      setCancelError(getApiErrorMessage(err, 'Could not cancel this order.'));
    }
  }

  const actions = order && isCancellable(order.status) && (
    <Button variant="ghost" className="text-danger" onClick={() => void handleCancel()} isLoading={cancel.isPending}>
      Cancel order
    </Button>
  );

  return (
    <AccountLayout eyebrow="My Account" title={order ? `Order #${order.code}` : 'Track Order'} actions={actions || undefined}>
      {isLoading ? (
        <div className="d-flex flex-column gap-3">
          <Skeleton height={120} radius={16} />
          <Skeleton height={220} radius={16} />
        </div>
      ) : isError || !order ? (
        <EmptyState
          icon="⚠️"
          title="Order not found"
          description={getApiErrorMessage(error, 'We could not find this order.')}
          action={
            <Link to={paths.orders()} className="btn btn-outline-cream">
              Back to orders
            </Link>
          }
        />
      ) : (
        <div className="d-flex flex-column gap-4">
          {cancelError && (
            <div className="alert alert-danger mb-0" role="alert">
              {cancelError}
            </div>
          )}

          {/* Status */}
          <Card padding="lg">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
              <div className="d-flex align-items-center gap-2">
                <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
                <span className="en-text-muted small">Placed {dateFmt.format(new Date(order.placedAt))}</span>
              </div>
            </div>

            {isTerminated(order.status) ? (
              <div className="en-text-dim">
                This order is <strong>{orderStatusLabel(order.status).toLowerCase()}</strong> and is no longer in
                delivery.
              </div>
            ) : (
              <Stepper status={order.status} />
            )}
          </Card>

          <div className="row g-4">
            {/* Items */}
            <div className="col-12 col-lg-7">
              <Card padding="md" className="h-100">
                <h2 className="en-display h5 mb-3">Items</h2>
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {order.items.map((item) => (
                    <li key={item.id} className="d-flex justify-content-between gap-3">
                      <div>
                        <div className="fw-semibold">{item.productName}</div>
                        <div className="en-text-muted small">
                          {formatWeight(item.weightG)} · Qty {item.quantity}
                        </div>
                      </div>
                      <div className="fw-semibold flex-shrink-0">{formatPaise(item.lineTotalPaise)}</div>
                    </li>
                  ))}
                </ul>

                <div className="en-divider my-3" />

                <dl className="row mb-0 small">
                  <dt className="col-8 en-text-dim fw-normal">Subtotal</dt>
                  <dd className="col-4 text-end mb-1">{formatPaise(order.subtotalPaise)}</dd>
                  {order.discountPaise > 0 && (
                    <>
                      <dt className="col-8 en-text-dim fw-normal">Discount</dt>
                      <dd className="col-4 text-end mb-1" style={{ color: 'var(--en-green)' }}>
                        −{formatPaise(order.discountPaise)}
                      </dd>
                    </>
                  )}
                  <dt className="col-8 en-text-dim fw-normal">Shipping</dt>
                  <dd className="col-4 text-end mb-2">
                    {order.shippingPaise === 0 ? 'Free' : formatPaise(order.shippingPaise)}
                  </dd>
                  <dt className="col-8 en-display h6 mb-0">Total</dt>
                  <dd className="col-4 text-end en-display h6 mb-0">{formatPaise(order.totalPaise)}</dd>
                </dl>
              </Card>
            </div>

            {/* Delivery + payment */}
            <div className="col-12 col-lg-5">
              <Card padding="md" className="h-100">
                <h2 className="en-display h5 mb-3">Delivery</h2>
                <div className="mb-1 fw-semibold">{order.address.name}</div>
                <address className="en-text-dim small mb-3">
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ''}
                  <br />
                  {order.address.city} — {order.address.pincode}
                  <br />
                  {order.address.phone}
                </address>

                {order.slotLabel && (
                  <div className="mb-3">
                    <span className="en-text-muted small d-block">Delivery slot</span>
                    <span>{order.slotLabel}</span>
                  </div>
                )}

                <div className="en-divider my-3" />

                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="en-text-muted small d-block">Payment</span>
                    <span>{PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}</span>
                  </div>
                  <Badge tone={order.paymentStatus === PAYMENT_STATUS.PAID ? 'fresh' : 'neutral'}>
                    {order.paymentMethod}
                  </Badge>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </AccountLayout>
  );
}
