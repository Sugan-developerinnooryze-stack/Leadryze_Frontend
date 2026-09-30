import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/tasks';
const KEY  = ['native-crm', 'tasks'] as const;

export interface TaskSummary {
  _id: string;
  title: string;
  taskStatus: string;
  dueDate?: string;
  assignedTo?: string;
}
interface Meta { total: number; page: number; totalPages: number; }

/** Backend accepts only page/limit — no sort override (fixed server-side
 * sort is {dueDate: 1, createdAt: -1}, soonest-due-first). Not a gap to
 * fix — a reasonable "what's coming up" order for a dashboard preview. */
export function useTasksListQuery(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as TaskSummary[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useTasksStatsQuery(range?: string, customFrom?: string, customTo?: string) {
  return useQuery({
    queryKey: [...KEY, 'stats', range, customFrom, customTo],
    queryFn: () => api.get(`${BASE}/stats`, { params: range ? { range, customFrom, customTo } : undefined }).then((r) => r.data.data as {
      total: number;
      allTimeTotal: number;
      overdue: number;
      dueToday: number;
      byStatus: Record<string, number>;
    }),
  });
}
