import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

export interface TenantBookingHoursConfig {
  enabled: boolean;
  timezone: string;
  slotMinutes: number;
  leadTimeHours: number;
  horizonDays: number;
  hours: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string }>;
  requireTeam?: boolean;
  requireService?: boolean;
  requireName?: boolean;
  contactRequirement?: 'email_only' | 'phone_only' | 'email_or_phone' | 'email_and_phone';
  staffLabel?: string;
}

export type VoiceProvider = 'groq';

export interface TenantVoicePreset {
  provider: 'cartesia';
  voiceId: string;
  displayName: string;
  gender: 'male' | 'female';
  language: string;
}

export interface TenantVoiceConfig {
  enabled: boolean;
  sttProvider: VoiceProvider;
  ttsProvider: VoiceProvider;
  voiceName?: string;
  sttLanguage?: string;
  autoPlay: boolean;
  /** Continuous, hands-free voice conversation (LiveKit) — separate from
   * `enabled` above (push-to-talk); a tenant can run either, both, or
   * neither independently. */
  continuousModeEnabled?: boolean;
  /** Hard per-call duration cap (minutes) for continuous voice — separate
   * from the monthly voice-minutes quota (aiConfig.monthlyVoiceMinutesLimit). */
  maxSessionMinutes?: number;
  /** Whether the text input stays usable while a continuous call is active
   * (default true — hybrid mode). */
  allowTextDuringVoice?: boolean;
  /** Structured Cartesia voice preset for CONTINUOUS voice — kept alongside
   * (not replacing) voiceName, which stays the push-to-talk (Groq/Orpheus)
   * free-text override. */
  voicePreset?: TenantVoicePreset;
}

export interface TenantWidgetConfig {
  enabled: boolean;
  widgetKey?: string;
  allowedDomains: string[];
  greeting?: string;
  quickQuestions?: { text: string; enabled: boolean }[];
  showBookingQuickReply?: boolean;
  /** On by default — sends the automatic lead-confirmation (visitor) +
   * sales-alert (assigned staff) email pair the moment a real chatbot Lead
   * is created. See branding.contactEmail/contactPhone/address below for
   * the info the confirmation email shares with the visitor. */
  autoSendLeadEmails?: boolean;
  defaultTeamId?: string | null;
  websiteUrl?: string;
  crawlStatus?: 'not_configured' | 'crawling' | 'ready' | 'ready_with_warnings' | 'failed';
  lastCrawledAt?: string;
  crawlPageCount?: number;
  crawlPagesIndexed?: number;
  crawlPagesFailed?: number;
  crawlChunksIndexed?: number;
  lastSuccessfulCrawlAt?: string;
  lastSuccessfulCrawlPagesIndexed?: number;
  lastSuccessfulCrawlChunksIndexed?: number;
  logoUrl?: string;
  template?: 'modern' | 'minimal' | 'chips' | 'dark';
  booking?: TenantBookingHoursConfig;
  voice?: TenantVoiceConfig;
}

export interface CrawlStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  pagesCrawled?: number;
  chunksIngested?: number;
  failures?: Array<{ url: string; reason: string }>;
  error?: string;
}

export type ToolModelPreset = 'groq' | 'anthropic' | 'openai' | 'google';

export interface Tenant {
  _id: string;
  name: string;
  widget?: TenantWidgetConfig;
  branding?: { primaryColor?: string; companyName?: string; logoUrl?: string; contactEmail?: string; contactPhone?: string; address?: string };
  aiConfig?: { toolModelPreset?: ToolModelPreset | null; autoConvertLeadOnMeetingCompleted?: boolean };
  dataScopeConfig?: Record<string, boolean>;
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

/** Contact info the automatic lead-confirmation email shares with a visitor
 * — mirrors useUpdateTenantWidget()'s exact shape/pattern. Only companyName/
 * contactEmail/contactPhone/address are ever accepted here (see
 * tenant.service.ts's own allow-list) — logoUrl/primaryColor stay off this
 * path (uploaded/set elsewhere). */
export function useUpdateTenantBranding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branding: { companyName?: string; contactEmail?: string; contactPhone?: string; address?: string }) =>
      api.put(`${BASE}/${id}`, { branding }).then((r) => r.data.data as Tenant),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

/** Governs only the RAG/catalog/booking tool-calling path — never the
 * plain fast-path/conversational path. `toolModelPreset: null` clears the
 * override back to the global default. */
export function useUpdateTenantAIConfig(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aiConfig: { toolModelPreset?: ToolModelPreset | null; autoConvertLeadOnMeetingCompleted?: boolean }) =>
      api.put(`${BASE}/${id}`, { aiConfig }).then((r) => r.data.data as Tenant),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(id) }),
  });
}

/** Per-module row-level scoping toggle — mirrors useUpdateTenantWidget()'s
 * exact shape. Only ever sends the keys the caller changed; the backend's
 * own dot-notation merge (tenant.service.ts's updateTenant()) means any
 * module key not included here is left completely untouched. */
export function useUpdateTenantDataScopeConfig(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dataScopeConfig: Record<string, boolean>) =>
      api.put(`${BASE}/${id}`, { dataScopeConfig }).then((r) => r.data.data as Tenant),
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
