import { dashboardRepository } from './dashboard.repository.js';
import type { DashboardStatsDTO } from './dashboard.types.js';

const TOP_PRODUCTS_LIMIT = 5;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStatsDTO> {
    const since = startOfToday();

    const [orders, revenueAgg, pending, lowStock, newCustomers, top] = await Promise.all([
      dashboardRepository.ordersToday(since),
      dashboardRepository.revenueToday(since),
      dashboardRepository.pendingByStatus(),
      dashboardRepository.lowStockCount(),
      dashboardRepository.newCustomersToday(since),
      dashboardRepository.topProducts(TOP_PRODUCTS_LIMIT),
    ]);

    return {
      today: {
        orders,
        revenuePaise: revenueAgg._sum.totalPaise ?? 0,
        newCustomers,
      },
      pendingByStatus: pending.map((p) => ({ status: p.status, count: p._count._all })),
      lowStockCount: Number(lowStock[0]?.count ?? 0),
      topProducts: top.map((t) => ({
        name: t.productName,
        units: t._sum.quantity ?? 0,
        revenuePaise: t._sum.lineTotalPaise ?? 0,
      })),
      generatedAt: new Date().toISOString(),
    };
  },
};
