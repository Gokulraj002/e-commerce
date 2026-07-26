/**
 * Presentation helpers for order status — labels, badge tones, cancellability,
 * and progress-stepper positioning. Keeps the pages free of status logic.
 */
import { ORDER_FLOW, ORDER_STATUS, type OrderStatus } from '@elite/shared';
import type { BadgeTone } from '@/components/ui';

/** Statuses a customer may self-cancel — must mirror the backend rule. */
const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
];

/** Human-friendly label per status. */
const STATUS_LABEL: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'Payment pending',
  [ORDER_STATUS.CREATED]: 'Order placed',
  [ORDER_STATUS.CONFIRMED]: 'Confirmed',
  [ORDER_STATUS.PACKING]: 'Packing',
  [ORDER_STATUS.READY]: 'Ready',
  [ORDER_STATUS.ASSIGNED]: 'Assigned',
  [ORDER_STATUS.PICKED_UP]: 'Picked up',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
  [ORDER_STATUS.RETURNED]: 'Returned',
  [ORDER_STATUS.FAILED_DELIVERY]: 'Delivery failed',
};

/**
 * Short customer-facing step captions for the tracking stepper. Only the
 * happy-path statuses appear here; terminal/edge statuses (Cancelled, Returned,
 * FailedDelivery, PendingPayment) render via a separate badge, not the stepper.
 */
const STEP_CAPTION: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.CREATED]: 'Placed',
  [ORDER_STATUS.CONFIRMED]: 'Confirmed',
  [ORDER_STATUS.PACKING]: 'Packing',
  [ORDER_STATUS.READY]: 'Ready',
  [ORDER_STATUS.ASSIGNED]: 'Assigned',
  [ORDER_STATUS.PICKED_UP]: 'Picked up',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'On the way',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
};

const BADGE_TONE: Record<OrderStatus, BadgeTone> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'gold',
  [ORDER_STATUS.CREATED]: 'neutral',
  [ORDER_STATUS.CONFIRMED]: 'neutral',
  [ORDER_STATUS.PACKING]: 'gold',
  [ORDER_STATUS.READY]: 'gold',
  [ORDER_STATUS.ASSIGNED]: 'gold',
  [ORDER_STATUS.PICKED_UP]: 'gold',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'gold',
  [ORDER_STATUS.DELIVERED]: 'fresh',
  [ORDER_STATUS.CANCELLED]: 'crimson',
  [ORDER_STATUS.RETURNED]: 'crimson',
  [ORDER_STATUS.FAILED_DELIVERY]: 'crimson',
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

export function orderStatusTone(status: OrderStatus): BadgeTone {
  return BADGE_TONE[status];
}

export function isCancellable(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(status);
}

export function isTerminated(status: OrderStatus): boolean {
  return (
    status === ORDER_STATUS.CANCELLED ||
    status === ORDER_STATUS.RETURNED ||
    status === ORDER_STATUS.FAILED_DELIVERY
  );
}

export interface TrackStep {
  status: (typeof ORDER_FLOW)[number];
  caption: string;
  /** This step has already been reached. */
  done: boolean;
  /** This step is the current position. */
  current: boolean;
}

/**
 * Build the visual stepper from the happy-path ORDER_FLOW. The current status'
 * index marks how far the order has progressed; later steps are pending.
 */
export function buildTrackSteps(status: OrderStatus): TrackStep[] {
  const currentIndex = ORDER_FLOW.indexOf(status);
  return ORDER_FLOW.map((flowStatus, index) => ({
    status: flowStatus,
    caption: STEP_CAPTION[flowStatus] ?? flowStatus,
    done: currentIndex >= 0 && index <= currentIndex,
    current: index === currentIndex,
  }));
}
