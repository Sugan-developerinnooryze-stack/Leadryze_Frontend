import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

export interface TenantWidgetConfig {
  enabled: boolean;
  widgetKey?: string;
  allowedDomains: string[];
  greeting?: string;
  defaultTeamId?: string | null;
  websiteUrl?: string;
  lastCrawledAt?: string;
  crawlPageCount?: number;
  logoUrl?: string;
  template?: 'modern' | 'minimal' | 'chips' | 'dark';
}

export interface CrawlStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  pagesCrawled?: number;
  chunksIngested?: number;
  failures?: Array<{ url: string; reason: string }>;
  error?: string;
}

export interface Tenant {
  _id: string;
  name: string;
  widget?: TenantWidgetConfig;
  branding?: { primaryColor?: string; companyName?: string; logoUrl?: string };
}

const BASE = '/api/v1/tenants';
const KEY  = (id: string) => ['tenants', id] as const;

export function useTenantQuery(id: string) {
  return useQuery({
    queryKey: KEY(id),
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as Tenant),
    enabled: !!id,
  });
}

/** Never sends `widgetKey`/`logoUrl` — the backend ignores both anyway
 * (server-generated/upload-only respectively), but this hook simply never
 * offers a field for either in the first place. */
export function useUpdateTenantWidget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widget: Partial<Omit<TenantWidgetConfig, 'widgetKey' | 'logoUrl'>>) =>
      api.put(`${BASE}/${id}`, { widget }).then((r) => r.data.data as Tenant),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

export function useRegenerateWidgetKey(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(`${BASE}/${id}/widget/regenerate-key`).then((r) => r.data.data as { widgetKey: string }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

export function useUploadWidgetLogo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`${BASE}/${id}/widget/logo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data.data as { logoUrl: string });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

export function useRemoveWidgetLogo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`${BASE}/${id}/widget/logo`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

/** Kicks off a crawl of the tenant's own website; returns immediately with
 * {status:'running'} — the caller should poll useCrawlStatus for completion. */
export function useTriggerWebsiteCrawl() {
  return useMutation({
    mutationFn: (params: { tenantId: string; startUrl: string }) =>
      api.post('/api/v1/ai/knowledge/crawl', { startUrl: params.startUrl })
        .then((r) => r.data.data as CrawlStatus),
  });
}

/** Polls crawl progress. `enabled`/`refetchInterval` are left to the caller
 * (only poll while a crawl is actually in flight) — this hook just wraps the
 * request shape. */
export function useCrawlStatus(tenantId: string, opts: { enabled: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['tenants', tenantId, 'crawl-status'],
    queryFn: () => api.get('/api/v1/ai/knowledge/crawl-status').then((r) => r.data.data as CrawlStatus),
    enabled: opts.enabled && !!tenantId,
    refetchInterval: opts.refetchInterval ?? 2000,
  });
}
