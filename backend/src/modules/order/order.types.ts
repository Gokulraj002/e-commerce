import { Prisma } from '@prisma/client';

/**
 * Canonical include used whenever we need to map an Order → OrderDTO.
 * Keeps every read (checkout, order list, order detail, status change) shaped
 * identically so the mapper never hits an undefined relation.
 */
export const orderInclude = {
  items: true,
  address: true,
  slot: true,
} satisfies Prisma.OrderInclude;

/** An Order row with the relations required by `toOrderDTO`. */
export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Filters accepted by the admin order listing. */
export interface AdminOrderFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}
