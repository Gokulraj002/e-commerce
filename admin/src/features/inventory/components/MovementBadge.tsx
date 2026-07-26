import { STOCK_MOVEMENT_TYPE, type StockMovementType } from '@elite/shared';

import { StatusBadge, type BadgeTone } from '@/components/ui';

/** Colour mapping for stock-movement types (green = stock in, red = out/loss). */
const MOVEMENT_TONES: Record<StockMovementType, BadgeTone> = {
  [STOCK_MOVEMENT_TYPE.PURCHASE_IN]: 'success',
  [STOCK_MOVEMENT_TYPE.RETURN_IN]: 'info',
  [STOCK_MOVEMENT_TYPE.SALE_OUT]: 'neutral',
  [STOCK_MOVEMENT_TYPE.ADJUSTMENT]: 'warning',
  [STOCK_MOVEMENT_TYPE.WASTAGE]: 'danger',
};

/** Pill for a stock-movement type, coloured by direction/impact. */
export function MovementBadge({ type }: { type: StockMovementType }) {
  return <StatusBadge status={type} tone={MOVEMENT_TONES[type]} />;
}
