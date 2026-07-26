import { Badge, Button, Modal } from '@/components/ui';
import { formatPaise } from '@/lib/money';

import type { PaymentInit } from '../checkout.types';

export interface MockPaymentModalProps {
  open: boolean;
  init: PaymentInit | null;
  processing: boolean;
  onPay: () => void;
  onCancel: () => void;
}

/**
 * Placeholder gateway step. The real Razorpay/PhonePe/Cashfree browser SDK is a
 * future integration — this clearly-marked mock stands in for it so the online
 * flow (init → pay → verify → success) can be exercised end-to-end.
 */
export function MockPaymentModal({
  open,
  init,
  processing,
  onPay,
  onCancel,
}: MockPaymentModalProps): JSX.Element | null {
  if (!init) return null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissOnBackdrop={!processing}
      title={
        <span className="d-inline-flex align-items-center gap-2">
          Complete payment <Badge tone="gold">Mock</Badge>
        </span>
      }
      footer={
        <div className="d-flex gap-2 w-100">
          <Button variant="ghost" onClick={onCancel} disabled={processing} fullWidth>
            Cancel
          </Button>
          <Button variant="gold" onClick={onPay} isLoading={processing} fullWidth>
            Pay {formatPaise(init.amountPaise)}
          </Button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3">
        <p className="en-text-dim mb-0">
          This is a placeholder for the {init.method} checkout. No real gateway SDK is
          loaded yet, so no money moves — confirming simulates a successful payment.
        </p>

        <div className="en-well p-3">
          <dl className="row row-cols-2 g-2 mb-0 small">
            <div className="col d-flex justify-content-between">
              <dt className="en-text-muted fw-normal">Order</dt>
            </div>
            <div className="col text-end">
              <dd className="mb-0"><code>{init.orderCode}</code></dd>
            </div>
            <div className="col">
              <dt className="en-text-muted fw-normal">Method</dt>
            </div>
            <div className="col text-end">
              <dd className="mb-0">{init.method}</dd>
            </div>
            <div className="col">
              <dt className="en-text-muted fw-normal">Amount</dt>
            </div>
            <div className="col text-end">
              <dd className="mb-0 fw-semibold">{formatPaise(init.amountPaise)}</dd>
            </div>
          </dl>
        </div>

        {init.isMock && (
          <p className="en-text-muted small mb-0">
            Gateway credentials are not configured in this environment, so the payment is
            auto-verified server-side.
          </p>
        )}
      </div>
    </Modal>
  );
}
