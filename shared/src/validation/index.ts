/**
 * Zod schemas shared by backend (request validation) and frontends (form
 * validation) so rules live in ONE place. Add feature schemas here as modules
 * are built. Keep them framework-agnostic.
 */
import { z } from 'zod';

export const phoneSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number');

export const pincodeSchema = z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode');

export const emailSchema = z.string().email('Enter a valid email');

export const registerSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  phone: phoneSchema,
  email: emailSchema.optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Password is required'),
});

export const addressSchema = z.object({
  label: z.string().min(1).max(30),
  name: z.string().min(2).max(80),
  phone: phoneSchema,
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional(),
  city: z.string().min(2).max(60),
  pincode: pincodeSchema,
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
