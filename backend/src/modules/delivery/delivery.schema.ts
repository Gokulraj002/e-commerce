/**
 * Zod request schemas for the delivery module. Validated by the `validate`
 * middleware against 'body' | 'query' | 'params'.
 */
import { DELIVERY_STATUS } from '@elite/shared';
import { z } from 'zod';

const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'pincode must be 6 digits');

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const time = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, 'time must be HH:MM');

// ── Public ──────────────────────────────────────────────────────────

export const serviceabilityQuerySchema = z.object({ pincode });

export const slotsQuerySchema = z.object({
  date: dateOnly,
  pincode: pincode.optional(),
});

// ── Zones (admin) ───────────────────────────────────────────────────

export const idParamsSchema = z.object({ id: z.string().min(1) });

export const createZoneSchema = z.object({
  name: z.string().trim().min(1),
  pincodes: z.array(pincode).min(1),
  feePaise: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateZoneSchema = z
  .object({
    name: z.string().trim().min(1),
    pincodes: z.array(pincode).min(1),
    feePaise: z.number().int().min(0),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'no fields to update');

// ── Slots (admin) ───────────────────────────────────────────────────

const slotWindowSchema = z.object({
  label: z.string().trim().min(1).optional(),
  startTime: time,
  endTime: time,
  capacity: z.number().int().min(1).max(10_000).optional(),
  cutoffMinutesBefore: z.number().int().min(0).max(1440).optional(),
});

/** Generate one slot per (date in range) × (window). */
export const generateSlotsSchema = z.object({
  zoneId: z.string().min(1).optional(),
  startDate: dateOnly,
  endDate: dateOnly,
  windows: z.array(slotWindowSchema).min(1),
});

export const updateSlotSchema = z
  .object({
    label: z.string().trim().min(1),
    capacity: z.number().int().min(1).max(10_000),
    cutoffAt: z.string().datetime(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'no fields to update');

// ── Assignments (dispatch) ──────────────────────────────────────────

export const assignmentsQuerySchema = z.object({
  status: z.nativeEnum(DELIVERY_STATUS).optional(),
  date: dateOnly.optional(),
});

export const orderIdParamsSchema = z.object({ orderId: z.string().min(1) });

export const manualAssignSchema = z.object({ partnerId: z.string().min(1) });

export const autoAssignSchema = z
  .object({ express: z.boolean().default(false) })
  .default({ express: false });

// ── Partner app ─────────────────────────────────────────────────────

export const verifyOtpSchema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/, 'otp must be 4 digits'),
});

export const failDeliverySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
