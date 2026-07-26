import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { ROLES } from '@elite/shared';

import {
  DataTable,
  DEFAULT_TABLE_QUERY,
  Drawer,
  EmptyState,
  FormSection,
  Icon,
  PageHeader,
  SelectField,
  StatTile,
  TextField,
  TextareaField,
  type DataTableQuery,
} from '@/components/ui';
import { formatPaise, formatWeight, rupeesToPaise } from '@/lib/money';
import { RoleGate } from '@/features/auth';
import {
  purchaseFormSchema,
  useCreatePurchase,
  usePurchase,
  usePurchases,
  useStock,
  useSuppliers,
  useWarehouses,
  type PurchaseDTO,
  type PurchaseFormInput,
} from '@/features/inventory';

const INVENTORY_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.STORE_MANAGER,
];

const BLANK_ITEM = { variantId: '', quantityG: 0, costRupees: 0 };

/** Client-side aggregation range used for the "this month" KPI tiles. */
function startOfCurrentMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function Purchases() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = usePurchases({
    page: query.page,
    pageSize: query.pageSize,
  });

  // Wider fetch dedicated to the KPI tiles. Small businesses typically post
  // <200 purchases per month; larger deployments should swap this for a real
  // aggregation endpoint.
  const { data: kpiData, isLoading: kpiLoading } = usePurchases({ page: 1, pageSize: 200 });

  // Reference data for name lookups + form pickers.
  const { data: suppliers } = useSuppliers({ page: 1, pageSize: 100 });
  const { data: warehouses } = useWarehouses();
  const { data: stock } = useStock({ page: 1, pageSize: 100 });

  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    suppliers?.items.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [suppliers]);

  const warehouseName = useMemo(() => {
    const m = new Map<string, string>();
    warehouses?.forEach((w) => m.set(w.id, w.name));
    return m;
  }, [warehouses]);

  const variantLabel = useMemo(() => {
    const m = new Map<string, string>();
    stock?.items.forEach((r) =>
      m.set(r.variantId, `${r.productName} — ${formatWeight(r.weightG)} (${r.sku})`),
    );
    return m;
  }, [stock]);

  // ── KPI tiles ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const monthStart = startOfCurrentMonth();
    const items = kpiData?.items ?? [];
    const thisMonth = items.filter((p) => new Date(p.createdAt) >= monthStart);

    const spendPaise = thisMonth.reduce((sum, p) => sum + (p.totalPaise ?? 0), 0);

    // Top supplier by paise this month.
    const supplierTotals = new Map<string, number>();
    for (const p of thisMonth) {
      supplierTotals.set(p.supplierId, (supplierTotals.get(p.supplierId) ?? 0) + p.totalPaise);
    }
    let topSupplierId: string | null = null;
    let topSupplierPaise = 0;
    for (const [id, total] of supplierTotals.entries()) {
      if (total > topSupplierPaise) {
        topSupplierId = id;
        topSupplierPaise = total;
      }
    }

    return {
      count: thisMonth.length,
      spendPaise,
      topSupplierId,
      topSupplierPaise,
    };
  }, [kpiData]);

  const columns = useMemo<ColumnDef<PurchaseDTO>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        enableHiding: false,
        cell: ({ row }) => <span className="fw-semibold tabular">{row.original.code}</span>,
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => supplierName.get(row.original.supplierId) ?? row.original.supplierId,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) => (
          <span className="text-muted-2">
            {warehouseName.get(row.original.warehouseId) ?? row.original.warehouseId}
          </span>
        ),
      },
      {
        id: 'items',
        header: 'Lines',
        cell: ({ row }) => <span className="tabular">{row.original.items.length}</span>,
      },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <span className="fw-medium tabular">{formatPaise(row.original.totalPaise)}</span>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-muted-2 small">
            {new Date(row.original.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
    ],
    [supplierName, warehouseName],
  );

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Stock-in entries from suppliers"
        actions={
          <RoleGate allow={INVENTORY_ROLES}>
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              <Icon name="plus" size={16} /> <span className="ms-1">New purchase</span>
            </button>
          </RoleGate>
        }
      />

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <StatTile
            label="Spend this month"
            value={formatPaise(kpis.spendPaise)}
            icon="chart"
            tone="brand"
            caption={`${kpis.count} purchase${kpis.count === 1 ? '' : 's'}`}
            loading={kpiLoading}
          />
        </div>
        <div className="col-12 col-md-4">
          <StatTile
            label="Purchases this month"
            value={kpis.count.toLocaleString('en-IN')}
            icon="clipboard"
            tone="info"
            caption="Stock-in entries recorded"
            loading={kpiLoading}
          />
        </div>
        <div className="col-12 col-md-4">
          <StatTile
            label="Top supplier"
            value={
              kpis.topSupplierId
                ? supplierName.get(kpis.topSupplierId) ?? kpis.topSupplierId
                : '—'
            }
            icon="suppliers"
            tone="success"
            caption={
              kpis.topSupplierId
                ? `${formatPaise(kpis.topSupplierPaise)} this month`
                : 'No purchases yet'
            }
            loading={kpiLoading}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        loading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search purchases…"
        zebra
        stickyHeader
        densityToggle
        columnMenu
        tableId="admin-purchases"
        getRowId={(row) => row.id}
        emptyMessage={
          <EmptyState
            icon="clipboard"
            title="No purchases yet"
            message="Record your first stock-in entry to see it here."
            action={
              <RoleGate allow={INVENTORY_ROLES}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setFormOpen(true)}
                >
                  <Icon name="plus" size={14} /> <span className="ms-1">New purchase</span>
                </button>
              </RoleGate>
            }
            compact
          />
        }
        onRowClick={(row) => setDetailId(row.id)}
      />

      <PurchaseFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supplierOptions={suppliers?.items ?? []}
        warehouseOptions={warehouses ?? []}
        variantOptions={stock?.items ?? []}
      />

      <PurchaseDetailDrawer
        id={detailId}
        onClose={() => setDetailId(null)}
        supplierName={supplierName}
        warehouseName={warehouseName}
        variantLabel={variantLabel}
      />
    </>
  );
}

