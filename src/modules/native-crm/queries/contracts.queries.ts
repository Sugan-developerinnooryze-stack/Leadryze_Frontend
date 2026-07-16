import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/contracts';
const KEY  = ['native-crm', 'contracts'] as const;

interface ListParams { page?: number; limit?: number; search?: string; status?: string; }
interface Meta       { total: number; page: number; totalPages: number; }

export function useContractsListQuery(params: ListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as any[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useContractQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
    enabled: !!id,
  });
}

export function useContractCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useContractUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useContractDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/* ── Contract master engine ────────────────────────────────────────────────── */

export interface ScheduleSummary {
  totalVisits:      number;
  totalDays:        number;
  perMonth:         { month: string; count: number }[];
  estimatedRevenue: number;
  estimatedHours:   number;
}

/** Dry-run the schedule engine — powers the form's live Schedule Preview. */
export function useSchedulePreview() {
  return useMutation({
    mutationFn: (body: { services: any[]; startDate: string; endDate: string }) =>
      api.post(`${BASE}/schedule-preview`, body).then(
        (r) => r.data.data as { summary: ScheduleSummary; visits: any[] }
      ),
  });
}

/** Update one generated visit (status / notes). */
export function useVisitStatusUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; visitNumber: number; status?: string; notes?: string }) =>
      api.patch(`${BASE}/${id}/visit-status`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Create WOs for planned visits (all, or a subset). */
export function useGenerateWorkorders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visitNumbers }: { id: string; visitNumbers?: number[] }) =>
      api.post(`${BASE}/${id}/generate-workorders`, { visitNumbers }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['native-crm', 'workorders'] });
    },
  });
}
