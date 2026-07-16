import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/custom-templates';
const KEY  = ['native-crm', 'custom-templates'] as const;

export function useCustomTemplatesQuery(docType?: string) {
  return useQuery({
    queryKey: [...KEY, docType],
    queryFn: () =>
      api.get(BASE, { params: docType ? { docType } : {} })
        .then((r) => (r.data.data ?? []) as any[]),
  });
}

export function useCustomTemplateQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
    enabled: !!id,
  });
}

export function useCustomTemplateCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomTemplateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomTemplateDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomTemplateSetDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`${BASE}/${id}/set-default`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
