import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OrderDTO } from '@elite/shared';

import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Spinner,
  StatTile,
  StatusBadge,
} from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import { useAdminOrders, useCustomer } from '@/features/sales';
import { formatDateTime } from '@/features/sales';
import { formatPaise } from '@/lib/money';

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0] ?? '');
  return (parts.join('') || '?').toUpperCase();
}

function TimelineDot({ tone = 'brand' }: { tone?: 'brand' | 'muted' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background:
          tone === 'brand' ? 'var(--brand)' : 'var(--text-subtle)',
        boxShadow:
          tone === 'brand'
            ? '0 0 0 3px var(--brand-tint)'
            : '0 0 0 3px var(--bg-muted)',
        marginTop: 6,
        flexShrink: 0,
      }}
    />
  );
}

interface TimelineEvent {
  key: string;
  title: string;
  meta: string;
  tone: 'brand' | 'muted';
}

/**
 * Build a compact timeline of key events for a customer. Uses only the data
 * we have: signup date + the most recent orders.
 */
function buildTimeline(joinedAt: string, orders: OrderDTO[]): TimelineEvent[] {
  const events: TimelineEvent[] = orders.slice(0, 5).map((o) => ({
    key: `order-${o.id}`,
    title: `Order ${o.code}`,
    meta: `${formatPaise(o.totalPaise)} · ${formatDateTime(o.placedAt)}`,
    tone: 'brand',
  }));
  events.push({
    key: 'signup',
    title: 'Joined',
    meta: formatDateTime(joinedAt),
    tone: 'muted',
  });
  return events;
}

export default function CustomerDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: user, isLoading, isError, error, refetch } = useCustomer(id);
  const { data: orders, isLoading: ordersLoading, isError: ordersError } = useAdminOrders({
    search: user?.phone,
    pageSize: 50,
  });

  const orderItems = orders?.items ?? [];
  const orderCount = orders?.total ?? orderItems.length;
  const lifetimeSpendPaise = useMemo(
    () => orderItems.reduce((sum, o) => sum + (o.totalPaise ?? 0), 0),
    [orderItems],
  );
  const aovPaise = orderItems.length > 0 ? Math.round(lifetimeSpendPaise / orderItems.length) : null;
  const partialSpend = orderCount > orderItems.length;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner label="Loading customer…" />
      </div>
    );
  }
  if (isError) {
    return (
      <>
        <PageHeader title="Customer" />
        <ErrorState
          title="Couldn't load this customer"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </>
    );
  }
  if (!user) {
    return (
      <>
        <PageHeader title="Customer not found" />
        <EmptyState
          icon="users"
          title="No customer with that ID"
          message="They may have been removed. Go back and pick another."
        />
      </>
    );
  }

  const timeline = buildTimeline(user.createdAt, orderItems);

  return (
    <>
      <PageHeader
        title={user.name}
        subtitle={`${user.phone}${user.email ? ` · ${user.email}` : ''}`}
        actions={
          <StatusBadge
            status={user.isMember ? 'MEMBER' : 'GUEST'}
            tone={user.isMember ? 'success' : 'neutral'}
          />
        }
      />

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center gap-3">
          <div
            className="ui-thumb"
            aria-hidden="true"
            style={{ width: 56, height: 56, fontSize: '1.05rem' }}
          >
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-grow-1">
            <div
              className="fw-semibold text-truncate"
              style={{ color: 'var(--text-strong)', fontSize: '1.05rem' }}
            >
              {user.name}
            </div>
            <div className="text-muted-2 small text-truncate d-flex flex-wrap gap-3 mt-1">
              <span className="d-inline-flex align-items-center gap-1">
                <Icon name="clock" size={13} /> Joined {formatDateTime(user.createdAt)}
              </span>
              <span className="tabular">{user.phone}</span>
              {user.email && <span className="text-truncate">{user.email}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="Lifetime spend"
            value={<span>{formatPaise(lifetimeSpendPaise)}</span>}
            caption={partialSpend ? `from last ${orderItems.length} orders` : undefined}
            icon="chart"
            tone="brand"
            loading={ordersLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="Orders"
            value={<span>{orderCount.toLocaleString('en-IN')}</span>}
            icon="cart"
            tone="info"
            loading={ordersLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="Average order value"
            value={<span>{aovPaise != null ? formatPaise(aovPaise) : 'N/A'}</span>}
            caption={partialSpend ? 'recent orders' : undefined}
            icon="tag"
            tone="success"
            loading={ordersLoading}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-header fw-semibold" style={{ color: 'var(--text-strong)' }}>
              Profile
            </div>
            <div className="card-body d-flex flex-column gap-3">
              <div>
                <div className="ui-form-section__title">Role</div>
                <div className="fw-semibold" style={{ color: 'var(--text-strong)' }}>
                  {user.role.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <div className="ui-form-section__title">Phone</div>
                <div className="fw-semibold tabular" style={{ color: 'var(--text-strong)' }}>
                  {user.phone}
                </div>
              </div>
              <div>
                <div className="ui-form-section__title">Email</div>
                <div className="fw-semibold" style={{ color: 'var(--text-strong)' }}>
                  {user.email ?? <span className="text-muted-2 fw-normal">Not on file</span>}
                </div>
              </div>
              <div>
                <div className="ui-form-section__title">Membership</div>
                <div>
                  <StatusBadge
                    status={user.isMember ? 'MEMBER' : 'GUEST'}
                    tone={user.isMember ? 'success' : 'neutral'}
                  />
                </div>
              </div>
              <div>
                <div className="ui-form-section__title">Joined</div>
                <div className="fw-semibold" style={{ color: 'var(--text-strong)' }}>
                  {formatDateTime(user.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card h-100">
            <div
              className="card-header fw-semibold d-flex align-items-center justify-content-between"
              style={{ color: 'var(--text-strong)' }}
            >
              <span>Recent orders</span>
              <span className="text-muted-2 small tabular">
                {orderItems.length} shown{orderCount > orderItems.length ? ` / ${orderCount}` : ''}
              </span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th className="text-end">Total</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-3">
                        <Spinner size="sm" label="Loading orders…" />
                      </td>
                    </tr>
                  ) : ordersError ? (
                    <tr>
                      <td colSpan={4} className="text-center text-danger py-3">
                        Couldn't load orders.
                      </td>
                    </tr>
                  ) : orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <EmptyState
                          title="No orders yet"
                          message="This customer hasn't placed any orders."
                          compact
                        />
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/sales/orders/${o.code}`} className="fw-semibold">
                            {o.code}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge kind="order" status={o.status} />
                        </td>
                        <td className="text-end tabular">{formatPaise(o.totalPaise)}</td>
                        <td className="text-muted-2 small">{formatDateTime(o.placedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-3">
          <div className="card h-100">
            <div className="card-header fw-semibold" style={{ color: 'var(--text-strong)' }}>
              Timeline
            </div>
            <div className="card-body d-flex flex-column gap-3">
              {timeline.map((ev) => (
                <div key={ev.key} className="d-flex gap-2">
                  <TimelineDot tone={ev.tone} />
                  <div className="min-w-0">
                    <div className="fw-semibold small" style={{ color: 'var(--text-strong)' }}>
                      {ev.title}
                    </div>
                    <div className="text-muted-2 small text-truncate">{ev.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
