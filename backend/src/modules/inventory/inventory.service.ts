import type { PurchaseItem, StockMovement, Supplier, Warehouse } from '@prisma/client';
import { STOCK_MOVEMENT_TYPE } from '@elite/shared';
import type { StockMovementType } from '@elite/shared';

import { ApiError } from '../../utils/ApiError.js';
import * as repo from './inventory.repository.js';
import type { InventoryWithVariant, PurchaseWithItems } from './inventory.repository.js';
import type {
  PurchaseDTO,
  StockMovementDTO,
  StockRef,
  StockRowDTO,
  SupplierDTO,
  ValuationReportDTO,
  ValuationRowDTO,
  WarehouseDTO,
  WastageReportDTO,
  WastageRowDTO,
} from './inventory.types.js';

// ═══════════════════════════════════════════════════════════════════
// Mappers (Prisma entity → client-safe DTO)
// ═══════════════════════════════════════════════════════════════════
function toWarehouseDTO(w: Warehouse): WarehouseDTO {
  return {
    id: w.id,
    name: w.name,
    address: w.address,
    pincode: w.pincode,
    isActive: w.isActive,
  };
}

function toSupplierDTO(s: Supplier): SupplierDTO {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    isActive: s.isActive,
  };
}

function toStockRowDTO(inv: InventoryWithVariant): StockRowDTO {
  const availableG = inv.stockG - inv.reservedG;
  return {
    variantId: inv.variantId,
    sku: inv.variant.sku,
    productName: inv.variant.product.name,
    weightG: inv.variant.weightG,
    warehouseId: inv.warehouseId,
    stockG: inv.stockG,
    reservedG: inv.reservedG,
    availableG,
    reorderLevelG: inv.reorderLevelG,
    lowStock: availableG <= inv.reorderLevelG,
  };
}

function toPurchaseDTO(p: PurchaseWithItems): PurchaseDTO {
  return {
    id: p.id,
    code: p.code,
    supplierId: p.supplierId,
    warehouseId: p.warehouseId,
    totalPaise: p.totalPaise,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    items: p.items.map((it: PurchaseItem) => ({
      id: it.id,
      variantId: it.variantId,
      quantityG: it.quantityG,
      costPaise: it.costPaise,
    })),
  };
}

