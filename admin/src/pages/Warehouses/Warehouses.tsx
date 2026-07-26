import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES } from '@elite/shared';

import {
  ConfirmModal,
  Drawer,
  EmptyState,
  FilterChip,
  FormSection,
  Icon,
  PageHeader,
  Spinner,
  StatusBadge,
  TextField,
  TextareaField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  useDeleteWarehouse,
  useSaveWarehouse,
  useWarehouses,
  warehouseFormSchema,
  type WarehouseDTO,
  type WarehouseFormInput,
} from '@/features/inventory';

const INVENTORY_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.STORE_MANAGER,
];

const EMPTY_FORM: WarehouseFormInput = {
  name: '',
  address: '',
  pincode: '',
  isActive: true,
};

type StatusFilter = 'all' | 'active' | 'inactive';

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0));
  return (letters.join('') || '?').toUpperCase();
}

export default function Warehouses() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<WarehouseDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toDelete, setToDelete] = useState<WarehouseDTO | null>(null);

  const { data, isLoading, isFetching } = useWarehouses();
  const save = useSaveWarehouse();
  const remove = useDeleteWarehouse();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WarehouseFormInput>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: EMPTY_FORM,
  });

  // The warehouses endpoint returns a plain array — search + status filters
  // apply client-side over the full list.
  const filtered = useMemo(() => {
    const all = data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter((w) => {
      if (status === 'active' && !w.isActive) return false;
      if (status === 'inactive' && w.isActive) return false;
      if (!term) return true;
      return (
        w.name.toLowerCase().includes(term) ||
        (w.pincode ?? '').toLowerCase().includes(term) ||
        (w.address ?? '').toLowerCase().includes(term)
      );
    });
  }, [data, search, status]);

  const items = data ?? [];
  const activeCount = items.filter((w) => w.isActive).length;
  const inactiveCount = items.length - activeCount;

  function openCreate() {
    setEditing(null);
    reset(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(w: WarehouseDTO) {
    setEditing(w);
    reset({
      name: w.name,
      address: w.address ?? '',
      pincode: w.pincode ?? '',
      isActive: w.isActive,
    });
    setDrawerOpen(true);
  }

  const onSubmit = handleSubmit((values) => {
    const body: Partial<WarehouseDTO> = {
      name: values.name,
      address: values.address ? values.address : null,
      pincode: values.pincode ? values.pincode : null,
      isActive: values.isActive,
    };
    save.mutate({ id: editing?.id, body }, { onSuccess: () => setDrawerOpen(false) });
  });

  return (
    <>
      <PageHeader
        title="Warehouses"
        subtitle="Storage locations for your stock"
        actions={
          <RoleGate allow={INVENTORY_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={16} /> <span className="ms-1">New warehouse</span>
            </button>
          </RoleGate>
        }
      />

      <div className="ui-filter-strip">
        <div className="ui-filter-strip__search">
          <span className="ui-filter-strip__search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Search warehouses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ui-filter-strip__chips">
          <FilterChip
            label={`All (${items.length})`}
            active={status === 'all'}
            onClick={() => setStatus('all')}
          />
          <FilterChip
            label={`Active (${activeCount})`}
            active={status === 'active'}
            onClick={() => setStatus('active')}
          />
          <FilterChip
            label={`Inactive (${inactiveCount})`}
            active={status === 'inactive'}
            onClick={() => setStatus('inactive')}
          />
        </div>
        <span className="ui-filter-strip__spacer" />
        {isFetching && <Spinner size="sm" />}
      </div>

      {isLoading ? (
        <div className="py-5 text-center">
          <Spinner label="Loading warehouses…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="warehouse"
          title={
            search
              ? 'No warehouses match that search'
              : status !== 'all'
                ? `No ${status} warehouses`
                : 'No warehouses yet'
          }
          message={
            search
              ? 'Try a different name, pincode, or address.'
              : 'Add a warehouse so purchases can attribute inventory to a location.'
          }
          action={
            !search && (
              <RoleGate allow={INVENTORY_ROLES}>
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                  <Icon name="plus" size={14} /> <span className="ms-1">New warehouse</span>
                </button>
              </RoleGate>
            )
          }
        />
      ) : (
        <div className="ui-entity-grid">
          {filtered.map((w) => (
            <WarehouseCard
              key={w.id}
              warehouse={w}
              onEdit={() => openEdit(w)}
              onDelete={() => setToDelete(w)}
            />
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit warehouse' : 'New warehouse'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="warehouse-form"
              className="btn btn-primary"
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="warehouse-form" onSubmit={onSubmit}>
          <FormSection title="Identity">
            <TextField
              id="wh-name"
              label="Name"
              required
              error={errors.name}
              {...register('name')}
            />
          </FormSection>
          <FormSection title="Location" description="Where the stock physically sits">
            <TextareaField
              id="wh-address"
              label="Address"
              rows={2}
              error={errors.address}
              {...register('address')}
            />
            <TextField
              id="wh-pincode"
              label="Pincode"
              hint="6-digit pincode"
              error={errors.pincode}
              {...register('pincode')}
            />
          </FormSection>
          <FormSection title="Status" dense>
            <div className="form-check">
              <input
                id="wh-active"
                type="checkbox"
                className="form-check-input"
                {...register('isActive')}
              />
              <label className="form-check-label" htmlFor="wh-active">
                Active — available for new purchases
              </label>
            </div>
          </FormSection>
        </form>
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete warehouse"
        message={
          <>
            Delete <strong>{toDelete?.name}</strong>? This cannot be undone.
          </>
        }
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </>
  );
}

// ── Card ────────────────────────────────────────────────────────────
interface WarehouseCardProps {
  warehouse: WarehouseDTO;
  onEdit: () => void;
  onDelete: () => void;
}

function WarehouseCard({ warehouse, onEdit, onDelete }: WarehouseCardProps) {
  return (
    <div className="ui-entity-card">
      <div className="ui-entity-card__head">
        <div className="d-flex align-items-start gap-2 min-w-0">
          <div className="ui-thumb" aria-hidden="true">
            {initials(warehouse.name)}
          </div>
          <div className="min-w-0">
            <h3 className="ui-entity-card__title">{warehouse.name}</h3>
          </div>
        </div>
        <StatusBadge
          status={warehouse.isActive ? 'ACTIVE' : 'INACTIVE'}
          tone={warehouse.isActive ? 'success' : 'neutral'}
        />
      </div>

      <div className="ui-entity-card__meta">
        <div className="ui-entity-card__row">
          <span className="ui-entity-card__row-icon">
            <Icon name="map" size={14} />
          </span>
          <span className="ui-entity-card__row-text">
            {warehouse.address ?? 'No address on file'}
          </span>
        </div>
        <div className="ui-entity-card__row">
          <span className="ui-entity-card__row-icon">
            <Icon name="tag" size={14} />
          </span>
          <span className="ui-entity-card__row-text">
            Pincode {warehouse.pincode ?? '—'}
          </span>
        </div>
      </div>

      <div className="ui-entity-card__footer">
        <span className="text-truncate">
          {warehouse.isActive ? 'Accepting stock-ins' : 'Paused'}
        </span>
        <RoleGate allow={INVENTORY_ROLES}>
          <div className="ui-entity-card__actions">
            <button type="button" className="btn btn-sm btn-light" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light text-danger"
              onClick={onDelete}
              aria-label={`Delete ${warehouse.name}`}
            >
              Delete
            </button>
          </div>
        </RoleGate>
      </div>
    </div>
  );
}
