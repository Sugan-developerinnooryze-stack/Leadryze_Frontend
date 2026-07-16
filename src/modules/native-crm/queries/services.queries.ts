import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/services';
const KEY  = ['native-crm', 'services'] as const;

interface ListParams { page?: number; limit?: number; search?: string; status?: string; categoryId?: string; }
interface Meta       { total: number; page: number; totalPages: number; }

export function useServicesListQuery(params: ListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as any[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useServiceCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useServiceUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useServiceDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
