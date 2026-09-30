import { useState, useCallback, useEffect } from 'react';
import {
  ArrowPathIcon, ServerIcon, CheckCircleIcon, XCircleIcon,
  ExclamationTriangleIcon, InformationCircleIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { authService } from '../../../services/auth.service';
import { AdminCard } from '../shared/AdminCard';

interface ServiceHealth { name: string; status: 'ok' | 'error' | 'unknown'; detail: string }
interface ApiKeyHealth {
  name: string; key: string; set: boolean; usage: string; provider: string;
  activeRole: string; freeLimit: string | null; paidNote: string;
  rateLimit: string; purpose: string; model: string;
}
interface KeyStats { today: number; week: number; month: number; model: string; escalations: number; label?: string }
interface TenantAiUsage {
  tenantId: string; tenantName: string; plan: string;
  monthlyTokenLimit: number; tokensUsedThisMonth: number; percentUsed: number;
  estimatedCostUsd: number; requestCount: number; moderationFallbackCount: number;
  sttSeconds: number; ttsCharacters: number; voiceCostUsd: number; voiceRequestCount: number;
  monthlyVoiceMinutesLimit: number; continuousVoiceMinutesUsed: number; voiceMinutesPercentUsed: number;
  continuousVoiceSessionCount: number; deepgramSttSeconds: number; cartesiaTtsCharacters: number;
  continuousVoiceCostUsd: number;
}

const ROLE_BADGE: Record<string, string> = {
  primary:  'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400 border-ryze-600/20',
  fallback: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  inactive: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border',
};

function KeyRow({ k, stats, loading }: { k: ApiKeyHealth; stats: KeyStats | undefined; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const todayPct = stats && k.rateLimit !== 'N/A' ? Math.min(100, Math.round((stats.today / Math.max(stats.today, 50)) * 100)) : 0;

  return (
    <>
      <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer select-none" onClick={() => setOpen((v) => !v)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary text-sm">{k.name}</span>
            {k.activeRole !== 'inactive' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${ROLE_BADGE[k.activeRole]}`}>{k.activeRole}</span>
            )}
            {k.model && <span className="text-xs text-text-muted font-mono">{k.model}</span>}
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-text-muted hidden md:table-cell">{k.key}</td>
        <td className="px-4 py-3">
          {k.set
            ? <span className="flex items-center gap-1.5 text-success-700 dark:text-success-500 text-xs font-semibold"><CheckCircleIcon className="h-4 w-4" />Configured</span>
            : <span className="flex items-center gap-1.5 text-danger-700 dark:text-danger-500 text-xs font-semibold"><XCircleIcon className="h-4 w-4" />Missing</span>}
        </td>
        <td className="px-4 py-3">
          {loading ? <div className="h-3 bg-black/[0.06] dark:bg-white/[0.08] rounded animate-pulse w-12" />
            : stats ? <span className="text-xs text-text-primary font-medium">{stats.today} {stats.label ?? 'calls'}</span>
            : <span className="text-xs text-text-muted">—</span>}
        </td>
        <td className="px-3 py-3 text-text-muted">
          <ChevronRightIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </td>
      </tr>

      {open && (
        <tr className="bg-black/[0.015] dark:bg-white/[0.02]">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Purpose</p>
                <p className="text-xs text-text-muted leading-relaxed">{k.purpose}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Rate Limit</p>
                <p className="text-xs text-text-muted">{k.rateLimit}</p>
                {k.freeLimit ? <p className="text-xs text-success-600 dark:text-success-500 mt-1">Free tier: {k.freeLimit}</p> : <p className="text-xs text-text-muted mt-1">{k.paidNote}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                  Usage ({stats?.label ? stats.label.charAt(0).toUpperCase() + stats.label.slice(1) : 'AI Calls'})
                </p>
                {stats ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.08] dark:bg-white/[0.1] overflow-hidden">
                        <div className="h-full rounded-full bg-ryze-500 transition-all" style={{ width: `${todayPct}%` }} />
                      </div>
                      <span className="text-xs text-text-muted whitespace-nowrap">{stats.today} today</span>
                    </div>
                    <div className="flex gap-3 text-xs text-text-muted">
                      <span>7d: <span className="text-text-primary">{stats.week}</span></span>
                      <span>30d: <span className="text-text-primary">{stats.month}</span></span>
                      {stats.escalations > 0 && <span>{stats.label ? 'Failed' : 'Escalations'}: <span className="text-amber-600 dark:text-amber-400">{stats.escalations}</span></span>}
                    </div>
                  </div>
                ) : <p className="text-xs text-text-muted">No activity logged yet</p>}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">ENV:</span>
                <code className="text-xs text-text-muted bg-surface border border-border px-2 py-0.5 rounded">{k.key}</code>
              </div>
              {k.paidNote && <p className="text-xs text-text-muted italic">{k.paidNote}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function HealthPage() {
  const [services,  setServices]  = useState<ServiceHealth[]>([]);
  const [apiKeys,   setApiKeys]   = useState<ApiKeyHealth[]>([]);
  const [keyStats,  setKeyStats]  = useState<Record<string, KeyStats>>({});
  const [loading,   setLoading]   = useState(true);
  const [statsLoad, setStatsLoad] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [aiOffline, setAiOffline] = useState(false);
  const [aiUsage,     setAiUsage]     = useState<TenantAiUsage[]>([]);
  const [aiUsageLoad, setAiUsageLoad] = useState(true);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/admin/system/health');
      setServices(res.data.data.services ?? []);
      setApiKeys(res.data.data.apiKeys ?? []);
      setAiOffline(res.data.data.aiServiceOffline ?? false);
      setLastFetch(new Date());
    } catch { toast.error('Failed to fetch system health'); }
    finally { setLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoad(true);
    try {
      const res = await authService.adminGetKeyStats();
      setKeyStats(res.data.data.usage ?? {});
    } catch { /* stats optional */ }
    finally { setStatsLoad(false); }
  }, []);

  const loadAiUsage = useCallback(async () => {
    setAiUsageLoad(true);
    try {
      const res = await authService.adminGetAiUsage();
      setAiUsage(res.data.data.tenants ?? []);
    } catch { /* stats optional */ }
    finally { setAiUsageLoad(false); }
  }, []);

  const refresh = useCallback(() => { loadHealth(); loadStats(); loadAiUsage(); }, [loadHealth, loadStats, loadAiUsage]);
  useEffect(() => { refresh(); }, [refresh]);

  const svcCls = (s: string) => s === 'ok' ? 'bg-success-500/10 border-success-500/20' : 'bg-danger-500/10 border-danger-500/20';
  const configuredCount = apiKeys.filter((k) => k.set).length;
  const missingCount    = apiKeys.filter((k) => !k.set).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">System Health & API Analytics</h1>
          <p className="text-xs text-text-muted mt-0.5">{lastFetch ? `Last checked: ${lastFetch.toLocaleTimeString()}` : 'Checking…'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-success-700 dark:text-success-500 bg-success-500/10 border border-success-500/20 px-3 py-1 rounded-full">{configuredCount} configured</span>
          {missingCount > 0 && <span className="text-xs text-danger-700 dark:text-danger-500 bg-danger-500/10 border border-danger-500/20 px-3 py-1 rounded-full">{missingCount} missing</span>}
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Infrastructure Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading && services.length === 0
            ? [0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-border animate-pulse" />)
            : services.map((svc) => (
                <div key={svc.name} className={`rounded-xl p-4 border ${svcCls(svc.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <ServerIcon className="h-5 w-5 text-text-muted" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${svc.status === 'ok' ? 'text-success-700 dark:text-success-500' : 'text-danger-700 dark:text-danger-500'}`}>
                      {svc.status === 'ok' ? '● Online' : '● Offline'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{svc.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{svc.detail}</p>
                </div>
              ))}
        </div>
      </div>

      {aiOffline && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">AI service is offline — AI key statuses cannot be determined until it reconnects.</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">API Keys & Analytics</h2>
          <p className="text-xs text-text-muted flex items-center gap-1">
            <InformationCircleIcon className="h-3.5 w-3.5" />
            Click any row to expand details · Key values are never exposed
          </p>
        </div>
        <AdminCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Service / Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase hidden md:table-cell">Env Variable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">Calls Today</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && apiKeys.length === 0
                ? [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded animate-pulse w-3/4" /></td></tr>
                  ))
                : apiKeys.map((k) => <KeyRow key={k.key} k={k} stats={keyStats[k.provider]} loading={statsLoad} />)}
            </tbody>
          </table>
        </AdminCard>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">AI Token Usage & Quotas (this month)</h2>
          <p className="text-xs text-text-muted flex items-center gap-1" title="Only conversations through a tenant's public website widget count toward their quota. At 100%, the AI stops replying with generated answers — but the widget stays up and still collects the visitor's name/email as a lead.">
            <InformationCircleIcon className="h-3.5 w-3.5" />
            Covers the public chat widget only · at 100%, AI replies pause but leads keep coming in
          </p>
        </div>
        <AdminCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border">
                {['Tenant', 'Plan', 'Tokens Used / Limit', 'Quota Remaining', 'Est. Cost', 'Conversations', 'Safety Check Issues', 'Push-to-talk Voice', 'Continuous Voice'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aiUsageLoad && aiUsage.length === 0
                ? [0, 1, 2].map((i) => <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded animate-pulse w-3/4" /></td></tr>)
                : aiUsage.length === 0
                ? <tr><td colSpan={9} className="px-4 py-6 text-center text-xs text-text-muted">No AI usage recorded yet this month</td></tr>
                : aiUsage.map((t) => {
                    const pct = Math.round(t.percentUsed * 100);
                    const barColor = pct >= 100 ? 'bg-danger-500' : pct >= 95 ? 'bg-danger-400' : pct >= 90 ? 'bg-orange-400' : pct >= 80 ? 'bg-amber-400' : 'bg-success-500';
                    const textColor = pct >= 95 ? 'text-danger-600 dark:text-danger-500' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted';
                    return (
                      <tr key={t.tenantId} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-text-primary font-medium">{t.tenantName}</td>
                        <td className="px-4 py-3 text-text-muted capitalize">{t.plan}</td>
                        <td className="px-4 py-3 text-text-primary tabular-nums">{t.tokensUsedThisMonth.toLocaleString()} / {t.monthlyTokenLimit.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-black/[0.08] dark:bg-white/[0.1] overflow-hidden">
                              <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{pct}%{pct >= 100 ? ' — AI paused' : ''}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-primary tabular-nums">${t.estimatedCostUsd.toFixed(4)}</td>
                        <td className="px-4 py-3 text-text-muted tabular-nums">{t.requestCount.toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums">{t.moderationFallbackCount > 0 ? <span className="text-amber-600 dark:text-amber-400">{t.moderationFallbackCount}</span> : <span className="text-text-muted">0</span>}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {t.voiceRequestCount > 0 ? <span className="text-cyan-700 dark:text-cyan-400">{t.voiceRequestCount} · ${t.voiceCostUsd.toFixed(4)}</span> : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {t.continuousVoiceSessionCount > 0 ? (() => {
                            const vPct = Math.round(t.voiceMinutesPercentUsed * 100);
                            const vTextColor = vPct >= 95 ? 'text-danger-600 dark:text-danger-500' : vPct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-purple-700 dark:text-purple-400';
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className={vTextColor}>{t.continuousVoiceMinutesUsed.toFixed(1)} / {t.monthlyVoiceMinutesLimit.toLocaleString()} min ({vPct}%{vPct >= 100 ? ' — paused' : ''})</span>
                                <span className="text-text-muted text-[11px]">{t.continuousVoiceSessionCount} calls · ${t.continuousVoiceCostUsd.toFixed(4)}</span>
                              </div>
                            );
                          })() : <span className="text-text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </AdminCard>
      </div>
    </div>
  );
}
