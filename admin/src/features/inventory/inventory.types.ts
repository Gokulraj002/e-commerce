import type { StockMovementType } from '@elite/shared';

/**
 * Client-side mirror of the backend inventory DTOs
 * (`backend/src/modules/inventory/inventory.types.ts`). These are not exported
 * from `@elite/shared`, so we redeclare the client-safe shapes here. All weights
 * are grams (Int), all money is integer paise.
 */

export interface WarehouseDTO {
  id: string;
  name: string;
  address: string | null;
  pincode: string | null;
  isActive: boolean;
}

export interface SupplierDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

/** A single variant's stock position (all weights in grams). */
export interface StockRowDTO {
  variantId: string;
  sku: string;
  productName: string;
  weightG: number;
  warehouseId: string;
  stockG: number;
  reservedG: number;
  availableG: number; // stockG - reservedG
  reorderLevelG: number;
  lowStock: boolean; // availableG <= reorderLevelG
}

export interface PurchaseItemDTO {
  id: string;
  variantId: string;
  quantityG: number;
  costPaise: number;
}

export interface PurchaseDTO {
  id: string;
  code: string;
  supplierId: string;
  warehouseId: string;
  totalPaise: number;
  note: string | null;
  createdAt: string;
  items: PurchaseItemDTO[];
}

export interface StockMovementDTO {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  warehouseId: string;
  type: StockMovementType;
  quantityG: number; // signed: +in / -out
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ValuationRowDTO {
  variantId: string;
  sku: string;
  productName: string;
  availableG: number;
  unitCostPaisePerKg: number;
  valuePaise: number;
}

export interface ValuationReportDTO {
  rows: ValuationRowDTO[];
  totalValuePaise: number;
}

/** Payload for a manual stock adjustment (grams delta). */
export interface AdjustStockPayload {
  deltaG: number;
  reason?: string;
  type: StockMovementType;
}

/** Payload for a stock-in purchase. */
export interface PurchasePayload {
  supplierId: string;
  warehouseId: string;
  note?: string;
  items: { variantId: string; quantityG: number; costPaise: number }[];
}

/** Query params for the stock levels list. */
export interface StockListParams {
  page: number;
  pageSize: number;
  search?: string;
  lowStock?: boolean;
}

/** Query params for the movements ledger. */
export interface MovementListParams {
  page: number;
  pageSize: number;
  variantId?: string;
  type?: StockMovementType;
}
