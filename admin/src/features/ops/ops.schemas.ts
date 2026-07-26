import { z } from 'zod';

/**
 * Zod form schemas + inferred input types for the ops forms. Money fields are
 * captured in RUPEES (human-friendly) and converted to paise before the API
 * call. Pincodes are entered as a comma/space separated string and split on
 * submit.
 */

const pincodeList = z
  .string()
  .trim()
  .min(1, 'Add at least one pincode')
  .refine(
    (v) =>
      v
        .split(/[\s,]+/)
        .filter(Boolean)
        .every((p) => /^\d{6}$/.test(p)),
    'Each pincode must be 6 digits',
  );

// ── Delivery zone ───────────────────────────────────────────────────
export const zoneFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  pincodes: pincodeList,
  feeRupees: z
    .number({ invalid_type_error: 'Enter a delivery fee' })
    .nonnegative('Fee cannot be negative'),
  isActive: z.boolean(),
});
export type ZoneFormInput = z.infer<typeof zoneFormSchema>;

/** Split a "560001, 560002" style string into a clean pincode array. */
export function parsePincodes(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean))];
}

// ── Generate slots ──────────────────────────────────────────────────
export const generateSlotsFormSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an end date'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
    label: z.string().trim().max(60).optional().or(z.literal('')),
    capacity: z
      .number({ invalid_type_error: 'Enter a capacity' })
      .int('Whole number')
      .min(1, 'Min 1')
      .max(10_000),
    cutoffMinutesBefore: z
      .number({ invalid_type_error: 'Enter minutes' })
      .int('Whole number')
      .min(0)
      .max(1440),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must not precede start date',
    path: ['endDate'],
  });
export type GenerateSlotsFormInput = z.infer<typeof generateSlotsFormSchema>;

// ── CMS page ────────────────────────────────────────────────────────
export const cmsPageFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().trim().min(1, 'Content is required'),
  isPublished: z.boolean(),
});
export type CmsPageFormInput = z.infer<typeof cmsPageFormSchema>;

// ── Banner ──────────────────────────────────────────────────────────
export const bannerFormSchema = z.object({
  title: z.string().trim().max(200).optional().or(z.literal('')),
  imageUrl: z.string().trim().url('Enter a valid image URL'),
  link: z.string().trim().url('Enter a valid link URL').optional().or(z.literal('')),
  position: z.string().trim().min(1, 'Position is required').max(60),
  sortOrder: z.number({ invalid_type_error: 'Enter a number' }).int().min(0),
  isActive: z.boolean(),
});
export type BannerFormInput = z.infer<typeof bannerFormSchema>;
