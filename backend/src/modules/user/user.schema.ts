import { addressSchema, emailSchema } from '@elite/shared';
import { z } from 'zod';

/** Address create rules live in @elite/shared. */
export { addressSchema };

/** Partial address for PATCH — every field optional, but at least one required. */
export const addressUpdateSchema = addressSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const updateProfileSchema = z
  .object({
    name: z.string().min(2, 'Name is too short').max(80).optional(),
    email: emailSchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.email !== undefined,
    'Provide a name or email to update',
  );

export const idParamSchema = z.object({
  id: z.string().min(1, 'Invalid id'),
});

export const customersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CustomersQuery = z.infer<typeof customersQuerySchema>;
