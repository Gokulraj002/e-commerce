import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { STOCK_MOVEMENT_TYPE, type StockMovementType } from '@elite/shared';

import {
  DataTable,
  DEFAULT_TABLE_QUERY,
  Drawer,
  EmptyState,
  FilterChip,
  FormSection,
  Icon,
  PageHeader,
  SelectField,
  StatTile,
  StatusBadge,
  TextField,
  TextareaField,
  useToast,
  type DataTableBulkAction,
  type DataTableQuery,
} from '@/components/ui';
import { formatPaise, formatWeight } from '@/lib/money';
import {
  adjustStockFormSchema,
  MovementBadge,
  useAdjustStock,
  useMovements,
  useStock,
  useValuation,
  useWarehouses,
  type AdjustStockFormInput,
  type StockMovementDTO,
  type StockRowDTO,
} from '@/features/inventory';

/**
 * Live inventory position. Premium refresh: StatTile row, filter strip with
 * chips + warehouse selector, opt-in DataTable (sticky/zebra/density/columns/
 * selection with bulk-adjust), and a collapsible recent-movements side panel.
 * All weights in grams; money in paise.
 */

/** Product initials for the .ui-thumb chip. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0));
  return (letters.join('') || '?').toUpperCase();
}

function formatMovementTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InventoryStock() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [lowOnly, setLowOnly] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [adjusting, setAdjusting] = useState<StockRowDTO | null>(null);
  const [bulkRows, setBulkRows] = useState<StockRowDTO[] | null>(null);
  const [showMovements, setShowMovements] = useState(false);

  const stockParams = useMemo(
    () => ({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search?.trim() || undefined,
      lowStock: lowOnly || undefined,
    }),
    [query.page, query.pageSize, query.search, lowOnly],
  );
  const { data, isLoading, isFetching } = useStock(stockParams);

  // Light aggregate queries for the stat tiles.
  const { data: valuation, isLoading: valLoading } = useValuation();
  const { data: lowStock, isLoading: lowLoading } = useStock({
    page: 1,
    pageSize: 1,
    lowStock: true,
  });

  const { data: warehouses } = useWarehouses();

  const adjust = useAdjustStock();

  // Recent movements (short list) — always fetch small page for the side panel.
  const { data: recentMovements } = useMovements({ page: 1, pageSize: 8 });

  // Client-side warehouse filter is applied over the currently fetched page
  // (backend doesn't accept warehouseId in the list params). Small business
  // deployments run 1–2 warehouses, so this is honest UX rather than a rewrite.
  const rows: StockRowDTO[] = useMemo(() => {
    const all = data?.items ?? [];
    if (!warehouseFilter) return all;
    return all.filter((r) => r.warehouseId === warehouseFilter);
  }, [data, warehouseFilter]);

  const totalOnHandKg = useMemo(() => {
    const rowsAll = valuation?.rows ?? [];
    const grams = rowsAll.reduce((sum, r) => sum + (r.availableG ?? 0), 0);
    return grams / 1000;
  }, [valuation]);

  const columns = useMemo<ColumnDef<StockRowDTO>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="d-flex align-items-center gap-2 min-w-0">
            <div className="ui-thumb" aria-hidden="true">
              {initials(row.original.productName)}
            </div>
            <div className="min-w-0">
              <div className="fw-medium text-truncate">{row.original.productName}</div>
              <div className="text-muted-2 small text-truncate">{row.original.sku}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'pack',
        header: 'Pack',
        cell: ({ row }) => (
          <span className="tabular">{formatWeight(row.original.weightG)}</span>
        ),
      },
      {
        id: 'stockG',
        header: 'On hand',
        cell: ({ row }) => <span className="tabular">{formatWeight(row.original.stockG)}</span>,
      },
      {
        id: 'reservedG',
        header: 'Reserved',
        cell: ({ row }) => (
          <span className="text-muted-2 tabular">{formatWeight(row.original.reservedG)}</span>
        ),
      },
      {
        id: 'availableG',
        header: 'Available',
        cell: ({ row }) => (
          <div className="d-flex align-items-center gap-2">
            <span className="fw-medium tabular">{formatWeight(row.original.availableG)}</span>
            {row.original.lowStock && <StatusBadge status="LOW_STOCK" tone="danger" />}
          </div>
        ),
      },
      {
        id: 'reorderLevelG',
        header: 'Reorder at',
        cell: ({ row }) => (
          <span className="text-muted-2 tabular">{formatWeight(row.original.reorderLevelG)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => setAdjusting(row.original)}
            >
              Adjust
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const bulkActions: DataTableBulkAction<StockRowDTO>[] = useMemo(
    () => [
      {
        key: 'bulk-adjust',
        label: 'Adjust selected',
        tone: 'primary',
        icon: 'sliders',
        onRun: (selected) => setBulkRows(selected),
      },
    ],
    [],
  );

  const hasWarehouseFilter = (warehouses?.length ?? 0) > 1;

  return (
    <>
      <PageHeader title="Stock levels" subtitle="Live inventory position — all weights in kg/g" />

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatTile
            label="Tracked SKUs"
            value={(valuation?.rows.length ?? 0).toLocaleString('en-IN')}
            icon="box"
            tone="brand"
            loading={valLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatTile
            label="Low-stock SKUs"
            value={(lowStock?.total ?? 0).toLocaleString('en-IN')}
            icon="alert"
            tone="danger"
            caption="At or below reorder level"
            loading={lowLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatTile
            label="On hand"
            value={`${totalOnHandKg.toFixed(1)} kg`}
            icon="warehouse"
            tone="info"
            caption="Sum of available weight"
            loading={valLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatTile
            label="Stock valuation"
            value={formatPaise(valuation?.totalValuePaise ?? 0)}
            icon="chart"
            tone="success"
            caption="At latest purchase cost"
            loading={valLoading}
          />
        </div>
      </div>

      {/* Filters strip lives above the table so search/quick chips sit close to
          the primary "Adjust in bulk" action. DataTable's own toolbar is hidden. */}
      <div className="ui-filter-strip">
        <div className="ui-filter-strip__search">
          <span className="ui-filter-strip__search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Search product or SKU…"
            value={query.search ?? ''}
            onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))}
          />
        </div>
        <div className="ui-filter-strip__chips">
          <FilterChip
            label="Low stock only"
            icon="alert"
            active={lowOnly}
            onClick={() => {
              setLowOnly((v) => !v);
              setQuery((q) => ({ ...q, page: 1 }));
            }}
            onClear={lowOnly ? () => setLowOnly(false) : undefined}
          />
        </div>
        {hasWarehouseFilter && (
          <>
            <span className="ui-filter-strip__sep" aria-hidden="true" />
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              aria-label="Filter by warehouse"
            >
              <option value="">All warehouses</option>
              {(warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="ui-filter-strip__spacer" />
        <button
          type="button"
          className="btn btn-sm btn-light"
          onClick={() => setShowMovements((v) => !v)}
          aria-pressed={showMovements}
        >
          <Icon name="clock" size={14} />
          <span className="ms-1">{showMovements ? 'Hide movements' : 'Recent movements'}</span>
        </button>
      </div>

      <div className={`ui-stock-layout ${showMovements ? 'has-side' : ''}`}>
        <div>
          <DataTable
            columns={columns}
            data={rows}
            total={warehouseFilter ? rows.length : data?.total ?? 0}
            query={query}
            onQueryChange={setQuery}
            loading={isLoading}
            isFetching={isFetching}
            hideSearch
            zebra
            stickyHeader
            densityToggle
            columnMenu
            selectable
            bulkActions={bulkActions}
            tableId="admin-stock"
            getRowId={(row) => row.variantId}
            emptyMessage={
              <EmptyState
                icon="warehouse"
                title={query.search || lowOnly ? 'No stock matches these filters' : 'No stock records'}
                message={
                  query.search || lowOnly
                    ? 'Try clearing filters or searching a different SKU.'
                    : 'Record a purchase to start tracking stock.'
                }
                compact
              />
            }
          />
        </div>

        {showMovements && (
          <RecentMovementsPanel
            movements={recentMovements?.items ?? []}
            onOpenLedger={() => {
              /* future — could route to a dedicated ledger view */
            }}
          />
        )}
      </div>

      <AdjustDrawer
        row={adjusting}
        onClose={() => setAdjusting(null)}
        pending={adjust.isPending}
        onSubmit={(variantId, body) =>
          adjust.mutate({ variantId, body }, { onSuccess: () => setAdjusting(null) })
        }
      />

      <BulkAdjustDrawer
        rows={bulkRows}
        onClose={() => setBulkRows(null)}
      />
    </>
  );
}

// ── Recent movements side panel ─────────────────────────────────────
interface RecentMovementsPanelProps {
  movements: StockMovementDTO[];
  onOpenLedger: () => void;
}

function RecentMovementsPanel({ movements }: RecentMovementsPanelProps) {
  return (
    <aside className="ui-side-panel" aria-label="Recent stock movements">
      <div className="ui-side-panel__head">
        <h3 className="ui-side-panel__title">Recent movements</h3>
        <span className="text-muted-2 small">Last {movements.length || 8}</span>
      </div>
      {movements.length === 0 ? (
        <div className="ui-side-panel__empty">No movements recorded.</div>
      ) : (
        <ul className="ui-side-panel__list list-unstyled mb-0">
          {movements.map((m) => (
            <li key={m.id} className="ui-side-panel__row">
              <div className="flex-grow-1 min-w-0">
                <div className="ui-side-panel__row-name text-truncate">
                  {m.productName ?? m.sku ?? m.variantId}
                </div>
                <div className="ui-side-panel__row-meta">
                  <MovementBadge type={m.type} />
                  <span className="ms-1">{formatMovementTime(m.createdAt)}</span>
                </div>
              </div>
              <span
                className={`ui-side-panel__qty ${m.quantityG >= 0 ? 'is-up' : 'is-down'}`}
              >
                {m.quantityG >= 0 ? '+' : '−'}
                {formatWeight(Math.abs(m.quantityG))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// ── Adjust stock drawer (single variant) ───────────────────────────
interface AdjustDrawerProps {
  row: StockRowDTO | null;
  onClose: () => void;
  pending: boolean;
  onSubmit: (
    variantId: string,
    body: { deltaG: number; reason?: string; type: StockMovementType },
  ) => void;
}

function AdjustDrawer({ row, onClose, pending, onSubmit }: AdjustDrawerProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustStockFormInput>({
    resolver: zodResolver(adjustStockFormSchema),
    defaultValues: { deltaG: 0, type: STOCK_MOVEMENT_TYPE.ADJUSTMENT, reason: '' },
  });

  // Reset the form whenever a new row is opened.
  const rowId = row?.variantId ?? null;
  useEffect(() => {
    reset({ deltaG: 0, type: STOCK_MOVEMENT_TYPE.ADJUSTMENT, reason: '' });
  }, [rowId, reset]);

  const submit = handleSubmit((values) => {
    if (!row) return;
    onSubmit(row.variantId, {
      deltaG: values.deltaG,
      type: values.type,
      reason: values.reason ? values.reason : undefined,
    });
  });

  return (
    <Drawer
      open={Boolean(row)}
      onClose={onClose}
      title="Adjust stock"
      footer={
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="adjust-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      }
    >
      {row && (
        <form id="adjust-form" onSubmit={submit}>
          <FormSection title="Product" dense>
            <div className="d-flex align-items-center gap-2">
              <div className="ui-thumb" aria-hidden="true">
                {initials(row.productName)}
              </div>
              <div className="min-w-0">
                <div className="fw-medium">{row.productName}</div>
                <div className="text-muted-2 small">
                  {row.sku} · on hand {formatWeight(row.stockG)} · available{' '}
                  {formatWeight(row.availableG)}
                </div>
              </div>
            </div>
          </FormSection>
          <FormSection title="Adjustment">
            <TextField
              id="adj-delta"
              label="Change (grams)"
              type="number"
              required
              hint="Positive to add, negative to remove (e.g. -500 for 500 g wastage)"
              error={errors.deltaG}
              {...register('deltaG', { valueAsNumber: true })}
            />
            <SelectField id="adj-type" label="Type" error={errors.type} {...register('type')}>
              <option value={STOCK_MOVEMENT_TYPE.ADJUSTMENT}>Adjustment (correction)</option>
              <option value={STOCK_MOVEMENT_TYPE.WASTAGE}>Wastage (write-off)</option>
            </SelectField>
            <TextareaField
              id="adj-reason"
              label="Reason"
              rows={2}
              error={errors.reason}
              {...register('reason')}
            />
          </FormSection>
        </form>
      )}
    </Drawer>
  );
}

// ── Bulk adjust drawer (many variants, shared reason/type) ─────────
interface BulkAdjustDrawerProps {
  rows: StockRowDTO[] | null;
  onClose: () => void;
}

function BulkAdjustDrawer({ rows, onClose }: BulkAdjustDrawerProps) {
  const adjust = useAdjustStock();
  const toast = useToast();

  const [type, setType] = useState<StockMovementType>(STOCK_MOVEMENT_TYPE.ADJUSTMENT);
  const [reason, setReason] = useState('');
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset local edit state each time a new selection opens.
  useEffect(() => {
    if (rows) {
      setType(STOCK_MOVEMENT_TYPE.ADJUSTMENT);
      setReason('');
      const initial: Record<string, number> = {};
      for (const r of rows) initial[r.variantId] = 0;
      setDeltas(initial);
    }
  }, [rows]);

  const list = rows ?? [];
  const nonZero = list.filter((r) => (deltas[r.variantId] ?? 0) !== 0);
  const canSubmit = nonZero.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Fire adjustments in parallel — the queries hook invalidates + toasts
      // per success, so use mutateAsync here to sequence a single completion.
      await Promise.allSettled(
        nonZero.map((r) =>
          adjust.mutateAsync({
            variantId: r.variantId,
            body: {
              deltaG: deltas[r.variantId],
              type,
              reason: reason ? reason : undefined,
            },
          }),
        ),
      );
      toast.info({
        title: 'Bulk adjustment queued',
        message: `${nonZero.length} variant${nonZero.length === 1 ? '' : 's'} updated`,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={Boolean(rows)}
      onClose={onClose}
      title={`Adjust ${list.length} variant${list.length === 1 ? '' : 's'}`}
      footer={
        <div className="d-flex align-items-center justify-content-between gap-2">
          <span className="text-muted-2 small">
            {nonZero.length} of {list.length} will change
          </span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? 'Applying…' : 'Apply to selected'}
            </button>
          </div>
        </div>
      }
    >
      {list.length === 0 ? (
        <EmptyState
          icon="sliders"
          title="No rows selected"
          message="Pick one or more stock rows from the table, then reopen this drawer."
        />
      ) : (
        <>
          <FormSection title="Shared" description="Applied to every variant with a non-zero change">
            <SelectField
              id="bulk-type"
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as StockMovementType)}
            >
              <option value={STOCK_MOVEMENT_TYPE.ADJUSTMENT}>Adjustment (correction)</option>
              <option value={STOCK_MOVEMENT_TYPE.WASTAGE}>Wastage (write-off)</option>
            </SelectField>
            <TextareaField
              id="bulk-reason"
              label="Reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormSection>
          <FormSection title={`Per-variant change (${list.length})`}>
            <div className="ui-bulk-list">
              {list.map((r) => {
                const value = deltas[r.variantId] ?? 0;
                return (
                  <div key={r.variantId} className="ui-bulk-list__row">
                    <div className="ui-bulk-list__row-head">
                      <div className="d-flex align-items-center gap-2 min-w-0">
                        <div className="ui-thumb" aria-hidden="true">
                          {initials(r.productName)}
                        </div>
                        <div className="min-w-0">
                          <div className="ui-bulk-list__row-name text-truncate">
                            {r.productName}
                          </div>
                          <div className="ui-bulk-list__row-meta">
                            {r.sku} · available {formatWeight(r.availableG)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ui-bulk-list__row-input">
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() =>
                          setDeltas((prev) => ({
                            ...prev,
                            [r.variantId]: (prev[r.variantId] ?? 0) - 100,
                          }))
                        }
                        aria-label="Decrease 100 g"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={value}
                        step={100}
                        onChange={(e) =>
                          setDeltas((prev) => ({
                            ...prev,
                            [r.variantId]: Number(e.target.value) || 0,
                          }))
                        }
                        aria-label={`Change in grams for ${r.productName}`}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() =>
                          setDeltas((prev) => ({
                            ...prev,
                            [r.variantId]: (prev[r.variantId] ?? 0) + 100,
                          }))
                        }
                        aria-label="Increase 100 g"
                      >
                        +
                      </button>
                      <span className="text-muted-2 small ms-1">g</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>
        </>
      )}
    </Drawer>
  );
}
