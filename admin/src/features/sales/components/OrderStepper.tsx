import { ORDER_FLOW, type OrderStatus } from '@elite/shared';
import { humanizeStatus } from '@/components/ui';

import { flowIndex } from '../orderStatusMachine';

interface OrderStepperProps {
  status: OrderStatus;
}

const circleBase: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 600,
  flexShrink: 0,
};

/**
 * Horizontal progress stepper over the happy-path ORDER_FLOW. Steps up to and
 * including the current status are marked complete; off-path statuses
 * (CANCELLED / RETURNED / FAILED_DELIVERY) show a note above the flow.
 */
export function OrderStepper({ status }: OrderStepperProps) {
  const current = flowIndex(status);
  const offPath = current === -1;

  return (
    <div>
      {offPath && (
        <div className="mb-3">
          <span className="ui-badge ui-badge--danger">{humanizeStatus(status)}</span>
          <span className="text-muted-2 small ms-2">This order has left the standard flow.</span>
        </div>
      )}
      <div className="d-flex align-items-start" style={{ overflowX: 'auto' }}>
        {ORDER_FLOW.map((step, index) => {
          const done = !offPath && index < current;
          const active = !offPath && index === current;
          const circleClass = done
            ? 'bg-success text-white'
            : active
              ? 'bg-primary text-white'
              : 'bg-light text-muted-2 border';
          return (
            <div
              key={step}
              className="d-flex flex-column align-items-center text-center"
              style={{ flex: 1, minWidth: 84 }}
            >
              <div className="d-flex align-items-center w-100">
                <span
                  className="flex-grow-1"
                  style={{
                    height: 2,
                    background: index === 0 ? 'transparent' : done || active ? 'var(--bs-success)' : 'var(--bs-border-color)',
                  }}
                />
                <span className={`rounded-circle ${circleClass}`} style={circleBase}>
                  {done ? '✓' : index + 1}
                </span>
                <span
                  className="flex-grow-1"
                  style={{
                    height: 2,
                    background:
                      index === ORDER_FLOW.length - 1
                        ? 'transparent'
                        : done
                          ? 'var(--bs-success)'
                          : 'var(--bs-border-color)',
                  }}
                />
              </div>
              <span
                className={`small mt-2 ${active ? 'fw-semibold' : 'text-muted-2'}`}
                style={{ lineHeight: 1.2 }}
              >
                {humanizeStatus(step)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