function toMovementDTO(
  m: StockMovement,
  variant?: { sku: string; productName: string },
): StockMovementDTO {
  return {
    id: m.id,
    variantId: m.variantId,
    sku: variant?.sku ?? null,
    productName: variant?.productName ?? null,
    warehouseId: m.warehouseId,
    type: m.type as StockMovementType,
    quantityG: m.quantityG,
    reason: m.reason,
    refType: m.refType,
    refId: m.refId,
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Build a variantId → {sku, productName} lookup for a set of ids. */
async function variantLookup(
  variantIds: string[],
): Promise<Map<string, { sku: string; productName: string }>> {
  const map = new Map<string, { sku: string; productName: string }>();
  if (variantIds.length === 0) return map;
  const variants = await repo.findVariantsWithProductByIds([...new Set(variantIds)]);
  for (const v of variants) {
    map.set(v.id, { sku: v.sku, productName: v.product.name });
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════
// Reusable stock primitives (called by this module AND other modules)
// ═══════════════════════════════════════════════════════════════════

/**
 * Apply a signed gram delta to a variant's stock and record a
 * StockMovement. The single source of truth for every stock mutation.
 * Throws if the variant has no inventory row or the change would drive
 * stock below zero.
 */
export async function adjustStock(
  variantId: string,
  deltaG: number,
  type: StockMovementType,
  reason?: string,
  ref?: StockRef,
): Promise<StockRowDTO> {
  const inv = await repo.findInventoryByVariant(variantId);
  if (!inv) throw ApiError.notFound('No inventory record for this variant');
  if (inv.stockG + deltaG < 0) {
    throw ApiError.badRequest('Adjustment would drive stock below zero');
  }
  await repo.applyStockChange({
    variantId,
    warehouseId: inv.warehouseId,
    deltaG,
    type,
    reason,
    ref,
  });
  return getStockRow(variantId);
}

/** Available (sellable) grams for a variant = stockG - reservedG. */
export async function getAvailableG(variantId: string): Promise<number> {
  const inv = await repo.findInventoryByVariant(variantId);
  if (!inv) throw ApiError.notFound('No inventory record for this variant');
  return inv.stockG - inv.reservedG;
}

/**
 * Restock a variant from a customer return / RTO. Writes a RETURN_IN
 * movement and increments stock. `quantityG` must be positive.
 */
export async function restockFromReturn(
  variantId: string,
  quantityG: number,
  reason?: string,
  ref?: StockRef,
): Promise<StockRowDTO> {
  if (quantityG <= 0) throw ApiError.badRequest('Return quantity must be positive');
  return adjustStock(
    variantId,
    quantityG,
    STOCK_MOVEMENT_TYPE.RETURN_IN,
    reason ?? 'Customer return restock',
    { refType: 'RETURN', ...ref },
  );
}

async function getStockRow(variantId: string): Promise<StockRowDTO> {
  const rows = await repo.listInventoryWithVariant();
  const row = rows.find((r) => r.variantId === variantId);
  if (!row) throw ApiError.notFound('No inventory record for this variant');
  return toStockRowDTO(row);
}

// ═══════════════════════════════════════════════════════════════════
// Warehouses
// ═══════════════════════════════════════════════════════════════════
export async function createWarehouse(input: {
  name: string;
  address?: string;
  pincode?: string;
  isActive?: boolean;
}): Promise<WarehouseDTO> {
  const w = await repo.createWarehouse({
    name: input.name,
    address: input.address ?? null,
    pincode: input.pincode ?? null,
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  });
  return toWarehouseDTO(w);
}

export async function listWarehouses(): Promise<WarehouseDTO[]> {
  const items = await repo.listWarehouses();
  return items.map(toWarehouseDTO);
}

export async function getWarehouse(id: string): Promise<WarehouseDTO> {
  const w = await repo.findWarehouseById(id);
  if (!w) throw ApiError.notFound('Warehouse not found');
  return toWarehouseDTO(w);
}

export async function updateWarehouse(
  id: string,
  input: Partial<{ name: string; address: string; pincode: string; isActive: boolean }>,
): Promise<WarehouseDTO> {
  await getWarehouse(id);
  const w = await repo.updateWarehouse(id, input);
  return toWarehouseDTO(w);
}

export async function deleteWarehouse(id: string): Promise<{ id: string }> {
  await getWarehouse(id);
  await repo.deleteWarehouse(id);
  return { id };
}

// ═══════════════════════════════════════════════════════════════════
// Suppliers
// ═══════════════════════════════════════════════════════════════════
export async function createSupplier(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}): Promise<SupplierDTO> {
  const s = await repo.createSupplier({
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  });
  return toSupplierDTO(s);
}

export async function listSuppliers(params: {
  search?: string;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}) {
  const { items, total } = await repo.listSuppliers({
    search: params.search,
    skip: params.skip,
    take: params.take,
  });
  return {
    items: items.map(toSupplierDTO),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getSupplier(id: string): Promise<SupplierDTO> {
  const s = await repo.findSupplierById(id);
  if (!s) throw ApiError.notFound('Supplier not found');
  return toSupplierDTO(s);
}

export async function updateSupplier(
  id: string,
  input: Partial<{
    name: string;
    phone: string;
    email: string;
    address: string;
    isActive: boolean;
  }>,
): Promise<SupplierDTO> {
  await getSupplier(id);
  const s = await repo.updateSupplier(id, input);
  return toSupplierDTO(s);
}

export async function deleteSupplier(id: string): Promise<{ id: string }> {
  await getSupplier(id);
  await repo.deleteSupplier(id);
  return { id };
}

// ═══════════════════════════════════════════════════════════════════
// Stock levels
// ═══════════════════════════════════════════════════════════════════
export async function listStock(params: {
  search?: string;
  lowStock?: boolean;
  page: number;
  pageSize: number;
}) {
  const all = await repo.listInventoryWithVariant(params.search);
  let rows = all.map(toStockRowDTO);
  if (params.lowStock) rows = rows.filter((r) => r.lowStock);

  const total = rows.length;
  const start = (params.page - 1) * params.pageSize;
  const items = rows.slice(start, start + params.pageSize);
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Manual adjustment endpoint: ADJUSTMENT (correction) or WASTAGE. */
export async function adjustStockManual(
  variantId: string,
  input: { deltaG: number; reason?: string; type: StockMovementType },
  createdBy?: string,
): Promise<StockRowDTO> {
  return adjustStock(variantId, input.deltaG, input.type, input.reason, {
    refType: 'MANUAL',
    createdBy,
  });
}

export async function listLowStock() {
  const all = await repo.listInventoryWithVariant();
  return all.map(toStockRowDTO).filter((r) => r.lowStock);
}

// ═══════════════════════════════════════════════════════════════════
// Purchases (stock-in)
// ═══════════════════════════════════════════════════════════════════
function generatePurchaseCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PUR-${stamp}-${rand}`;
}

export async function createPurchase(
  input: {
    supplierId: string;
    warehouseId: string;
    note?: string;
    items: { variantId: string; quantityG: number; costPaise: number }[];
  },
  createdBy?: string,
): Promise<PurchaseDTO> {
  const supplier = await repo.findSupplierById(input.supplierId);
  if (!supplier) throw ApiError.notFound('Supplier not found');
  const warehouse = await repo.findWarehouseById(input.warehouseId);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  const variantIds = input.items.map((i) => i.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw ApiError.badRequest('Duplicate variant in purchase items');
  }
  const variants = await repo.findVariantsByIds(variantIds);
  if (variants.length !== variantIds.length) {
    throw ApiError.badRequest('One or more variants do not exist');
  }

  const totalPaise = input.items.reduce((sum, i) => sum + i.costPaise, 0);
  const purchase = await repo.createPurchaseWithItems({
    code: generatePurchaseCode(),
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    note: input.note,
    totalPaise,
    items: input.items,
    createdBy,
  });
  return toPurchaseDTO(purchase);
}

export async function listPurchases(params: {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}) {
  const { items, total } = await repo.listPurchases({
    skip: params.skip,
    take: params.take,
  });
  return {
    items: items.map(toPurchaseDTO),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getPurchase(id: string): Promise<PurchaseDTO> {
  const p = await repo.findPurchaseById(id);
  if (!p) throw ApiError.notFound('Purchase not found');
  return toPurchaseDTO(p);
}

// ═══════════════════════════════════════════════════════════════════
// Movements ledger
// ═══════════════════════════════════════════════════════════════════
export async function listMovements(params: {
  variantId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}) {
  const { items, total } = await repo.listMovements({
    variantId: params.variantId,
    type: params.type,
    from: params.from,
    to: params.to,
    skip: params.skip,
    take: params.take,
  });
  const lookup = await variantLookup(items.map((m) => m.variantId));
  return {
    items: items.map((m) => toMovementDTO(m, lookup.get(m.variantId))),
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Reports
// ═══════════════════════════════════════════════════════════════════

/**
 * Stock valuation. Per variant: value = availableG/1000 * latest per-kg
 * cost. The per-kg cost is derived from that variant's most recent
 * purchase line (costPaise is the line total for quantityG grams), so
 * value = round(availableG * costPaise / quantityG). Variants with no
 * purchase history are valued at 0.
 */
export async function getValuation(): Promise<ValuationReportDTO> {
  const inventories = await repo.listInventoryWithVariant();
  const variantIds = inventories.map((i) => i.variantId);
  const purchaseItems = await repo.listPurchaseItemsWithDate(variantIds);

  // Latest purchase line per variant.
  const latest = new Map<string, { costPaise: number; quantityG: number; at: number }>();
  for (const it of purchaseItems) {
    const at = it.purchase.createdAt.getTime();
    const prev = latest.get(it.variantId);
    if (!prev || at > prev.at) {
      latest.set(it.variantId, { costPaise: it.costPaise, quantityG: it.quantityG, at });
    }
  }

  const rows: ValuationRowDTO[] = inventories.map((inv) => {
    const availableG = inv.stockG - inv.reservedG;
    const cost = latest.get(inv.variantId);
    const unitCostPaisePerKg =
      cost && cost.quantityG > 0
        ? Math.round((cost.costPaise * 1000) / cost.quantityG)
        : 0;
    const valuePaise =
      cost && cost.quantityG > 0
        ? Math.round((availableG * cost.costPaise) / cost.quantityG)
        : 0;
    return {
      variantId: inv.variantId,
      sku: inv.variant.sku,
      productName: inv.variant.product.name,
      availableG,
      unitCostPaisePerKg,
      valuePaise,
    };
  });

  const totalValuePaise = rows.reduce((sum, r) => sum + r.valuePaise, 0);
  return { rows, totalValuePaise };
}

/** Total wastage (grams) in a date range, grouped by variant. */
export async function getWastage(from?: Date, to?: Date): Promise<WastageReportDTO> {
  const rangeFrom = from ?? new Date(0);
  const rangeTo = to ?? new Date();
  const movements = await repo.listWastageMovements(rangeFrom, rangeTo);

  const byVariant = new Map<string, number>();
  for (const m of movements) {
    // Wastage movements are negative (stock leaving); report magnitude.
    byVariant.set(m.variantId, (byVariant.get(m.variantId) ?? 0) + Math.abs(m.quantityG));
  }

  const lookup = await variantLookup([...byVariant.keys()]);
  const rows: WastageRowDTO[] = [...byVariant.entries()].map(([variantId, wastageG]) => ({
    variantId,
    sku: lookup.get(variantId)?.sku ?? null,
    productName: lookup.get(variantId)?.productName ?? null,
    wastageG,
  }));
  rows.sort((a, b) => b.wastageG - a.wastageG);

  const totalWastageG = rows.reduce((sum, r) => sum + r.wastageG, 0);
  return {
    from: rangeFrom.toISOString(),
    to: rangeTo.toISOString(),
    totalWastageG,
    rows,
  };
}
