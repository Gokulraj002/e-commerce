import { z } from 'zod';

/**
 * Admin staff sign in with email + password (customers use phone OTP on the
 * storefront). Kept local to the admin app since the shared `loginSchema` is
 * the phone-based customer flow.
 */
export const staffLoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
