/**
 * Canonical enums & constants shared across backend, customer web, and admin.
 * These MUST match the Prisma schema enums. Single source of truth.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  DELIVERY_MANAGER: 'DELIVERY_MANAGER',
  CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Staff roles that may access the admin panel. */
export const STAFF_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.STORE_MANAGER,
  ROLES.INVENTORY_MANAGER,
  ROLES.DELIVERY_MANAGER,
  ROLES.CUSTOMER_SUPPORT,
];

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CREATED: 'CREATED',
  CONFIRMED: 'CONFIRMED',
  PACKING: 'PACKING',
  READY: 'READY',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
  FAILED_DELIVERY: 'FAILED_DELIVERY',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Ordered happy-path lifecycle (for progress bars / validation). */
export const ORDER_FLOW: OrderStatus[] = [
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKING,
  ORDER_STATUS.READY,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const PAYMENT_METHOD = {
  RAZORPAY: 'RAZORPAY',
  PHONEPE: 'PHONEPE',
  CASHFREE: 'CASHFREE',
  COD: 'COD',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const DELIVERY_STATUS = {
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  PICKED_UP: 'PICKED_UP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURNED_TO_STORE: 'RETURNED_TO_STORE',
} as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const STOCK_MOVEMENT_TYPE = {
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  WASTAGE: 'WASTAGE',
  RETURN_IN: 'RETURN_IN',
} as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE)[keyof typeof STOCK_MOVEMENT_TYPE];

/** Products are sold by weight — canonical pack weights in grams. */
export const WEIGHT_PACKS_G = [250, 500, 1000] as const;

export const COUPON_TYPE = {
  PERCENT: 'PERCENT',
  FLAT: 'FLAT',
  FREE_SHIPPING: 'FREE_SHIPPING',
} as const;
export type CouponType = (typeof COUPON_TYPE)[keyof typeof COUPON_TYPE];

export const STORE = {
  NAME: 'Elite NonVeg',
  CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
  FREE_SHIPPING_THRESHOLD: 699,
  CITY: 'Hyderabad',
  SUPPORT_WHATSAPP: '+917989020944',
} as const;

/** All monetary values are stored & transported as integer paise (₹1 = 100). */
export const MONEY = { UNIT_PER_RUPEE: 100 } as const;
