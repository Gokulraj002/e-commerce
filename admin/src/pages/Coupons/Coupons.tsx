import { useMemo, useState } from 'react';
import { COUPON_TYPE, ROLES } from '@elite/shared';

import {
  ConfirmModal,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  PageHeader,
  StatusBadge,
  type BadgeTone,
} from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import { RoleGate } from '@/features/auth';
import {
  CouponForm,
  formatDate,
  useCoupons,
  useDeleteCoupon,
  useSaveCoupon,
  type AdminCoupon,
} from '@/features/sales';
import { formatPaise } from '@/lib/money';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];
const SKELETON_COUNT = 4;

type CouponFilter = 'all' | 'active' | 'expired' | 'used';

const FILTER_ORDER: CouponFilter[] = ['all', 'active', 'expired', 'used'];
const FILTER_LABEL: Record<CouponFilter, string> = {
  all: 'All',
  active: 'Active',
  expired: 'Expired',
  used: 'Fully used',
};

// ── Coupon state predicates ────────────────────────────────────────
function isExpired(c: AdminCoupon): boolean {
  return c.expiresAt !== null && new Date(c.expiresAt).getTime() < Date.now();
}
function isFullyUsed(c: AdminCoupon): boolean {
  return c.usageLimit !== null && c.usedCount >= c.usageLimit;
}
function isActiveNow(c: AdminCoupon): boolean {
  return c.isActive && !isExpired(c) && !isFullyUsed(c);
}
function passesFilter(c: AdminCoupon, f: CouponFilter): boolean {
  if (f === 'active') return isActiveNow(c);
  if (f === 'expired') return isExpired(c);
  if (f === 'used') return isFullyUsed(c);
  return true;
}

function badgeFor(c: AdminCoupon): { label: string; tone: BadgeTone } {
  if (isExpired(c)) return { label: 'EXPIRED', tone: 'danger' };
  if (isFullyUsed(c)) return { label: 'FULLY USED', tone: 'neutral' };
  if (!c.isActive) return { label: 'INACTIVE', tone: 'warning' };
  return { label: 'ACTIVE', tone: 'success' };
}

function typeLabel(c: AdminCoupon): string {
  if (c.type === COUPON_TYPE.PERCENT) return 'Percentage off';
  if (c.type === COUPON_TYPE.FLAT) return 'Flat amount off';
  return 'Free shipping';
}
function valueLabel(c: AdminCoupon): string {
  if (c.type === COUPON_TYPE.PERCENT) return `${c.percent ?? 0}%`;
  if (c.type === COUPON_TYPE.FLAT) return formatPaise(c.valuePaise ?? 0);
  return 'Free';
}
function usagePct(c: AdminCoupon): number {
  if (!c.usageLimit || c.usageLimit <= 0) return 0;
  return Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100));
}
function barTone(pct: number): '' | 'is-warning' | 'is-danger' {
  if (pct >= 100) return 'is-danger';
  if (pct >= 75) return 'is-warning';
  return '';
}

