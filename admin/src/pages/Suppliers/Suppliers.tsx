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
  supplierFormSchema,
  useDeleteSupplier,
  useSaveSupplier,
  useSuppliers,
  type SupplierDTO,
  type SupplierFormInput,
} from '@/features/inventory';

const INVENTORY_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INVENTORY_MANAGER,
  ROLES.STORE_MANAGER,
];

const EMPTY_FORM: SupplierFormInput = {
  name: '',
  phone: '',
  email: '',
  address: '',
  isActive: true,
};

type StatusFilter = 'all' | 'active' | 'inactive';

/** Two-letter initials for the supplier avatar chip. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0));
  return (letters.join('') || '?').toUpperCase();
}

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SupplierDTO | null>(null);

  // Suppliers list — grid view fetches a wider page since cards are cheap.
  const { data, isLoading, isFetching } = useSuppliers({
    page: 1,
    pageSize: 100,
    search: search.trim() || undefined,
  });
  const save = useSaveSupplier();
  const remove = useDeleteSupplier();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: EMPTY_FORM,
  });

  function openCreate() {
    setEditing(null);
    reset(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(s: SupplierDTO) {
    setEditing(s);
    reset({
      name: s.name,
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      isActive: s.isActive,
    });
    setDrawerOpen(true);
  }

  const onSubmit = handleSubmit((values) => {
    const body: Partial<SupplierDTO> = {
      name: values.name,
      phone: values.phone ? values.phone : null,
      email: values.email ? values.email : null,
      address: values.address ? values.address : null,
      isActive: values.isActive,
    };
    save.mutate({ id: editing?.id, body }, { onSuccess: () => setDrawerOpen(false) });
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    if (status === 'all') return items;
    return items.filter((s) => (status === 'active' ? s.isActive : !s.isActive));
  }, [items, status]);

  const activeCount = items.filter((s) => s.isActive).length;
  const inactiveCount = items.length - activeCount;

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Vendors you buy fresh stock from"
        actions={
          <RoleGate allow={INVENTORY_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={16} /> <span className="ms-1">New supplier</span>
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
            placeholder="Search suppliers…"
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
          <Spinner label="Loading suppliers…" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="suppliers"
          title={
            search
              ? 'No suppliers match that search'
              : status !== 'all'
                ? `No ${status} suppliers`
                : 'No suppliers yet'
          }
          message={
            search
              ? 'Try a different name.'
              : 'Add your first supplier so purchases can attribute back to them.'
          }
          action={
            !search && (
              <RoleGate allow={INVENTORY_ROLES}>
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                  <Icon name="plus" size={14} /> <span className="ms-1">New supplier</span>
                </button>
              </RoleGate>
            )
          }
        />
      ) : (
        <div className="ui-entity-grid">
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={() => openEdit(s)}
              onDelete={() => setToDelete(s)}
            />
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit supplier' : 'New supplier'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="supplier-form"
              className="btn btn-primary"
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={onSubmit}>
          <FormSection title="Identity">
            <TextField
              id="sup-name"
              label="Name"
              required
              error={errors.name}
              {...register('name')}
            />
          </FormSection>
          <FormSection title="Contact" description="Optional — used for POs and reminders">
            <TextField id="sup-phone" label="Phone" error={errors.phone} {...register('phone')} />
            <TextField
              id="sup-email"
              label="Email"
              type="email"
              error={errors.email}
              {...register('email')}
            />
            <TextareaField
              id="sup-address"
              label="Address"
              rows={2}
              error={errors.address}
              {...register('address')}
            />
          </FormSection>
          <FormSection title="Status" dense>
            <div className="form-check">
              <input
                id="sup-active"
                type="checkbox"
                className="form-check-input"
                {...register('isActive')}
              />
              <label className="form-check-label" htmlFor="sup-active">
                Active — available for new purchases
              </label>
            </div>
          </FormSection>
        </form>
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete supplier"
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
interface SupplierCardProps {
  supplier: SupplierDTO;
  onEdit: () => void;
  onDelete: () => void;
}

function SupplierCard({ supplier, onEdit, onDelete }: SupplierCardProps) {
  return (
    <div className="ui-entity-card">
      <div className="ui-entity-card__head">
        <div className="d-flex align-items-start gap-2 min-w-0">
          <div className="ui-thumb" aria-hidden="true">
            {initials(supplier.name)}
          </div>
          <div className="min-w-0">
            <h3 className="ui-entity-card__title">{supplier.name}</h3>
          </div>
        </div>
        <StatusBadge
          status={supplier.isActive ? 'ACTIVE' : 'INACTIVE'}
          tone={supplier.isActive ? 'success' : 'neutral'}
        />
      </div>

      <div className="ui-entity-card__meta">
        <div className="ui-entity-card__row">
          <span className="ui-entity-card__row-icon">
            <Icon name="clock" size={14} />
          </span>
          <span className="ui-entity-card__row-text">{supplier.phone ?? 'No phone on file'}</span>
        </div>
        <div className="ui-entity-card__row">
          <span className="ui-entity-card__row-icon">
            <Icon name="file" size={14} />
          </span>
          <span className="ui-entity-card__row-text">{supplier.email ?? 'No email on file'}</span>
        </div>
        <div className="ui-entity-card__row">
          <span className="ui-entity-card__row-icon">
            <Icon name="map" size={14} />
          </span>
          <span className="ui-entity-card__row-text">
            {supplier.address ?? 'No address on file'}
          </span>
        </div>
      </div>

      <div className="ui-entity-card__footer">
        <span className="text-truncate">{supplier.isActive ? 'Ready for POs' : 'Paused'}</span>
        <RoleGate allow={INVENTORY_ROLES}>
          <div className="ui-entity-card__actions">
            <button type="button" className="btn btn-sm btn-light" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light text-danger"
              onClick={onDelete}
              aria-label={`Delete ${supplier.name}`}
            >
              Delete
            </button>
          </div>
        </RoleGate>
      </div>
    </div>
  );
}
