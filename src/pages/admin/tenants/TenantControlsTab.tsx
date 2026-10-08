import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Squares2X2Icon, UserGroupIcon, LinkIcon, CpuChipIcon, BoltIcon,
  BuildingOffice2Icon, WrenchScrewdriverIcon, Cog6ToothIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../../../services/auth.service';
import { ALL_FLAGS_TRUE, type FeatureFlags } from '../../../stores/featureFlags.store';
import { AdminCard, AdminLoadingState } from '../shared/AdminCard';
import { FeatureFlagsEditor, type FlagGroup } from '../shared/FeatureFlagsEditor';

const NOT_ENFORCED_NOTE = 'Saved, but no backend behavior currently reads this flag yet — see the Phase 2 roadmap.';
const CONNECTOR_NOTE = 'Blocks new connections for this tenant. An already-connected integration keeps syncing on its existing schedule — this doesn’t pause or disconnect it.';
const PLATFORM_FLOOR_NOTE = 'The platform-wide switch is currently ON for everyone, which always wins — turning this off has no effect right now. This only matters if the platform-wide switch is ever turned off, in which case it lets this one tenant opt back in.';
const NO_BACKEND_ROUTE_NOTE = 'Hides the sidebar link. There is no dedicated Supervisors API to also block server-side — this is a frontend-only gate.';

/** Authoritative inventory — every toggle here has been traced to its real
 * consumer (or confirmed to have none) directly in the codebase, not
 * assumed. See the plan's "Authoritative Controls inventory" section for
 * the evidence behind each `enforced` value. Nothing is hidden — an
 * unenforced toggle still saves, it's just labeled honestly. */
