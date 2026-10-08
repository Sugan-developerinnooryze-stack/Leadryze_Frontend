import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { ALL_FLAGS_TRUE, type FeatureFlags } from '../../../stores/featureFlags.store';
import { AdminLoadingState, AdminCard, AdminCardHeader } from '../shared/AdminCard';
import { FeatureFlagsEditor } from '../shared/FeatureFlagsEditor';
import { FLAG_GROUPS } from '../tenants/TenantControlsTab';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

const PLAN_TIERS = ['starter', 'growth', 'professional', 'enterprise'] as const;
type PlanTier = typeof PLAN_TIERS[number];
const PLAN_LABELS: Record<PlanTier, string> = {
  starter: 'Starter', growth: 'Growth', professional: 'Professional', enterprise: 'Enterprise',
};

interface AiPlanDefault {
  monthlyTokenLimit: number;
  monthlyVoiceMinutesLimit: number;
  priceUsdPerMonth: number;
}

// Matches backend/src/modules/admin/platform-defaults.model.ts's own
// DEFAULT_AI_PLAN_DEFAULTS seed — only used here as the initial render
// state before the real (Super-Admin-editable) values load.
const EMPTY_PLAN_DEFAULTS: Record<PlanTier, AiPlanDefault> = {
  starter:      { monthlyTokenLimit: 300_000,   monthlyVoiceMinutesLimit: 100,  priceUsdPerMonth: 0 },
  growth:       { monthlyTokenLimit: 1_000_000, monthlyVoiceMinutesLimit: 250,  priceUsdPerMonth: 0 },
  professional: { monthlyTokenLimit: 1_500_000, monthlyVoiceMinutesLimit: 500,  priceUsdPerMonth: 0 },
  enterprise:   { monthlyTokenLimit: 8_000_000, monthlyVoiceMinutesLimit: 3000, priceUsdPerMonth: 0 },
};

/** The template every new tenant inherits at creation time, and what a
 * tenant on accessConfigMode:'default' has as its effective flags right
 * now. Editing here never touches a tenant already set to Customize.
 *
 * Also the single shared source for per-plan AI token/voice-minute limits
 * and pricing — replaces what used to be 3 independently-hardcoded copies
 * of the same numbers (tenant.service.ts, admin.routes.ts, ai/src/services/
 * context.builder.ts). A tenant's own custom override (set per-tenant from
 * its Tenant Detail → AI & Usage tab) still takes precedence over whatever
 * plan default is set here when one exists. */
export default function PlatformDefaultsPage() {
  const [flags, setFlags]     = useState<FeatureFlags>(ALL_FLAGS_TRUE);
  const [aiPlans, setAiPlans] = useState<Record<PlanTier, AiPlanDefault>>(EMPTY_PLAN_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authService.adminGetPlatformDefaults()
      .then((r) => {
        setFlags({ ...ALL_FLAGS_TRUE, ...r.data.data.flags });
        setAiPlans({ ...EMPTY_PLAN_DEFAULTS, ...r.data.data.aiPlanDefaults });
      })
      .catch(() => toast.error('Failed to load platform defaults'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = useCallback((key: keyof FeatureFlags, val: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: val }));
  }, []);

  const updatePlan = (tier: PlanTier, field: keyof AiPlanDefault, value: string) => {
    const num = Number(value);
    setAiPlans((prev) => ({ ...prev, [tier]: { ...prev[tier], [field]: Number.isFinite(num) ? num : 0 } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await authService.adminSetPlatformDefaults(flags as unknown as Record<string, boolean>, aiPlans);
      toast.success('Platform defaults saved');
    } catch {
      toast.error('Failed to save platform defaults');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading platform defaults…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Platform Defaults</h1>
        <p className="text-sm text-text-muted mt-0.5">
          The template new tenants inherit automatically, and what any tenant on "Use System Default" is currently showing. Editing here never changes a tenant that's been individually customized.
        </p>
      </div>

      <AdminCard>
        <AdminCardHeader
          icon={CurrencyDollarIcon}
          title="AI Plan Defaults"
          description="Per-plan monthly AI budget and price — what a tenant's usage limit falls back to when no per-tenant override is set (Tenant Detail → AI & Usage)."
        />
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Monthly Token Limit</th>
                <th className="pb-2 pr-4">Monthly Voice Minutes</th>
                <th className="pb-2">Price ($/month)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PLAN_TIERS.map((tier) => (
                <tr key={tier}>
                  <td className="py-3 pr-4 font-medium text-text-primary whitespace-nowrap">{PLAN_LABELS[tier]}</td>
                  <td className="py-3 pr-4">
                    <input
                      type="number" min={0} value={aiPlans[tier].monthlyTokenLimit}
                      onChange={(e) => updatePlan(tier, 'monthlyTokenLimit', e.target.value)}
                      className="w-36 px-2.5 py-1.5 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      type="number" min={0} value={aiPlans[tier].monthlyVoiceMinutesLimit}
                      onChange={(e) => updatePlan(tier, 'monthlyVoiceMinutesLimit', e.target.value)}
                      className="w-28 px-2.5 py-1.5 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
                    />
                  </td>
                  <td className="py-3">
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                      <input
                        type="number" min={0} value={aiPlans[tier].priceUsdPerMonth}
                        onChange={(e) => updatePlan(tier, 'priceUsdPerMonth', e.target.value)}
                        className="w-full pl-6 pr-2.5 py-1.5 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <FeatureFlagsEditor groups={FLAG_GROUPS} flags={flags as unknown as Record<string, boolean>} onChange={toggle} />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Saving…' : 'Save Platform Defaults'}
      </button>
    </div>
  );
}
