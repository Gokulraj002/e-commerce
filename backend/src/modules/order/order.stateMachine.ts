import { ORDER_STATUS, type OrderStatus } from '@elite/shared';

/**
 * Order lifecycle state machine.
 *
 * The happy path mirrors `ORDER_FLOW` from '@elite/shared'
 * (CREATED → CONFIRMED → … → DELIVERED). On top of that linear flow we allow a
 * set of "edge" transitions that leave the happy path: CANCELLED, RETURNED and
 * FAILED_DELIVERY. This map is the single source of truth for which status
 * changes are legal — services MUST guard every status write with
 * `canTransition()` and never mutate `Order.status` directly.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  // Online orders start here; move to CREATED once payment is initialised/authorised.
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CREATED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CREATED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PACKING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.OUT_FOR_DELIVERY],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FAILED_DELIVERY],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURNED],
  // A failed delivery can be re-attempted, cancelled, or returned to store.
  [ORDER_STATUS.FAILED_DELIVERY]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.RETURNED,
  ],
  // Terminal states.
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.RETURNED]: [],
};

/** Statuses from which a customer may still self-cancel (before fulfilment starts). */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
];

/** Terminal statuses that can never transition further. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURNED,
];

/** Guard: is moving `from` → `to` a legal transition? Identity moves are rejected. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Returns the list of statuses reachable from `from` (for UI / validation). */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
