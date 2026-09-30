import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  ArrowPathIcon, ShieldCheckIcon, ExclamationTriangleIcon, ComputerDesktopIcon,
  ClipboardDocumentListIcon, CheckCircleIcon, XCircleIcon, ChevronRightIcon, WifiIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { AdminCard, AdminEmptyState } from '../shared/AdminCard';

interface SecurityEventItem {
  _id: string; event: string; tenantId?: string; userId?: string;
  ip: string; userAgent: string; detail?: Record<string, unknown>; timestamp: string;
}
interface SecurityStats { by24h: Record<string, number>; by7d: Record<string, number>; topIPs: { _id: string; count: number }[] }
interface SecurityPosture {
  score: number; grade: 'good' | 'warning' | 'critical';
  checks: { id: string; label: string; pass: boolean }[];
  events24h: { failedLogins24h: number; rateLimitHits24h: number; webhookFails24h: number; tokenErrors24h: number };
}
interface ConnectorHealth {
  stats: { total: number; active: number; healthy: number; failed: number; pending: number };
  connectors: { id: string; type: string; name: string; isActive: boolean; syncStatus: string; lastSyncAt?: string; syncError?: string; tenant: string }[];
}
interface ActiveSession {
  id: string; userId: string;
  user: { firstName: string; lastName: string; email: string; role: string } | null;
  tenantId: string; ip: string; city: string; country: string;
  browser: string; os: string; createdAt: string; expiresAt: string;
}
interface AuditLogItem {
  _id: string; tenantId?: string; actorId: string; actorEmail: string; actorRole: string;
  action: string; target?: string; targetId?: string; detail?: Record<string, unknown>;
  ip: string; timestamp: string;
}

type SecuritySubTab = 'overview' | 'events' | 'sessions' | 'audit';

const EVENT_SEVERITY: Record<string, 'red' | 'amber' | 'green'> = {
  'auth.login_failed': 'red', 'webhook.sig_invalid': 'red', 'tenant.access_denied': 'red',
  'websocket.auth_failed': 'red', 'ai.prompt_blocked': 'red',
  'ratelimit.violation': 'amber', 'auth.token_expired': 'amber', 'auth.token_invalid': 'amber',
  'auth.login_success': 'green', 'auth.logout': 'green', 'auth.password_reset': 'green', 'auth.email_verified': 'green',
};
const SEV_CLS: Record<string, string> = {
  red:   'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20',
  amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  green: 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20',
};
const ALL_EVENT_TYPES = [
  'auth.login_failed', 'auth.login_success', 'auth.logout',
  'auth.token_expired', 'auth.token_invalid', 'auth.password_reset', 'auth.email_verified',
  'ratelimit.violation', 'webhook.sig_invalid', 'websocket.auth_failed', 'tenant.access_denied',
  'ai.prompt_blocked',
];
const GRADE_CLS = {
  good:     { bar: 'bg-success-500', text: 'text-success-600 dark:text-success-500', label: 'Good' },
  warning:  { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     label: 'Warning' },
  critical: { bar: 'bg-danger-500',  text: 'text-danger-600 dark:text-danger-500',   label: 'Critical' },
};
const SNAPSHOT_CLS: Record<string, string> = {
  red:   'bg-danger-500/10 border-danger-500/20 text-danger-600 dark:text-danger-500',
  amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400',
  blue:  'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400',
};