// ── Page-scoped styles ─────────────────────────────────────────────
const COUPONS_STYLES = `
.coupon-card {
  position: relative;
  height: 100%;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: 1.1rem 1.15rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  transition:
    box-shadow 0.18s var(--ease),
    border-color 0.18s var(--ease),
    transform 0.18s var(--ease);
}
.coupon-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
  transform: translateY(-2px);
}
.coupon-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.coupon-card__code {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.02rem;
  letter-spacing: 0.02em;
  color: var(--text-strong);
  padding: 0.25rem 0.55rem;
  background: var(--bg-muted);
  border: 1px dashed var(--border-strong);
  border-radius: 6px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coupon-card__value {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.15rem 0 0.25rem;
}
.coupon-card__type {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.coupon-card__amount {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.coupon-card__meta {
  margin: 0;
  padding: 0.6rem 0 0;
  border-top: 1px solid var(--border-hairline);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.83rem;
}
.coupon-card__row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.coupon-card__row dt {
  color: var(--text-muted);
  font-weight: 400;
  margin: 0;
}
.coupon-card__row dd {
  color: var(--text-strong);
  font-weight: 500;
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.coupon-card__bar {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--bg-muted);
  overflow: hidden;
}
.coupon-card__bar-fill {
  height: 100%;
  background: var(--brand);
  transition: width 0.3s var(--ease);
}
.coupon-card__bar-fill.is-warning { background: var(--warning); }
.coupon-card__bar-fill.is-danger { background: var(--danger); }
.coupon-card__actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  padding-top: 0.35rem;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
}
.coupon-card:hover .coupon-card__actions,
.coupon-card:focus-within .coupon-card__actions {
  opacity: 1;
  transform: translateY(0);
}

/* Skeleton state — same footprint as a real card. */
.coupon-card--skeleton {
  min-height: 210px;
  gap: 0.6rem;
  pointer-events: none;
}
.coupon-card--skeleton:hover {
  box-shadow: var(--shadow-xs);
  transform: none;
  border-color: var(--border);
}
.coupon-card__sk {
  background: linear-gradient(90deg,
    var(--bg-muted) 0%,
    var(--bg-subtle) 50%,
    var(--bg-muted) 100%);
  background-size: 200% 100%;
  animation: coupon-shimmer 1.4s linear infinite;
  border-radius: 6px;
  height: 12px;
}
.coupon-card__sk--code  { height: 30px; width: 55%; }
.coupon-card__sk--pill  { height: 20px; width: 62px; border-radius: 50rem; }
.coupon-card__sk--value { height: 22px; width: 45%; }
.coupon-card__sk--line  { height: 10px; }
.coupon-card__sk--short { width: 65%; }
@keyframes coupon-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.coupons-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: inline-grid;
  place-items: center;
  background: var(--brand-tint);
  color: var(--brand);
  margin-bottom: 0.5rem;
  border: 1px dashed rgba(179, 18, 30, 0.28);
}

/* ── Mobile compact list variant ─────────────────────────────── */
@media (max-width: 575.98px) {
  .coupon-card {
    padding: 0.75rem 0.9rem;
    gap: 0.35rem;
  }
  .coupon-card__head {
    align-items: flex-start;
  }
  .coupon-card__code {
    font-size: 0.9rem;
    padding: 0.15rem 0.45rem;
  }
  .coupon-card__value {
    padding: 0;
  }
  .coupon-card__amount { font-size: 1.15rem; }
  .coupon-card__meta {
    padding-top: 0.4rem;
    gap: 0.3rem;
    font-size: 0.8rem;
  }
  .coupon-card__actions {
    opacity: 1;
    transform: none;
    justify-content: flex-start;
  }
}
`;

