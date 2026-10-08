import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { Campaign, CampaignRecipient, AudiencePreview, CampaignAudience } from '../campaign.types';

const BASE = '/api/v1/campaigns';
const KEY = ['campaigns'] as const;

interface ListParams { page?: number; limit?: number; status?: string; type?: string; }
interface Meta { total: number; page: number; totalPages: number; }

export function useCampaignsListQuery(params: ListParams = {}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () =>
      api.get(BASE, { params }).then((r) => ({
        items: (r.data.data ?? []) as Campaign[],
        meta: (r.data.meta ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
  });
}

export function useCampaignQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as Campaign),
    enabled: !!id,
  });
}

export function useCampaignCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Campaign>) => api.post(BASE, data).then((r) => r.data.data as Campaign),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCampaignUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data as Campaign),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useCampaignDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

function useLifecycleAction(action: string, method: 'activate' | 'pause' | 'resume' | 'cancel' | 'duplicate') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/${action}`).then((r) => r.data.data as Campaign),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (method !== 'duplicate') qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useCampaignActivate() { return useLifecycleAction('activate', 'activate'); }
export function usePauseCampaign() { return useLifecycleAction('pause', 'pause'); }
export function useResumeCampaign() { return useLifecycleAction('resume', 'resume'); }
export function useCancelCampaign() { return useLifecycleAction('cancel', 'cancel'); }
export function useDuplicateCampaign() { return useLifecycleAction('duplicate', 'duplicate'); }

export function useTestSendCampaign() {
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) =>
      api.post(`${BASE}/${id}/test-send`, { to }).then((r) => r.data.data as { sent: boolean }),
  });
}

export function useCampaignAudiencePreview() {
  return useMutation({
    mutationFn: ({ id }: { id: string; audience?: CampaignAudience }) =>
      api.post(`${BASE}/${id}/audience-preview`).then((r) => r.data.data as AudiencePreview),
  });
}

export function useCampaignRecipientsQuery(id: string, params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: [...KEY, id, 'recipients', params],
    queryFn: () =>
      api.get(`${BASE}/${id}/recipients`, { params }).then((r) => ({
        items: (r.data.data ?? []) as CampaignRecipient[],
        meta: (r.data.meta ?? { total: 0, page: 1, totalPages: 1 }) as Meta,
      })),
    enabled: !!id,
  });
}

// Relocated to templates.queries.ts — re-exported here so TemplatePickerList.tsx's
// existing import keeps working unchanged.
export { useTemplatesForChannelQuery } from '../../templates/queries/templates.queries';

export function useCustomersForAudienceQuery(params: { search?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['customers', 'for-audience', params],
    queryFn: () => api.get('/api/v1/customers', { params: { limit: 50, ...params } }).then((r) => r.data.data ?? []),
  });
}
