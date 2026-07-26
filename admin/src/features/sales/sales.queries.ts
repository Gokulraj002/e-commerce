import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderStatus } from '@elite/shared';

import { getApiErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui';

import {
  approveReview,
  createCoupon,
  deleteCoupon,
  deleteReview,
  fetchAdminOrderByCode,
  fetchAdminOrders,
  fetchCoupons,
  fetchCustomer,
  fetchCustomers,
  fetchPendingReviews,
  updateCoupon,
  updateOrderStatus,
} from './sales.api';
import type { AdminOrdersQuery, CouponWriteInput, PagedQuery } from './sales.types';

/** Query key factory — keeps invalidation targeted and typo-proof. */
export const salesKeys = {
  orders: ['sales', 'orders'] as const,
  ordersList: (q: AdminOrdersQuery) => ['sales', 'orders', 'list', q] as const,
  order: (code: string) => ['sales', 'orders', 'detail', code] as const,
  coupons: ['sales', 'coupons'] as const,
  customers: ['sales', 'customers'] as const,
  customersList: (q: PagedQuery) => ['sales', 'customers', 'list', q] as const,
  customer: (id: string) => ['sales', 'customers', 'detail', id] as const,
  reviews: ['sales', 'reviews'] as const,
  reviewsList: (q: PagedQuery) => ['sales', 'reviews', 'pending', q] as const,
};

// ── Orders ──────────────────────────────────────────────────────────
export function useAdminOrders(query: AdminOrdersQuery) {
  return useQuery({
    queryKey: salesKeys.ordersList(query),
    queryFn: () => fetchAdminOrders(query),
  });
}

export function useOrder(code: string | undefined) {
  return useQuery({
    queryKey: salesKeys.order(code ?? ''),
    queryFn: () => fetchAdminOrderByCode(code as string),
    enabled: Boolean(code),
  });
}

interface UpdateStatusVars {
  id: string;
  code: string;
  status: OrderStatus;
  note?: string;
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, status, note }: UpdateStatusVars) =>
      updateOrderStatus(id, { status, note }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: salesKeys.orders });
      qc.invalidateQueries({ queryKey: salesKeys.order(vars.code) });
      toast.success({ title: 'Order status updated' });
    },
    onError: (err) =>
      toast.error({ title: 'Could not update status', message: getApiErrorMessage(err) }),
  });
}

// ── Coupons ─────────────────────────────────────────────────────────
export function useCoupons() {
  return useQuery({ queryKey: salesKeys.coupons, queryFn: fetchCoupons });
}

interface SaveCouponVars {
  id?: string;
  body: CouponWriteInput;
}

export function useSaveCoupon() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: SaveCouponVars) =>
      id ? updateCoupon(id, body) : createCoupon(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: salesKeys.coupons });
      toast.success({ title: vars.id ? 'Coupon updated' : 'Coupon created' });
    },
    onError: (err) =>
      toast.error({ title: 'Could not save coupon', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.coupons });
      toast.success({ title: 'Coupon deleted' });
    },
    onError: (err) =>
      toast.error({ title: 'Could not delete coupon', message: getApiErrorMessage(err) }),
  });
}

// ── Customers ───────────────────────────────────────────────────────
export function useCustomers(query: PagedQuery) {
  return useQuery({
    queryKey: salesKeys.customersList(query),
    queryFn: () => fetchCustomers(query),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: salesKeys.customer(id ?? ''),
    queryFn: () => fetchCustomer(id as string),
    enabled: Boolean(id),
  });
}

// ── Reviews ─────────────────────────────────────────────────────────
export function usePendingReviews(query: PagedQuery) {
  return useQuery({
    queryKey: salesKeys.reviewsList(query),
    queryFn: () => fetchPendingReviews(query),
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => approveReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.reviews });
      toast.success({ title: 'Review approved' });
    },
    onError: (err) =>
      toast.error({ title: 'Could not approve review', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.reviews });
      toast.success({ title: 'Review deleted' });
    },
    onError: (err) =>
      toast.error({ title: 'Could not delete review', message: getApiErrorMessage(err) }),
  });
}
