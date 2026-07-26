import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PAYMENT_METHOD, PAYMENT_STATUS, ROLES, STORE, type OrderStatus } from '@elite/shared';

import {
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TextareaField,
  humanizeStatus,
  useToast,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  OrderStatusTimeline,
  OrderStepper,
  formatDateTime,
  nextStatuses,
  useOrder,
  useRefund,
  useUpdateOrderStatus,
  type OrderWithPayment,
} from '@/features/sales';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight, paiseToRupees, rupeesToPaise } from '@/lib/money';
import { ROUTES } from '@/routes/paths';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

// TODO: flip to `true` once the backend exposes `POST /orders/:code/invoice`
// returning `{ url }` to a rendered PDF. Until then the button falls back to
// a lightweight client-side print of the visible order page.
const INVOICE_API_READY: boolean = false;

interface InvoiceResponse {
  url: string;
}

/** Strip everything but digits so `wa.me/<number>` gets a clean E.164-ish tail. */
function toWhatsAppDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Two-letter thumb glyph derived from the product name. OrderItemDTO carries
 * no image URL, so we render a tinted monogram tile in place of a real thumb.
 */
function thumbLetters(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

export default function OrderDetail() {
  const { code = '' } = useParams<{ code: string }>();
  const { data: order, isLoading, isError, error, refetch } = useOrder(code);
  const update = useUpdateOrderStatus();
  const refund = useRefund();
  const toast = useToast();

  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);

  // Widen the DTO with an optional `payment` sub-object. Today the field is
  // absent, so refund controls stay disabled; once the backend exposes it,
  // the same code path becomes live without further UI changes.
  const orderWithPayment: OrderWithPayment | null = order ?? null;
  const payment = orderWithPayment?.payment ?? null;

  /** Max refundable in paise — payment's remaining balance, else order total. */
  const refundableMaxPaise = useMemo(() => {
    if (payment?.refundablePaise != null) return payment.refundablePaise;
    if (payment?.amountPaise != null) return payment.amountPaise;
    return order?.totalPaise ?? 0;
  }, [payment, order]);

  const refundDisabled =
    !payment ||
    order?.paymentMethod === PAYMENT_METHOD.COD ||
    order?.paymentStatus === PAYMENT_STATUS.REFUNDED ||
    order?.paymentStatus === PAYMENT_STATUS.PENDING ||
    order?.paymentStatus === PAYMENT_STATUS.FAILED;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner label="Loading order…" />
      </div>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title={`Order ${code}`} />
        <ErrorState
          title="Couldn't load this order"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </>
    );
  }
  if (!order) {
    return (
      <>
        <PageHeader title={`Order ${code} not found`} />
        <EmptyState
          icon="cart"
          title="No such order"
          message="The order may have been cancelled or the code is wrong."
        />
      </>
    );
  }

  const options = nextStatuses(order.status);

  const openRefundDrawer = () => {
    setRefundAmount(String(paiseToRupees(refundableMaxPaise)));
    setRefundReason('');
    setRefundError(null);
    setRefundOpen(true);
  };

  const closeRefundDrawer = () => {
    if (refund.isPending) return;
    setRefundOpen(false);
  };

  const submitRefund = async () => {
    setRefundError(null);
    const rupees = Number(refundAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setRefundError('Enter a refund amount in rupees.');
      return;
    }
    const amountPaise = rupeesToPaise(rupees);
    if (amountPaise > refundableMaxPaise) {
      setRefundError(
        `Refund cannot exceed the payable amount (${formatPaise(refundableMaxPaise)}).`,
      );
      return;
    }
    if (!payment) return; // Button is gated but guard the call site too.

    try {
      await refund.mutateAsync({
        paymentId: payment.id,
        orderCode: order.code,
        input: {
          amountPaise,
          reason: refundReason.trim() || undefined,
        },
      });
      setRefundOpen(false);
    } catch {
      /* mutation surfaces its own error toast */
    }
  };

  const handleWhatsApp = () => {
    const digits = toWhatsAppDigits(order.address.phone);
    if (!digits) {
      toast.error({ title: 'No phone number on file for this customer' });
      return;
    }
    const message =
      `Hi ${order.address.name}, this is ${STORE.NAME} about your order ${order.code}. ` +
      `Please let us know if you have any questions.`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadInvoice = async () => {
    if (INVOICE_API_READY) {
      try {
        const res = await api.post<InvoiceResponse>(`/orders/${order.code}/invoice`);
        if (res.url) {
          window.open(res.url, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (err) {
        toast.error({
          title: 'Could not download invoice',
          message: getApiErrorMessage(err),
        });
        return;
      }
    }
    // Fallback: browser print of the current page (order detail is the primary
    // content). Users can pick "Save as PDF" from the print dialog.
    window.print();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error({ title: 'Could not copy to clipboard' });
    }
  };

  return (
    <div className="od-v2">
      {/* ─── Header bar ─────────────────────────────────────────── */}
      <header className="od-headbar">
        <nav aria-label="Breadcrumb" className="od-breadcrumb">
          <Link to={ROUTES.orders}>Sales</Link>
          <span aria-hidden="true" className="od-breadcrumb__sep">/</span>
          <Link to={ROUTES.orders}>Orders</Link>
          <span aria-hidden="true" className="od-breadcrumb__sep">/</span>
          <span className="od-breadcrumb__current tabular">{order.code}</span>
        </nav>

        <div className="od-titlebar">
          <div className="od-titlebar__lead">
            <h1 className="section-title">{order.code}</h1>
            <button
              type="button"
              className="od-icon-btn od-copy-code"
              onClick={() => {
                void handleCopyCode();
              }}
              title={copied ? 'Copied!' : 'Copy order code'}
              aria-label="Copy order code"
            >
              <Icon name={copied ? 'shield' : 'clipboard'} size={14} />
            </button>
            <span className="od-titlebar__placed">
              Placed {formatDateTime(order.placedAt)}
            </span>
          </div>

          <div className="od-titlebar__aside">
            <StatusBadge kind="order" status={order.status} />
            <RoleGate allow={ADMIN_ROLES}>
              <div className="od-actions" role="group" aria-label="Order actions">
                <button
                  type="button"
                  className="od-ghost-btn"
                  onClick={openRefundDrawer}
                  disabled={refundDisabled}
                  title={
                    refundDisabled
                      ? 'Refunds require a captured gateway payment'
                      : 'Issue a full or partial refund'
                  }
                >
                  <Icon name="refresh" size={14} />
                  <span>Refund</span>
                </button>
                <button
                  type="button"
                  className="od-ghost-btn"
                  onClick={handleWhatsApp}
                  title="Message the customer on WhatsApp"
                >
                  <Icon name="users" size={14} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  className="od-ghost-btn"
                  onClick={() => window.print()}
                  title="Print this order"
                >
                  <Icon name="file" size={14} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  className="od-ghost-btn"
                  onClick={() => {
                    void handleCopyCode();
                  }}
                  title="Copy order code"
                >
                  <Icon name="clipboard" size={14} />
                  <span>Copy</span>
                </button>
              </div>
            </RoleGate>
          </div>
        </div>
      </header>

      {/* ─── Stepper row ────────────────────────────────────────── */}
      <div className="card od-stepper mb-3">
        <div className="card-body">
          <OrderStepper status={order.status} />
          <div className="od-legend" aria-hidden="true">
            <span className="od-legend__item">
              <i className="dot dot--success" /> Completed
            </span>
            <span className="od-legend__item">
              <i className="dot dot--primary" /> Current
            </span>
            <span className="od-legend__item">
              <i className="dot dot--muted" /> Upcoming
            </span>
          </div>
        </div>
      </div>

      {/* ─── Main 3-column body ─────────────────────────────────── */}
      <div className="row g-3">
        {/* Left — 60% */}
        <div className="col-12 col-lg-7">
          {/* Items */}
          <div className="card od-items">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h2 className="ui-card-title">Items</h2>
              <span className="text-muted-2 small tabular">
                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="table-responsive">
              <table className="table od-items-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="text-nowrap">Weight × Qty</th>
                    <th scope="col" className="text-end">Each</th>
                    <th scope="col" className="text-end">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="od-item-cell">
                          <div className="od-thumb" aria-hidden="true">
                            {thumbLetters(it.productName)}
                          </div>
                          <span className="od-item-name">{it.productName}</span>
                        </div>
                      </td>
                      <td className="text-nowrap">
                        <span className="tabular">{formatWeight(it.weightG)}</span>
                        <span className="text-muted-2 ms-2 tabular">× {it.quantity}</span>
                      </td>
                      <td className="text-end tabular">{formatPaise(it.pricePaise)}</td>
                      <td className="text-end tabular fw-semibold">
                        {formatPaise(it.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes / instructions */}
          <div className="card mt-3 od-notes">
            <div className="card-header">
              <h2 className="ui-card-title">Notes &amp; instructions</h2>
            </div>
            <div className="card-body">
              <p className="text-muted-2 small mb-0">
                No special instructions were left for this order.
              </p>
            </div>
          </div>

          {/* Change status */}
          <div className="card mt-3 od-status-card">
            <div className="card-header">
              <h2 className="ui-card-title">Change status</h2>
            </div>
            <div className="card-body">
              {options.length === 0 ? (
                <div className="text-muted-2">
                  No further transitions from{' '}
                  <strong>{humanizeStatus(order.status)}</strong>.
                </div>
              ) : (
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-4">
                    <SelectField
                      label="Next status"
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                    >
                      <option value="">Select…</option>
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {humanizeStatus(s)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div className="col-12 col-md-6">
                    <TextareaField
                      label="Note (optional)"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-2 d-grid">
                    <button
                      className="btn btn-primary"
                      disabled={!nextStatus || update.isPending}
                      onClick={async () => {
                        if (!nextStatus) return;
                        await update.mutateAsync({
                          id: order.id,
                          code: order.code,
                          status: nextStatus,
                          note: note.trim() || undefined,
                        });
                        setNote('');
                        setNextStatus('');
                      }}
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — 40% */}
        <div className="col-12 col-lg-5">
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="ui-card-title">Customer &amp; delivery</h2>
            </div>
            <div className="card-body small">
              <div className="fw-semibold">{order.address.name}</div>
              <div className="tabular">{order.address.phone}</div>
              <div className="text-muted-2 mt-2">
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ''}
              </div>
              <div className="text-muted-2">
                {order.address.city} · <span className="tabular">{order.address.pincode}</span>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h2 className="ui-card-title">Delivery slot</h2>
            </div>
            <div className="card-body small">
              {order.slotLabel ? (
                <div className="d-flex align-items-center gap-2">
                  <Icon name="clock" size={16} className="text-muted-2" />
                  <strong>{order.slotLabel}</strong>
                </div>
              ) : (
                <span className="text-muted-2">No slot selected.</span>
              )}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <h2 className="ui-card-title">Payment</h2>
            </div>
            <div className="card-body small">
              <div className="od-kv">
                <span>Method</span>
                <strong>{humanizeStatus(order.paymentMethod)}</strong>
              </div>
              <div className="od-kv">
                <span>Status</span>
                <StatusBadge kind="payment" status={order.paymentStatus} />
              </div>
              {payment?.id && (
                <div className="od-kv">
                  <span>Gateway id</span>
                  <code className="tabular">{payment.id}</code>
                </div>
              )}
            </div>
          </div>

          <div className="card od-totals">
            <div className="card-header">
              <h2 className="ui-card-title">Totals</h2>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__row">
                <span>Subtotal</span>
                <span className="tabular">{formatPaise(order.subtotalPaise)}</span>
              </div>
              {order.discountPaise > 0 && (
                <div className="stat-tile__row">
                  <span>Discount</span>
                  <span className="tabular">−{formatPaise(order.discountPaise)}</span>
                </div>
              )}
              <div className="stat-tile__row">
                <span>Shipping</span>
                <span className="tabular">{formatPaise(order.shippingPaise)}</span>
              </div>
              <div className="stat-tile__row stat-tile__row--total">
                <span>Total</span>
                <span className="tabular">{formatPaise(order.totalPaise)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom rail: activity + export ─────────────────────── */}
      <div className="card mt-3 od-activity">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h2 className="ui-card-title">Activity</h2>
          <RoleGate allow={ADMIN_ROLES}>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              onClick={() => {
                void handleDownloadInvoice();
              }}
            >
              <Icon name="file" size={14} />
              <span>Export invoice</span>
            </button>
          </RoleGate>
        </div>
        <div className="card-body">
          <OrderStatusTimeline status={order.status} placedAt={order.placedAt} />
        </div>
      </div>

      {/* ─── Refund drawer (preserved) ──────────────────────────── */}
      <Drawer
        open={refundOpen}
        onClose={closeRefundDrawer}
        title={`Refund order ${order.code}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-light"
              onClick={closeRefundDrawer}
              disabled={refund.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void submitRefund();
              }}
              disabled={refund.isPending}
            >
              {refund.isPending ? 'Refunding…' : 'Refund payment'}
            </button>
          </div>
        }
      >
        <div className="text-muted-2 small mb-3">
          Refundable balance:{' '}
          <strong className="tabular">{formatPaise(refundableMaxPaise)}</strong>
        </div>
        <TextField
          label="Amount (₹)"
          type="number"
          min={0}
          step="0.01"
          value={refundAmount}
          onChange={(e) => setRefundAmount(e.target.value)}
          required
        />
        <TextareaField
          label="Reason (optional)"
          rows={3}
          maxLength={500}
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          hint="Shared with the customer on their refund receipt."
        />
        {refundError && (
          <div className="alert alert-danger py-2 mb-0 small" role="alert">
            {refundError}
          </div>
        )}
      </Drawer>
    </div>
  );
}