// ── New purchase form ──────────────────────────────────────────────
interface FormDrawerProps {
  open: boolean;
  onClose: () => void;
  supplierOptions: { id: string; name: string }[];
  warehouseOptions: { id: string; name: string }[];
  variantOptions: { variantId: string; productName: string; sku: string; weightG: number }[];
}

function PurchaseFormDrawer({
  open,
  onClose,
  supplierOptions,
  warehouseOptions,
  variantOptions,
}: FormDrawerProps) {
  const create = useCreatePurchase();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: { supplierId: '', warehouseId: '', note: '', items: [BLANK_ITEM] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const totalPaise = (items ?? []).reduce(
    (sum, it) => sum + rupeesToPaise(Number(it?.costRupees) || 0),
    0,
  );

  const submit = handleSubmit((values) => {
    create.mutate(
      {
        supplierId: values.supplierId,
        warehouseId: values.warehouseId,
        note: values.note ? values.note : undefined,
        items: values.items.map((it) => ({
          variantId: it.variantId,
          quantityG: it.quantityG,
          costPaise: rupeesToPaise(it.costRupees),
        })),
      },
      {
        onSuccess: () => {
          reset({ supplierId: '', warehouseId: '', note: '', items: [BLANK_ITEM] });
          onClose();
        },
      },
    );
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New purchase"
      footer={
        <div className="d-flex align-items-center justify-content-between gap-2">
          <span className="text-muted-2">
            Total: <strong className="text-body tabular">{formatPaise(totalPaise)}</strong>
          </span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="purchase-form"
              className="btn btn-primary"
              disabled={create.isPending}
            >
              {create.isPending ? 'Saving…' : 'Record purchase'}
            </button>
          </div>
        </div>
      }
    >
      <form id="purchase-form" onSubmit={submit}>
        <FormSection title="Source" description="Where the stock came from and where it lands">
          <SelectField
            id="pur-supplier"
            label="Supplier"
            required
            error={errors.supplierId}
            {...register('supplierId')}
          >
            <option value="">Select supplier…</option>
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="pur-warehouse"
            label="Warehouse"
            required
            error={errors.warehouseId}
            {...register('warehouseId')}
          >
            <option value="">Select warehouse…</option>
            {warehouseOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </SelectField>
        </FormSection>

        <FormSection
          title={`Line items (${fields.length})`}
          description="Grams received and total line cost in rupees"
          action={
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => append(BLANK_ITEM)}
            >
              <Icon name="plus" size={14} /> <span className="ms-1">Add line</span>
            </button>
          }
        >
          {typeof errors.items?.message === 'string' && (
            <div className="ui-field__error mb-2">{errors.items.message}</div>
          )}

          <div className="d-flex flex-column gap-2">
            {fields.map((field, i) => (
              <div key={field.id} className="card">
                <div className="card-body d-flex flex-column gap-2">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="text-muted-2 small">Line {i + 1}</span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-light text-danger"
                        onClick={() => remove(i)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <SelectField
                    id={`pur-variant-${i}`}
                    label="Product variant"
                    error={errors.items?.[i]?.variantId}
                    {...register(`items.${i}.variantId` as const)}
                  >
                    <option value="">Select variant…</option>
                    {variantOptions.map((v) => (
                      <option key={v.variantId} value={v.variantId}>
                        {v.productName} — {formatWeight(v.weightG)} ({v.sku})
                      </option>
                    ))}
                  </SelectField>
                  <div className="row g-2">
                    <div className="col-6">
                      <TextField
                        id={`pur-qty-${i}`}
                        label="Quantity (grams)"
                        type="number"
                        error={errors.items?.[i]?.quantityG}
                        {...register(`items.${i}.quantityG` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="col-6">
                      <TextField
                        id={`pur-cost-${i}`}
                        label="Line cost (₹)"
                        type="number"
                        step="0.01"
                        error={errors.items?.[i]?.costRupees}
                        {...register(`items.${i}.costRupees` as const, { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title="Note" description="Optional — invoice reference, batch info, etc." dense>
          <TextareaField
            id="pur-note"
            label=""
            rows={2}
            error={errors.note}
            {...register('note')}
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Purchase detail ────────────────────────────────────────────────
interface DetailDrawerProps {
  id: string | null;
  onClose: () => void;
  supplierName: Map<string, string>;
  warehouseName: Map<string, string>;
  variantLabel: Map<string, string>;
}

function PurchaseDetailDrawer({
  id,
  onClose,
  supplierName,
  warehouseName,
  variantLabel,
}: DetailDrawerProps) {
  const { data: purchase, isLoading } = usePurchase(id);

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={purchase ? purchase.code : 'Purchase'}>
      {isLoading && <p className="text-muted-2">Loading…</p>}
      {purchase && (
        <>
          <FormSection title="Summary" dense>
            <div className="ui-detail-grid">
              <div>
                <div className="ui-detail-grid__label">Supplier</div>
                <div className="ui-detail-grid__value">
                  {supplierName.get(purchase.supplierId) ?? purchase.supplierId}
                </div>
              </div>
              <div>
                <div className="ui-detail-grid__label">Warehouse</div>
                <div className="ui-detail-grid__value">
                  {warehouseName.get(purchase.warehouseId) ?? purchase.warehouseId}
                </div>
              </div>
              <div>
                <div className="ui-detail-grid__label">Date</div>
                <div className="ui-detail-grid__value">
                  {new Date(purchase.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="ui-detail-grid__label">Total</div>
                <div className="ui-detail-grid__value fw-medium tabular">
                  {formatPaise(purchase.totalPaise)}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title={`Items (${purchase.items.length})`}>
            <table className="ui-table table mb-0">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Qty</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((it) => (
                  <tr key={it.id}>
                    <td>{variantLabel.get(it.variantId) ?? it.variantId}</td>
                    <td className="tabular">{formatWeight(it.quantityG)}</td>
                    <td className="tabular">{formatPaise(it.costPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FormSection>

          {purchase.note && (
            <FormSection title="Note" dense>
              <div className="text-body-secondary">{purchase.note}</div>
            </FormSection>
          )}
        </>
      )}
    </Drawer>
  );
}