export default function SecurityPage() {
  const [subTab,     setSubTab]     = useState<SecuritySubTab>('overview');
  const [events,     setEvents]     = useState<SecurityEventItem[]>([]);
  const [stats,      setStats]      = useState<SecurityStats | null>(null);
  const [posture,    setPosture]    = useState<SecurityPosture | null>(null);
  const [connHealth, setConnHealth] = useState<ConnectorHealth | null>(null);
  const [sessions,   setSessions]   = useState<ActiveSession[]>([]);
  const [auditLogs,  setAuditLogs]  = useState<AuditLogItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('');
  const [ipFilter,   setIpFilter]   = useState('');
  const [expandedId, setExpanded]   = useState<string | null>(null);
  const [lastRefresh, setLast]      = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (subTab === 'overview') {
        const [postRes, connRes, stRes] = await Promise.all([
          authService.adminGetSecurityPosture(), authService.adminGetConnectorHealth(), authService.adminGetSecurityStats(),
        ]);
        setPosture(postRes.data.data); setConnHealth(connRes.data.data); setStats(stRes.data.data);
      } else if (subTab === 'events') {
        const params: Record<string, string> = { limit: '100' };
        if (filter) params.event = filter;
        if (ipFilter) params.ip = ipFilter;
        const [evRes, stRes] = await Promise.all([authService.adminGetSecurityEvents(params), authService.adminGetSecurityStats()]);
        setEvents(evRes.data.data.events ?? []); setStats(stRes.data.data);
      } else if (subTab === 'sessions') {
        const res = await authService.adminGetSessions();
        setSessions(res.data.data.sessions ?? []);
      } else if (subTab === 'audit') {
        const res = await authService.adminGetAuditLogs({ limit: '100' });
        setAuditLogs(res.data.data.logs ?? []);
      }
      setLast(new Date());
    } catch { toast.error('Failed to load security data'); }
    finally { setLoading(false); }
  }, [subTab, filter, ipFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const handleTerminateSession = async (id: string) => {
    try {
      await authService.adminTerminateSession(id);
      toast.success('Session terminated');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { toast.error('Failed to terminate session'); }
  };

  const stat24h   = stats?.by24h ?? {};
  const totalEvts = Object.values(stat24h).reduce((a, b) => a + b, 0);
  const tokenErrs = (stat24h['auth.token_expired'] ?? 0) + (stat24h['auth.token_invalid'] ?? 0);

  const SUBTABS: { id: SecuritySubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview',  icon: ShieldCheckIcon },
    { id: 'events',   label: 'Events',    icon: ExclamationTriangleIcon },
    { id: 'sessions', label: 'Sessions',  icon: ComputerDesktopIcon },
    { id: 'audit',    label: 'Audit Logs', icon: ClipboardDocumentListIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Security Center</h1>
          <p className="text-xs text-text-muted mt-0.5">{lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : 'Loading…'} · Auto-refreshes every 30s</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {SUBTABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
              subTab === id ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          {subTab === 'overview' && posture && connHealth && (
            <div className="space-y-6">
              <AdminCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Security Health Score</h3>
                    <p className="text-xs text-text-muted mt-0.5">Computed from config + 24h event counts</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-extrabold ${GRADE_CLS[posture.grade].text}`}>{posture.score}</p>
                    <p className={`text-xs font-semibold ${GRADE_CLS[posture.grade].text}`}>{GRADE_CLS[posture.grade].label}</p>
                  </div>
                </div>
                <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full h-2 mb-6">
                  <div className={`h-2 rounded-full transition-all ${GRADE_CLS[posture.grade].bar}`} style={{ width: `${posture.score}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {posture.checks.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5">
                      {c.pass ? <CheckCircleIcon className="h-4 w-4 text-success-500 shrink-0" /> : <XCircleIcon className="h-4 w-4 text-danger-500 shrink-0" />}
                      <span className={`text-xs ${c.pass ? 'text-text-muted' : 'text-danger-600 dark:text-danger-500'}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </AdminCard>

              <AdminCard className="p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">Encryption & Auth Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'JWT Secret',         pass: posture.checks.find((c) => c.id === 'jwt_secret')?.pass ?? false },
                    { label: 'JWT Refresh Secret', pass: posture.checks.find((c) => c.id === 'jwt_refresh')?.pass ?? false },
                    { label: 'Encryption Key',     pass: posture.checks.find((c) => c.id === 'encryption_key')?.pass ?? false },
                    { label: 'Internal API Key',   pass: posture.checks.find((c) => c.id === 'internal_key')?.pass ?? false },
                    { label: 'Email Alerts',       pass: posture.checks.find((c) => c.id === 'brevo_configured')?.pass ?? false },
                    { label: 'AES-256-GCM (Connector Credentials)', pass: true },
                    { label: 'bcrypt (Passwords)',                  pass: true },
                    { label: 'SHA-256 (Token Hashing)',             pass: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 py-1.5">
                      {item.pass ? <CheckCircleIcon className="h-4 w-4 text-success-500 shrink-0" /> : <XCircleIcon className="h-4 w-4 text-amber-500 shrink-0" />}
                      <span className={`text-xs ${item.pass ? 'text-text-muted' : 'text-amber-700 dark:text-amber-400'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </AdminCard>

              <AdminCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">Connector Health</h3>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success-500" />{connHealth.stats.healthy} Healthy</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger-500" />{connHealth.stats.failed} Failed</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-text-muted" />{connHealth.stats.pending} Pending</span>
                  </div>
                </div>
                {connHealth.connectors.length === 0 ? (
                  <p className="text-xs text-text-muted py-4 text-center">No connectors configured across any tenant</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-text-muted uppercase tracking-wider border-b border-border">
                        <tr>{['Type', 'Name', 'Tenant', 'Status', 'Last Sync', 'Error'].map((h) => <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {connHealth.connectors.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2.5 pr-4 font-mono text-text-muted uppercase">{c.type}</td>
                            <td className="py-2.5 pr-4 text-text-primary">{c.name}</td>
                            <td className="py-2.5 pr-4 text-text-muted">{c.tenant}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`px-2 py-0.5 rounded-full font-medium border ${
                                c.syncStatus === 'success' ? 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20'
                                  : c.syncStatus === 'failed' ? 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20'
                                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'
                              }`}>{c.syncStatus || 'never'}</span>
                            </td>
                            <td className="py-2.5 pr-4 text-text-muted">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleDateString() : '—'}</td>
                            <td className="py-2.5 text-danger-600 dark:text-danger-500 max-w-xs truncate">{c.syncError ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AdminCard>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Failed Logins',    value: posture.events24h.failedLogins24h,  color: 'red'   },
                  { label: 'Rate Limit Hits',  value: posture.events24h.rateLimitHits24h, color: 'amber' },
                  { label: 'Webhook Failures', value: posture.events24h.webhookFails24h,  color: 'amber' },
                  { label: 'Token Errors',     value: posture.events24h.tokenErrors24h,   color: 'blue'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl p-4 border ${SNAPSHOT_CLS[color]}`}>
                    <p className="text-2xl font-extrabold">{value}</p>
                    <p className="text-xs text-text-muted mt-1">{label} (24h)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'events' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Failed Logins',      value: stat24h['auth.login_failed']    ?? 0, color: 'red'   },
                  { label: 'Rate Limit Hits',    value: stat24h['ratelimit.violation']  ?? 0, color: 'amber' },
                  { label: 'Token Errors',       value: tokenErrs,                            color: 'amber' },
                  { label: 'Webhook Failures',   value: stat24h['webhook.sig_invalid']  ?? 0, color: 'red'   },
                  { label: 'Tenant Violations',  value: stat24h['tenant.access_denied'] ?? 0, color: 'red'   },
                  { label: 'Total Events (24h)', value: totalEvts,                            color: 'blue'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl p-4 border ${SNAPSHOT_CLS[color]}`}>
                    <p className="text-2xl font-extrabold">{value}</p>
                    <p className="text-xs text-text-muted mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                  className="bg-surface border border-border text-sm text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ryze-500">
                  <option value="">All Event Types</option>
                  {ALL_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} placeholder="Filter by IP…"
                  className="bg-surface border border-border text-sm text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ryze-500 w-44" />
              </div>

              <AdminCard>
                {events.length === 0 ? (
                  <AdminEmptyState icon={ShieldCheckIcon} title="No security events in the selected range" />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-black/[0.015] dark:bg-white/[0.02] text-text-muted text-xs uppercase tracking-wider">
                      <tr>{['Time', 'Event', 'Severity', 'Tenant', 'IP', ''].map((h) => <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {events.map((ev) => {
                        const sev = EVENT_SEVERITY[ev.event] ?? 'amber';
                        const isEx = expandedId === ev._id;
                        return (
                          <Fragment key={ev._id}>
                            <tr onClick={() => setExpanded(isEx ? null : ev._id)} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                              <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{new Date(ev.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                              <td className="px-4 py-3"><span className={`inline-flex text-xs font-mono px-2 py-0.5 rounded-full border ${SEV_CLS[sev]}`}>{ev.event}</span></td>
                              <td className="px-4 py-3"><span className={`text-xs font-semibold ${sev === 'red' ? 'text-danger-600 dark:text-danger-500' : sev === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-success-600 dark:text-success-500'}`}>{sev === 'red' ? '● High' : sev === 'amber' ? '● Medium' : '● Low'}</span></td>
                              <td className="px-4 py-3 text-xs text-text-muted font-mono">{ev.tenantId ? ev.tenantId.slice(-8) : '—'}</td>
                              <td className="px-4 py-3 text-xs text-text-primary font-mono">{ev.ip}</td>
                              <td className="px-3 py-3 text-text-muted"><ChevronRightIcon className={`h-4 w-4 transition-transform ${isEx ? 'rotate-90' : ''}`} /></td>
                            </tr>
                            {isEx && (
                              <tr className="bg-black/[0.015] dark:bg-white/[0.02]">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                      <p className="font-semibold text-text-muted uppercase tracking-wide mb-1">Detail</p>
                                      <pre className="text-text-muted bg-surface border border-border rounded-lg p-3 overflow-x-auto">{JSON.stringify(ev.detail ?? {}, null, 2)}</pre>
                                    </div>
                                    <div className="space-y-2">
                                      {ev.userId && <p className="text-text-muted"><span className="text-text-muted/70">User ID: </span>{ev.userId}</p>}
                                      {ev.tenantId && <p className="text-text-muted"><span className="text-text-muted/70">Tenant: </span>{ev.tenantId}</p>}
                                      <p className="text-text-muted break-all"><span className="text-text-muted/70">User Agent: </span>{ev.userAgent}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </AdminCard>

              {stats && stats.topIPs.length > 0 && (
                <AdminCard className="p-5">
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Top Offending IPs (24h)</h3>
                  <div className="space-y-2">
                    {stats.topIPs.map((item, i) => (
                      <div key={item._id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-muted w-5 text-right">{i + 1}</span>
                          <code className="text-xs text-text-primary font-mono">{item._id}</code>
                        </div>
                        <span className="text-xs font-semibold text-danger-600 dark:text-danger-500">{item.count} hits</span>
                      </div>
                    ))}
                  </div>
                </AdminCard>
              )}
            </div>
          )}

          {subTab === 'sessions' && (
            <AdminCard>
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">Active Sessions</h3>
                <p className="text-xs text-text-muted mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} currently active</p>
              </div>
              {sessions.length === 0 ? (
                <AdminEmptyState icon={WifiIcon} title="No active sessions" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/[0.015] dark:bg-white/[0.02] text-text-muted text-xs uppercase tracking-wider">
                      <tr>{['User', 'Role', 'IP / Location', 'Browser / OS', 'Signed In', ''].map((h) => <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-text-primary text-xs font-medium">{s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId.slice(-8)}</p>
                            <p className="text-text-muted text-xs">{s.user?.email ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border border-border">{s.user?.role ?? '—'}</span></td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-text-primary font-mono">{s.ip}</p>
                            <p className="text-xs text-text-muted">{s.city}, {s.country}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-text-muted">{s.browser}</p>
                            <p className="text-xs text-text-muted">{s.os}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{new Date(s.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleTerminateSession(s.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-700 dark:text-danger-500 text-xs hover:bg-danger-500/20 transition-colors">
                              <TrashIcon className="h-3.5 w-3.5" />
                              Terminate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          )}

          {subTab === 'audit' && (
            <AdminCard>
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">Audit Log</h3>
                <p className="text-xs text-text-muted mt-0.5">Admin accountability trail — who did what and when</p>
              </div>
              {auditLogs.length === 0 ? (
                <AdminEmptyState icon={ClipboardDocumentListIcon} title="No audit events recorded yet" description="Events are logged as admins perform privileged actions." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/[0.015] dark:bg-white/[0.02] text-text-muted text-xs uppercase tracking-wider">
                      <tr>{['Time', 'Actor', 'Role', 'Action', 'Target', 'IP'].map((h) => <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-4 py-3 text-xs text-text-primary">{log.actorEmail}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border border-border">{log.actorRole}</span></td>
                          <td className="px-4 py-3"><span className="text-xs font-mono text-ryze-700 dark:text-ryze-400">{log.action}</span></td>
                          <td className="px-4 py-3 text-xs text-text-muted">{log.target ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-text-muted font-mono">{log.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          )}
        </>
      )}
    </div>
  );
}
