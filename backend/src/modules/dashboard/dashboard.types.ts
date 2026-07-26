import type { OrderStatus } from '@elite/shared';

/** Aggregated numbers for the admin dashboard — all money in paise. */

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
    revenuePaise: number; // paid orders placed today
    newCustomers: number;
  };
  pendingByStatus: StatusCount[];
  lowStockCount: number;
  topProducts: TopProduct[];
  generatedAt: string;
}
