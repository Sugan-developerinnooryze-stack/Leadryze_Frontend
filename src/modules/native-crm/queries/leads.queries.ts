import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/leads';
const KEY  = ['native-crm', 'leads'] as const;

interface LeadFilters {
  page?:       number;
  limit?:      number;
  search?:     string;
  status?:     string;
  source?:     string;
  rating?:     string;
  priority?:   string;
  leadOwner?:  string;
  isConverted?: boolean;
}

interface Meta { total: number; page: number; totalPages: number; }

export function useLeadsQuery(params?: LeadFilters) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as any[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useLeadQuery(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn:  () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
    enabled:  !!id,
  });
}

export function useLeadCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLeadUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLeadDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLeadUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`${BASE}/${id}/stage`, { status }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLeadConvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${BASE}/${id}/convert`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['native-crm', 'customers'] });
    },
  });
}

export function useLeadConvertToContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${BASE}/${id}/convert/contact`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['native-crm', 'contacts'] });
    },
  });
}

export function useLeadConvertToOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${BASE}/${id}/convert/opportunity`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['native-crm', 'deals'] });
    },
  });
}

export function useLeadConvertToCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${BASE}/${id}/convert/customer`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['native-crm', 'customers'] });
    },
  });
}

export function useLeadConversionsQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id, 'conversions'],
    queryFn:  () => api.get(`${BASE}/${id}/conversions`).then((r) => r.data.data as any[]),
    enabled:  !!id,
  });
}

export function useLeadsStatsQuery() {
  return useQuery({
    queryKey: [...KEY, 'stats'],
    queryFn: () => api.get(`${BASE}/stats`).then((r) => r.data.data as {
      pipeline: { _id: string; count: number; revenue: number }[];
      total: number;
      converted: number;
      totalRevenue: number;
      conversionRate: number;
    }),
  });
}
