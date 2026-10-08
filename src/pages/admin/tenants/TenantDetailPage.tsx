import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronLeftIcon, UsersIcon, UserGroupIcon, LinkIcon,
  ChartBarIcon, MegaphoneIcon, ExclamationTriangleIcon,
  CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { useTenantAiUsageQuery } from '../../../modules/native-crm/queries/tenant.queries';
import { AdminCard, AdminCardHeader, AdminLoadingState, AdminErrorState, AdminEmptyState } from '../shared/AdminCard';
import { ActiveBadge } from '../shared/StatusBadge';
import { CopyIconButton } from '../shared/CopyIconButton';
import { PLAN_CONFIG, CONNECTOR_CONFIG, timeAgo } from '../shared/adminConfig';
import { ConfirmDangerousAction } from '../shared/ConfirmDangerousAction';
import { TenantControlsTab } from './TenantControlsTab';
import CredentialsRevealModal from './CredentialsRevealModal';
import type { TenantDetail, TenantUser } from '../shared/adminTypes';

type Tab = 'overview' | 'users' | 'customers' | 'connectors' | 'ai-usage' | 'campaigns' | 'controls';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',   label: 'Overview' },
  { id: 'users',      label: 'Users' },
  { id: 'customers',  label: 'Customers' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'ai-usage',   label: 'AI & Usage' },
  { id: 'campaigns',  label: 'Campaigns' },
  { id: 'controls',   label: 'Controls' },
];

/** Only Super Admin can set a tenant's AI budget — see tenant.service.ts's
 * updateTenant() allow-list, which deliberately excludes these 4 fields from
 * the TENANT_ADMIN-reachable PUT /tenants/:id so a tenant can't raise its
 * own limit. This tab is the one place that write actually happens now
 * (PUT /admin/tenants/:id/ai-config); the tenant's own Widget Settings page
 * only displays these numbers read-only. Blank input = no override, use the
 * plan default (Platform Defaults → Plan Defaults, editable there). */
