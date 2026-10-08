import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/templates';
const KEY = ['templates'] as const;

export interface Template {
  _id: string;
  tenantId: string;
  name: string;
  type: 'email' | 'whatsapp' | 'sms';
  category: string;
  subject?: string;
  body: string;
  variables: string[];
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateUsage {
  campaigns: number;
  automationRules: number;
  automationFlows: number;
  total: number;
}

interface ListParams { page?: number; limit?: number; type?: string; category?: string; }
interface Meta { total: number; page: number; totalPages: number; }

export function useTemplatesListQuery(params: ListParams = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as Template[],
        meta: (r.data.meta ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

// Relocated here from campaigns.queries.ts — kept available there too via a
// re-export so TemplatePickerList.tsx's existing import keeps working
// unchanged.
export function useTemplatesForChannelQuery(channel: string) {
  return useQuery({
    queryKey: [...KEY, 'for-channel', channel],
    queryFn: () => api.get(BASE, { params: { type: channel } }).then((r) => (r.data.data ?? []) as Template[]),
    enabled: !!channel,
  });
}

export function useTemplateQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as Template),
    enabled: !!id,
  });
}

export function useTemplateCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Template>) => api.post(BASE, data).then((r) => r.data.data as Template),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTemplateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Template> }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data as Template),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

// Existing DELETE route — already a soft-delete (isActive:false). Named
// "Deactivate" here to match what it actually does.
export function useTemplateDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTemplateActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/activate`).then((r) => r.data.data as Template),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/duplicate`).then((r) => r.data.data as Template),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ id, sampleVariables }: { id: string; sampleVariables?: Record<string, string> }) =>
      api.post(`${BASE}/${id}/preview`, { sampleVariables }).then((r) => r.data.data as { subject?: string; body: string }),
  });
}

export function useTestSendTemplate() {
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) =>
      api.post(`${BASE}/${id}/test-send`, { to }).then((r) => r.data.data as { sent: boolean; reason?: string }),
  });
}

export function useTemplateUsageQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id, 'usage'],
    queryFn: () => api.get(`${BASE}/${id}/usage`).then((r) => r.data.data as TemplateUsage),
    enabled: !!id,
  });
}
