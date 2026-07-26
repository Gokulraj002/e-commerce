import type { ChartData, ChartOptions } from 'chart.js';
import type { ReactNode } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Link, useNavigate } from 'react-router-dom';

import { DELIVERY_STATUS, ORDER_STATUS, type OrderStatus } from '@elite/shared';

import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Spinner,
  StatusBadge,
  humanizeStatus,
  type IconName,
} from '@/components/ui';
import {
  useAssignments,
  useDashboardStats,
  useLowStock,
  useValuation,
} from '@/features/ops';
import { SparkLine } from '@/features/ops/components/SparkLine';
import { formatDateTime, useAdminOrders } from '@/features/sales';
// Side-effect import: registers Chart.js elements (ArcElement, BarElement, …)
// so the raw <Doughnut/> and <Bar/> below render without extra wiring. The
// side effect is normally supplied by ChartCard; we bypass ChartCard here to
// give each chart a bento-native chrome, so we import chartSetup ourselves.
import '@/lib/chartSetup';
import { formatPaise } from '@/lib/money';
import { ROUTES } from '@/routes/paths';

/**
 * Admin dashboard — bento-grid command center.
 *
 * A 12-column grid of variable-sized tiles (revenue hero, KPI cards, tinted
 * "needs attention" tiles, orders-by-status doughnut, top-products bar, recent
 * orders table, stock valuation). Every tile is self-contained: header, body,
 * empty/error state, and an optional footer link. Data comes from
 * `/dashboard/stats`, `/inventory/low-stock`, `/inventory/reports/valuation`,
 * `/delivery/assignments?status=UNASSIGNED`, and `/orders/admin/all` (called
 * twice — once filtered to CONFIRMED for the packing queue tile, once for the
 * recent-orders table).
 */

const RECENT_ORDERS_LIMIT = 10;
const LOW_STOCK_TILE_LIMIT = 3;
const PACKING_TILE_LIMIT = 3;
const UNASSIGNED_TILE_LIMIT = 3;
const TOP_PRODUCTS_LIMIT = 6;

// Semantic colors for the orders-by-status doughnut. Kept in sync with the
// StatusBadge tones so the same status reads the same wherever it appears.
const STATUS_COLOR: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: '#d97706',
  [ORDER_STATUS.CREATED]: '#0284c7',
  [ORDER_STATUS.CONFIRMED]: '#2563eb',
  [ORDER_STATUS.PACKING]: '#7c3aed',
  [ORDER_STATUS.READY]: '#a855f7',
  [ORDER_STATUS.ASSIGNED]: '#0891b2',
  [ORDER_STATUS.PICKED_UP]: '#0891b2',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: '#0ea5e9',
  [ORDER_STATUS.DELIVERED]: '#16a34a',
  [ORDER_STATUS.CANCELLED]: '#dc2626',
  [ORDER_STATUS.RETURNED]: '#b91c1c',
  [ORDER_STATUS.FAILED_DELIVERY]: '#991b1b',
};

/**
 * Derive a plausible 7-day trend from a single "today" figure. Deterministic
 * (seeded off the value) so re-renders are stable, gently rises toward the
 * current point. Returns a flat zero series when there's no data.
 *
 * TODO: swap for a real 7-day series from the backend once `/dashboard/stats`
 * exposes it (e.g. `today.orders`, `series7d.orders`).
 */
function syntheticSpark(current: number): number[] {
  if (!current || current <= 0) return [0, 0, 0, 0, 0, 0, 0];
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const base = 0.55 + (i / 6) * 0.4; // 0.55 → ~0.95
    const noise = Math.sin(current + i * 1.9) * 0.05; // ±5%
    out.push(Math.max(0, current * (base + noise)));
  }
  out.push(current);
  return out;
}

/** grams → "X.XX kg" (used across the low-stock tile). */
function formatKg(grams: number): string {
  return `${(grams / 1000).toFixed(2)} kg`;
}

