import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/tickets';
const KEY  = ['native-crm', 'ticket-attachments'] as const;

export function useTicketAttachmentsQuery(ticketId: string) {
  return useQuery({
    queryKey: [...KEY, ticketId],
    queryFn: () => api.get(`${BASE}/${ticketId}/attachments`).then((r) => (r.data.data ?? []) as any[]),
    enabled: !!ticketId,
  });
}

export function useTicketAttachmentUpload(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`${BASE}/${ticketId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, ticketId] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'tickets', ticketId, 'timeline'] });
    },
  });
}

export function useTicketAttachmentDelete(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.delete(`${BASE}/attachments/${attachmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, ticketId] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'tickets'] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'tickets', ticketId, 'timeline'] });
    },
  });
}
