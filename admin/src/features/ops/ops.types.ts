import type { DeliveryStatus, OrderStatus } from '@elite/shared';

/**
 * Client-safe DTOs for the operations surface (delivery dispatch, reports,
 * settings, CMS, RBAC). Some of these mirror backend module-local DTOs that are
 * NOT exported from `@elite/shared`; they are redeclared here to stay in sync
 * with the API responses without reaching into the backend package.
 */

// ── Delivery: zones ─────────────────────────────────────────────────
export interface DeliveryZoneDTO {
  id: string;
  name: string;
  pincodes: string[];
  feePaise: number;
  isActive: boolean;
}

export interface ZonePayload {
  name: string;
  pincodes: string[];
  feePaise: number;
  isActive: boolean;
}

// ── Delivery: slots ─────────────────────────────────────────────────
export interface SlotWindowPayload {
  label?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  capacity?: number;
  cutoffMinutesBefore?: number;
}

export interface GenerateSlotsPayload {
  zoneId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  windows: SlotWindowPayload[];
}

export interface UpdateSlotPayload {
  label?: string;
  capacity?: number;
  cutoffAt?: string;
  isActive?: boolean;
}

// ── Delivery: partners (derived from the assignment board) ──────────
/**
 * There is no admin "list delivery partners" endpoint, so partner rows are
 * derived from the assignment board (grouped by partner name). `activeLoad` is
 * the count of non-terminal assignments — a live proxy for current workload.
 */
export interface PartnerRow {
  name: string;
  total: number;
  activeLoad: number;
  delivered: number;
  failed: number;
  available: boolean; // inferred: available when nothing is in flight
}

// ── Reports: dashboard stats ────────────────────────────────────────
export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export interface TopProduct {
  name: string;
  units: number;
  revenuePaise: number;
}

export interface DashboardStatsDTO {
  today: {
    orders: number;
    revenuePaise: number;
    newCustomers: number;
  };
  pendingByStatus: StatusCount[];
  lowStockCount: number;
  topProducts: TopProduct[];
  generatedAt: string;
}

// ── Reports: inventory ──────────────────────────────────────────────
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

export interface WastageRowDTO {
  variantId: string;
  sku: string | null;
  productName: string | null;
  wastageG: number;
}

export interface WastageReportDTO {
  from: string;
  to: string;
  totalWastageG: number;
  rows: WastageRowDTO[];
}

export interface LowStockRowDTO {
  variantId: string;
  sku: string;
  productName: string;
  weightG: number;
  warehouseId: string;
  stockG: number;
  reservedG: number;
  availableG: number;
  reorderLevelG: number;
  lowStock: boolean;
}

export interface RangeParams {
  from?: string;
  to?: string;
}

// ── Settings ────────────────────────────────────────────────────────
export interface SettingDTO {
  key: string;
  value: unknown;
  group: string;
}

export interface SaveSettingPayload {
  value: unknown;
  group?: string;
}

// ── CMS: pages ──────────────────────────────────────────────────────
export interface CmsPageDTO {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface CmsPagePayload {
  slug?: string;
  title?: string;
  content?: string;
  isPublished?: boolean;
}

// ── CMS: banners ────────────────────────────────────────────────────
export interface BannerDTO {
  id: string;
  title: string | null;
  imageUrl: string;
  link: string | null;
  position: string;
  sortOrder: number;
  isActive: boolean;
}

export interface BannerPayload {
  title?: string | null;
  imageUrl?: string;
  link?: string | null;
  position?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// Re-export for convenience in pages.
export type { DeliveryStatus, OrderStatus };
