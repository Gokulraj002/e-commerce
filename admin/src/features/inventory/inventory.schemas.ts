import { STOCK_MOVEMENT_TYPE } from '@elite/shared';
import { z } from 'zod';

/**
 * Zod schemas + inferred input types for the inventory forms. Money fields are
 * captured in RUPEES here (nice for humans) and converted to paise before POST.
 * Weight fields are grams (Int).
 */

// ── Supplier ───────────────────────────────────────────────────────
export const supplierFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  isActive: z.boolean(),
});
export type SupplierFormInput = z.infer<typeof supplierFormSchema>;

// ── Warehouse ──────────────────────────────────────────────────────
export const warehouseFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit pincode')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean(),
});
export type WarehouseFormInput = z.infer<typeof warehouseFormSchema>;

// ── Stock adjustment ───────────────────────────────────────────────
export const adjustStockFormSchema = z.object({
  // Signed grams; +N to add, -N to remove. Non-zero integer.
  deltaG: z
    .number({ invalid_type_error: 'Enter a number of grams' })
    .int('Grams must be a whole number')
    .refine((v) => v !== 0, 'Enter a non-zero amount'),
  type: z.enum([STOCK_MOVEMENT_TYPE.ADJUSTMENT, STOCK_MOVEMENT_TYPE.WASTAGE]),
  reason: z.string().trim().max(240).optional().or(z.literal('')),
});
export type AdjustStockFormInput = z.infer<typeof adjustStockFormSchema>;

// ── Purchase (stock-in) ────────────────────────────────────────────
export const purchaseItemFormSchema = z.object({
  variantId: z.string().min(1, 'Pick a product variant'),
  quantityG: z
    .number({ invalid_type_error: 'Enter grams' })
    .int('Grams must be a whole number')
    .positive('Quantity must be positive'),
  // Captured in rupees; converted to paise on submit.
  costRupees: z
    .number({ invalid_type_error: 'Enter a cost' })
    .nonnegative('Cost cannot be negative'),
});
export type PurchaseItemFormInput = z.infer<typeof purchaseItemFormSchema>;

export const purchaseFormSchema = z.object({
  supplierId: z.string().min(1, 'Pick a supplier'),
  warehouseId: z.string().min(1, 'Pick a warehouse'),
  note: z.string().trim().max(240).optional().or(z.literal('')),
  items: z.array(purchaseItemFormSchema).min(1, 'Add at least one line item'),
});
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;
