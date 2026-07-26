import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type ListQuery = z.infer<typeof listQuerySchema>;
