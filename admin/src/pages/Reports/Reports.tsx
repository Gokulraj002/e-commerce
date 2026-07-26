import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChartData, ChartOptions } from 'chart.js';

import {
  ChartCard,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  StatCard,
  humanizeStatus,
} from '@/components/ui';
import {
  useDashboardStats,
  useLowStock,
  useValuation,
  useWastage,
} from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise } from '@/lib/money';
import { ROUTES } from '@/routes/paths';

import {
  RangeFilter,
  rangeDays,
  resolveRange,
  type RangeKey,
} from '@/features/ops/components/RangeFilter';

/* ------------------------------------------------------------------------- */
/*  Design tokens local to Reports                                            */
/* ------------------------------------------------------------------------- */

/** Categorical palette used by every chart on this page. */
const PALETTE = [
  '#b3121e',
  '#b78628',
  '#16a34a',
  '#0284c7',
  '#7c3aed',
  '#d97706',
  '#334155',
] as const;

const GRID = 'rgba(9, 9, 11, 0.05)';
const TICK_COLOR = '#71717a';

const rupeeFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const compactFmt = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const pctFmt = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const dayLabelFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
});

/* ------------------------------------------------------------------------- */
/*  Chart option builders                                                     */
/* ------------------------------------------------------------------------- */

/** Base cartesian options shared by trend line/bar charts. */
function makeCartesianOptions(opts: {
  yFormatter?: (v: number) => string;
  showLegend?: boolean;
}): ChartOptions<'line' | 'bar'> {
  const { yFormatter, showLegend = false } = opts;
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: showLegend, position: 'bottom' },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#e4e4e7',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: "'Inter'", size: 12, weight: 600 },
        bodyFont: {
          family: "'JetBrains Mono', ui-monospace, monospace",
          size: 12,
        },
        callbacks: yFormatter
          ? {
              label: (ctx) =>
                ` ${ctx.dataset.label ?? ''}${
                  ctx.dataset.label ? ': ' : ''
                }${yFormatter(Number(ctx.parsed.y))}`,
            }
          : undefined,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: GRID },
        ticks: {
          color: TICK_COLOR,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (v) =>
            yFormatter ? yFormatter(Number(v)) : compactFmt.format(Number(v)),
        },
      },
    },
  };
}

/** Horizontal-bar options (Top products). */
function makeHorizontalBarOptions(): ChartOptions<'bar'> {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#e4e4e7',
        padding: 10,
        cornerRadius: 8,
        bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
        callbacks: {
          label: (ctx) => ` ${compactFmt.format(Number(ctx.parsed.x))} units`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: GRID },
        ticks: {
          color: TICK_COLOR,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (v) => compactFmt.format(Number(v)),
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11.5 } },
      },
    },
  };
}

/** Doughnut chart options (Orders by status). */
function makeDoughnutOptions(): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: TICK_COLOR,
          font: { size: 12 },
          boxWidth: 10,
          padding: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#e4e4e7',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed}`,
        },
      },
    },
  };
}

/* ------------------------------------------------------------------------- */
/*  Placeholder trend synthesiser                                              */
/* ------------------------------------------------------------------------- */
//
// TODO(reports): swap for a real daily-revenue endpoint (e.g.
// `GET /dashboard/timeseries?from&to`). Until then we anchor a gentle
// deterministic curve to today's revenue/orders so the trend charts render
// something meaningful and stable per range.

function buildDailyLabels(from: string, days: number): string[] {
  const out: string[] = [];
  const start = new Date(from);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(dayLabelFmt.format(d));
  }
  return out;
}

/** Deterministic, softly-rising series that lands exactly on `endValue`. */
function buildSyntheticSeries(days: number, endValue: number, seed: number): number[] {
  if (days <= 0 || endValue <= 0) return new Array(Math.max(0, days)).fill(0);
  const out: number[] = [];
  for (let i = 0; i < days; i++) {
    const t = days === 1 ? 1 : i / (days - 1);
    const base = endValue * (0.6 + 0.4 * t);
    const wobble = Math.sin(i * 0.9 + seed) * endValue * 0.12;
    out.push(Math.max(0, Math.round(base + wobble)));
  }
  out[out.length - 1] = endValue;
  return out;
}

