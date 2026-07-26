import type { StockMovementType } from '@elite/shared';

/**
 * Provenance for a stock movement. Callers from other modules (orders,
 * returns) pass this so every StockMovement row is traceable.
 */
export interface StockRef {
  refType?: string; // ORDER / PURCHASE / MANUAL / RETURN
  refId?: string;
  createdBy?: string;
}

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
  unitCostPaisePerKg: number; // derived from latest purchase
  valuePaise: number; // round(availableG/1000 * unitCostPaisePerKg)
}

export interface ValuationReportDTO {
  rows: ValuationRowDTO[];
  totalValuePaise: number;
}

export interface WastageRowDTO {
  variantId: string;
  sku: string | null;
  productName: string | null;
  wastageG: number; // positive magnitude
}

export interface WastageReportDTO {
  from: string;
  to: string;
  totalWastageG: number;
  rows: WastageRowDTO[];
}
