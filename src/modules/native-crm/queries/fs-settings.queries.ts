import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/fs-settings';
const KEY  = ['native-crm', 'fs-settings'] as const;

export function useFSSettingsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => (r.data.data ?? {}) as any),
  });
}

export function useFSSettingsUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(BASE, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useFSSettingsUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ field, file }: { field: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('field', field);
      return api.post(`${BASE}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

const PREF_KEY = ['native-crm', 'fs-settings', 'template-preferences'] as const;

export function useTemplatePreferencesQuery() {
  return useQuery({
    queryKey: PREF_KEY,
    queryFn: () =>
      api.get(`${BASE}/template-preferences`).then(
        (r) => (r.data.data ?? {}) as Record<string, string>
      ),
  });
}

export function useTemplatePreferencesUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.put(`${BASE}/template-preferences`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PREF_KEY }),
  });
}
