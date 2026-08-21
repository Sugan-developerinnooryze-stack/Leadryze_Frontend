import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/tickets/sla-policy';
const KEY  = ['native-crm', 'ticket-sla-policy'] as const;

export function useTicketSlaPolicyQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => r.data.data as any),
  });
}

export function useTicketSlaPolicyUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