export const FLAG_GROUPS: FlagGroup[] = [
  {
    group: 'Sidebar Navigation',
    desc: 'Control which items appear in the left navigation',
    icon: Squares2X2Icon,
    items: [
      { key: 'nav_dashboard',  label: 'Dashboard',      enforced: true },
      { key: 'nav_aiChat',     label: 'AI Chat',        enforced: false, note: NOT_ENFORCED_NOTE },
      { key: 'nav_customers',  label: 'Customers',      enforced: true },
      { key: 'nav_campaigns',  label: 'Campaigns',      enforced: true },
      { key: 'nav_templates',  label: 'Templates',      enforced: true },
      { key: 'nav_analytics',  label: 'Analytics',      enforced: true },
      { key: 'nav_knowledge',  label: 'Knowledge Base', enforced: true },
      { key: 'nav_logs',       label: 'Logs',           enforced: true },
      { key: 'nav_connectors', label: 'Connectors',     enforced: true },
      { key: 'nav_settings',   label: 'Settings',       enforced: true },
      { key: 'nav_crmData',    label: 'CRM Data section', enforced: true },
      { key: 'nav_fieldService', label: 'Field Service section', enforced: true },
      { key: 'nav_configuration', label: 'Configuration section', enforced: true },
    ],
  },
  {
    group: 'Native CRM',
    desc: 'Control which Native CRM sub-items this tenant can access',
    icon: BuildingOffice2Icon,
    items: [
      { key: 'native_contacts',  label: 'Contacts',  enforced: true },
      { key: 'native_companies', label: 'Companies', enforced: true },
      { key: 'native_deals',     label: 'Deals',      enforced: true, note: 'Shared by Native CRM\'s own Deals link and Field Service\'s Deals page — both read the same underlying data, so one flag covers both.' },
      { key: 'native_tasks',     label: 'Tasks',      enforced: true },
      { key: 'native_tickets',   label: 'Tickets',    enforced: true },
      { key: 'native_calls',     label: 'Calls',      enforced: true },
      { key: 'native_meetings',  label: 'Meetings',   enforced: true },
    ],
  },
  {
    group: 'Field Service',
    desc: 'Control which Field Service sub-items this tenant can access',
    icon: WrenchScrewdriverIcon,
    items: [
      { key: 'fs_leads',      label: 'Leads',      enforced: true },
      { key: 'fs_categories', label: 'Categories', enforced: true },
      { key: 'fs_services',   label: 'Services',   enforced: true },
      { key: 'fs_teams',      label: 'Teams',      enforced: true },
      { key: 'fs_supervisors', label: 'Supervisors', enforced: false, note: NO_BACKEND_ROUTE_NOTE },
      { key: 'fs_staffs',     label: 'Staff',      enforced: true },
      { key: 'fs_customers',  label: 'Customers',  enforced: true },
      { key: 'fs_sites',      label: 'Sites',      enforced: true },
      { key: 'fs_parts',      label: 'Parts',      enforced: true },
      { key: 'fs_quotations', label: 'Quotations', enforced: true },
      { key: 'fs_workorders', label: 'Work Orders', enforced: true },
      { key: 'fs_contracts',  label: 'Contracts',  enforced: true },
      { key: 'fs_invoices',   label: 'Invoices',   enforced: true },
      { key: 'fs_receipts',   label: 'Receipts',   enforced: true },
      { key: 'fs_expenses',   label: 'Expenses',   enforced: true },
      { key: 'fs_activities', label: 'Activities', enforced: true },
      { key: 'fs_products',   label: 'Products',   enforced: true },
      { key: 'fs_assets',     label: 'Assets',     enforced: true },
      { key: 'fs_vehicles',   label: 'Vehicles',   enforced: true },
    ],
  },
  {
    group: 'Configuration',
    desc: 'Control which Configuration pages this tenant can access',
    icon: Cog6ToothIcon,
    items: [
      { key: 'config_hub',           label: 'Configuration Hub', enforced: true },
      { key: 'config_customFields',  label: 'Custom Fields',     enforced: true },
      { key: 'config_customModules', label: 'Custom Modules',    enforced: true },
      { key: 'config_fsSettings',    label: 'FS Settings',       enforced: true },
    ],
  },
  {
    group: 'Customers Page',
    desc: 'Control which tabs appear on the Customers page',
    icon: UserGroupIcon,
    items: [
      { key: 'customers_tabLeads',    label: 'Leads tab',    enforced: true },
      { key: 'customers_tabContacts', label: 'Contacts tab', enforced: true },
      { key: 'customers_tabDirect',   label: 'Direct tab',   enforced: true },
    ],
  },
  {
    group: 'Connectors',
    desc: 'Control which connector types are visible and available for this tenant',
    icon: LinkIcon,
    items: [
      { key: 'connector_zoho',       label: 'Zoho CRM',   enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_hubspot',    label: 'HubSpot',    enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_salesforce', label: 'Salesforce', enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_rest',       label: 'REST API',   enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_mysql',      label: 'MySQL',      enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_postgresql', label: 'PostgreSQL', enforced: true, note: CONNECTOR_NOTE },
      { key: 'connector_mongodb',    label: 'MongoDB',    enforced: true, note: CONNECTOR_NOTE },
    ],
  },
  {
    group: 'Bot & AI Controls',
    desc: 'Enable or disable bot features for this tenant',
    icon: CpuChipIcon,
    items: [
      { key: 'bot_enabled',      label: 'Internal AI assistant visible (staff-only — does not affect the public website chatbot)', enforced: true },
      { key: 'bot_leadCapture',  label: 'Lead capture (collect visitor data)',            enforced: true },
      { key: 'bot_escalation',   label: 'Human escalation (hand off to agent)',           enforced: true },
      { key: 'bot_ragSearch',    label: 'Knowledge base search (RAG)',                    enforced: true },
      { key: 'bot_piiMasking',   label: 'PII masking (hide sensitive data in logs)',      enforced: true, note: PLATFORM_FLOOR_NOTE },
      { key: 'bot_contentGuard', label: 'Content guardrails (block off-topic replies)',   enforced: true, note: PLATFORM_FLOOR_NOTE },
    ],
  },
  {
    group: 'Automation',
    desc: 'Automated follow-up and communication workflows',
    icon: BoltIcon,
    items: [
      { key: 'auto_followup',  label: 'Follow-up messages (post-lead capture)',    enforced: true },
      { key: 'auto_booking',   label: 'Booking confirmations & reminders',         enforced: true, note: 'Applies to bookings the AI/widget makes on a visitor’s behalf. A staff member manually scheduling a meeting is always confirmed, regardless of this flag.' },
      { key: 'auto_reminder',  label: 'Appointment reminders',                     enforced: true },
      { key: 'auto_feedback',  label: 'Post-interaction feedback requests',        enforced: false, note: 'Saved, but no scheduled job currently reads this flag — see the Phase 2 roadmap.' },
    ],
  },
];

export function TenantControlsTab({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [flags, setFlags]     = useState<FeatureFlags>(ALL_FLAGS_TRUE);
  const [effectiveFlags, setEffectiveFlags] = useState<FeatureFlags>(ALL_FLAGS_TRUE);
  const [mode, setMode]       = useState<'default' | 'custom'>('custom');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Tenant Limits — deliberately separate state from `flags`/`mode` above.
  // Not a feature flag: a seat cap, saved through its own small card and
  // its own button, per the explicit "don't mix these two concepts"
  // requirement this was built against.
  const [maxUsersInput, setMaxUsersInput] = useState('');   // '' = unlimited
  const [activeUsers, setActiveUsers]     = useState(0);
  const [savingLimit, setSavingLimit]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authService.adminGetFeatureFlags(tenantId)
      .then((r) => {
        setFlags({ ...ALL_FLAGS_TRUE, ...r.data.data.flags });
        setEffectiveFlags({ ...ALL_FLAGS_TRUE, ...(r.data.data.effectiveFlags ?? r.data.data.flags) });
        setMode(r.data.data.accessConfigMode ?? 'default');
        setMaxUsersInput(r.data.data.maxUsers != null ? String(r.data.data.maxUsers) : '');
        setActiveUsers(r.data.data.activeUsers ?? 0);
      })
      .catch(() => toast.error('Failed to load controls'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(load, [load]);

  const saveLimit = async () => {
    const trimmed = maxUsersInput.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
      toast.error('Enter a positive whole number, or leave blank for unlimited');
      return;
    }
    setSavingLimit(true);
    try {
      const res = await authService.adminSetFeatureFlags(tenantId, flags as unknown as Record<string, boolean>, undefined, parsed);
      toast.success(`User limit saved for ${tenantName}`);
      // LR-ADMIN-002: lowering the limit below current usage is allowed
      // (it only blocks new invites, never removes anyone) but deserves a
      // clear heads-up rather than silently taking effect.
      if (res.data?.data?.seatWarning) {
        toast(res.data.data.seatWarning, { icon: '⚠️', duration: 8000 });
      }
      load();
    } catch {
      toast.error('Failed to save user limit');
    } finally {
      setSavingLimit(false);
    }
  };

  const toggle = useCallback((key: keyof FeatureFlags, val: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: val }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await authService.adminSetFeatureFlags(tenantId, flags as unknown as Record<string, boolean>);
      toast.success(`Controls saved for ${tenantName}`);
      load();
    } catch {
      toast.error('Failed to save controls');
    } finally {
      setSaving(false);
    }
  };

  const switchMode = async (next: 'default' | 'custom') => {
    if (next === mode) return;
    setSaving(true);
    try {
      // Flags themselves are untouched by a mode switch — 'flags' here is
      // still the tenant's own raw stored values, so switching back to
      // 'custom' later restores exactly what was there before, not
      // whatever the template happened to say at the time.
      await authService.adminSetFeatureFlags(tenantId, flags as unknown as Record<string, boolean>, next);
      toast.success(next === 'default' ? 'Now using the system default' : 'Now customized for this tenant');
      load();
    } catch {
      toast.error('Failed to switch mode');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading controls…" />;

  return (
    <div className="space-y-5">
      <AdminCard>
        <div className="p-4 flex items-center gap-4 flex-wrap">
          <div className="h-9 w-9 rounded-lg bg-ryze-600/10 flex items-center justify-center shrink-0">
            <UsersIcon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-medium text-text-primary">Tenant Limits</p>
            <p className="text-xs text-text-muted mt-0.5">
              Maximum team-member logins this tenant can create. Currently using{' '}
              <span className="font-semibold text-text-primary">{activeUsers}</span>
              {maxUsersInput.trim() !== '' ? ` / ${maxUsersInput.trim()}` : ' (unlimited)'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Unlimited"
              value={maxUsersInput}
              onChange={(e) => setMaxUsersInput(e.target.value)}
              className="w-28 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            />
            <button
              onClick={saveLimit}
              disabled={savingLimit}
              className="px-3.5 py-2 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {savingLimit ? 'Saving…' : 'Save Limit'}
            </button>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Access configuration</p>
            <p className="text-xs text-text-muted mt-0.5">
              {mode === 'default'
                ? 'This tenant inherits the Platform Defaults template — edits here are disabled. Switch to Customize to set its own values.'
                : 'This tenant has its own independent settings below.'}
            </p>
          </div>
          <div className="flex p-[3px] rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-border">
            {(['default', 'custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === m ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {m === 'default' ? 'Use System Default' : 'Customize This Tenant'}
              </button>
            ))}
          </div>
        </div>
      </AdminCard>

      <FeatureFlagsEditor
        groups={FLAG_GROUPS}
        flags={(mode === 'default' ? effectiveFlags : flags) as unknown as Record<string, boolean>}
        onChange={toggle}
        readOnly={mode === 'default'}
      />

      {mode === 'custom' && (
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save Controls'}
        </button>
      )}
      <p className="text-center text-xs text-text-muted">
        Changes take effect the next time the user refreshes their browser. Toggles marked "Not enforced yet" save correctly but don't change tenant behavior yet.
      </p>
    </div>
  );
}
