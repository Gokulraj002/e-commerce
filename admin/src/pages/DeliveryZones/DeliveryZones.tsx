import { useState } from 'react';
import { ROLES } from '@elite/shared';

import {
  ConfirmModal,
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TextareaField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  useDeleteZone,
  useSaveZone,
  useZones,
  type DeliveryZoneDTO,
} from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, paiseToRupees, rupeesToPaise } from '@/lib/money';

const DELIVERY_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER];

interface FormState {
  name: string;
  pincodes: string;
  feeRupees: string;
  isActive: boolean;
}

const EMPTY: FormState = { name: '', pincodes: '', feeRupees: '40', isActive: true };

function toForm(z: DeliveryZoneDTO): FormState {
  return {
    name: z.name,
    pincodes: z.pincodes.join(', '),
    feeRupees: String(paiseToRupees(z.feePaise)),
    isActive: z.isActive,
  };
}

export default function DeliveryZones() {
  const { data, isLoading, isError, error, refetch } = useZones();
  const save = useSaveZone();
  const remove = useDeleteZone();

  const [editing, setEditing] = useState<DeliveryZoneDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<DeliveryZoneDTO | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDrawerOpen(true);
  }
  function openEdit(z: DeliveryZoneDTO) {
    setEditing(z);
    setForm(toForm(z));
    setDrawerOpen(true);
  }

  async function onSave() {
    const pincodes = form.pincodes
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    await save.mutateAsync({
      id: editing?.id,
      body: {
        name: form.name.trim(),
        pincodes,
        feePaise: rupeesToPaise(Number(form.feeRupees) || 0),
        isActive: form.isActive,
      },
    });
    setDrawerOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Delivery zones"
        subtitle="Which pincodes we serve, and the base delivery fee for each."
        actions={
          <RoleGate allow={DELIVERY_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ New zone</button>
          </RoleGate>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn't load delivery zones"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading zones…" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon="map"
          title="No delivery zones yet"
          message="Add a zone with pincodes and a base fee so orders can find a matching route."
          action={
            <RoleGate allow={DELIVERY_ROLES}>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                + New zone
              </button>
            </RoleGate>
          }
        />
      ) : (
        <div className="row g-3">
          {(data ?? []).map((z) => (
            <div className="col-12 col-md-6 col-lg-4" key={z.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-semibold">{z.name}</div>
                      <div className="text-muted-2 small">{z.pincodes.length} pincodes · {formatPaise(z.feePaise)}</div>
                    </div>
                    <StatusBadge
                      status={z.isActive ? 'ACTIVE' : 'INACTIVE'}
                      tone={z.isActive ? 'success' : 'neutral'}
                    />
                  </div>
                  <div className="mt-2 small text-muted-2" style={{ maxHeight: 80, overflow: 'hidden' }}>
                    {z.pincodes.join(', ')}
                  </div>
                  <div className="d-flex gap-2 mt-3">
                    <RoleGate allow={DELIVERY_ROLES}>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(z)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(z)}>Delete</button>
                    </RoleGate>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? `Edit ${editing.name}` : 'New zone'}>
        <div className="d-flex flex-column gap-3">
          <TextField label="Zone name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextareaField
            label="Pincodes (comma or space separated)"
            rows={3}
            value={form.pincodes}
            onChange={(e) => setForm({ ...form, pincodes: e.target.value })}
          />
          <TextField
            label="Delivery fee (₹)"
            type="number"
            value={form.feeRupees}
            onChange={(e) => setForm({ ...form, feeRupees: e.target.value })}
          />
          <SelectField
            label="Status"
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button className="btn btn-outline-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave} disabled={save.isPending}>Save</button>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete this zone?"
        message={toDelete ? `“${toDelete.name}” will be removed.` : ''}
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
