import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui';

import * as invApi from './inventory.api';
import type {
  AdjustStockPayload,
  MovementListParams,
  PurchasePayload,
  StockListParams,
  SupplierDTO,
  WarehouseDTO,
} from './inventory.types';

/**
 * React Query hooks for the inventory module. Reads are cached by param key;
 * mutations invalidate every affected list and surface a toast.
 */

const keys = {
  all: ['inventory'] as const,
  warehouses: () => [...keys.all, 'warehouses'] as const,
  suppliers: (params: { page: number; pageSize: number; search?: string }) =>
    [...keys.all, 'suppliers', params] as const,
  stock: (params: StockListParams) => [...keys.all, 'stock', params] as const,
  purchases: (params: { page: number; pageSize: number }) =>
    [...keys.all, 'purchases', params] as const,
  purchase: (id: string) => [...keys.all, 'purchase', id] as const,
  movements: (params: MovementListParams) => [...keys.all, 'movements', params] as const,
  valuation: () => [...keys.all, 'valuation'] as const,
};

// ── Warehouses ─────────────────────────────────────────────────────
export function useWarehouses() {
  return useQuery({
    queryKey: keys.warehouses(),
    queryFn: invApi.listWarehouses,
  });
}

/** Create (no id) or update (id) a warehouse. */
export function useSaveWarehouse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<WarehouseDTO> }) =>
      id ? invApi.updateWarehouse(id, body) : invApi.createWarehouse(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.warehouses() });
      toast.success({ title: vars.id ? 'Warehouse updated' : 'Warehouse created' });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => invApi.deleteWarehouse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.warehouses() });
      toast.success({ title: 'Warehouse deleted' });
    },
    onError: (err) => toast.error({ title: 'Delete failed', message: getApiErrorMessage(err) }),
  });
}

// ── Suppliers ──────────────────────────────────────────────────────
export function useSuppliers(params: { page: number; pageSize: number; search?: string }) {
  return useQuery({
    queryKey: keys.suppliers(params),
    queryFn: () => invApi.listSuppliers(params),
  });
}

/** Create (no id) or update (id) a supplier. */
export function useSaveSupplier() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<SupplierDTO> }) =>
      id ? invApi.updateSupplier(id, body) : invApi.createSupplier(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'suppliers'] });
      toast.success({ title: vars.id ? 'Supplier updated' : 'Supplier created' });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => invApi.deleteSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'suppliers'] });
      toast.success({ title: 'Supplier deleted' });
    },
    onError: (err) => toast.error({ title: 'Delete failed', message: getApiErrorMessage(err) }),
  });
}

// ── Stock levels ───────────────────────────────────────────────────
export function useStock(params: StockListParams) {
  return useQuery({
    queryKey: keys.stock(params),
    queryFn: () => invApi.listStock(params),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ variantId, body }: { variantId: string; body: AdjustStockPayload }) =>
      invApi.adjustStock(variantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'stock'] });
      qc.invalidateQueries({ queryKey: [...keys.all, 'movements'] });
      qc.invalidateQueries({ queryKey: keys.valuation() });
      toast.success({ title: 'Stock adjusted' });
    },
    onError: (err) => toast.error({ title: 'Adjustment failed', message: getApiErrorMessage(err) }),
  });
}

// ── Purchases ──────────────────────────────────────────────────────
export function usePurchases(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: keys.purchases(params),
    queryFn: () => invApi.listPurchases(params),
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: keys.purchase(id ?? ''),
    queryFn: () => invApi.getPurchase(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: PurchasePayload) => invApi.createPurchase(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'purchases'] });
      qc.invalidateQueries({ queryKey: [...keys.all, 'stock'] });
      qc.invalidateQueries({ queryKey: [...keys.all, 'movements'] });
      qc.invalidateQueries({ queryKey: keys.valuation() });
      toast.success({ title: 'Purchase recorded', message: data.code });
    },
    onError: (err) => toast.error({ title: 'Purchase failed', message: getApiErrorMessage(err) }),
  });
}

// ── Movements ledger ───────────────────────────────────────────────
export function useMovements(params: MovementListParams) {
  return useQuery({
    queryKey: keys.movements(params),
    queryFn: () => invApi.listMovements(params),
  });
}

// ── Reports ────────────────────────────────────────────────────────
export function useValuation() {
  return useQuery({
    queryKey: keys.valuation(),
    queryFn: invApi.getValuation,
  });
}
