import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

export function useDashboardStatsQuery(range?: string, customFrom?: string, customTo?: string) {
  return useQuery({
    queryKey: ['dashboard', 'stats', range, customFrom, customTo],
    queryFn: () => api.get('/api/v1/native-crm/dashboard-stats', { params: range ? { range, customFrom, customTo } : undefined }).then((r) => r.data.data as {
      totalLeads: number;
      newToday: number;
      appointments: number;
      appointmentsToday: number;
      conversionRate: number;
      bySource: Record<string, number>;
      byStatus: Record<string, number>;
    }),
  });
}

/** Thin wrapper over the existing Leads list endpoint's `owner=unassigned`
 * filter (the "My X"/"Unassigned" view-tab mechanism already shipped this
 * session) — no backend change needed, just reads `meta.total`. */
export function useUnassignedLeadsCountQuery() {
  return useQuery({
    queryKey: ['dashboard', 'unassigned-leads-count'],
    queryFn: () => api.get('/api/v1/native-crm/leads', { params: { owner: 'unassigned', limit: 1 } })
      .then((r) => (r.data.meta?.total ?? 0) as number),
  });
}

/** The top-level "Management" module (backend/src/modules/activities), not
 * to be confused with Field Service's own separate Activities module. */
export function useManagementActivityStatsQuery(range?: string, customFrom?: string, customTo?: string) {
  return useQuery({
    queryKey: ['activities', 'stats', range, customFrom, customTo],
    queryFn: () => api.get('/api/v1/activities/stats', { params: range ? { range, customFrom, customTo } : undefined }).then((r) => r.data.data as {
      total: number;
      byType: Record<string, number>;
      pending: number;
      inProgress: number;
      completed: number;
      cancelled: number;
    }),
  });
}

export interface DailyPoint { date: string; count: number; }

/** The tenant's real, operationally-used Customer entity — the one Work
 * Orders/Invoices/Quotations/Contracts/Deals actually reference (Sidebar's
 * own Field Service "Customers" nav badge is this same count). Not the
 * separate, unintegrated top-level `/api/v1/customers` module — that one
 * isn't referenced by any other Native CRM module and was the source of an
 * earlier count mismatch. */
export function useCustomersStatsQuery(range?: string, customFrom?: string, customTo?: string) {
  return useQuery({
    queryKey: ['native-crm', 'customers', 'stats', range, customFrom, customTo],
    queryFn: () => api.get('/api/v1/native-crm/customers/stats', { params: range ? { range, customFrom, customTo } : undefined }).then((r) => r.data.data as {
      totalCustomers: number;
      newToday: number;
      byStatus: Record<string, number>;
      priorTotal: number | null;
      daily: DailyPoint[];
    }),
  });
}

export interface RecentActivityEntry {
  _id: string;
  entityModule: string;
  entityId: string;
  action: string;
  description: string;
  createdAt: string;
}

/** The tenant-wide feed — personalized server-side (permission+flag
 * filtered per entry, not a single fixed gate), see
 * backend/.../timeline/timeline.controller.ts's `recent` handler. */
export function useRecentActivityQuery(limit = 10) {
  return useQuery({
    queryKey: ['timeline', 'recent', limit],
    queryFn: () => api.get('/api/v1/native-crm/timeline/recent', { params: { limit } })
      .then((r) => (r.data.data ?? []) as RecentActivityEntry[]),
  });
}
