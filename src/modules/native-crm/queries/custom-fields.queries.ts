import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/custom-fields';
const KEY  = ['native-crm', 'custom-fields'] as const;

export interface NativeCustomField {
  _id:             string;
  module:          string;
  fieldKey:        string;
  label:           string;
  fieldType:       string;
  options?:        string[];
  formTemplateId?: string;
  required:        boolean;
  order:           number;
  isActive:        boolean;
}

export function useCustomFieldsQuery(module?: string) {
  return useQuery({
    queryKey: [...KEY, module ?? 'all'],
    queryFn: () =>
      api.get(BASE, { params: module ? { module } : {} })
        .then((r) => (r.data.data ?? []) as NativeCustomField[]),
  });
}

export function useCustomFieldCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomFieldUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomFieldDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCustomFieldUpload(mediaType: 'image' | 'video' = 'image') {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const endpoint = mediaType === 'video' ? `${BASE}/upload/video` : `${BASE}/upload/image`;
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data as { url?: string; urls?: string[] };
    },
  });
}
