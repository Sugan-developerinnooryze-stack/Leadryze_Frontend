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

/** Find-or-create the "Classic (Starter)" template for a docType — idempotent,
 * safe to call even if one already exists (returns the existing one). */
export function useSeedStarterTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docType: string) => api.post(`${BASE}/seed-starter`, { docType }).then((r) => r.data.data as any),
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

export interface CatalogItem  { key: string; label: string; elemType: string; }
export interface CatalogGroup { label: string; items: CatalogItem[]; }

/** Designer variable palette — per docType, includes tenant custom fields. */
export function useTemplateCatalogQuery(docType: string) {
  return useQuery({
    queryKey: [...KEY, 'catalog', docType],
    queryFn: () =>
      api.get(`${BASE}/catalog`, { params: { docType } })
        .then((r) => (r.data.data?.groups ?? []) as CatalogGroup[]),
  });
}

/** Render an unsaved designer draft against a real document; returns HTML. */
export function previewDraftHtml(module: string, docId: string, body: { elements: any[]; page?: any; header?: any; footer?: any }) {
  return api
    .post(`/api/v1/native-crm/pdf/${module}/${docId}/preview-html`, body, { responseType: 'text' as const })
    .then((r) => r.data as string);
}

/** Same source HTML as previewDraftHtml, rendered to a real PDF file and downloaded. */
export async function downloadDraftPdf(
  module: string, docId: string, filename: string,
  body: { elements: any[]; page?: any; header?: any; footer?: any },
) {
  const res = await api.post(`/api/v1/native-crm/pdf/${module}/${docId}/download-draft`, body, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export interface LiveRowCells { index: string; name: string; description: string; partNumber: string; count: string; amount: string; lineTotal: string; }
export interface LiveData {
  vars:     Record<string, string>;
  services: LiveRowCells[];
  parts:    LiveRowCells[];
  totals:   Record<string, string>;
  docLabel: string;
}

/** Real, pre-resolved data for the designer's "Live Data" canvas mode. */
export function useLiveDataQuery(module: string, docId: string) {
  return useQuery({
    queryKey: ['native-crm', 'pdf', 'live-data', module, docId],
    queryFn: () =>
      api.get(`/api/v1/native-crm/pdf/${module}/${docId}/live-data`)
        .then((r) => r.data.data as LiveData),
    enabled: !!module && !!docId,
  });
}
