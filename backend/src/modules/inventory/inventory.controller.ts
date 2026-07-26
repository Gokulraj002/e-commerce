import type { Request, Response } from 'express';
import type { StockMovementType } from '@elite/shared';

import { created, ok, parsePagination } from '../../utils/http.js';
import * as service from './inventory.service.js';

// ── Warehouses ─────────────────────────────────────────────────────
export async function createWarehouse(req: Request, res: Response) {
  const data = await service.createWarehouse(req.body);
  return created(res, data, 'Warehouse created');
}
export async function listWarehouses(_req: Request, res: Response) {
  return ok(res, await service.listWarehouses());
}
export async function getWarehouse(req: Request, res: Response) {
  return ok(res, await service.getWarehouse(req.params.id));
}
export async function updateWarehouse(req: Request, res: Response) {
  return ok(res, await service.updateWarehouse(req.params.id, req.body), 'Warehouse updated');
}
export async function deleteWarehouse(req: Request, res: Response) {
  return ok(res, await service.deleteWarehouse(req.params.id), 'Warehouse deleted');
}

// ── Suppliers ──────────────────────────────────────────────────────
export async function createSupplier(req: Request, res: Response) {
  return created(res, await service.createSupplier(req.body), 'Supplier created');
}
export async function listSuppliers(req: Request, res: Response) {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  return ok(res, await service.listSuppliers({ search, page, pageSize, skip, take }));
}
export async function getSupplier(req: Request, res: Response) {
  return ok(res, await service.getSupplier(req.params.id));
}
export async function updateSupplier(req: Request, res: Response) {
  return ok(res, await service.updateSupplier(req.params.id, req.body), 'Supplier updated');
}
export async function deleteSupplier(req: Request, res: Response) {
  return ok(res, await service.deleteSupplier(req.params.id), 'Supplier deleted');
}

// ── Stock levels ───────────────────────────────────────────────────
export async function listStock(req: Request, res: Response) {
  const { page, pageSize } = parsePagination(req.query);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const lowStock = req.query.lowStock === 'true';
  return ok(res, await service.listStock({ search, lowStock, page, pageSize }));
}
export async function adjustStock(req: Request, res: Response) {
  const data = await service.adjustStockManual(req.params.variantId, req.body, req.user?.id);
  return ok(res, data, 'Stock adjusted');
}
export async function listLowStock(_req: Request, res: Response) {
  return ok(res, await service.listLowStock());
}

// ── Purchases ──────────────────────────────────────────────────────
export async function createPurchase(req: Request, res: Response) {
  const data = await service.createPurchase(req.body, req.user?.id);
  return created(res, data, 'Purchase recorded');
}
export async function listPurchases(req: Request, res: Response) {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  return ok(res, await service.listPurchases({ page, pageSize, skip, take }));
}
export async function getPurchase(req: Request, res: Response) {
  return ok(res, await service.getPurchase(req.params.id));
}

// ── Movements ledger ───────────────────────────────────────────────
export async function listMovements(req: Request, res: Response) {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const q = req.query;
  return ok(
    res,
    await service.listMovements({
      variantId: typeof q.variantId === 'string' ? q.variantId : undefined,
      type: typeof q.type === 'string' ? (q.type as StockMovementType) : undefined,
      from: q.from ? new Date(q.from as string) : undefined,
      to: q.to ? new Date(q.to as string) : undefined,
      page,
      pageSize,
      skip,
      take,
    }),
  );
}

// ── Reports ────────────────────────────────────────────────────────
export async function getValuation(_req: Request, res: Response) {
  return ok(res, await service.getValuation());
}
export async function getWastage(req: Request, res: Response) {
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;
  return ok(res, await service.getWastage(from, to));
}
