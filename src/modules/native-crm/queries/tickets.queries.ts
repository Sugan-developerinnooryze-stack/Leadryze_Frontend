import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/tickets';
const KEY  = ['native-crm', 'tickets'] as const;

export function useTicketQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as any),
    enabled: !!id,
  });
}

export function useTicketUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`${BASE}/${id}`, data),
    onSuccess: (_r, { id }) => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: [...KEY, id] }); },
  });
}

/** Reassignment — a distinct, .assign-permission-gated endpoint, not the
 * general update above (see ticket.validation.ts's own comment for why
 * staffId/teamId are excluded from the general edit path entirely). */
export function useTicketAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, staffId, teamId }: { id: string; staffId?: string; teamId?: string }) =>
      api.put(`${BASE}/${id}/assign`, { staffId, teamId }),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
      qc.invalidateQueries({ queryKey: [...KEY, id, 'timeline'] });
    },
  });
}

export function useTicketTimelineQuery(id: string) {
  return useQuery({
    queryKey: [...KEY, id, 'timeline'],
    queryFn: () => api.get(`${BASE}/${id}/timeline`).then((r) => (r.data.data ?? []) as any[]),
    enabled: !!id,
  });
}

export function useTicketAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.post(`${BASE}/${id}/notes`, { text }),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: [...KEY, id] });
      qc.invalidateQueries({ queryKey: [...KEY, id, 'timeline'] });
    },
  });
}