/* ------------------------------------------------------------------------- */
/*  Small presentational helpers                                              */
/* ------------------------------------------------------------------------- */

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="d-flex align-items-baseline justify-content-between mb-2 mt-1">
      <h2
        className="mb-0"
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-muted)',
        }}
      >
        {title}
      </h2>
      {hint && (
        <span className="text-muted-2 small tabular" style={{ fontSize: '0.75rem' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <hr className="my-4" style={{ borderColor: 'var(--border)', opacity: 0.7 }} />;
}

/**
 * Card chrome mimicking ChartCard for non-chart blocks (tables, empty
 * state, error state). Keeps the layout homogenous.
 */
function PanelCard({
  title,
  subtitle,
  actions,
  children,
  bodyStyle,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div className="card h-100">
      <div className="card-body d-flex flex-column" style={bodyStyle}>
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h3 className="ui-card-title">{title}</h3>
            {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </div>
        <div className="flex-grow-1">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Page                                                                      */
/* ------------------------------------------------------------------------- */

export default function Reports() {
  const navigate = useNavigate();

  // ── Range state ────────────────────────────────────────────────────
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const range = useMemo(
    () => resolveRange(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );
  const days = rangeDays(rangeKey, customFrom, customTo);
  const rangeLabel = useMemo(() => {
    if (rangeKey === 'today') return 'Today';
    if (rangeKey === '7d') return 'Last 7 days';
    if (rangeKey === '30d') return 'Last 30 days';
    if (rangeKey === '90d') return 'Last 90 days';
    return `${range.from} → ${range.to}`;
  }, [rangeKey, range.from, range.to]);

  // ── Data ───────────────────────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsIsError,
    error: statsError,
    refetch: refetchStats,
  } = useDashboardStats();

  const {
    data: valuation,
    isLoading: valuationLoading,
    isError: valuationIsError,
  } = useValuation();

  const {
    data: wastage,
    isLoading: wastageLoading,
    isError: wastageIsError,
    error: wastageError,
    refetch: refetchWastage,
  } = useWastage({ from: range.from, to: range.to });

  const { data: lowStock, isLoading: lowStockLoading } = useLowStock();

  // ── Derived KPIs (endpoint only exposes "today" for now) ──────────
  const kpi = useMemo(() => {
    const today = stats?.today;
    const revenuePaise = today?.revenuePaise ?? 0;
    const orders = today?.orders ?? 0;
    const aovPaise = orders > 0 ? Math.round(revenuePaise / orders) : 0;
    return { revenuePaise, orders, aovPaise };
  }, [stats]);

  /* ---------------------------------------------------------------- */
  /*  Chart datasets                                                    */
  /* ---------------------------------------------------------------- */

  // Trend row: synthetic curves anchored on today's real KPIs.
  const trendLabels = useMemo(() => buildDailyLabels(range.from, days), [range.from, days]);
  const revenueSeries = useMemo(
    () => buildSyntheticSeries(days, kpi.revenuePaise, 1),
    [days, kpi.revenuePaise],
  );
  const ordersSeries = useMemo(
    () => buildSyntheticSeries(days, kpi.orders, 4),
    [days, kpi.orders],
  );

  const revenueLine: ChartData<'line'> = useMemo(
    () => ({
      labels: trendLabels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueSeries,
          borderColor: PALETTE[0],
          backgroundColor: 'rgba(179,18,30,0.10)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: PALETTE[0],
          fill: true,
        },
      ],
    }),
    [trendLabels, revenueSeries],
  );

  const ordersBar: ChartData<'bar'> = useMemo(
    () => ({
      labels: trendLabels,
      datasets: [
        {
          label: 'Orders',
          data: ordersSeries,
          backgroundColor: PALETTE[3],
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    }),
    [trendLabels, ordersSeries],
  );

  // Distribution row: real data from /dashboard/stats.
  const statusDoughnut: ChartData<'doughnut'> = useMemo(() => {
    const rows = stats?.pendingByStatus ?? [];
    return {
      labels: rows.map((r) => humanizeStatus(r.status)),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: rows.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  }, [stats]);

  const topProducts = useMemo(
    () => (stats?.topProducts ?? []).slice(0, 10),
    [stats],
  );
  const topProductsBar: ChartData<'bar'> = useMemo(
    () => ({
      labels: topProducts.map((p) => p.name),
      datasets: [
        {
          label: 'Units',
          data: topProducts.map((p) => p.units),
          backgroundColor: PALETTE[0],
          borderRadius: 4,
          maxBarThickness: 20,
        },
      ],
    }),
    [topProducts],
  );

  // Wastage row: real data from /inventory/reports/wastage.
  const wastageRows = useMemo(
    () => (wastage?.rows ?? []).slice(0, 10),
    [wastage],
  );
  const wastageBar: ChartData<'bar'> = useMemo(
    () => ({
      labels: wastageRows.map((r) => r.productName ?? r.sku ?? '—'),
      datasets: [
        {
          label: 'Wastage (kg)',
          data: wastageRows.map((r) => +(r.wastageG / 1000).toFixed(3)),
          backgroundColor: PALETTE[5],
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    }),
    [wastageRows],
  );

  /* ---------------------------------------------------------------- */
  /*  Loading / hard error fallbacks                                    */
  /* ---------------------------------------------------------------- */

  if (statsLoading) {
    return (
      <>
        <PageHeader title="Reports" subtitle="Sales, catalog & inventory analytics." />
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading reports…" />
        </div>
      </>
    );
  }

  if (statsIsError || !stats) {
    return (
      <>
        <PageHeader title="Reports" subtitle="Sales, catalog & inventory analytics." />
        <ErrorState
          title="Couldn't load report data"
          message={statsIsError ? getApiErrorMessage(statsError) : 'No data returned.'}
          onRetry={() => refetchStats()}
        />
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  const totalWastageKg = wastage ? +(wastage.totalWastageG / 1000).toFixed(2) : 0;
  const lowStockRows = (lowStock ?? []).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales, catalog & inventory analytics."
        actions={
          <RangeFilter
            value={rangeKey}
            onChange={setRangeKey}
            from={customFrom}
            to={customTo}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
        }
      />

      {/* ── Section 1: KPI strip ─────────────────────────────────── */}
      <SectionTitle title="Overview" hint={rangeLabel} />
      <div className="row g-3 mb-2">
        <div className="col-6 col-xl-3">
          <StatCard
            label="Revenue"
            value={<span className="tabular">{formatPaise(kpi.revenuePaise)}</span>}
            icon="chart"
            caption="Current snapshot (today)"
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Orders"
            value={<span className="tabular">{kpi.orders.toLocaleString('en-IN')}</span>}
            icon="cart"
            caption="Current snapshot (today)"
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Avg. order value"
            value={
              <span className="tabular">
                {kpi.orders > 0 ? rupeeFmt.format(kpi.aovPaise / 100) : '—'}
              </span>
            }
            icon="ticket"
            caption={kpi.orders > 0 ? 'From today’s orders' : 'No orders today'}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            label="Refund rate"
            value={<span className="tabular text-muted-2">{pctFmt.format(0)}</span>}
            icon="alert"
            caption="N/A — endpoint not yet exposed"
          />
        </div>
      </div>

      <Divider />

      {/* ── Section 2: Trend row ─────────────────────────────────── */}
      <SectionTitle
        title="Trends"
        hint={`${days} day${days === 1 ? '' : 's'} · placeholder curve`}
      />
      <div className="row g-3 mb-2">
        <div className="col-12 col-xl-7">
          <ChartCard
            title="Revenue over time"
            subtitle="Anchored on today’s revenue — awaiting daily endpoint"
            type="line"
            data={revenueLine}
            options={makeCartesianOptions({
              yFormatter: (v) => rupeeFmt.format(v / 100),
            })}
            height={280}
          />
        </div>
        <div className="col-12 col-xl-5">
          <ChartCard
            title="Orders by day"
            subtitle="Anchored on today’s orders — awaiting daily endpoint"
            type="bar"
            data={ordersBar}
            options={makeCartesianOptions({
              yFormatter: (v) => compactFmt.format(v),
            })}
            height={280}
          />
        </div>
      </div>

      <Divider />

      {/* ── Section 3: Distribution row ──────────────────────────── */}
      <SectionTitle title="Distribution" hint="Current snapshot" />
      <div className="row g-3 mb-2">
        <div className="col-12 col-lg-5">
          {stats.pendingByStatus.length > 0 ? (
            <ChartCard
              title="Orders by status"
              subtitle="Live pending workload"
              type="doughnut"
              data={statusDoughnut}
              options={makeDoughnutOptions()}
              height={280}
            />
          ) : (
            <PanelCard title="Orders by status" subtitle="Live pending workload">
              <EmptyState
                title="No pending orders"
                message="Nothing waiting for action right now."
                compact
              />
            </PanelCard>
          )}
        </div>
        <div className="col-12 col-lg-7">
          {topProducts.length > 0 ? (
            <ChartCard
              title="Top 10 products"
              subtitle="Units sold, best-selling on top"
              type="bar"
              data={topProductsBar}
              options={makeHorizontalBarOptions()}
              height={Math.max(280, topProducts.length * 34)}
            />
          ) : (
            <PanelCard title="Top 10 products" subtitle="Units sold, best-selling on top">
              <EmptyState title="No sales yet" message="Products with sales will appear here." compact />
            </PanelCard>
          )}
        </div>
      </div>

      <Divider />

      {/* ── Section 4: Inventory row ─────────────────────────────── */}
      <SectionTitle
        title="Inventory"
        hint={
          valuation
            ? `Total stock value ${formatPaise(valuation.totalValuePaise)}`
            : undefined
        }
      />
      <div className="row g-3 mb-2">
        <div className="col-12 col-xl-7">
          <PanelCard
            title="Stock valuation"
            subtitle="Top 20 SKUs by on-hand value"
            actions={
              valuation ? (
                <span className="text-muted-2 small tabular">
                  {valuation.rows.length} SKU{valuation.rows.length === 1 ? '' : 's'}
                </span>
              ) : undefined
            }
          >
            <div className="table-responsive" style={{ maxHeight: 360 }}>
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="text-end">Available</th>
                    <th className="text-end">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        <Spinner size="sm" label="Loading valuation…" />
                      </td>
                    </tr>
                  ) : valuationIsError ? (
                    <tr>
                      <td colSpan={4} className="py-3">
                        <ErrorState
                          title="Couldn’t load valuation"
                          message="Try refreshing the page."
                        />
                      </td>
                    </tr>
                  ) : !valuation || valuation.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <EmptyState
                          title="No stock recorded"
                          message="Add inventory to see valuation."
                          compact
                        />
                      </td>
                    </tr>
                  ) : (
                    valuation.rows.slice(0, 20).map((r) => (
                      <tr key={r.variantId}>
                        <td>{r.productName}</td>
                        <td className="text-muted-2 small">{r.sku}</td>
                        <td className="text-end tabular">
                          {(r.availableG / 1000).toFixed(2)} kg
                        </td>
                        <td className="text-end tabular fw-semibold">
                          {formatPaise(r.valuePaise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PanelCard>
        </div>
        <div className="col-12 col-xl-5">
          {wastageLoading ? (
            <PanelCard title="Wastage by SKU" subtitle={rangeLabel}>
              <div className="d-flex justify-content-center py-5">
                <Spinner label="Loading wastage…" />
              </div>
            </PanelCard>
          ) : wastageIsError ? (
            <PanelCard title="Wastage by SKU" subtitle={rangeLabel}>
              <ErrorState
                title="Couldn’t load wastage"
                message={getApiErrorMessage(wastageError)}
                onRetry={() => refetchWastage()}
              />
            </PanelCard>
          ) : wastageRows.length === 0 ? (
            <PanelCard title="Wastage by SKU" subtitle={rangeLabel}>
              <EmptyState
                title="No wastage recorded"
                message="Nothing was written off in this range — great news."
              />
            </PanelCard>
          ) : (
            <ChartCard
              title="Wastage by SKU"
              subtitle={`${rangeLabel} · total ${totalWastageKg} kg`}
              type="bar"
              data={wastageBar}
              options={makeHorizontalBarOptions()}
              height={Math.max(280, wastageRows.length * 32)}
            />
          )}
        </div>
      </div>

      <Divider />

      {/* ── Section 5: Low stock alerts ──────────────────────────── */}
      <SectionTitle
        title="Alerts"
        hint={
          lowStockRows.length > 0
            ? `${lowStock?.length ?? 0} SKU${(lowStock?.length ?? 0) === 1 ? '' : 's'} below reorder`
            : undefined
        }
      />
      <div className="row g-3">
        <div className="col-12 col-xl-5 offset-xl-7">
          <PanelCard
            title="Low stock alerts"
            subtitle="Top 8 SKUs needing a reorder"
            actions={
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => navigate(ROUTES.inventoryStock)}
              >
                Open stock
              </button>
            }
          >
            {lowStockLoading ? (
              <div className="d-flex justify-content-center py-4">
                <Spinner size="sm" label="Loading alerts…" />
              </div>
            ) : lowStockRows.length === 0 ? (
              <EmptyState
                title="All stock levels healthy"
                message="Nothing sitting below its reorder threshold."
                compact
              />
            ) : (
              <ul className="list-unstyled mb-0" style={{ margin: 0 }}>
                {lowStockRows.map((r, idx) => (
                  <li
                    key={r.variantId}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(ROUTES.inventoryStock)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(ROUTES.inventoryStock);
                      }
                    }}
                    className="d-flex align-items-center justify-content-between py-2"
                    style={{
                      borderTop:
                        idx === 0 ? 'none' : '1px solid var(--border-hairline)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="min-w-0" style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-truncate">{r.productName}</div>
                      <div className="text-muted-2 small text-truncate">{r.sku}</div>
                    </div>
                    <div className="text-end ms-2">
                      <div className="tabular fw-semibold" style={{ color: 'var(--danger)' }}>
                        {(r.availableG / 1000).toFixed(2)} kg
                      </div>
                      <div className="text-muted-2 small tabular">
                        reorder ≤ {(r.reorderLevelG / 1000).toFixed(2)} kg
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>
      </div>
    </>
  );
}
