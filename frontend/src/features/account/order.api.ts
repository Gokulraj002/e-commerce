/**
 * Order API calls for the customer account area.
 * The apiClient response interceptor unwraps the `{ success, data }` envelope,
 * so these resolve directly to the DTO payloads.
 */
import type { OrderDTO, Paginated } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

export interface ListMyOrdersParams {
  page?: number;
  pageSize?: number;
}

/** GET /orders — the signed-in customer's own orders, paginated. */
export async function fetchMyOrders(
  params: ListMyOrdersParams = {},
): Promise<Paginated<OrderDTO>> {
  const { data } = await apiClient.get<Paginated<OrderDTO>>('/orders', { params });
  return data;
}

/** GET /orders/:code — a single order by its human-friendly code. */
export async function fetchOrder(code: string): Promise<OrderDTO> {
  const { data } = await apiClient.get<OrderDTO>(`/orders/${code}`);
  return data;
}

/** POST /orders/:code/cancel — self-cancel (allowed only before PACKING). */
export async function cancelOrder(code: string, reason?: string): Promise<OrderDTO> {
  const { data } = await apiClient.post<OrderDTO>(`/orders/${code}/cancel`, { reason });
  return data;
}