function AiUsageTab({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const { data: usage, isLoading, isError, refetch } = useTenantAiUsageQuery(tenantId);
  const [hydrated, setHydrated]   = useState(false);
  const [tokenLimit, setTokenLimit]     = useState('');
  const [voiceLimit, setVoiceLimit]     = useState('');
  const [warningPct, setWarningPct]     = useState('80');
  const [criticalPct, setCriticalPct]   = useState('95');
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Hydrate the edit form once, from the first successful load — not on
  // every 60s poll tick (useTenantAiUsageQuery refetches live usage in the
  // background), so an admin mid-edit never has their in-progress changes
  // silently overwritten.
  useEffect(() => {
    if (usage && !hydrated) {
      setTokenLimit(usage.customTokenLimit != null ? String(usage.customTokenLimit) : '');
      setVoiceLimit(usage.customVoiceMinutesLimit != null ? String(usage.customVoiceMinutesLimit) : '');
      setWarningPct(String(usage.warningThresholdPercent));
      setCriticalPct(String(usage.criticalThresholdPercent));
      setHydrated(true);
    }
  }, [usage, hydrated]);

  if (isLoading) return <AdminLoadingState label="Loading AI usage…" />;
  if (isError || !usage) return <AdminErrorState description="Couldn't load this tenant's AI usage." />;

  const statusTone = usage.status === 'exceeded' || usage.status === 'critical' ? 'bg-danger-500'
    : usage.status === 'warning' ? 'bg-amber-500' : 'bg-success-500';
  const statusLabel = usage.status === 'exceeded' ? 'Limit reached' : usage.status === 'critical' ? 'Critical' : usage.status === 'warning' ? 'Warning' : 'Normal';
  const statusCls = usage.status === 'exceeded' || usage.status === 'critical' ? 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20'
    : usage.status === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' : 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20';

  const handleSave = async () => {
    const warning = Number(warningPct);
    const critical = Number(criticalPct);
    if (!Number.isFinite(warning) || warning < 1 || warning > 100 || !Number.isFinite(critical) || critical < 1 || critical > 100) {
      toast.error('Thresholds must be between 1 and 100'); return;
    }
    if (warning >= critical) {
      toast.error('Warning threshold must be lower than critical threshold'); return;
    }
    setSaving(true);
    try {
      await authService.adminUpdateTenantAiConfig(tenantId, {
        monthlyTokenLimit: tokenLimit.trim() ? Number(tokenLimit) : null,
        monthlyVoiceMinutesLimit: voiceLimit.trim() ? Number(voiceLimit) : null,
        tokenWarningThresholdPercent: warning,
        tokenCriticalThresholdPercent: critical,
      });
      toast.success(`AI usage limits saved for ${tenantName}`);
      await refetch();
    } catch {
      toast.error('Failed to save AI usage limits');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await authService.adminUpdateTenantAiConfig(tenantId, { resetUsageCounter: true });
      toast.success(`Usage counter reset for ${tenantName} — full balance available again`);
      setShowResetConfirm(false);
      await refetch();
    } catch {
      toast.error('Failed to reset usage counter');
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminCard>
      <AdminCardHeader
        icon={ChartBarIcon}
        title="AI Token Usage — Prepaid Credits"
        description={`Plan default: ${usage.planDefaultTokenLimit.toLocaleString()} tokens (${usage.plan})`}
        right={<span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCls}`}>{statusLabel}</span>}
      />
      <div className="p-6 space-y-5">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm text-text-muted">{usage.tokensUsedThisMonth.toLocaleString()} / {usage.monthlyTokenLimit.toLocaleString()} tokens</span>
            <span className="text-sm font-semibold text-text-primary">{usage.percentUsed}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div className={`h-full rounded-full ${statusTone}`} style={{ width: `${Math.min(100, usage.percentUsed)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-text-muted">
              {usage.tokensRemaining.toLocaleString()} tokens remaining
              {usage.customTokenLimit != null ? ' · custom limit set' : ' · using plan default'}
              {' · '}granted {new Date(usage.creditsLastResetAt).toLocaleDateString()}
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs font-medium text-ryze-600 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 shrink-0"
            >
              Grant more credits
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">
            This is a prepaid balance, not a monthly subscription — it does not refill on its own. It only resets when you grant more credits here.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-text-muted">Voice minutes used</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">{usage.voiceMinutesUsedThisMonth.toFixed(1)} / {usage.monthlyVoiceMinutesLimit}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Warning / Critical thresholds</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">{usage.warningThresholdPercent}% / {usage.criticalThresholdPercent}%</p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-3">Set this tenant's limits</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Monthly Token Limit</label>
              <input
                type="number" min={0} value={tokenLimit} onChange={(e) => setTokenLimit(e.target.value)}
                placeholder={`Blank = plan default (${usage.planDefaultTokenLimit.toLocaleString()})`}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Monthly Voice Minutes Limit</label>
              <input
                type="number" min={0} value={voiceLimit} onChange={(e) => setVoiceLimit(e.target.value)}
                placeholder={`Blank = plan default (${usage.planDefaultVoiceMinutesLimit})`}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Warning Threshold %</label>
              <input
                type="number" min={1} max={100} value={warningPct} onChange={(e) => setWarningPct(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Critical Threshold %</label>
              <input
                type="number" min={1} max={100} value={criticalPct} onChange={(e) => setCriticalPct(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
              />
            </div>
          </div>
          <button
            onClick={handleSave} disabled={saving}
            className="mt-4 px-4 py-2 rounded-lg bg-ryze-600 hover:bg-ryze-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <p className="text-xs text-text-muted mt-2">
            Per-plan defaults (used when a field above is left blank) are editable in{' '}
            <Link to="/admin/platform-defaults" className="font-medium text-ryze-600 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">Platform Defaults</Link>.
          </p>
        </div>
      </div>

      <ConfirmDangerousAction
        open={showResetConfirm}
        title={`Grant more credits to ${tenantName}?`}
        consequences={[
          `Their usage counter goes back to 0 / ${usage.monthlyTokenLimit.toLocaleString()} tokens immediately.`,
          'This does not change their token or voice-minute limit — only use this if they\'ve actually run out and need a fresh balance.',
          'To also change their limit, set it in the fields above first, then grant credits.',
        ]}
        confirmWord={tenantName}
        confirmLabel="Grant Credits"
        loading={resetting}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
      />
    </AdminCard>
  );
}

export default function TenantDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? initialTab : 'overview');
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [regeneratingFor, setRegeneratingFor] = useState<string | null>(null);
  const [regenResult, setRegenResult] = useState<{ loginId: string; email: string; temporaryPassword: string; emailSent: boolean } | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    authService.adminTenantDetail(id)
      .then((r) => setDetail(r.data.data))
      .catch(() => { setError(true); toast.error('Failed to load tenant detail'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const changeTab = (t: Tab) => {
    setTab(t);
    setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  };

  const handleToggleActive = async (reason?: string) => {
    if (!detail) return;
    setToggling(true);
    try {
      const res = await authService.toggleClient(id, reason);
      setDetail((prev) => prev ? { ...prev, tenant: { ...prev.tenant, isActive: res.data.data.isActive } } : prev);
      toast.success(res.data.message);
      setConfirmDeactivate(false);
    } catch {
      toast.error('Failed to update tenant status');
    } finally {
      setToggling(false);
    }
  };

  // GET /admin/tenants/:id returns {tenant, users, ...} — unlike the list
  // endpoint (GET /admin/clients), it does NOT merge a computed `adminUser`
  // onto `tenant`, so it's derived here from the users array instead.
  const adminUser = detail?.users.find((u) => u.role === 'TENANT_ADMIN') ?? null;

  const handleRegeneratePasswordFor = async (targetUser: TenantUser) => {
    if (!window.confirm(`Regenerate the password for ${targetUser.email}? A new password will be emailed to them and the old one will stop working immediately.`)) return;
    setRegeneratingFor(targetUser._id);
    try {
      const res = await authService.adminResetUserPassword(targetUser._id, undefined, true);
      const { password, emailSent, loginId } = res.data.data;
      setRegenResult({ loginId: loginId ?? detail?.tenant.clientId ?? '(no Login ID on this account)', email: targetUser.email, temporaryPassword: password, emailSent });
      // Update the inline display immediately, without a full reload.
      setDetail((prev) => prev
        ? { ...prev, users: prev.users.map((x) => x._id === targetUser._id ? { ...x, password } : x) }
        : prev);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to regenerate password');
    } finally {
      setRegeneratingFor(null);
    }
  };

  if (loading) return <AdminLoadingState label="Loading tenant…" />;
  if (error || !detail) return <AdminErrorState description="Couldn't load this tenant." onRetry={load} />;

  const { tenant } = detail;
  const plan = PLAN_CONFIG[tenant.plan];

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/admin/tenants')} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ChevronLeftIcon className="h-4 w-4" /> All Tenants
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-ryze-600/10 border border-ryze-600/20 flex items-center justify-center text-sm font-bold text-ryze-600 dark:text-ryze-400">
            {tenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary">{tenant.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${plan?.cls || 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>
                {plan?.label || tenant.plan}
              </span>
              <ActiveBadge active={tenant.isActive} />
            </div>
            <p className="text-xs text-text-muted mt-0.5">{adminUser?.email ?? 'No admin assigned'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Users',      v: detail.users.length,         icon: UsersIcon },
          { label: 'Customers',  v: tenant.customerCount,        icon: UserGroupIcon },
          { label: 'Connectors', v: detail.connectors.length,    icon: LinkIcon },
          { label: 'Campaigns',  v: detail.campaigns.length,     icon: MegaphoneIcon },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-xl border border-border shadow-sm p-3 text-center">
            <s.icon className="h-4 w-4 text-text-muted mx-auto mb-1" />
            <div className="text-lg font-bold text-text-primary">{s.v}</div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => changeTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <AdminCard>
            <AdminCardHeader icon={LinkIcon} title="Active Connectors" />
            <div className="p-6">
              {detail.connectors.filter((c) => c.isActive).length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">No connectors yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.connectors.filter((c) => c.isActive).map((c) => {
                    const cfg = CONNECTOR_CONFIG[c.type];
                    return (
                      <span key={c._id} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg?.bg || 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot || 'bg-text-muted'}`} />
                        {cfg?.label || c.type}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminCard>

          <AdminCard tone="danger">
            <AdminCardHeader
              icon={ExclamationTriangleIcon}
              iconClassName="bg-danger-500/10 text-danger-600"
              title="Danger Zone"
              description={tenant.isActive ? 'Deactivating blocks all sign-ins and API access for this tenant.' : 'This tenant is currently deactivated.'}
            />
            <div className="p-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Tenant status</p>
                <p className="text-xs text-text-muted mt-0.5">{tenant.isActive ? 'Active — users can log in and use the CRM normally.' : 'Inactive — logins and API access are blocked.'}</p>
              </div>
              {tenant.isActive ? (
                <button
                  onClick={() => setConfirmDeactivate(true)}
                  className="px-4 py-2 text-sm bg-danger-600 hover:bg-danger-700 text-white font-medium rounded-lg transition-colors"
                >
                  Deactivate Tenant
                </button>
              ) : (
                <button
                  onClick={() => handleToggleActive()}
                  disabled={toggling}
                  className="px-4 py-2 text-sm bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  {toggling ? 'Working…' : 'Reactivate Tenant'}
                </button>
              )}
            </div>
          </AdminCard>
        </div>
      )}

      {tab === 'users' && (
        <AdminCard>
          {detail.users.length === 0 ? (
            <AdminEmptyState icon={UsersIcon} title="No users yet" description="Users invited to this tenant will appear here." />
          ) : (
            <div className="divide-y divide-border">
              {detail.users.map((u) => (
                <div key={u._id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-ryze-600/10 border border-ryze-600/20 flex items-center justify-center text-xs font-bold text-ryze-600 dark:text-ryze-400">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{u.firstName} {u.lastName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-text-muted font-mono">{u.email}</p>
                        <CopyIconButton value={u.email} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-text-muted font-mono">Login ID: {u.loginId ?? tenant.clientId ?? '—'}</p>
                        {(u.loginId ?? tenant.clientId) && <CopyIconButton value={u.loginId ?? tenant.clientId ?? ''} />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-text-muted font-mono">
                          Password: {u.password ?? (
                            <span className="italic text-text-muted/60">
                              {u.mustChangePassword ? 'not yet changed' : 'self-changed'}
                            </span>
                          )}
                        </p>
                        {u.password && <CopyIconButton value={u.password} />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-black/[0.04] dark:bg-white/[0.06] border border-border text-text-muted px-2 py-0.5 rounded-full">{u.role.replace('_', ' ')}</span>
                    {u.emailVerified ? <CheckCircleIcon className="h-4 w-4 text-success-500" /> : <ClockIcon className="h-4 w-4 text-amber-500" />}
                    <button
                      onClick={() => handleRegeneratePasswordFor(u)}
                      disabled={regeneratingFor === u._id}
                      className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                    >
                      {regeneratingFor === u._id ? 'Working…' : 'Regenerate Password'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      )}

      {tab === 'customers' && (
        <AdminCard>
          {detail.recentCustomers.length === 0 ? (
            <AdminEmptyState icon={UserGroupIcon} title="No customers yet" description="Customers captured by this tenant's CRM or chatbot will appear here." />
          ) : (
            <div className="divide-y divide-border">
              {detail.recentCustomers.map((c) => (
                <div key={c._id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-muted">{c.email || c.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CONNECTOR_CONFIG[c.channel]?.bg || 'bg-black/[0.04] dark:bg-white/[0.06] border-border text-text-muted'}`}>{c.channel}</span>
                    <span className="text-xs text-text-muted">{timeAgo(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      )}

      {tab === 'connectors' && (
        <AdminCard>
          {detail.connectors.length === 0 ? (
            <AdminEmptyState icon={LinkIcon} title="This tenant has not connected any external services yet." />
          ) : (
            <div className="divide-y divide-border">
              {detail.connectors.map((c) => {
                const cfg = CONNECTOR_CONFIG[c.type];
                return (
                  <div key={c._id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${cfg?.dot || 'bg-text-muted'}`} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{cfg?.label || c.type}</p>
                        <p className="text-xs text-text-muted">{timeAgo(c.createdAt)}</p>
                      </div>
                    </div>
                    <ActiveBadge active={c.isActive} />
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      )}

      {tab === 'ai-usage' && <AiUsageTab tenantId={id} tenantName={tenant.name} />}

      {tab === 'campaigns' && (
        <AdminCard>
          {detail.campaigns.length === 0 ? (
            <AdminEmptyState icon={MegaphoneIcon} title="No campaigns yet" />
          ) : (
            <div className="divide-y divide-border">
              {detail.campaigns.map((c) => (
                <div key={c._id} className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize border ${c.status === 'active' ? 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20' : 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>{c.status}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-muted">
                    <span>Sent <span className="text-text-primary font-medium">{c.stats.sent}</span></span>
                    <span>Delivered <span className="text-text-primary font-medium">{c.stats.delivered}</span></span>
                    <span>Opened <span className="text-text-primary font-medium">{c.stats.opened}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      )}

      {tab === 'controls' && <TenantControlsTab tenantId={id} tenantName={tenant.name} />}

      <ConfirmDangerousAction
        open={confirmDeactivate}
        title={`Deactivate ${tenant.name}?`}
        consequences={[
          'Block sign-in for every user at this tenant',
          'Reject their already-issued sessions on their next request',
          'Leave existing data untouched — nothing is deleted',
        ]}
        confirmWord={tenant.name}
        confirmLabel="Deactivate Tenant"
        requireReason
        loading={toggling}
        onCancel={() => setConfirmDeactivate(false)}
        onConfirm={(reason) => handleToggleActive(reason)}
      />

      {regenResult && (
        <CredentialsRevealModal
          title="Password regenerated"
          loginId={regenResult.loginId}
          email={regenResult.email}
          password={regenResult.temporaryPassword}
          emailSent={regenResult.emailSent}
          onClose={() => setRegenResult(null)}
        />
      )}
    </div>
  );
}
