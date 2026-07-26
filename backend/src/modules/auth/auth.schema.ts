import { z } from 'zod';
import { emailSchema, phoneSchema, registerSchema } from '@elite/shared';

export { registerSchema };

/**
 * Login accepts EITHER phone (customers) OR email (staff), plus a password.
 * The customer web app sends `phone`; the admin panel sends `email`.
 */
export const loginSchema = z
  .object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((d) => Boolean(d.phone) || Boolean(d.email), {
    message: 'Phone or email is required',
    path: ['phone'],
  });

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});
