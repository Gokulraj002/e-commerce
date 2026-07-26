import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { OrderDTO } from '@elite/shared';

import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import {
  AccountLayout,
  isCancellable,
  orderStatusLabel,
  orderStatusTone,
  useCancelOrder,
  useMyOrders,
} from '@/features/account';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

const PAGE_SIZE = 10;

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function OrderCard({ order }: { order: OrderDTO }): JSX.Element {
  const cancel = useCancelOrder(order.code);
  const [error, setError] = useState<string | null>(null);
  const itemSummary = order.items.map((i) => i.productName).join(', ');

  async function handleCancel(): Promise<void> {
    setError(null);
    try {
      await cancel.mutateAsync(undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not cancel this order.'));
    }
  }

  return (
    <Card padding="md">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold">#{order.code}</span>
            <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
          </div>
          <div className="en-text-muted small mt-1">{dateFmt.format(new Date(order.placedAt))}</div>
        </div>
        <div className="text-end">
          <div className="en-display h5 mb-0">{formatPaise(order.totalPaise)}</div>
          <div className="en-text-muted small">
            {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>

      {itemSummary && (
        <p className="en-text-dim small mb-0 mt-3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {itemSummary}
        </p>
      )}

      {error && (
        <div className="alert alert-danger mt-3 mb-0 py-2 small" role="alert">
          {error}
        </div>
      )}

      <div className="en-divider my-3" />

      <div className="d-flex flex-wrap gap-2">
        <Link to={paths.orderTracking(order.code)} className="btn btn-outline-cream btn-sm">
          View & track
        </Link>
        {isCancellable(order.status) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => void handleCancel()}
            isLoading={cancel.isPending}
          >
            Cancel order
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function Orders(): JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useMyOrders({ page, pageSize: PAGE_SIZE });

  return (
    <AccountLayout eyebrow="My Account" title="My Orders">
      {isLoading ? (
        <div className="d-flex flex-column gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={150} radius={16} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Could not load your orders"
          description={getApiErrorMessage(error, 'Please try again in a moment.')}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="When you place your first order, it will show up here."
          action={
            <Link to={paths.home()} className="btn btn-gold">
              Start shopping
            </Link>
          }
        />
      ) : (
        <>
          <div className="d-flex flex-column gap-3">
            {data.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="d-flex align-items-center justify-content-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <span className="en-text-dim small">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </AccountLayout>
  );
}