export default function Coupons() {
  const [filter, setFilter] = useState<CouponFilter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminCoupon | null>(null);

  const { data, isLoading, isError, error, refetch } = useCoupons();
  const save = useSaveCoupon();
  const remove = useDeleteCoupon();

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: AdminCoupon) => {
    setEditing(c);
    setDrawerOpen(true);
  };

  const filtered = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((c) => {
      if (q) {
        const hay = `${c.code} ${c.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return passesFilter(c, filter);
    });
  }, [data, search, filter]);

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      all: all.length,
      active: all.filter(isActiveNow).length,
      expired: all.filter(isExpired).length,
      used: all.filter(isFullyUsed).length,
    } satisfies Record<CouponFilter, number>;
  }, [data]);

  return (
    <>
      <style>{COUPONS_STYLES}</style>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes for promotions and campaigns."
        actions={
          <RoleGate allow={ADMIN_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={14} />
              <span className="ms-1">New coupon</span>
            </button>
          </RoleGate>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn't load coupons"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      <div className="ui-filter-strip">
        <div className="ui-filter-strip__search">
          <span className="ui-filter-strip__search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Search by code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search coupons"
          />
        </div>
        <div className="ui-filter-strip__sep" aria-hidden="true" />
        <div className="ui-filter-strip__chips" role="group" aria-label="Coupon filters">
          {FILTER_ORDER.map((f) => (
            <FilterChip
              key={f}
              label={`${FILTER_LABEL[f]} · ${counts[f].toLocaleString('en-IN')}`}
              active={filter === f}
              onClick={() => setFilter(f)}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="row g-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div key={i} className="col-12 col-sm-6 col-xl-3">
              <div className="coupon-card coupon-card--skeleton" aria-hidden="true">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="coupon-card__sk coupon-card__sk--code" />
                  <div className="coupon-card__sk coupon-card__sk--pill" />
                </div>
                <div className="coupon-card__sk coupon-card__sk--value" />
                <div className="coupon-card__sk coupon-card__sk--line" />
                <div className="coupon-card__sk coupon-card__sk--line coupon-card__sk--short" />
                <div className="coupon-card__sk coupon-card__sk--line" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body py-5 text-center">
            <div className="coupons-empty__icon" aria-hidden="true">
              <Icon name="ticket" size={26} />
            </div>
            <EmptyState
              title={counts.all === 0 ? 'No coupons yet' : 'Nothing matches these filters'}
              message={
                counts.all === 0
                  ? 'Create discount codes to run promotions and campaigns.'
                  : 'Try a different filter, or clear your search to see everything.'
              }
              action={
                counts.all === 0 ? (
                  <RoleGate allow={ADMIN_ROLES}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={openCreate}
                    >
                      <Icon name="plus" size={14} />
                      <span className="ms-1">Create your first coupon</span>
                    </button>
                  </RoleGate>
                ) : (
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                  >
                    Reset filters
                  </button>
                )
              }
              compact
            />
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {filtered.map((c) => {
            const badge = badgeFor(c);
            const pct = usagePct(c);
            const tone = barTone(pct);
            const limit = c.usageLimit != null ? c.usageLimit.toLocaleString('en-IN') : '∞';
            return (
              <div key={c.id} className="col-12 col-sm-6 col-xl-3">
                <div className="coupon-card">
                  <div className="coupon-card__head">
                    <div className="coupon-card__code" title={c.code}>
                      {c.code}
                    </div>
                    <StatusBadge status={badge.label} tone={badge.tone} />
                  </div>
                  <div className="coupon-card__value">
                    <span className="coupon-card__type">{typeLabel(c)}</span>
                    <span className="coupon-card__amount">{valueLabel(c)}</span>
                  </div>
                  <dl className="coupon-card__meta">
                    <div className="coupon-card__row">
                      <dt>Min. cart</dt>
                      <dd>{formatPaise(c.minCartPaise)}</dd>
                    </div>
                    <div className="coupon-card__row">
                      <dt>Usage</dt>
                      <dd>
                        {c.usedCount.toLocaleString('en-IN')} / {limit}
                      </dd>
                    </div>
                    <div
                      className="coupon-card__bar"
                      role="progressbar"
                      aria-label="Usage"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`coupon-card__bar-fill ${tone}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="coupon-card__row">
                      <dt>Valid until</dt>
                      <dd>{c.expiresAt ? formatDate(c.expiresAt) : 'No expiry'}</dd>
                    </div>
                  </dl>
                  <div className="coupon-card__actions">
                    <RoleGate allow={ADMIN_ROLES}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setToDelete(c)}
                      >
                        Delete
                      </button>
                    </RoleGate>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
      >
        <CouponForm
          coupon={editing}
          submitting={save.isPending}
          onCancel={() => setDrawerOpen(false)}
          onSubmit={async (body) => {
            await save.mutateAsync({ id: editing?.id, body });
            setDrawerOpen(false);
          }}
        />
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete coupon?"
        message={toDelete ? `"${toDelete.code}" will be removed. This cannot be undone.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
