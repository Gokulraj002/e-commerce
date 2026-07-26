import { STOCK_MOVEMENT_TYPE } from '@elite/shared';
import { z } from 'zod';

// ── Params ─────────────────────────────────────────────────────────
export const idParamSchema = z.object({ id: z.string().min(1) });
export const variantIdParamSchema = z.object({ variantId: z.string().min(1) });

// ── Warehouses ─────────────────────────────────────────────────────
export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit pincode')
    .optional(),
  isActive: z.boolean().optional(),
});
export const warehouseUpdateSchema = warehouseCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

// ── Suppliers ──────────────────────────────────────────────────────
export const supplierCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Enter a valid email').optional(),
  address: z.string().trim().max(240).optional(),
  isActive: z.boolean().optional(),
});
export const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

// ── Lists ──────────────────────────────────────────────────────────
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).optional(),
});

export const stockListQuerySchema = listQuerySchema.extend({
  lowStock: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});

// ── Stock adjustment ───────────────────────────────────────────────
export const adjustStockSchema = z.object({
  deltaG: z
    .number()
    .int('deltaG must be an integer number of grams')
    .refine((v) => v !== 0, 'deltaG must be non-zero'),
  reason: z.string().trim().max(240).optional(),
  // Manual adjustments are either a correction or a wastage write-off.
  type: z
    .enum([STOCK_MOVEMENT_TYPE.ADJUSTMENT, STOCK_MOVEMENT_TYPE.WASTAGE])
    .default(STOCK_MOVEMENT_TYPE.ADJUSTMENT),
});

// ── Purchases (stock-in) ───────────────────────────────────────────
export const purchaseItemSchema = z.object({
  variantId: z.string().min(1),
  quantityG: z.number().int().positive('quantityG must be a positive integer'),
  costPaise: z.number().int().nonnegative('costPaise must be a non-negative integer'),
});
export const purchaseCreateSchema = z.object({
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  note: z.string().trim().max(240).optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one purchase item is required'),
});

// ── Movements ledger ───────────────────────────────────────────────
export const movementQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  variantId: z.string().min(1).optional(),
  type: z.nativeEnum(STOCK_MOVEMENT_TYPE).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ── Reports ────────────────────────────────────────────────────────
export const rangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
