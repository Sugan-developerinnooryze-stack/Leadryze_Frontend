import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/deals/import';

export interface RejectedRow {
  row:    number;
  errors: string[];
  data:   Record<string, any>;
}

export interface DealImportSummary {
  batchId:    string;
  total:      number;
  created:    number;
  duplicates: number;
  rejected:   RejectedRow[];
}

export function useImportDealsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, any>[]) => api.post(BASE, { rows }).then((r) => r.data.data as DealImportSummary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'deals'] }),
  });
}
