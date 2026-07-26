import type { CouponType, OrderStatus } from '@elite/shared';

/**
 * Admin-facing sales types that are richer than the customer-safe DTOs in
 * `@elite/shared`. The coupon admin endpoints return the full persisted entity
 * (usage counters, limits, timestamps) rather than the trimmed `CouponDTO`, so
 * we model that shape here. JSON serialises Prisma `DateTime` columns as ISO
 * strings, hence the `string` date fields.
 */
export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  valuePaise: number | null;
  percent: number | null;
  maxDiscountPaise: number | null;
  minCartPaise: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

/** Request body accepted by POST /coupons and PATCH /coupons/:id. */
export interface CouponWriteInput {
  code: string;
  type: CouponType;
  valuePaise: number | null;
  percent: number | null;
  maxDiscountPaise: number | null;
  minCartPaise: number;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  description: string | null;
}

/** Filters for GET /orders/admin/all (server-side; no sort support). */
export interface AdminOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/** Paginated customer / review list query. */
export interface PagedQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}
