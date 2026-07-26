import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  ROLES,
  type DeliveryAssignmentDTO,
  type OrderDTO,
  type Paginated,
} from '@elite/shared';

import {
  ErrorState,
  Icon,
  PageHeader,
  StatCard,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import { useAssignments, useAutoAssign } from '@/features/ops';
import { useUpdateOrderStatus } from '@/features/sales';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { ROUTES } from '@/routes/paths';

const DELIVERY_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER];

type LaneKey = 'new' | 'assigned' | 'inflight' | 'done';

interface Lane {
  key: LaneKey;
  label: string;
  /** Backend delivery statuses that belong in this lane. */
  statuses: readonly string[];
  /** Semantic tone used for the lane header band. */
  tone: 'neutral' | 'info' | 'warning' | 'success';
}

const LANES: readonly Lane[] = [
  { key: 'new', label: 'Unassigned', statuses: [DELIVERY_STATUS.UNASSIGNED], tone: 'neutral' },
  {
    key: 'assigned',
    label: 'Assigned',
    statuses: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.ACCEPTED],
    tone: 'info',
  },
  {
    key: 'inflight',
    label: 'In flight',
    statuses: [DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.OUT_FOR_DELIVERY],
    tone: 'warning',
  },
  { key: 'done', label: 'Delivered', statuses: [DELIVERY_STATUS.DELIVERED], tone: 'success' },
] as const;

/** Cap for the "Auto-assign all unassigned" burst so we never fire a stampede. */
const AUTO_ASSIGN_ALL_LIMIT = 10;

/**
 * There is no admin `GET /orders/:code` endpoint — the sales feature resolves
 * a code by searching the admin order list. Duplicating that one call here
 * keeps the delivery board self-contained without cross-feature deep imports.
 */
async function resolveOrderIdByCode(code: string): Promise<string | null> {
  const page = await api.get<Paginated<OrderDTO>>('/orders/admin/all', {
    params: { search: code, pageSize: 50 },
  });
  return page.items.find((o) => o.code === code)?.id ?? null;
}

/** Local YYYY-MM-DD (avoids the UTC drift you get from toISOString). */
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * `assignedAt` is our best proxy for an ETA hint until the backend surfaces a
 * committed slot. Show wall-clock (HH:MM) so dispatchers can read it fast.
 */
function formatEtaHint(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function laneFor(status: string): LaneKey | null {
  const hit = LANES.find((l) => l.statuses.includes(status));
  return hit ? hit.key : null;
}

/** Small copy-to-clipboard glyph (inline so we don't grow the shared Icon set). */
function CopyGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="delivery-card delivery-card--skeleton" aria-hidden="true">
      <div className="delivery-skeleton__row delivery-skeleton__row--wide" />
      <div className="delivery-skeleton__row delivery-skeleton__row--mid" />
      <div className="delivery-skeleton__row delivery-skeleton__row--thin" />
    </div>
  );
}

interface AssignmentCardProps {
  assignment: DeliveryAssignmentDTO;
  laneKey: LaneKey;
  onCopy: (code: string) => void;
  onAutoAssign: (code: string) => void;
  onMarkDelivered: (code: string) => void;
  autoAssignPending: boolean;
  markPendingCode: string | null;
}

function AssignmentCard({
  assignment,
  laneKey,
  onCopy,
  onAutoAssign,
  onMarkDelivered,
  autoAssignPending,
  markPendingCode,
}: AssignmentCardProps) {
  const eta = formatEtaHint(assignment.assignedAt);
  const canMark = laneKey === 'assigned' || laneKey === 'inflight';
  const markingThis = markPendingCode === assignment.orderCode;

  return (
    <article className="delivery-card" aria-label={`Order ${assignment.orderCode}`}>
      <header className="delivery-card__head">
        <button
          type="button"
          className="delivery-card__code"
          onClick={() => onCopy(assignment.orderCode)}
          title="Copy order code"
          aria-label={`Copy order code ${assignment.orderCode}`}
        >
          <span className="tabular">{assignment.orderCode}</span>
          <span className="delivery-card__copy" aria-hidden="true">
            <CopyGlyph />
          </span>
        </button>
        <StatusBadge kind="delivery" status={assignment.status} />
      </header>

      <dl className="delivery-card__meta">
        <div className="delivery-card__row">
          <dt>Customer</dt>
          <dd className="text-muted-2">—</dd>
        </div>
        <div className="delivery-card__row">
          <dt>Partner</dt>
          <dd className={assignment.partnerName ? '' : 'text-muted-2'}>
            {assignment.partnerName ?? 'No partner'}
          </dd>
        </div>
        <div className="delivery-card__row">
          <dt>ETA</dt>
          <dd className="tabular">{eta ?? '—'}</dd>
        </div>
      </dl>

      <div className="delivery-card__actions">
        {laneKey === 'new' && (
          <RoleGate allow={DELIVERY_ROLES}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={autoAssignPending}
              onClick={() => onAutoAssign(assignment.orderCode)}
            >
              Auto-assign
            </button>
          </RoleGate>
        )}
        {canMark && (
          <RoleGate allow={DELIVERY_ROLES}>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              disabled={markingThis}
              onClick={() => onMarkDelivered(assignment.orderCode)}
            >
              {markingThis ? 'Marking…' : 'Mark delivered'}
            </button>
          </RoleGate>
        )}
        <Link
          to={ROUTES.orderDetail(assignment.orderCode)}
          className="btn btn-sm btn-outline-secondary"
        >
          View order
        </Link>
      </div>
    </article>
  );
}

