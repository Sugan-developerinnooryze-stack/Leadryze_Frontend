import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/template-assets';
const KEY  = ['native-crm', 'template-assets'] as const;

export interface TemplateAsset {
  _id:       string;
  url:       string;
  filename:  string;
  mimetype:  string;
  size:      number;
  createdAt: string;
}

/** Tenant's uploaded images for the PDF Designer's Uploads panel. */
export function useTemplateAssetsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      api.get(BASE, { params: { limit: 100 } })
        .then((r) => (r.data.data ?? []) as TemplateAsset[]),
  });
}

export function useTemplateAssetUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(BASE, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTemplateAssetDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
