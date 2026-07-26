import type {
  DeliveryAssignmentDTO,
  DeliverySlotDTO,
  OrderDTO,
  Paginated,
} from '@elite/shared';

import { api } from '@/lib/apiClient';

import type {
  BannerDTO,
  BannerPayload,
  CmsPageDTO,
  CmsPagePayload,
  DashboardStatsDTO,
  DeliveryZoneDTO,
  GenerateSlotsPayload,
  LowStockRowDTO,
  RangeParams,
  SaveSettingPayload,
  SettingDTO,
  UpdateSlotPayload,
  ValuationReportDTO,
  WastageReportDTO,
  ZonePayload,
} from './ops.types';

/**
 * Thin, typed wrappers around the ops-related backend routes. All calls return
 * the unwrapped payload (the `api` helper strips the response envelope).
 */

// ── Delivery: assignment board ──────────────────────────────────────
export interface AssignmentsQuery {
  status?: string;
  date?: string;
}

export const listAssignments = (params: AssignmentsQuery) =>
  api.get<DeliveryAssignmentDTO[]>('/delivery/assignments', { params });

export const assignManually = (orderId: string, partnerId: string) =>
  api.post<DeliveryAssignmentDTO>(`/delivery/assignments/${orderId}/assign`, { partnerId });

export const autoAssign = (orderId: string, express = false) =>
  api.post<DeliveryAssignmentDTO>(`/delivery/assignments/${orderId}/auto`, { express });

// ── Delivery: zones ─────────────────────────────────────────────────
export const listZones = () => api.get<DeliveryZoneDTO[]>('/delivery/zones');

export const createZone = (body: ZonePayload) =>
  api.post<DeliveryZoneDTO>('/delivery/zones', body);

export const updateZone = (id: string, body: Partial<ZonePayload>) =>
  api.patch<DeliveryZoneDTO>(`/delivery/zones/${id}`, body);

export const deleteZone = (id: string) => api.delete<{ id: string }>(`/delivery/zones/${id}`);

// ── Delivery: slots ─────────────────────────────────────────────────
export interface SlotsQuery {
  date: string;
  pincode?: string;
}

export const listSlots = (params: SlotsQuery) =>
  api.get<DeliverySlotDTO[]>('/delivery/slots', { params });

export const generateSlots = (body: GenerateSlotsPayload) =>
  api.post<{ created: number }>('/delivery/slots', body);

export const updateSlot = (id: string, body: UpdateSlotPayload) =>
  api.patch<DeliverySlotDTO>(`/delivery/slots/${id}`, body);

export const deleteSlot = (id: string) => api.delete<{ id: string }>(`/delivery/slots/${id}`);

// ── Orders (admin) — used to resolve order code → id and for reports ──
export interface AdminOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const listAdminOrders = (params: AdminOrdersQuery) =>
  api.get<Paginated<OrderDTO>>('/orders/admin/all', { params });

// ── Reports: dashboard + inventory ──────────────────────────────────
export const getDashboardStats = () => api.get<DashboardStatsDTO>('/dashboard/stats');

export const getValuation = () => api.get<ValuationReportDTO>('/inventory/reports/valuation');

export const getWastage = (params: RangeParams) =>
  api.get<WastageReportDTO>('/inventory/reports/wastage', { params });

export const getLowStock = () => api.get<LowStockRowDTO[]>('/inventory/low-stock');

// ── Settings ────────────────────────────────────────────────────────
export const listSettings = () => api.get<SettingDTO[]>('/settings');

export const saveSetting = (key: string, body: SaveSettingPayload) =>
  api.put<SettingDTO>(`/settings/${encodeURIComponent(key)}`, body);

// ── CMS: pages ──────────────────────────────────────────────────────
export const listCmsPages = () => api.get<CmsPageDTO[]>('/cms/admin/pages');

export const createCmsPage = (body: CmsPagePayload) =>
  api.post<CmsPageDTO>('/cms/admin/pages', body);

export const updateCmsPage = (id: string, body: CmsPagePayload) =>
  api.put<CmsPageDTO>(`/cms/admin/pages/${id}`, body);

export const deleteCmsPage = (id: string) => api.delete<{ id: string }>(`/cms/admin/pages/${id}`);

// ── CMS: banners ────────────────────────────────────────────────────
export const listBanners = () => api.get<BannerDTO[]>('/cms/admin/banners');

export const createBanner = (body: BannerPayload) =>
  api.post<BannerDTO>('/cms/admin/banners', body);

export const updateBanner = (id: string, body: BannerPayload) =>
  api.put<BannerDTO>(`/cms/admin/banners/${id}`, body);

export const deleteBanner = (id: string) => api.delete<{ id: string }>(`/cms/admin/banners/${id}`);
