import type { Paginated } from '@elite/shared';

import { api } from '@/lib/apiClient';

import type {
  AdjustStockPayload,
  MovementListParams,
  PurchaseDTO,
  PurchasePayload,
  StockListParams,
  StockMovementDTO,
  StockRowDTO,
  SupplierDTO,
  ValuationReportDTO,
  WarehouseDTO,
} from './inventory.types';

/**
 * Thin, typed wrappers around the `/inventory/*` backend routes. All calls
 * return the unwrapped payload (the `api` helper strips the response envelope).
 */

// ── Warehouses ─────────────────────────────────────────────────────
export const listWarehouses = () => api.get<WarehouseDTO[]>('/inventory/warehouses');

export const createWarehouse = (body: Partial<WarehouseDTO>) =>
  api.post<WarehouseDTO>('/inventory/warehouses', body);

export const updateWarehouse = (id: string, body: Partial<WarehouseDTO>) =>
  api.patch<WarehouseDTO>(`/inventory/warehouses/${id}`, body);

export const deleteWarehouse = (id: string) =>
  api.delete<{ id: string }>(`/inventory/warehouses/${id}`);

// ── Suppliers ──────────────────────────────────────────────────────
export const listSuppliers = (params: { page: number; pageSize: number; search?: string }) =>
  api.get<Paginated<SupplierDTO>>('/inventory/suppliers', { params });

export const createSupplier = (body: Partial<SupplierDTO>) =>
  api.post<SupplierDTO>('/inventory/suppliers', body);

export const updateSupplier = (id: string, body: Partial<SupplierDTO>) =>
  api.patch<SupplierDTO>(`/inventory/suppliers/${id}`, body);

export const deleteSupplier = (id: string) =>
  api.delete<{ id: string }>(`/inventory/suppliers/${id}`);

// ── Stock levels ───────────────────────────────────────────────────
export const listStock = (params: StockListParams) =>
  api.get<Paginated<StockRowDTO>>('/inventory/stock', { params });

export const adjustStock = (variantId: string, body: AdjustStockPayload) =>
  api.patch<StockRowDTO>(`/inventory/stock/${variantId}/adjust`, body);

// ── Purchases ──────────────────────────────────────────────────────
export const listPurchases = (params: { page: number; pageSize: number }) =>
  api.get<Paginated<PurchaseDTO>>('/inventory/purchases', { params });

export const getPurchase = (id: string) => api.get<PurchaseDTO>(`/inventory/purchases/${id}`);

export const createPurchase = (body: PurchasePayload) =>
  api.post<PurchaseDTO>('/inventory/purchases', body);

// ── Movements ledger ───────────────────────────────────────────────
export const listMovements = (params: MovementListParams) =>
  api.get<Paginated<StockMovementDTO>>('/inventory/movements', { params });

// ── Reports ────────────────────────────────────────────────────────
export const getValuation = () =>
  api.get<ValuationReportDTO>('/inventory/reports/valuation');
