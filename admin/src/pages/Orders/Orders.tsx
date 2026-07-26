import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ORDER_STATUS, type OrderDTO, type OrderStatus } from '@elite/shared';

import {
  DataTable,
  DEFAULT_TABLE_QUERY,
  FilterChip,
  Icon,
  PageHeader,
  StatusBadge,
  humanizeStatus,
  useToast,
  type DataTableBulkAction,
  type DataTableQuery,
} from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { ROUTES } from '@/routes/paths';
import {
  useAdminOrders,
  useUpdateOrderStatus,
  type AdminOrdersQuery,
} from '@/features/sales';
import { useDashboardStats } from '@/features/ops';

const STATUS_OPTIONS: OrderStatus[] = Object.values(ORDER_STATUS);
const SEARCH_DEBOUNCE_MS = 300;

// ── Date range chips (Today / 7d / 30d / All) ───────────────────────
type Range = 'today' | '7d' | '30d' | 'all';

const RANGE_LABELS: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

function rangeToDates(r: Range): { dateFrom?: string; dateTo?: string } {
  if (r === 'all') return {};
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (r === '7d') start.setDate(start.getDate() - 6);
  if (r === '30d') start.setDate(start.getDate() - 29);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

// ── Relative time (rounded to nearest useful unit) ─────────────────
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const secs = Math.floor((Date.now() - t) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2_592_000) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ── CSV export (client-side, quote-escaped) ────────────────────────
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportOrdersCsv(rows: OrderDTO[]): void {
  const headers = [
    'Order code',
    'Customer',
    'Phone',
    'Items',
    'Total (rupees)',
    'Payment method',
    'Payment status',
    'Order status',
    'Placed at',
  ];
  const body = rows.map((o) => [
    o.code,
    o.address.name,
    o.address.phone,
    o.items.reduce((n, i) => n + i.quantity, 0),
    (o.totalPaise / 100).toFixed(2),
    o.paymentMethod,
    o.paymentStatus,
    o.status,
    o.placedAt,
  ]);
  const csv = [headers, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Attention strip (real counts from /dashboard/stats) ────────────
type AttentionStatus =
  | typeof ORDER_STATUS.PENDING_PAYMENT
  | typeof ORDER_STATUS.CONFIRMED
  | typeof ORDER_STATUS.ASSIGNED;

const ATTENTION_STATUSES: readonly AttentionStatus[] = [
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.ASSIGNED,
];

const ATTENTION_META: Record<AttentionStatus, { label: string; tone: 'is-warning' | 'is-info' }> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { label: 'pending payment', tone: 'is-warning' },
  [ORDER_STATUS.CONFIRMED]: { label: 'ready to pack', tone: 'is-info' },
  [ORDER_STATUS.ASSIGNED]: { label: 'assigned', tone: 'is-info' },
};

// ── Page-scoped styles ─────────────────────────────────────────────
const ORDERS_STYLES = `
.orders-attn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  margin-bottom: 0.9rem;
}
.orders-attn__label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-right: 0.35rem;
}
.orders-attn__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.36rem 0.75rem;
  border-radius: 50rem;
  background: var(--bg-body);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    box-shadow 0.15s var(--ease),
    border-color 0.15s var(--ease),
    background 0.15s var(--ease),
    transform 0.15s var(--ease);
}
.orders-attn__chip:hover:not(:disabled) {
  box-shadow: var(--shadow-sm);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.orders-attn__chip:disabled {
  opacity: 0.55;
  cursor: default;
}
.orders-attn__chip strong { font-variant-numeric: tabular-nums; font-weight: 700; }
.orders-attn__chip .orders-attn__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}
.orders-attn__chip.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, var(--bg-body));
  border-color: color-mix(in srgb, var(--warning) 22%, var(--border));
}
.orders-attn__chip.is-info {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 8%, var(--bg-body));
  border-color: color-mix(in srgb, var(--info) 22%, var(--border));
}
.orders-attn__chip.is-active {
  box-shadow: var(--shadow-focus);
  outline: none;
}

.orders-code {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.orders-code__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-subtle);
  opacity: 0;
  transition: opacity 0.15s var(--ease), background 0.15s var(--ease), color 0.15s var(--ease);
}
.orders-code__copy:hover { background: var(--bg-muted); color: var(--text); }
.ui-table tbody tr:hover .orders-code__copy,
.orders-code__copy:focus-visible { opacity: 1; }
`;

export default function Orders() {
  const navigate = useNavigate();
  const toast = useToast();

  const [tableQuery, setTableQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [range, setRange] = useState<Range>('all');
  const [searchInput, setSearchInput] = useState<string>('');

  // Debounce search input into the tableQuery so the API only fires once
  // the user pauses typing.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setTableQuery((q) => (q.search === searchInput ? q : { ...q, search: searchInput, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const updateStatus = useUpdateOrderStatus();

  const apiQuery = useMemo<AdminOrdersQuery>(() => {
    const bounds = rangeToDates(range);
    return {
      page: tableQuery.page,
      pageSize: tableQuery.pageSize,
      search: tableQuery.search || undefined,
      status: status || undefined,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
    };
  }, [tableQuery, status, range]);

  const { data, isLoading, isFetching } = useAdminOrders(apiQuery);
  const stats = useDashboardStats();

  const attentionCounts = useMemo<Record<AttentionStatus, number>>(() => {
    const map = new Map<OrderStatus, number>();
    (stats.data?.pendingByStatus ?? []).forEach((s) => map.set(s.status, s.count));
    return {
      [ORDER_STATUS.PENDING_PAYMENT]: map.get(ORDER_STATUS.PENDING_PAYMENT) ?? 0,
      [ORDER_STATUS.CONFIRMED]: map.get(ORDER_STATUS.CONFIRMED) ?? 0,
      [ORDER_STATUS.ASSIGNED]: map.get(ORDER_STATUS.ASSIGNED) ?? 0,
    };
  }, [stats.data]);

  const copyCode = useCallback(
    async (code: string) => {
      try {
        await navigator.clipboard.writeText(code);
        toast.success({ title: 'Copied', message: code });
      } catch {
        toast.error({ title: 'Could not copy code' });
      }
    },
    [toast],
  );

  const columns = useMemo<ColumnDef<OrderDTO>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Order',
        cell: ({ row }) => (
          <span className="orders-code">
            <span className="fw-semibold">{row.original.code}</span>
            <button
              type="button"
              className="orders-code__copy"
              title="Copy code"
              aria-label={`Copy order code ${row.original.code}`}
              onClick={(e) => {
                e.stopPropagation();
                void copyCode(row.original.code);
              }}
            >
              <Icon name="clipboard" size={12} />
            </button>
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div>
            <div className="fw-semibold">{row.original.address.name}</div>
            <div className="small text-muted-2 tabular">{row.original.address.phone}</div>
          </div>
        ),
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => {
          const items = row.original.items;
          const count = items.length;
          const first = items[0]?.productName ?? '—';
          const suffix = count > 1 ? ` +${count - 1} more` : '';
          return (
            <div>
              <div className="fw-semibold tabular">
                {count === 1 ? '1 item' : `${count} items`}
              </div>
              <div
                className="small text-muted-2 text-truncate"
                style={{ maxWidth: 220 }}
                title={items.map((i) => i.productName).join(', ')}
              >
                {first}
                {suffix}
              </div>
            </div>
          );
        },
      },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <span className="fw-semibold tabular">{formatPaise(row.original.totalPaise)}</span>
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        cell: ({ row }) => (
          <div className="d-flex flex-column gap-1 align-items-start">
            <StatusBadge kind="payment" status={row.original.paymentStatus} />
            <span className="small text-muted-2">
              {humanizeStatus(row.original.paymentMethod)}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge kind="order" status={row.original.status} />,
      },
      {
        id: 'placedAt',
        header: 'Placed',
        cell: ({ row }) => (
          <span
            className="small text-muted-2 tabular"
            title={new Date(row.original.placedAt).toLocaleString('en-IN')}
          >
            {formatRelative(row.original.placedAt)}
          </span>
        ),
      },
    ],
    [copyCode],
  );

  const bulkActions: DataTableBulkAction<OrderDTO>[] = useMemo(
    () => [
      {
        key: 'export',
        label: 'Export CSV',
        icon: 'file',
        tone: 'default',
        onRun: (rows) => exportOrdersCsv(rows),
      },
      {
        key: 'confirm',
        label: 'Mark as CONFIRMED',
        icon: 'refresh',
        tone: 'primary',
        disabled: (rows) =>
          rows.length === 0 || rows.some((r) => r.status !== ORDER_STATUS.CREATED),
        onRun: (rows) => {
          rows.forEach((r) =>
            updateStatus.mutate({
              id: r.id,
              code: r.code,
              status: ORDER_STATUS.CONFIRMED,
            }),
          );
        },
      },
    ],
    [updateStatus],
  );

  const total = data?.total ?? 0;
  const subtitle = `${total.toLocaleString('en-IN')} order${total === 1 ? '' : 's'} in view`;

  return (
    <>
      <style>{ORDERS_STYLES}</style>
      <PageHeader title="Orders" subtitle={subtitle} />

      <div className="ui-filter-strip">
        <div className="ui-filter-strip__search">
          <span className="ui-filter-strip__search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Search by code, name or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search orders"
          />
        </div>
        <div className="ui-filter-strip__sep" aria-hidden="true" />
        <div className="ui-filter-strip__chips" role="group" aria-label="Date range">
          {RANGE_LABELS.map((r) => (
            <FilterChip
              key={r.key}
              label={r.label}
              active={range === r.key}
              onClick={() => {
                setRange(r.key);
                setTableQuery((q) => ({ ...q, page: 1 }));
              }}
            />
          ))}
        </div>
        <div className="ui-filter-strip__spacer" />
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setTableQuery((q) => ({ ...q, page: 1 }));
          }}
          aria-label="Filter by order status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {humanizeStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="orders-attn" role="region" aria-label="Orders needing attention">
        <span className="orders-attn__label">Needs attention</span>
        {ATTENTION_STATUSES.map((s) => {
          const count = attentionCounts[s];
          const meta = ATTENTION_META[s];
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              className={`orders-attn__chip ${meta.tone} ${active ? 'is-active' : ''}`}
              disabled={stats.isLoading}
              onClick={() => {
                setStatus(active ? '' : s);
                setTableQuery((q) => ({ ...q, page: 1 }));
              }}
              aria-pressed={active}
            >
              <span className="orders-attn__dot" aria-hidden="true" />
              <strong>{count.toLocaleString('en-IN')}</strong>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={total}
        query={tableQuery}
        onQueryChange={setTableQuery}
        loading={isLoading}
        isFetching={isFetching}
        stickyHeader
        density="comfortable"
        zebra
        tableId="admin-orders"
        columnMenu
        selectable
        bulkActions={bulkActions}
        hideSearch
        getRowId={(row) => row.id}
        onRowClick={(row) => navigate(ROUTES.orderDetail(row.code))}
        emptyMessage="No orders match these filters."
      />
    </>
  );
}
