import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/products';
const KEY  = ['native-crm', 'products'] as const;

interface ListParams { page?: number; limit?: number; search?: string; status?: string; }
interface Meta       { total: number; page: number; totalPages: number; }

export function useProductsListQuery(params: ListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as any[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useProductQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
    enabled: !!id,
  });
}

export function useProductCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useProductUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useProductDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
