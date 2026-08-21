import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

export interface KnowledgeSource {
  _id: string;
  type: 'website' | 'excel' | 'csv' | 'json';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastSyncAt?: string;
  lastSyncDurationMs?: number;
  itemsImported: number;
  itemsUpdated: number;
  itemsFailed: number;
  /** Rows created as new for lack of a confident SKU-less match — see
   * backend catalog-item.service.ts's buildIdentityFingerprint(). */
  itemsAmbiguous: number;
  lastError?: string;
}

export interface ImportSummary {
  knowledgeSourceId: string;
  total: number; created: number; updated: number; unchanged: number;
  rejected: Array<{ row: number; outcome: string; error?: string }>;
  ambiguousCreated: number;
}

const BASE = '/api/v1/native-crm/catalog';

export function useCatalogSources(tenantId: string) {
  return useQuery({
    queryKey: ['native-crm', 'catalog', 'sources', tenantId],
    queryFn: () => api.get(`${BASE}/sources`).then((r) => r.data.data as KnowledgeSource[]),
    enabled: !!tenantId,
  });
}

export function useImportCatalog(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { fileType: 'excel' | 'csv' | 'json'; fileLabel: string; rows: Array<Record<string, unknown>> }) =>
      api.post(`${BASE}/import`, params).then((r) => r.data.data as ImportSummary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'catalog', 'sources', tenantId] }),
  });
}
