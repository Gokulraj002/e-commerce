import { ORDER_FLOW, type OrderStatus } from '@elite/shared';
import { humanizeStatus } from '@/components/ui';

import { flowIndex } from '../orderStatusMachine';
import { formatDateTime } from '../format';

interface OrderStatusTimelineProps {
  status: OrderStatus;
  placedAt: string;
}

/**
 * Vertical status timeline. The API does not expose a per-status history log,
 * so the timeline is reconstructed from the happy-path flow up to the current
 * status; the placement time anchors the first step.
 */
export function OrderStatusTimeline({ status, placedAt }: OrderStatusTimelineProps) {
  const current = flowIndex(status);
  const offPath = current === -1;

  const reached: OrderStatus[] = offPath
    ? [...ORDER_FLOW.slice(0, 1), status]
    : ORDER_FLOW.slice(0, current + 1);

  return (
    <ul className="list-unstyled mb-0">
      {reached.map((step, index) => {
        const isLast = index === reached.length - 1;
        return (
          <li key={step} className="d-flex gap-3">
            <div className="d-flex flex-column align-items-center">
              <span
                className={`rounded-circle ${isLast ? 'bg-primary' : 'bg-success'}`}
                style={{ width: 12, height: 12, marginTop: 4, flexShrink: 0 }}
              />
              {!isLast && (
                <span style={{ width: 2, flexGrow: 1, background: 'var(--bs-border-color)' }} />
              )}
            </div>
            <div className={isLast ? 'pb-1' : 'pb-3'}>
              <div className="fw-semibold">{humanizeStatus(step)}</div>
              <div className="small text-muted-2">
                {index === 0 ? formatDateTime(placedAt) : 'Timestamp not recorded'}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
