import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/companies';
const KEY  = ['crm', 'companies'] as const;

interface ListParams { page?: number; limit?: number; search?: string; status?: string; }
interface Meta       { total: number; page: number; totalPages: number; }

export function useCompaniesListQuery(params: ListParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as any[],
        meta:  (r.data.meta  ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useCompanyQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
  });
}
