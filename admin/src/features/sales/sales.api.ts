import type { OrderDTO, OrderStatus, Paginated, ReviewDTO, UserDTO } from '@elite/shared';

import { api } from '@/lib/apiClient';

import type { AdminCoupon, AdminOrdersQuery, CouponWriteInput, PagedQuery } from './sales.types';

/**
 * Typed API surface for the sales domain. Every call returns an unwrapped
 * payload (the `api` helper strips the `{ success, data }` envelope).
 *
 * Note: the backend exposes no dedicated admin order-detail route, so a single
 * order is resolved through the admin list filtered by its human code.
 */

/** Drop empty/undefined values so they never hit the query string. */
function clean<T extends Record<string, unknown>>(params: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key as keyof T] = value as T[keyof T];
    }
  }
  return out;
}

// ── Orders ──────────────────────────────────────────────────────────
export function fetchAdminOrders(query: AdminOrdersQuery): Promise<Paginated<OrderDTO>> {
  return api.get<Paginated<OrderDTO>>('/orders/admin/all', { params: clean({ ...query }) });
}

/** Resolve one order by its code via the admin list (no by-id detail route). */
export async function fetchAdminOrderByCode(code: string): Promise<OrderDTO | null> {
  const page = await api.get<Paginated<OrderDTO>>('/orders/admin/all', {
    params: { search: code, pageSize: 50 },
  });
  return page.items.find((o) => o.code === code) ?? null;
}

export function updateOrderStatus(
  id: string,
  body: { status: OrderStatus; note?: string },
): Promise<OrderDTO> {
  return api.patch<OrderDTO>(`/orders/${id}/status`, body);
}

// ── Coupons ─────────────────────────────────────────────────────────
export function fetchCoupons(): Promise<AdminCoupon[]> {
  return api.get<AdminCoupon[]>('/coupons');
}

export function createCoupon(body: CouponWriteInput): Promise<AdminCoupon> {
  return api.post<AdminCoupon>('/coupons', body);
}

export function updateCoupon(id: string, body: CouponWriteInput): Promise<AdminCoupon> {
  return api.patch<AdminCoupon>(`/coupons/${id}`, body);
}

export function deleteCoupon(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/coupons/${id}`);
}

// ── Customers ───────────────────────────────────────────────────────
export function fetchCustomers(query: PagedQuery): Promise<Paginated<UserDTO>> {
  return api.get<Paginated<UserDTO>>('/users/customers', { params: clean({ ...query }) });
}

export function fetchCustomer(id: string): Promise<UserDTO> {
  return api.get<UserDTO>(`/users/customers/${id}`);
}

// ── Reviews ─────────────────────────────────────────────────────────
export function fetchPendingReviews(query: PagedQuery): Promise<Paginated<ReviewDTO>> {
  return api.get<Paginated<ReviewDTO>>('/reviews/pending', {
    params: clean({ page: query.page, pageSize: query.pageSize }),
  });
}

export function approveReview(id: string): Promise<ReviewDTO> {
  return api.patch<ReviewDTO>(`/reviews/${id}/approve`);
}

export function deleteReview(id: string): Promise<{ id: string }> {
  return api.delete<{ id: string }>(`/reviews/${id}`);
}