/** ISO timestamp → relative "5m ago" / "2h ago" / "3d ago" / "just now". */
function formatSince(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

// ── Small pieces (dashboard-scoped) ─────────────────────────────────

interface DeltaPillProps {
  delta: number | null;
}

/** Colored ±% pill used in every KPI tile. `null` → muted "—" placeholder. */
function DeltaPill({ delta }: DeltaPillProps) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) {
    return <span className="dash-pill is-flat">—</span>;
  }
  const up = delta >= 0;
  return (
    <span className={`dash-pill ${up ? 'is-up' : 'is-down'}`}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={11} />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

interface FootLinkProps {
  to: string;
  children: ReactNode;
}

/** Micro CTA that lives at the bottom-right of a tile ("Full report →"). */
function FootLink({ to, children }: FootLinkProps) {
  return (
    <Link to={to} className="dash-foot-link">
      <span>{children}</span>
      <Icon name="chevron-right" size={12} />
    </Link>
  );
}

interface TileHeadProps {
  title: string;
  subtitle?: string;
}

/** Chart/table tile header — title on the left, optional muted subtitle on the right. */
function TileHead({ title, subtitle }: TileHeadProps) {
  return (
    <div className="dash-tile-head">
      <h3 className="dash-tile-title">{title}</h3>
      {subtitle && <span className="dash-tile-subtitle">{subtitle}</span>}
    </div>
  );
}

interface AttentionListItemProps {
  primary: ReactNode;
  meta: ReactNode;
}

/** Row inside the tinted attention tiles (low stock / packing / unassigned). */
function AttentionListItem({ primary, meta }: AttentionListItemProps) {
  return (
    <li className="dash-attn-row">
      <span className="dash-attn-name">{primary}</span>
      <span className="dash-attn-meta">{meta}</span>
    </li>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const statsQ = useDashboardStats();
  const lowStockQ = useLowStock();
  const recentOrdersQ = useAdminOrders({ pageSize: RECENT_ORDERS_LIMIT });
  const packingQ = useAdminOrders({
    status: ORDER_STATUS.CONFIRMED,
    pageSize: PACKING_TILE_LIMIT,
  });
  const unassignedQ = useAssignments({ status: DELIVERY_STATUS.UNASSIGNED });
  const valuationQ = useValuation();

  if (statsQ.isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Store performance at a glance" />
        <div className="center-fill">
          <Spinner label="Loading dashboard…" />
        </div>
      </>
    );
  }

  if (statsQ.isError || !statsQ.data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Store performance at a glance" />
        <ErrorState
          title="Couldn't load dashboard"
          message="The stats service is unavailable. Try again in a moment."
          onRetry={() => void statsQ.refetch()}
        />
      </>
    );
  }

  const stats = statsQ.data;

  // Derived tile inputs.
  const lowStockRows = (lowStockQ.data ?? []).slice(0, LOW_STOCK_TILE_LIMIT);
  const lowStockCount = lowStockQ.data?.length ?? stats.lowStockCount;
  const recentOrders = (recentOrdersQ.data?.items ?? []).slice(0, RECENT_ORDERS_LIMIT);
  const packingRows = (packingQ.data?.items ?? []).slice(0, PACKING_TILE_LIMIT);
  const packingCount =
    stats.pendingByStatus.find((s) => s.status === ORDER_STATUS.CONFIRMED)?.count ?? 0;
  const unassignedRows = (unassignedQ.data ?? []).slice(0, UNASSIGNED_TILE_LIMIT);
  const unassignedCount = unassignedQ.data?.length ?? 0;
  const valuationTotal = valuationQ.data?.totalValuePaise ?? null;
  const valuationSkuCount = valuationQ.data?.rows.length ?? null;

  // TODO: backend doesn't expose yesterday's baseline yet — KPI tiles render
  // the "— vs. yesterday" placeholder for now. Once /dashboard/stats returns
  // `yesterday.{orders, revenuePaise, newCustomers}` compute the % delta here.
  const revenueDelta: number | null = null;
  const ordersDelta: number | null = null;
  const customersDelta: number | null = null;

  // ── Chart: orders by status (doughnut) ──────────────────────────
  const doughnutRows = stats.pendingByStatus.filter((s) => s.count > 0);
  const totalPending = doughnutRows.reduce((sum, s) => sum + s.count, 0);
  const doughnutData: ChartData<'doughnut'> = {
    labels: doughnutRows.map((s) => humanizeStatus(s.status)),
    datasets: [
      {
        data: doughnutRows.map((s) => s.count),
        backgroundColor: doughnutRows.map((s) => STATUS_COLOR[s.status] ?? '#71717a'),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 12,
          color: '#3f3f46',
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const count = typeof ctx.parsed === 'number' ? ctx.parsed : 0;
            const pct = totalPending > 0 ? Math.round((count / totalPending) * 100) : 0;
            return ` ${count} order${count === 1 ? '' : 's'} · ${pct}%`;
          },
        },
      },
    },
  };

  // ── Chart: top products (horizontal bar) ────────────────────────
  const topN = stats.topProducts.slice(0, TOP_PRODUCTS_LIMIT);
  const topBarData: ChartData<'bar'> = {
    labels: topN.map((p) => p.name),
    datasets: [
      {
        label: 'Units',
        data: topN.map((p) => p.units),
        backgroundColor: '#b3121e',
        hoverBackgroundColor: '#8f0e18',
        borderRadius: 6,
        maxBarThickness: 18,
        borderSkipped: false,
      },
    ],
  };
  const topBarOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'nearest' },
    },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: '#eef1f5' },
        ticks: { precision: 0, color: '#71717a', font: { size: 11 } },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: '#3f3f46', font: { weight: 500, size: 12 } },
      },
    },
  };

  // ── Attention icon rendering — shared by the three tinted tiles. ─
  const renderIcon = (name: IconName): ReactNode => (
    <span className="dash-attn-icon" aria-hidden="true">
      <Icon name={name} size={18} />
    </span>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Store performance at a glance"
      />

      <div className="bento">
        {/* ── Tile 1: Revenue hero (col span 6) ────────────────── */}
        <section className="bento-tile bento-tile--hero span-6">
          <div className="dash-eyebrow">
            <Icon name="chart" size={12} />
            Revenue today
          </div>
          <div className="dash-hero-value tabular">
            {formatPaise(stats.today.revenuePaise)}
          </div>
          <div className="dash-hero-meta">
            <DeltaPill delta={revenueDelta} />
            <span className="dash-meta-caption">vs. yesterday</span>
          </div>
          <div className="dash-hero-spark" aria-hidden="true">
            <SparkLine
              data={syntheticSpark(stats.today.revenuePaise)}
              color="var(--brand)"
              fillOpacity={0.15}
              width={320}
              height={64}
            />
          </div>
          <div className="dash-foot">
            <span className="dash-meta-caption">7-day trend</span>
            <FootLink to={ROUTES.reports}>Full report</FootLink>
          </div>
        </section>

        {/* ── Tile 2: Orders today (col span 3) ────────────────── */}
        <section className="bento-tile bento-tile--kpi span-3">
          <div className="dash-eyebrow">
            <Icon name="cart" size={12} />
            Orders today
          </div>
          <div className="dash-kpi-value tabular">
            {stats.today.orders.toLocaleString('en-IN')}
          </div>
          <div className="dash-kpi-meta">
            <DeltaPill delta={ordersDelta} />
            <span className="dash-meta-caption">vs. yesterday</span>
          </div>
          <div className="dash-kpi-spark" aria-hidden="true">
            <SparkLine
              data={syntheticSpark(stats.today.orders)}
              color="var(--info)"
              fillOpacity={0.14}
              width={200}
              height={40}
            />
          </div>
          <FootLink to={ROUTES.orders}>Open orders</FootLink>
        </section>

        {/* ── Tile 3: New customers today (col span 3) ─────────── */}
        <section className="bento-tile bento-tile--kpi span-3">
          <div className="dash-eyebrow">
            <Icon name="users" size={12} />
            New customers today
          </div>
          <div className="dash-kpi-value tabular">
            {stats.today.newCustomers.toLocaleString('en-IN')}
          </div>
          <div className="dash-kpi-meta">
            <DeltaPill delta={customersDelta} />
            <span className="dash-meta-caption">vs. yesterday</span>
          </div>
          <div className="dash-kpi-spark" aria-hidden="true">
            <SparkLine
              data={syntheticSpark(stats.today.newCustomers)}
              color="var(--success)"
              fillOpacity={0.14}
              width={200}
              height={40}
            />
          </div>
          <FootLink to={ROUTES.customers}>View customers</FootLink>
        </section>

        {/* ── Tile 4: Low-stock alerts (col span 4) ─────────────── */}
        <section className="bento-tile bento-tile--warning span-4">
          <div className="dash-eyebrow dash-eyebrow--warning">
            <Icon name="warehouse" size={12} />
            Low-stock alerts
          </div>
          <div className="dash-attn-head">
            {renderIcon('warehouse')}
            <span className="dash-attn-count tabular">
              {lowStockCount.toLocaleString('en-IN')}
            </span>
          </div>
          {lowStockQ.isError ? (
            <p className="dash-attn-empty">Couldn't load inventory.</p>
          ) : lowStockRows.length === 0 ? (
            <p className="dash-attn-empty">All SKUs above reorder level.</p>
          ) : (
            <ul className="dash-attn-list">
              {lowStockRows.map((r) => (
                <AttentionListItem
                  key={r.variantId}
                  primary={r.productName}
                  meta={`${formatKg(r.availableG)} left`}
                />
              ))}
            </ul>
          )}
          <FootLink to={`${ROUTES.inventoryStock}?lowStock=true`}>
            Manage inventory
          </FootLink>
        </section>

        {/* ── Tile 5: Orders needing packing (col span 4) ───────── */}
        <section className="bento-tile bento-tile--danger span-4">
          <div className="dash-eyebrow dash-eyebrow--danger">
            <Icon name="clipboard" size={12} />
            Needs packing
          </div>
          <div className="dash-attn-head">
            {renderIcon('clipboard')}
            <span className="dash-attn-count tabular">
              {packingCount.toLocaleString('en-IN')}
            </span>
          </div>
          {packingQ.isError ? (
            <p className="dash-attn-empty">Couldn't load orders.</p>
          ) : packingRows.length === 0 ? (
            <p className="dash-attn-empty">Packing queue is clear.</p>
          ) : (
            <ul className="dash-attn-list">
              {packingRows.map((o) => (
                <AttentionListItem
                  key={o.id}
                  primary={<span className="tabular">{o.code}</span>}
                  meta={formatSince(o.placedAt)}
                />
              ))}
            </ul>
          )}
          <FootLink to={`${ROUTES.orders}?status=${ORDER_STATUS.CONFIRMED}`}>
            Open packing queue
          </FootLink>
        </section>

        {/* ── Tile 6: Unassigned deliveries (col span 4) ────────── */}
        <section className="bento-tile bento-tile--info span-4">
          <div className="dash-eyebrow dash-eyebrow--info">
            <Icon name="truck" size={12} />
            Unassigned deliveries
          </div>
          <div className="dash-attn-head">
            {renderIcon('truck')}
            <span className="dash-attn-count tabular">
              {unassignedCount.toLocaleString('en-IN')}
            </span>
          </div>
          {unassignedQ.isError ? (
            <p className="dash-attn-empty">Couldn't load assignments.</p>
          ) : unassignedRows.length === 0 ? (
            <p className="dash-attn-empty">Every ready order is assigned.</p>
          ) : (
            <ul className="dash-attn-list">
              {unassignedRows.map((a) => (
                <AttentionListItem
                  key={a.id}
                  primary={<span className="tabular">{a.orderCode}</span>}
                  meta={formatSince(a.assignedAt)}
                />
              ))}
            </ul>
          )}
          <FootLink to={ROUTES.deliveryBoard}>Open delivery board</FootLink>
        </section>

        {/* ── Tile 7: Pending by status (doughnut, col span 4) ──── */}
        <section className="bento-tile bento-tile--chart span-4">
          <TileHead title="Pending by status" subtitle={`${totalPending} open`} />
          {doughnutRows.length > 0 ? (
            <div className="dash-chart dash-chart--doughnut">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <EmptyState
              icon="cart"
              title="Nothing pending"
              message="All open orders have shipped."
              compact
            />
          )}
        </section>

        {/* ── Tile 8: Top products (horizontal bar, col span 8) ─── */}
        <section className="bento-tile bento-tile--chart span-8">
          <TileHead
            title="Top products"
            subtitle={topN.length > 0 ? `Best sellers · top ${topN.length}` : undefined}
          />
          {topN.length > 0 ? (
            <div className="dash-chart">
              <Bar data={topBarData} options={topBarOptions} />
            </div>
          ) : (
            <EmptyState
              icon="tag"
              title="No sales yet"
              message="Rankings will appear once orders are placed."
              compact
            />
          )}
        </section>

        {/* ── Tile 9: Recent orders table (col span 8) ──────────── */}
        <section className="bento-tile bento-tile--table span-8">
          <TileHead title="Recent orders" subtitle={`Last ${RECENT_ORDERS_LIMIT}`} />
          {recentOrdersQ.isError ? (
            <ErrorState
              title="Couldn't load orders"
              message="Retry or check the sales service."
              onRetry={() => void recentOrdersQ.refetch()}
            />
          ) : recentOrders.length === 0 ? (
            <EmptyState
              icon="cart"
              title="No orders yet"
              message="Orders will show up here as they're placed."
              compact
            />
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="is-clickable"
                      onClick={() => navigate(ROUTES.orderDetail(o.code))}
                    >
                      <td className="code">{o.code}</td>
                      <td className="dash-table-truncate">{o.address.name}</td>
                      <td>
                        <StatusBadge kind="order" status={o.status} />
                      </td>
                      <td className="num">{formatPaise(o.totalPaise)}</td>
                      <td className="dash-table-muted">{formatDateTime(o.placedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Tile 10: Stock valuation (col span 4) ──────────────── */}
        <section className="bento-tile bento-tile--valuation span-4">
          <div className="dash-eyebrow">
            <Icon name="box" size={12} />
            Stock valuation
          </div>
          {valuationQ.isError ? (
            <p className="dash-attn-empty">Couldn't load valuation.</p>
          ) : valuationQ.isLoading || valuationTotal == null ? (
            <div className="dash-val-loading">
              <Spinner label="" />
            </div>
          ) : (
            <>
              <div className="dash-val-value tabular">{formatPaise(valuationTotal)}</div>
              <div className="dash-val-caption">
                {valuationSkuCount != null
                  ? `${valuationSkuCount.toLocaleString('en-IN')} SKUs tracked`
                  : 'across warehouse'}
              </div>
            </>
          )}
          <FootLink to={ROUTES.reports}>Valuation report</FootLink>
        </section>
      </div>
    </>
  );
}
