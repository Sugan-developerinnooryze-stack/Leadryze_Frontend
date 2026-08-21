import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

// Mirrors backend's dataset-version.model.ts field-for-field — frontend and
// backend don't share a build step (same convention already used for
// CARTESIA_VOICE_PRESETS/SUPPORTED_LANGUAGES), so this is a deliberate copy,
// not a drift risk in practice since the role vocabulary is small and stable.
export type SemanticRole = 'name' | 'category' | 'price' | 'location' | 'date' | 'description' | 'identifier' | 'image';
export type DatasetColumnType = 'string' | 'number' | 'currency' | 'date' | 'boolean';

export interface DatasetColumn {
  originalName: string;
  normalizedName: string;
  semanticRole?: SemanticRole;
  confidence: number;
  source: 'heuristic' | 'manual';
  dataType: DatasetColumnType;
}

export interface DatasetSummary {
  _id: string;
  name: string;
  sourceFileName: string;
  sourceType: 'excel' | 'csv' | 'json';
  availableToChatbot: boolean;
  activeVersion?: number;
  createdAt: string;
  activeVersionDetail?: {
    status: string;
    recordsInserted: number;
    recordsFailed: number;
    vectorsIndexed: number;
    vectorsFailed: number;
    expectedRecordCount: number;
    finishedAt?: string;
  };
}

export interface StartImportResult {
  datasetId: string;
  version: number;
  status?: string;
  recordsInserted?: number;
  vectorsIndexed?: number;
  lastError?: string;
}

export interface DatasetVersionSummary {
  version: number;
  status: string;
  recordsInserted: number;
  recordsFailed: number;
  vectorsIndexed: number;
  vectorsFailed: number;
  cellsTruncated: number;
  expectedRecordCount: number;
  diffAdded: number;
  diffUpdated: number;
  diffRemoved: number;
  diffUnchanged: number;
  lastError?: string;
  finishedAt?: string;
}

const TERMINAL_STATUSES = new Set(['ready', 'ready_with_warnings', 'failed']);

const BASE = '/api/v1/native-crm/datasets';

export function useDatasetsList(tenantId: string) {
  return useQuery({
    queryKey: ['native-crm', 'datasets', tenantId],
    queryFn: () => api.get(BASE).then((r) => r.data.data as DatasetSummary[]),
    enabled: !!tenantId,
  });
}

/** Not a mutation — read-only, called live as the user adjusts the header
 * row/mapping in the preview, same "no side effects until confirm" posture
 * as CatalogImportPreview's own client-side detection. */
export async function analyzeDatasetColumns(headers: string[], sampleRows: Array<Record<string, unknown>>): Promise<DatasetColumn[]> {
  const res = await api.post(`${BASE}/analyze`, { headers, sampleRows });
  return res.data.data.columns as DatasetColumn[];
}

export function useImportDataset(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      datasetId?: string; name: string; sourceFileName: string; sourceType: 'excel' | 'csv' | 'json';
      columns: DatasetColumn[]; headerRowIndex: number; rows: Array<Record<string, unknown>>; imageZipRef?: string;
    }) => api.post(`${BASE}/import`, params).then((r) => r.data.data as StartImportResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'datasets', tenantId] }),
  });
}

/** Step 1 of the two-file Mode B flow (plan section 5) — uploads the
 * product-images ZIP on its own, ahead of the existing JSON /import call,
 * since this pipeline has never taken a file upload before (rows are
 * already-parsed JSON from client-side SheetJS). Returns a short-lived
 * `imageZipRef` (backend's TempImageUpload, 24h TTL) that the caller then
 * passes into useImportDataset's own payload. Called as soon as the ZIP is
 * attached in the import popup (not deferred to final confirm), so
 * usePreviewImageMatch below has a real ref to check against immediately. */
export function useUploadImageZip() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`${BASE}/import-images`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data.data as { imageZipRef: string });
    },
  });
}

export interface ImageMatchPreview {
  declared: number;
  matched: number;
  missing: number;
  ambiguous: number;
  missingFilenames: string[];
  ambiguousFilenames: string[];
}

/** Real, non-destructive check of what the ZIP actually matches against the
 * declared filenames — surfaces a mismatch (e.g. Excel says .jpg, the ZIP
 * has .png) immediately in the popup instead of only after a full import +
 * manual DB check. Reuses the backend's own matching logic exactly (not a
 * separate client-side reimplementation), so this preview can never drift
 * from what the real import actually does. */
export function usePreviewImageMatch() {
  return useMutation({
    mutationFn: (params: { imageZipRef: string; declaredFilenames: string[] }) =>
      api.post(`${BASE}/preview-image-match`, params).then((r) => r.data.data as ImageMatchPreview),
  });
}

export function useToggleDatasetAvailable(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { datasetId: string; availableToChatbot: boolean }) =>
      api.put(`${BASE}/${params.datasetId}/available`, { availableToChatbot: params.availableToChatbot }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'datasets', tenantId] }),
  });
}

/** Polls a dataset's versions while an import is in flight (hardening Gap
 * 8) — mirrors useCrawlStatus's exact shape (tenant.queries.ts): the
 * caller controls `enabled` (only poll while actually importing) and the
 * hook exposes the LATEST version's live status/counters, which
 * dataset.service.ts's ingestion loop already updates after every batch
 * (recordsInserted/vectorsIndexed) — this hook doesn't need a new backend
 * route, GET /:id/versions already returns exactly this. */
export function useDatasetImportStatus(tenantId: string, datasetId: string | null, opts: { enabled: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['native-crm', 'datasets', tenantId, datasetId, 'versions'],
    queryFn: () => api.get(`${BASE}/${datasetId}/versions`).then((r) => r.data.data as DatasetVersionSummary[]),
    enabled: opts.enabled && !!tenantId && !!datasetId,
    refetchInterval: (query) => {
      const versions = query.state.data as DatasetVersionSummary[] | undefined;
      const latest = versions?.[0];
      return latest && TERMINAL_STATUSES.has(latest.status) ? false : (opts.refetchInterval ?? 2000);
    },
  });
}

export function useDeleteDataset(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datasetId: string) => api.delete(`${BASE}/${datasetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'datasets', tenantId] }),
  });
}
