import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/leads/import';

export interface RejectedRow {
  row:    number;
  errors: string[];
  data:   Record<string, any>;
}

export interface ImportSummary {
  batchId:    string;
  total:      number;
  created:    number;
  duplicates: number;
  triage:     number;
  rejected:   RejectedRow[];
}

export function useImportLeadsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, any>[]) => api.post(BASE, { rows }).then((r) => r.data.data as ImportSummary),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['native-crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'leads', 'import-triage'] });
    },
  });
}

export interface TriageItem {
  _id:            string;
  batchId:        string;
  rawRow:         Record<string, any>;
  matchType:      string;
  matchedLeadIds: string[];
  status:         string;
  createdAt:      string;
}

export function useLeadImportTriageQuery(batchId?: string) {
  return useQuery({
    queryKey: ['native-crm', 'leads', 'import-triage', batchId],
    queryFn: () => api.get(`${BASE}/triage`, { params: batchId ? { batchId } : undefined }).then((r) => r.data.data as TriageItem[]),
  });
}

export function useResolveTriageItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'create' | 'skip' }) =>
      api.post(`${BASE}/triage/${id}/resolve`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['native-crm', 'leads', 'import-triage'] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'leads'] });
    },
  });
}
