import {
  CpuChipIcon, ChartBarIcon, ShieldExclamationIcon, AdjustmentsHorizontalIcon,
  LockClosedIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useTenantAiUsageQuery, useTenantAiUsageHistoryQuery, useCrmChatbotStatusQuery,
} from '../../../modules/native-crm/queries/tenant.queries';

/** The internal CRM Assistant's own settings tab — entirely separate from
 * WidgetSettingsPage.tsx (the public chatbot widget's own config page).
 * Every control here is either read-only (a value owned by Super Admin
 * elsewhere, shown so a tenant admin can SEE it) or backed by a real,
 * already-verified backend setting — nothing here is invented. */

const PROVIDER_LABEL: Record<string, string> = {
  groq: 'Groq', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google',
};

function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
      ok ? 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20'
         : 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20'
    }`}>
      {ok ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
      {ok ? okLabel : badLabel}
    </span>
  );
}

function CardHeader({ icon: Icon, title, description, right }: {
  icon: typeof CpuChipIcon; title: string; description: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-ryze-600/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export default function CrmChatbotSettingsPanel() {
  const { user } = useAuthStore();
  const tenantId = user?.tenantId ?? '';

  const { data: usage, isLoading: usageLoading, isError: usageError, dataUpdatedAt: usageUpdatedAt } = useTenantAiUsageQuery(tenantId);
  const { data: status, isLoading: statusLoading, isError: statusError, dataUpdatedAt: statusUpdatedAt } = useCrmChatbotStatusQuery(!!tenantId);
  const { data: history, isLoading: historyLoading } = useTenantAiUsageHistoryQuery(tenantId);

  const lastUpdated = Math.max(usageUpdatedAt || 0, statusUpdatedAt || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">CRM Chatbot Settings</h2>
          <p className="text-sm text-text-muted">The internal, staff-facing CRM assistant — separate from the public chatbot widget below.</p>
        </div>
        {lastUpdated > 0 && (
          <p className="text-[11px] text-text-muted">Last updated: {new Date(lastUpdated).toLocaleTimeString()}</p>
        )}
      </div>

      {/* 1. AI Provider & Model */}
      <div className="card">
        <CardHeader
          icon={CpuChipIcon} title="AI Provider & Model"
          description="The model that answers internal CRM Assistant questions."
          right={!statusLoading && !statusError && status?.aiService && (
            <StatusPill ok={status.aiService.connected} okLabel="Connected" badLabel="Not configured" />
          )}
        />
        {statusLoading ? (
          <div className="h-16 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
        ) : statusError || !status?.aiService ? (
          <p className="text-sm text-text-muted">Couldn't reach the AI service to check its current status. This doesn't affect token usage or limits below.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-muted">Active provider / model</p>
              <p className="font-medium text-text-primary mt-0.5">{PROVIDER_LABEL[status.aiService.provider] ?? status.aiService.provider} — {status.aiService.model}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Fallback provider / model</p>
              <p className="font-medium text-text-primary mt-0.5">{PROVIDER_LABEL[status.aiService.fallbackProvider] ?? status.aiService.fallbackProvider} — {status.aiService.fallbackModel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-text-muted">Your account's model preference</p>
              <p className="font-medium text-text-primary mt-0.5">
                {status.toolModelPreset ? `${PROVIDER_LABEL[status.toolModelPreset] ?? status.toolModelPreset} (set by your Super Admin)` : 'Platform default (no override set)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Token Usage & Limits */}
      <div className="card">
        <CardHeader icon={ChartBarIcon} title="Token Usage & Limits" description="Shared monthly allowance across both the public widget and this assistant." />
        {usageLoading ? (
          <div className="h-24 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
        ) : usageError || !usage ? (
          <p className="text-sm text-text-muted">Couldn't load usage data.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-text-muted">{usage.tokensUsedThisMonth.toLocaleString()} / {usage.monthlyTokenLimit.toLocaleString()} tokens (combined)</span>
                <span className="text-sm font-semibold text-text-primary">{usage.percentUsed}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                <div
                  className={`h-full rounded-full ${usage.status === 'exceeded' || usage.status === 'critical' ? 'bg-danger-500' : usage.status === 'warning' ? 'bg-amber-500' : 'bg-success-500'}`}
                  style={{ width: `${Math.min(100, usage.percentUsed)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {usage.tokensRemaining.toLocaleString()} tokens remaining · this is the ONE number that controls whether requests are allowed — the breakdown below is informational only.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-text-muted">Public Chatbot Widget</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{usage.usageBySource.publicWidget.toLocaleString()} tokens</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-text-muted">Internal CRM Assistant</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{usage.usageBySource.internalAssistant.toLocaleString()} tokens</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              This limit is set by your Super Admin and applies to both systems together — not a separate limit per system.
            </p>
          </div>
        )}
      </div>

      {/* 3. Rate Limits & Safety */}
      <div className="card">
        <CardHeader icon={ShieldExclamationIcon} title="Rate Limits & Safety" description="A separate, short-term safety limit — distinct from the monthly token allowance above." />
        {statusLoading ? (
          <div className="h-12 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
        ) : statusError || !status?.aiService ? (
          <p className="text-sm text-text-muted">Rate-limit status is unavailable right now.</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">{status.aiService.rateLimit.remaining} of {status.aiService.rateLimit.max} requests remaining this hour</p>
              <p className="text-xs text-text-muted mt-0.5">
                A per-tenant request-rate limit (this hour only), not the monthly token allowance above — the two are tracked and enforced separately.
              </p>
            </div>
            <StatusPill ok={status.aiService.rateLimit.allowed} okLabel="Normal" badLabel="Limit reached" />
          </div>
        )}
        <p className="text-xs text-text-muted mt-3">
          Per-user request limits aren't configurable today — only one shared, per-tenant hourly limit exists.
        </p>
      </div>

      {/* 4. Assistant Behavior */}
      <div className="card">
        <CardHeader icon={AdjustmentsHorizontalIcon} title="Assistant Behavior" description="Safeguards that are always on — nothing here is a toggle, since no backend setting exists to turn them off." />
        <ul className="space-y-2.5 text-sm">
          <li className="flex items-start gap-2.5">
            <LockClosedIcon className="h-4 w-4 text-ryze-600 dark:text-ryze-400 shrink-0 mt-0.5" />
            <span className="text-text-primary">Every create, update, or delete requires explicit staff confirmation before it happens — the assistant never writes data silently.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <LockClosedIcon className="h-4 w-4 text-ryze-600 dark:text-ryze-400 shrink-0 mt-0.5" />
            <span className="text-text-primary">Record visibility and write access always follow the staff member's own role, permissions, and branch restrictions — never broadened by the assistant.</span>
          </li>
        </ul>
      </div>

      {/* 5. Feature & Access Controls */}
      <div className="card">
        <CardHeader
          icon={status?.botEnabled !== false ? CheckCircleIcon : XCircleIcon}
          title="Feature & Access Controls"
          description="Whether the internal CRM assistant is enabled for your account."
        />
        {statusLoading ? (
          <div className="h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
        ) : (
          <>
            <StatusPill ok={status?.botEnabled !== false} okLabel="Enabled" badLabel="Disabled" />
            <p className="text-xs text-text-muted mt-2">
              Managed by your Super Admin. When disabled, the assistant is blocked at the server — not just hidden from this screen — so a direct API call is refused the same way.
            </p>
          </>
        )}
      </div>

      {/* 6. Usage History */}
      <div className="card">
        <CardHeader icon={ClockIcon} title="Usage History" description="Daily usage since your current billing period began." />
        {historyLoading ? (
          <div className="h-32 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse" />
        ) : !history || history.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">No usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted border-b border-border">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Tokens</th>
                  <th className="pb-2 pr-4 font-medium">Requests</th>
                  <th className="pb-2 font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={`${row.date}-${row.source}-${i}`} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-text-primary">{row.date}</td>
                    <td className="py-2 pr-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-muted">
                        {row.source === 'internal_assistant' ? 'Internal Assistant' : 'Public Widget'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-text-primary">
                      {row.totalTokens.toLocaleString()}
                      {row.isEstimated && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="The provider didn't report real usage for part of this day — this figure is a rough estimate, not an exact count.">
                          estimated
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-text-muted">{row.requestCount}</td>
                    <td className="py-2 text-text-muted">${row.estimatedCostUsd.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-text-muted mt-3">
              Estimated cost is always derived from token counts, not a provider-issued invoice — treat it as directional, not billing-grade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
