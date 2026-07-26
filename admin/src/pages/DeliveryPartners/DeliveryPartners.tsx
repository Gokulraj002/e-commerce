import { useMemo } from 'react';

import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { useAssignments } from '@/features/ops';
import type { PartnerRow } from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';

/**
 * There is no admin "list partners" endpoint — partner rows are derived from
 * the assignment board (group by partner name, count active load and outcomes).
 */
function derivePartners(rows: { partnerName: string | null; status: string }[]): PartnerRow[] {
  const map = new Map<string, PartnerRow>();
  for (const a of rows) {
    const name = a.partnerName ?? 'Unassigned pool';
    const row = map.get(name) ?? {
      name,
      total: 0,
      activeLoad: 0,
      delivered: 0,
      failed: 0,
      available: true,
    };
    row.total += 1;
    if (['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(a.status)) {
      row.activeLoad += 1;
    }
    if (a.status === 'DELIVERED') row.delivered += 1;
    if (a.status === 'FAILED' || a.status === 'RETURNED_TO_STORE') row.failed += 1;
    row.available = row.activeLoad === 0;
    map.set(name, row);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function DeliveryPartners() {
  const { data, isLoading, isError, error, refetch } = useAssignments({});
  const rows = useMemo(() => derivePartners(data ?? []), [data]);

  return (
    <>
      <PageHeader
        title="Delivery partners"
        subtitle="Derived from the assignment board. Live workload and outcomes."
      />
      {isError && (
        <ErrorState
          title="Couldn't load partner activity"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}
      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading partners…" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="truck"
          title="No partner activity yet"
          message="Assign an order to a delivery partner from the board to see them here."
        />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Active load</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                  <th>Total</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.name}>
                    <td className="fw-semibold">{p.name}</td>
                    <td>{p.activeLoad}</td>
                    <td>{p.delivered}</td>
                    <td>{p.failed}</td>
                    <td>{p.total}</td>
                    <td>
                      <StatusBadge
                        status={p.available ? 'AVAILABLE' : 'BUSY'}
                        tone={p.available ? 'success' : 'warning'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
