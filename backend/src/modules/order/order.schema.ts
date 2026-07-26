import { ORDER_STATUS } from '@elite/shared';
import { z } from 'zod';

const orderStatusEnum = z.enum([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKING,
  ORDER_STATUS.READY,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURNED,
  ORDER_STATUS.FAILED_DELIVERY,
]);

/** GET / — customer's own orders, paginated. */
export const listMyOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /:code — path param. */
export const orderCodeParamSchema = z.object({
  code: z.string().min(3),
});

/** POST /:code/cancel */
export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** GET /admin/all — admin filters. */
export const adminListOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: orderStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(120).optional(),
});

/** PATCH /:id/status — admin status change. */
export const orderIdParamSchema = z.object({
  id: z.string().min(1),
});

export const updateStatusSchema = z.object({
  status: orderStatusEnum,
  note: z.string().max(500).optional(),
});

export type ListMyOrdersInput = z.infer<typeof listMyOrdersSchema>;
export type AdminListOrdersInput = z.infer<typeof adminListOrdersSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
