import type {
  Inventory,
  Prisma,
  Product,
  ProductVariant,
  Purchase,
  PurchaseItem,
  StockMovement,
  Supplier,
  Warehouse,
} from '@prisma/client';
import type { StockMovementType } from '@elite/shared';

import { prisma } from '../../lib/prisma.js';
import type { StockRef } from './inventory.types.js';

export type InventoryWithVariant = Inventory & {
  variant: ProductVariant & { product: Product };
};
export type PurchaseWithItems = Purchase & { items: PurchaseItem[] };

// ── Warehouses ─────────────────────────────────────────────────────
export function createWarehouse(data: Prisma.WarehouseCreateInput): Promise<Warehouse> {
  return prisma.warehouse.create({ data });
}
export function listWarehouses(): Promise<Warehouse[]> {
  return prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
}
export function findWarehouseById(id: string): Promise<Warehouse | null> {
  return prisma.warehouse.findUnique({ where: { id } });
}
export function updateWarehouse(
  id: string,
  data: Prisma.WarehouseUpdateInput,
): Promise<Warehouse> {
  return prisma.warehouse.update({ where: { id }, data });
}
export function deleteWarehouse(id: string): Promise<Warehouse> {
  return prisma.warehouse.delete({ where: { id } });
}

// ── Suppliers ──────────────────────────────────────────────────────
export function createSupplier(data: Prisma.SupplierCreateInput): Promise<Supplier> {
  return prisma.supplier.create({ data });
}
export function findSupplierById(id: string): Promise<Supplier | null> {
  return prisma.supplier.findUnique({ where: { id } });
}
export function updateSupplier(
  id: string,
  data: Prisma.SupplierUpdateInput,
): Promise<Supplier> {
  return prisma.supplier.update({ where: { id }, data });
}
export function deleteSupplier(id: string): Promise<Supplier> {
  return prisma.supplier.delete({ where: { id } });
}
export async function listSuppliers(params: {
  search?: string;
  skip: number;
  take: number;
}): Promise<{ items: Supplier[]; total: number }> {
  const where: Prisma.SupplierWhereInput = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.supplier.count({ where }),
  ]);
  return { items, total };
}

// ── Variants ───────────────────────────────────────────────────────
export function findVariantsByIds(ids: string[]): Promise<ProductVariant[]> {
  return prisma.productVariant.findMany({ where: { id: { in: ids } } });
}
export function findVariantsWithProductByIds(
  ids: string[],
): Promise<(ProductVariant & { product: Product })[]> {
  return prisma.productVariant.findMany({
    where: { id: { in: ids } },
    include: { product: true },
  });
}

// ── Inventory ──────────────────────────────────────────────────────
export function findInventoryByVariant(variantId: string): Promise<Inventory | null> {
  return prisma.inventory.findUnique({ where: { variantId } });
}

/**
 * All inventory rows joined with variant + product. Stock/availability
 * comparisons (availableG vs reorderLevelG) are computed in the service,
 * so the repository stays a plain Prisma passthrough.
 */
export function listInventoryWithVariant(search?: string): Promise<InventoryWithVariant[]> {
  const where: Prisma.InventoryWhereInput = search
    ? {
        variant: {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      }
    : {};
  return prisma.inventory.findMany({
    where,
    include: { variant: { include: { product: true } } },
    orderBy: { variant: { sku: 'asc' } },
  });
}

/** Atomically apply a signed delta to stock and record the movement. */
export function applyStockChange(input: {
  variantId: string;
  warehouseId: string;
  deltaG: number;
  type: StockMovementType;
  reason?: string;
  ref?: StockRef;
}): Promise<Inventory> {
  return prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.update({
      where: { variantId: input.variantId },
      data: { stockG: { increment: input.deltaG } },
    });
    await tx.stockMovement.create({
      data: {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        type: input.type,
        quantityG: input.deltaG,
        reason: input.reason ?? null,
        refType: input.ref?.refType ?? 'MANUAL',
        refId: input.ref?.refId ?? null,
        createdBy: input.ref?.createdBy ?? null,
      },
    });
    return inventory;
  });
}

// ── Purchases ──────────────────────────────────────────────────────
/**
 * Create a Purchase with its items, increment each variant's inventory,
 * and write a PURCHASE_IN movement per item — all in one transaction.
 */
export async function createPurchaseWithItems(input: {
  code: string;
  supplierId: string;
  warehouseId: string;
  note?: string;
  totalPaise: number;
  items: { variantId: string; quantityG: number; costPaise: number }[];
  createdBy?: string;
}): Promise<PurchaseWithItems> {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        code: input.code,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        note: input.note ?? null,
        totalPaise: input.totalPaise,
      },
    });
    for (const item of input.items) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          variantId: item.variantId,
          quantityG: item.quantityG,
          costPaise: item.costPaise,
        },
      });
      await tx.inventory.upsert({
        where: { variantId: item.variantId },
        update: { stockG: { increment: item.quantityG } },
        create: {
          variantId: item.variantId,
          warehouseId: input.warehouseId,
          stockG: item.quantityG,
        },
      });
      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          warehouseId: input.warehouseId,
          type: 'PURCHASE_IN',
          quantityG: item.quantityG,
          reason: 'Purchase stock-in',
          refType: 'PURCHASE',
          refId: purchase.id,
          createdBy: input.createdBy ?? null,
        },
      });
    }
    return tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { items: true },
    });
  });
}

export async function listPurchases(params: {
  skip: number;
  take: number;
}): Promise<{ items: PurchaseWithItems[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.purchase.count(),
  ]);
  return { items, total };
}

export function findPurchaseById(id: string): Promise<PurchaseWithItems | null> {
  return prisma.purchase.findUnique({ where: { id }, include: { items: true } });
}

// ── Stock movements ────────────────────────────────────────────────
export async function listMovements(params: {
  variantId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}): Promise<{ items: StockMovement[]; total: number }> {
  const where: Prisma.StockMovementWhereInput = {
    ...(params.variantId ? { variantId: params.variantId } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { items, total };
}

export function listWastageMovements(from: Date, to: Date): Promise<StockMovement[]> {
  return prisma.stockMovement.findMany({
    where: { type: 'WASTAGE', createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Purchase items (for valuation latest-cost lookup) ──────────────
export function listPurchaseItemsWithDate(
  variantIds: string[],
): Promise<(PurchaseItem & { purchase: Pick<Purchase, 'createdAt'> })[]> {
  return prisma.purchaseItem.findMany({
    where: { variantId: { in: variantIds } },
    include: { purchase: { select: { createdAt: true } } },
  });
}
