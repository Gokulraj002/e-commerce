import { ORDER_FLOW, ORDER_STATUS, type OrderStatus } from '@elite/shared';

/**
 * Frontend mirror of the backend order state machine
 * (`backend/src/modules/order/order.stateMachine.ts`). Kept in sync so the
 * admin only ever offers status changes the API will accept. The backend
 * remains the source of truth and re-validates every transition.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CREATED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CREATED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PACKING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.OUT_FOR_DELIVERY],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED_DELIVERY],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURNED],
  [ORDER_STATUS.FAILED_DELIVERY]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.RETURNED]: [],
};

/** Statuses reachable from `from` — drives the OrderDetail status control. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

/** Is this status part of the linear happy-path flow (for the stepper)? */
export function isInFlow(status: OrderStatus): boolean {
  return ORDER_FLOW.includes(status);
}

/** Zero-based position in ORDER_FLOW, or -1 for off-path statuses. */
export function flowIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status);
}
