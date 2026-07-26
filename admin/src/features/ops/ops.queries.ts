import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui';

import * as opsApi from './ops.api';
import type { AdminOrdersQuery, AssignmentsQuery, SlotsQuery } from './ops.api';
import type {
  BannerPayload,
  CmsPagePayload,
  GenerateSlotsPayload,
  RangeParams,
  SaveSettingPayload,
  UpdateSlotPayload,
  ZonePayload,
} from './ops.types';

/**
 * React Query hooks for the ops surface. Reads are cached by param key;
 * mutations invalidate the affected lists and surface a toast.
 */

const keys = {
  all: ['ops'] as const,
  assignments: (params: AssignmentsQuery) => [...keys.all, 'assignments', params] as const,
  zones: () => [...keys.all, 'zones'] as const,
  slots: (params: SlotsQuery) => [...keys.all, 'slots', params] as const,
  adminOrders: (params: AdminOrdersQuery) => [...keys.all, 'adminOrders', params] as const,
  dashboard: () => [...keys.all, 'dashboard'] as const,
  valuation: () => [...keys.all, 'valuation'] as const,
  wastage: (params: RangeParams) => [...keys.all, 'wastage', params] as const,
  lowStock: () => [...keys.all, 'lowStock'] as const,
  settings: () => [...keys.all, 'settings'] as const,
  cmsPages: () => [...keys.all, 'cmsPages'] as const,
  banners: () => [...keys.all, 'banners'] as const,
};

// ── Delivery: assignment board ──────────────────────────────────────
export function useAssignments(params: AssignmentsQuery) {
  return useQuery({
    queryKey: keys.assignments(params),
    queryFn: () => opsApi.listAssignments(params),
  });
}

export function useAssign() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ orderId, partnerId }: { orderId: string; partnerId: string }) =>
      opsApi.assignManually(orderId, partnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'assignments'] });
      toast.success({ title: 'Order assigned' });
    },
    onError: (err) => toast.error({ title: 'Assignment failed', message: getApiErrorMessage(err) }),
  });
}

export function useAutoAssign() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ orderId, express }: { orderId: string; express?: boolean }) =>
      opsApi.autoAssign(orderId, express),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'assignments'] });
      toast.success({ title: 'Auto-assigned', message: data.partnerName ?? undefined });
    },
    onError: (err) =>
      toast.error({ title: 'Auto-assign failed', message: getApiErrorMessage(err) }),
  });
}

// ── Delivery: zones ─────────────────────────────────────────────────
export function useZones() {
  return useQuery({ queryKey: keys.zones(), queryFn: opsApi.listZones });
}

export function useSaveZone() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ZonePayload }) =>
      id ? opsApi.updateZone(id, body) : opsApi.createZone(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.zones() });
      toast.success({ title: vars.id ? 'Zone updated' : 'Zone created' });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => opsApi.deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.zones() });
      toast.success({ title: 'Zone deleted' });
    },
    onError: (err) => toast.error({ title: 'Delete failed', message: getApiErrorMessage(err) }),
  });
}

// ── Delivery: slots ─────────────────────────────────────────────────
export function useSlots(params: SlotsQuery) {
  return useQuery({
    queryKey: keys.slots(params),
    queryFn: () => opsApi.listSlots(params),
    enabled: Boolean(params.date),
  });
}

export function useGenerateSlots() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: GenerateSlotsPayload) => opsApi.generateSlots(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'slots'] });
      toast.success({ title: 'Slots generated', message: `${data.created} created` });
    },
    onError: (err) => toast.error({ title: 'Generate failed', message: getApiErrorMessage(err) }),
  });
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSlotPayload }) =>
      opsApi.updateSlot(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'slots'] });
      toast.success({ title: 'Slot updated' });
    },
    onError: (err) => toast.error({ title: 'Update failed', message: getApiErrorMessage(err) }),
  });
}

// ── Delivery: partners (derived from admin orders + board) ──────────
export function useAdminOrders(params: AdminOrdersQuery) {
  return useQuery({
    queryKey: keys.adminOrders(params),
    queryFn: () => opsApi.listAdminOrders(params),
  });
}

// ── Reports ─────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({ queryKey: keys.dashboard(), queryFn: opsApi.getDashboardStats });
}

export function useValuation() {
  return useQuery({ queryKey: keys.valuation(), queryFn: opsApi.getValuation });
}

export function useWastage(params: RangeParams) {
  return useQuery({ queryKey: keys.wastage(params), queryFn: () => opsApi.getWastage(params) });
}

export function useLowStock() {
  return useQuery({ queryKey: keys.lowStock(), queryFn: opsApi.getLowStock });
}

// ── Settings ────────────────────────────────────────────────────────
export function useSettings() {
  return useQuery({ queryKey: keys.settings(), queryFn: opsApi.listSettings });
}

export function useSaveSetting() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: SaveSettingPayload }) =>
      opsApi.saveSetting(key, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.settings() });
      toast.success({ title: 'Setting saved', message: vars.key });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

// ── CMS: pages ──────────────────────────────────────────────────────
export function useCmsPages() {
  return useQuery({ queryKey: keys.cmsPages(), queryFn: opsApi.listCmsPages });
}

export function useSaveCmsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CmsPagePayload }) =>
      id ? opsApi.updateCmsPage(id, body) : opsApi.createCmsPage(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.cmsPages() });
      toast.success({ title: vars.id ? 'Page updated' : 'Page created' });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteCmsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => opsApi.deleteCmsPage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.cmsPages() });
      toast.success({ title: 'Page deleted' });
    },
    onError: (err) => toast.error({ title: 'Delete failed', message: getApiErrorMessage(err) }),
  });
}

// ── CMS: banners ────────────────────────────────────────────────────
export function useBanners() {
  return useQuery({ queryKey: keys.banners(), queryFn: opsApi.listBanners });
}

export function useSaveBanner() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: BannerPayload }) =>
      id ? opsApi.updateBanner(id, body) : opsApi.createBanner(body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.banners() });
      toast.success({ title: vars.id ? 'Banner updated' : 'Banner created' });
    },
    onError: (err) => toast.error({ title: 'Save failed', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => opsApi.deleteBanner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.banners() });
      toast.success({ title: 'Banner deleted' });
    },
    onError: (err) => toast.error({ title: 'Delete failed', message: getApiErrorMessage(err) }),
  });
}
