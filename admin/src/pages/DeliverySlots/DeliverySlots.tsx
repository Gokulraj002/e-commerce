import { useState } from 'react';
import { ROLES } from '@elite/shared';

import {
  EmptyState,
  ErrorState,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import { useGenerateSlots, useSlots, useUpdateSlot, useZones } from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';

const DELIVERY_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DeliverySlots() {
  const [date, setDate] = useState(todayISO());
  const [pincode, setPincode] = useState('');
  const { data: zones } = useZones();
  const { data, isLoading, isError, error, refetch } = useSlots({ date, pincode: pincode || undefined });
  const gen = useGenerateSlots();
  const update = useUpdateSlot();

  // simple slot-generator inputs
  const [genStart, setGenStart] = useState(todayISO());
  const [genEnd, setGenEnd] = useState(todayISO());
  const [zoneId, setZoneId] = useState('');
  const [capacity, setCapacity] = useState('50');
  const windows = [
    { label: 'Morning', startTime: '07:00', endTime: '09:00' },
    { label: 'Afternoon', startTime: '13:00', endTime: '15:00' },
    { label: 'Evening', startTime: '18:00', endTime: '20:00' },
  ];

  async function runGenerate() {
    await gen.mutateAsync({
      zoneId: zoneId || undefined,
      startDate: genStart,
      endDate: genEnd,
      windows: windows.map((w) => ({ ...w, capacity: Number(capacity) || 50 })),
    });
    refetch();
  }

  return (
    <>
      <PageHeader
        title="Delivery slots"
        subtitle="Time windows customers can choose at checkout. Pincode filters to zones."
      />

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-3">
              <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-12 col-md-3">
              <TextField label="Pincode (optional)" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <RoleGate allow={DELIVERY_ROLES}>
        <div className="card mb-3">
          <div className="card-header fw-semibold">Generate slots</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <TextField label="From" type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <TextField label="To" type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <SelectField label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                  <option value="">All zones</option>
                  {(zones ?? []).map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </SelectField>
              </div>
              <div className="col-6 col-md-2">
                <TextField label="Capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div className="col-12 col-md-1 d-grid">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runGenerate}
                  disabled={gen.isPending}
                  aria-label="Generate slots for the selected range"
                >
                  {gen.isPending ? <Spinner size="sm" /> : 'Run'}
                </button>
              </div>
            </div>
            <div className="text-muted-2 small mt-2">
              Creates 3 windows per day: 7–9 AM, 1–3 PM, 6–8 PM.
            </div>
          </div>
        </div>
      </RoleGate>

      <div className="card">
        <div className="card-header fw-semibold">Slots for {date}</div>
        {isError ? (
          <div className="p-3">
            <ErrorState
              title="Couldn't load slots"
              message={getApiErrorMessage(error)}
              onRetry={() => refetch()}
              className="mb-0"
            />
          </div>
        ) : isLoading ? (
          <div className="d-flex justify-content-center py-4">
            <Spinner label="Loading slots…" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            icon="clock"
            title="No slots for this date"
            message="Use the generator above to create standard delivery windows."
            compact
          />
        ) : (
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Window</th>
                  <th>Cut-off</th>
                  <th>Booked / Capacity</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td>{s.startTime} – {s.endTime}</td>
                    <td>{new Date(s.cutoffAt).toLocaleString()}</td>
                    <td>—</td>
                    <td>
                      <StatusBadge
                        status={s.available ? 'AVAILABLE' : 'FULL'}
                        tone={s.available ? 'success' : 'warning'}
                      />
                    </td>
                    <td className="text-end">
                      <RoleGate allow={DELIVERY_ROLES}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => update.mutate({ id: s.id, body: { isActive: !s.available } })}
                          disabled={update.isPending}
                          aria-label={`${s.available ? 'Disable' : 'Enable'} the ${s.label} slot`}
                        >
                          {s.available ? 'Disable' : 'Enable'}
                        </button>
                      </RoleGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
