import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  type DeliveryStatus,
  type OrderStatus,
  type PaymentStatus,
} from '@elite/shared';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ORDER_TONES: Record<OrderStatus, BadgeTone> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 'warning',
  [ORDER_STATUS.CREATED]: 'info',
  [ORDER_STATUS.CONFIRMED]: 'info',
  [ORDER_STATUS.PACKING]: 'info',
  [ORDER_STATUS.READY]: 'info',
  [ORDER_STATUS.ASSIGNED]: 'info',
  [ORDER_STATUS.PICKED_UP]: 'info',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'info',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
  [ORDER_STATUS.RETURNED]: 'danger',
  [ORDER_STATUS.FAILED_DELIVERY]: 'danger',
};

const PAYMENT_TONES: Record<PaymentStatus, BadgeTone> = {
  [PAYMENT_STATUS.PENDING]: 'warning',
  [PAYMENT_STATUS.PAID]: 'success',
  [PAYMENT_STATUS.FAILED]: 'danger',
  [PAYMENT_STATUS.REFUNDED]: 'neutral',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'warning',
};

const DELIVERY_TONES: Record<DeliveryStatus, BadgeTone> = {
  [DELIVERY_STATUS.UNASSIGNED]: 'neutral',
  [DELIVERY_STATUS.ASSIGNED]: 'info',
  [DELIVERY_STATUS.ACCEPTED]: 'info',
  [DELIVERY_STATUS.PICKED_UP]: 'info',
  [DELIVERY_STATUS.OUT_FOR_DELIVERY]: 'info',
  [DELIVERY_STATUS.DELIVERED]: 'success',
  [DELIVERY_STATUS.FAILED]: 'danger',
  [DELIVERY_STATUS.RETURNED_TO_STORE]: 'warning',
};

/** SNAKE_CASE → "Snake Case" for display. */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type StatusBadgeProps =
  | { kind: 'order'; status: OrderStatus }
  | { kind: 'payment'; status: PaymentStatus }
  | { kind: 'delivery'; status: DeliveryStatus }
  | { kind?: undefined; status: string; tone?: BadgeTone };

function resolveTone(props: StatusBadgeProps): BadgeTone {
  switch (props.kind) {
    case 'order':
      return ORDER_TONES[props.status];
    case 'payment':
      return PAYMENT_TONES[props.status];
    case 'delivery':
      return DELIVERY_TONES[props.status];
    default:
      return props.tone ?? 'neutral';
  }
}

/**
 * Colored pill for a domain status. Pass `kind` for automatic color mapping of
 * order/payment/delivery statuses, or use it generically with an explicit tone.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const tone = resolveTone(props);
  return <span className={`ui-badge ui-badge--${tone}`}>{humanizeStatus(props.status)}</span>;
}