export default function DeliveryBoard() {
  const [date, setDate] = useState<string>(todayYmd());
  const [search, setSearch] = useState<string>('');
  const [bulkPending, setBulkPending] = useState(false);
  const [markPendingCode, setMarkPendingCode] = useState<string | null>(null);

  const toast = useToast();
  const {
    data,
    isLoading,
    isError,
    isFetching,
    error,
    refetch,
  } = useAssignments({ date: date || undefined });
  const autoAssign = useAutoAssign();
  const updateStatus = useUpdateOrderStatus();

  const assignments = useMemo<DeliveryAssignmentDTO[]>(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const code = a.orderCode.toLowerCase();
      const partner = (a.partnerName ?? '').toLowerCase();
      return code.includes(q) || partner.includes(q);
    });
  }, [assignments, search]);

  const grouped = useMemo(() => {
    const out: Record<LaneKey, DeliveryAssignmentDTO[]> = {
      new: [],
      assigned: [],
      inflight: [],
      done: [],
    };
    for (const a of filtered) {
      const key = laneFor(a.status);
      if (key) out[key].push(a);
    }
    return out;
  }, [filtered]);

  const kpis = useMemo(() => {
    const counts = { total: 0, unassigned: 0, inflight: 0, delivered: 0 };
    for (const a of assignments) {
      counts.total += 1;
      const key = laneFor(a.status);
      if (key === 'new') counts.unassigned += 1;
      else if (key === 'inflight') counts.inflight += 1;
      else if (key === 'done') counts.delivered += 1;
    }
    return counts;
  }, [assignments]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success({ title: 'Copied', message: code });
    } catch {
      toast.error({ title: "Couldn't copy", message: code });
    }
  };

  const handleAutoAssign = (code: string) => {
    autoAssign.mutate({ orderId: code });
  };

  const handleMarkDelivered = async (code: string) => {
    setMarkPendingCode(code);
    try {
      const orderId = await resolveOrderIdByCode(code);
      if (!orderId) {
        toast.error({ title: 'Order not found', message: code });
        return;
      }
      await updateStatus.mutateAsync({
        id: orderId,
        code,
        status: ORDER_STATUS.DELIVERED,
      });
    } catch (err) {
      toast.error({ title: 'Could not mark delivered', message: getApiErrorMessage(err) });
    } finally {
      setMarkPendingCode(null);
    }
  };

  const handleAutoAssignAll = async () => {
    const targets = grouped.new.slice(0, AUTO_ASSIGN_ALL_LIMIT);
    if (targets.length === 0) return;
    setBulkPending(true);
    try {
      for (const a of targets) {
        try {
          await autoAssign.mutateAsync({ orderId: a.orderCode });
        } catch {
          // per-item toast is already surfaced by the mutation; keep the loop going
        }
      }
    } finally {
      setBulkPending(false);
    }
  };

  const bulkDisabled = bulkPending || grouped.new.length === 0;

  return (
    <>
      <PageHeader
        title="Delivery board"
        subtitle="Live dispatch view. Auto-assign uses zone + workload + distance scoring."
      />

      <section className="delivery-toolbar" aria-label="Board controls">
        <div className="delivery-toolbar__group">
          <label className="delivery-toolbar__field" aria-label="Filter by delivery date">
            <Icon name="clock" size={14} />
            <input
              type="date"
              className="form-control form-control-sm delivery-toolbar__date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="dd/mm/yyyy"
            />
          </label>

          <div className="delivery-toolbar__search">
            <span className="delivery-toolbar__search-icon" aria-hidden="true">
              <Icon name="search" size={14} />
            </span>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search by order code or partner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search assignments"
            />
          </div>
        </div>

        <div className="delivery-toolbar__group">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Icon name="refresh" size={14} />
            <span>{isFetching ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <RoleGate allow={DELIVERY_ROLES}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleAutoAssignAll}
              disabled={bulkDisabled}
              title={
                grouped.new.length === 0
                  ? 'Nothing unassigned'
                  : `Auto-assign up to ${AUTO_ASSIGN_ALL_LIMIT} orders`
              }
            >
              {bulkPending
                ? 'Auto-assigning…'
                : `Auto-assign all${grouped.new.length ? ` (${Math.min(grouped.new.length, AUTO_ASSIGN_ALL_LIMIT)})` : ''}`}
            </button>
          </RoleGate>
        </div>
      </section>

      {isError && (
        <ErrorState
          title="Couldn't load the delivery board"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
          className="mb-3"
        />
      )}

      <section className="row g-3 delivery-kpis" aria-label="Today at a glance">
        <div className="col-6 col-lg-3">
          <StatCard label="Total today" value={kpis.total} icon="clipboard" loading={isLoading} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Unassigned" value={kpis.unassigned} icon="alert" loading={isLoading} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="In flight" value={kpis.inflight} icon="truck" loading={isLoading} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Delivered" value={kpis.delivered} icon="star" loading={isLoading} />
        </div>
      </section>

      <section className="delivery-board" aria-label="Dispatch lanes">
        {LANES.map((lane) => {
          const cards = grouped[lane.key];
          return (
            <div className={`delivery-lane delivery-lane--${lane.tone}`} key={lane.key}>
              <header className="delivery-lane__header">
                <div className="delivery-lane__title">
                  <span className={`delivery-lane__dot delivery-lane__dot--${lane.tone}`} />
                  {lane.label}
                </div>
                <span className="delivery-lane__count tabular">{cards.length}</span>
              </header>
              <div className="delivery-lane__body">
                {isLoading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : cards.length === 0 ? (
                  <div className="delivery-lane__empty">Nothing here.</div>
                ) : (
                  cards.map((a) => (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      laneKey={lane.key}
                      onCopy={handleCopy}
                      onAutoAssign={handleAutoAssign}
                      onMarkDelivered={handleMarkDelivered}
                      autoAssignPending={autoAssign.isPending || bulkPending}
                      markPendingCode={markPendingCode}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
