import { z } from 'zod';

/** HTTP methods we ever record via auditMiddleware. */
const actionEnum = z.enum(['POST', 'PUT', 'PATCH', 'DELETE']);

/** GET / — admin audit-log listing filters. */
export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  entity: z.string().trim().min(1).max(80).optional(),
  action: actionEnum.optional(),
  userId: z.string().trim().min(1).max(64).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
