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

/** Never sends `widgetKey` — the backend ignores it anyway (server-generated
 * only, via regenerateWidgetKey below), but this hook simply never offers a
 * field for it in the first place. */
export function useUpdateTenantWidget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widget: Partial<Omit<TenantWidgetConfig, 'widgetKey'>>) =>
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
