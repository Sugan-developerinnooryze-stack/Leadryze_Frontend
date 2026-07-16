import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingOffice2Icon, UsersIcon, UserGroupIcon, ChatBubbleLeftRightIcon,
  MegaphoneIcon, LinkIcon, ChevronRightIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon,
  ShieldCheckIcon, ArrowLeftOnRectangleIcon, Squares2X2Icon,
  ClipboardDocumentCheckIcon, CpuChipIcon, ServerIcon, ArrowPathIcon,
  ExclamationTriangleIcon, InformationCircleIcon, AdjustmentsHorizontalIcon,
  XMarkIcon, HeartIcon, KeyIcon, TrashIcon, ClipboardDocumentListIcon,
  ComputerDesktopIcon, WifiIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import { ALL_FLAGS_TRUE, type FeatureFlags } from '../../stores/featureFlags.store';

/* ── Types ─────────────────────────────────────────────── */
interface Stats {
  totalClients: number; totalCustomers: number; activeConnectors: number;
  totalUsers: number; totalMessages: number; totalCampaigns: number;
}
interface AdminUser { _id: string; firstName: string; lastName: string; email: string; createdAt: string; }
interface Client {
  _id: string; name: string; slug: string; plan: string; isActive: boolean;
  userCount: number; customerCount: number; connectorCount: number;
  connectorTypes: string[];
  messageCount: number; campaignCount: number;
  adminUser: AdminUser | null; createdAt: string;
}
interface TenantUser { _id: string; firstName: string; lastName: string; email: string; role: string; emailVerified: boolean; createdAt: string; }
interface RecentCustomer { _id: string; name: string; email: string; phone: string; channel: string; createdAt: string; }
interface ConnectorItem { _id: string; type: string; isActive: boolean; createdAt: string; }
interface Campaign { _id: string; name: string; type: string; status: string; stats: { sent: number; delivered: number; opened: number }; createdAt: string; }
interface AdminLog {
  _id: string; service: 'ai' | 'backend'; level: 'info' | 'warn' | 'error' | 'debug';
  event: string; message: string; metadata: Record<string, unknown>;
  sessionId?: string; createdAt: string;
  tenantId?: { name: string; slug: string };
}

interface TenantDetail {
  tenant: Client; users: TenantUser[]; recentCustomers: RecentCustomer[];
  recentMessages: { _id: string; content: string; channel: string; direction: string; aiGenerated: boolean; status: string; createdAt: string; customerId?: { name: string; email: string } }[];
  connectors: ConnectorItem[]; campaigns: Campaign[];
}

/* ── Config ─────────────────────────────────────────────── */
const PLAN_CONFIG: Record<string, { label: string; cls: string }> = {
  starter:      { label: 'Starter',      cls: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  professional: { label: 'Professional', cls: 'bg-blue-900/60 text-blue-300 border-blue-700'   },
  enterprise:   { label: 'Enterprise',   cls: 'bg-purple-900/60 text-purple-300 border-purple-700' },
};

const CONNECTOR_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  zoho:       { dot: 'bg-blue-500',   label: 'Zoho',        bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400'   },
  hubspot:    { dot: 'bg-orange-500', label: 'HubSpot',     bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
  salesforce: { dot: 'bg-sky-500',    label: 'Salesforce',  bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400'      },
  mysql:      { dot: 'bg-teal-500',   label: 'MySQL',       bg: 'bg-teal-500/10 border-teal-500/30 text-teal-400'   },
  postgresql: { dot: 'bg-indigo-500', label: 'PostgreSQL',  bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
  mongodb:    { dot: 'bg-green-500',  label: 'MongoDB',     bg: 'bg-green-500/10 border-green-500/30 text-green-400' },
  rest:       { dot: 'bg-purple-500', label: 'REST API',    bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── Toggle Switch ───────────────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
        on ? 'bg-brand-600' : 'bg-gray-700'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

/* ── Controls Tab Content ────────────────────────────────── */
const FLAG_GROUPS = [
  {
    group: 'Sidebar Navigation',
    desc: 'Control which items appear in the left navigation',
    items: [
      { key: 'nav_dashboard',  label: 'Dashboard' },
      { key: 'nav_aiChat',     label: 'AI Chat' },
      { key: 'nav_customers',  label: 'Customers' },
      { key: 'nav_campaigns',  label: 'Campaigns' },
      { key: 'nav_templates',  label: 'Templates' },
      { key: 'nav_analytics',  label: 'Analytics' },
      { key: 'nav_knowledge',  label: 'Knowledge Base' },
      { key: 'nav_logs',       label: 'Logs' },
      { key: 'nav_connectors', label: 'Connectors' },
      { key: 'nav_settings',   label: 'Settings' },
      { key: 'nav_crmData',    label: 'CRM Data section' },
    ],
  },
  {
    group: 'Customers Page',
    desc: 'Control which tabs appear on the Customers page',
    items: [
      { key: 'customers_tabLeads',    label: 'Leads tab' },
      { key: 'customers_tabContacts', label: 'Contacts tab' },
      { key: 'customers_tabDirect',   label: 'Direct tab' },
    ],
  },
  {
    group: 'Connectors',
    desc: 'Control which connector types are visible and available for this tenant',
    items: [
      { key: 'connector_zoho',       label: 'Zoho CRM'    },
      { key: 'connector_hubspot',    label: 'HubSpot'     },
      { key: 'connector_salesforce', label: 'Salesforce'  },
      { key: 'connector_rest',       label: 'REST API'    },
      { key: 'connector_mysql',      label: 'MySQL'       },
      { key: 'connector_postgresql', label: 'PostgreSQL'  },
      { key: 'connector_mongodb',    label: 'MongoDB'     },
    ],
  },
  {
    group: 'Bot & AI Controls',
    desc: 'Enable or disable bot features for this tenant',
    items: [
      { key: 'bot_enabled',      label: 'Bot enabled (chat widget visible)' },
      { key: 'bot_leadCapture',  label: 'Lead capture (collect visitor data)' },
      { key: 'bot_escalation',   label: 'Human escalation (hand off to agent)' },
      { key: 'bot_ragSearch',    label: 'Knowledge base search (RAG)' },
      { key: 'bot_piiMasking',   label: 'PII masking (hide sensitive data in logs)' },
      { key: 'bot_contentGuard', label: 'Content guardrails (block off-topic replies)' },
    ],
  },
  {
    group: 'Automation',
    desc: 'Automated follow-up and communication workflows',
    items: [
      { key: 'auto_followup',  label: 'Follow-up messages (post-lead capture)' },
      { key: 'auto_booking',   label: 'Booking confirmations & reminders' },
      { key: 'auto_reminder',  label: 'Appointment reminders' },
      { key: 'auto_feedback',  label: 'Post-interaction feedback requests' },
    ],
  },
];

function ControlsTab({ clientId, tenantName }: { clientId: string; tenantName: string }) {
  const [flags, setFlags]     = useState<FeatureFlags>(ALL_FLAGS_TRUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    authService.adminGetFeatureFlags(clientId)
      .then((r) => setFlags({ ...ALL_FLAGS_TRUE, ...r.data.data.flags }))
      .catch(() => toast.error('Failed to load feature flags'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const toggle = useCallback((key: keyof FeatureFlags, val: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: val }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await authService.adminSetFeatureFlags(clientId, flags as unknown as Record<string, boolean>);
      toast.success(`Controls saved for ${tenantName}`);
    } catch {
      toast.error('Failed to save feature flags');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="flex gap-2">{[0,1,2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {FLAG_GROUPS.map((grp) => (
        <div key={grp.group} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">{grp.group}</p>
            <p className="text-xs text-gray-500 mt-0.5">{grp.desc}</p>
          </div>
          <div className="space-y-3">
            {grp.items.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{label}</span>
                <Toggle
                  on={flags[key as keyof FeatureFlags] !== false}
                  onChange={(v) => toggle(key as keyof FeatureFlags, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saving ? 'Saving…' : 'Save Controls'}
      </button>
      <p className="text-center text-xs text-gray-600">
        Changes take effect the next time the user refreshes their browser.
      </p>
    </div>
  );
}

/* ── Full-Screen Tenant Control Panel ────────────────────── */
function TenantControlPanel({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [tab, setTab] = useState<'overview' | 'users' | 'customers' | 'connectors' | 'campaigns' | 'controls'>('overview');

  useEffect(() => {
    authService.adminTenantDetail(clientId)
      .then((r) => setDetail(r.data.data))
      .catch(() => toast.error('Failed to load tenant detail'));
  }, [clientId]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col overflow-hidden">

      {/* Panel header */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <BuildingOffice2Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">{detail?.tenant.name ?? '…'}</p>
            <p className="text-xs text-gray-500">{detail?.tenant.adminUser?.email ?? ''}</p>
          </div>
          {detail && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ml-1 ${PLAN_CONFIG[detail.tenant.plan]?.cls || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {PLAN_CONFIG[detail.tenant.plan]?.label || detail.tenant.plan}
            </span>
          )}
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Stat strip */}
      {detail && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-gray-900/40 border-b border-gray-800/60 shrink-0">
          {[
            { label: 'Users',      v: detail.users.length,         icon: '👤' },
            { label: 'Customers',  v: detail.tenant.customerCount, icon: '👥' },
            { label: 'Connectors', v: detail.connectors.length,    icon: '🔗' },
            { label: 'Campaigns',  v: detail.campaigns.length,     icon: '📣' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/60 rounded-xl p-2.5 text-center border border-gray-700/50">
              <div className="text-sm mb-0.5">{s.icon}</div>
              <div className="text-lg font-bold text-white">{s.v}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900/30 overflow-x-auto shrink-0">
        {(['overview','users','customers','connectors','campaigns','controls'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-500 text-brand-400 bg-brand-900/20'
                : t === 'controls'
                  ? 'border-transparent text-amber-400 hover:text-amber-300 hover:bg-amber-900/10'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t === 'controls' ? '⚙ Controls' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Body */}
      {!detail ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-2">{[0,1,2].map((i) => <span key={i} className="h-3 w-3 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-3">

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Connectors</p>
                  {detail.connectors.filter(c => c.isActive).length === 0
                    ? <p className="text-xs text-gray-600 py-3 text-center">No connectors yet</p>
                    : (
                      <div className="flex flex-wrap gap-2">
                        {detail.connectors.filter(c => c.isActive).map((c) => {
                          const cfg = CONNECTOR_CONFIG[c.type];
                          return (
                            <span key={c._id} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg?.bg || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot || 'bg-gray-500'}`} />
                              {cfg?.label || c.type}
                            </span>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Customers</p>
                  {detail.recentCustomers.length === 0
                    ? <p className="text-xs text-gray-600 py-3 text-center">No customers yet</p>
                    : detail.recentCustomers.map((c) => (
                      <div key={c._id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                        <div>
                          <p className="text-sm text-white font-medium">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.email || c.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CONNECTOR_CONFIG[c.channel]?.bg || 'bg-gray-800 border-gray-700 text-gray-400'}`}>{c.channel}</span>
                          <span className="text-xs text-gray-600">{timeAgo(c.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
                {detail.campaigns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Campaigns</p>
                    {detail.campaigns.slice(0, 3).map((c) => (
                      <div key={c._id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                        <p className="text-sm text-white">{c.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Sent: {c.stats.sent}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${c.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* USERS */}
            {tab === 'users' && (
              detail.users.length === 0
                ? <p className="text-center text-gray-600 py-8">No users</p>
                : detail.users.map((u) => (
                  <div key={u._id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-bold text-brand-400">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded">{u.role.replace('_', ' ')}</span>
                      {u.emailVerified ? <CheckCircleIcon className="h-4 w-4 text-green-500" /> : <ClockIcon className="h-4 w-4 text-yellow-500" />}
                    </div>
                  </div>
                ))
            )}

            {/* CUSTOMERS */}
            {tab === 'customers' && (
              detail.recentCustomers.length === 0
                ? <p className="text-center text-gray-600 py-8">No customers yet</p>
                : detail.recentCustomers.map((c) => (
                  <div key={c._id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email || c.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${CONNECTOR_CONFIG[c.channel]?.bg || 'bg-gray-800 border-gray-700 text-gray-400'}`}>{c.channel}</span>
                      <span className="text-xs text-gray-600">{timeAgo(c.createdAt)}</span>
                    </div>
                  </div>
                ))
            )}

            {/* CONNECTORS */}
            {tab === 'connectors' && (
              detail.connectors.length === 0
                ? <p className="text-center text-gray-600 py-8">No connectors</p>
                : detail.connectors.map((c) => {
                  const cfg = CONNECTOR_CONFIG[c.type];
                  return (
                    <div key={c._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${cfg?.dot || 'bg-gray-500'}`} />
                        <div>
                          <p className="text-sm font-semibold text-white">{cfg?.label || c.type}</p>
                          <p className="text-xs text-gray-600">{timeAgo(c.createdAt)}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.isActive ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-red-900/40 text-red-400 border border-red-800'}`}>
                        {c.isActive ? '● Active' : '● Inactive'}
                      </span>
                    </div>
                  );
                })
            )}

            {/* CAMPAIGNS */}
            {tab === 'campaigns' && (
              detail.campaigns.length === 0
                ? <p className="text-center text-gray-600 py-8">No campaigns</p>
                : detail.campaigns.map((c) => (
                  <div key={c._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize border ${c.status === 'active' ? 'bg-green-900/40 text-green-400 border-green-800' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>{c.status}</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-500">Sent <span className="text-white font-medium">{c.stats.sent}</span></span>
                      <span className="text-gray-500">Delivered <span className="text-white font-medium">{c.stats.delivered}</span></span>
                      <span className="text-gray-500">Opened <span className="text-white font-medium">{c.stats.opened}</span></span>
                    </div>
                  </div>
                ))
            )}

            {/* CONTROLS */}
            {tab === 'controls' && (
              <ControlsTab clientId={clientId} tenantName={detail.tenant.name} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Health Panel ─────────────────────────────────────────── */
interface ServiceHealth { name: string; status: 'ok' | 'error' | 'unknown'; detail: string; }
interface ApiKeyHealth {
  name: string; key: string; set: boolean; usage: string; provider: string;
  activeRole: string; freeLimit: string | null; paidNote: string;
  rateLimit: string; purpose: string; model: string;
}
interface KeyStats { today: number; week: number; month: number; model: string; escalations: number; label?: string; }

const ROLE_BADGE: Record<string, string> = {
  primary:  'bg-brand-900/60 text-brand-300 border-brand-700/60',
  fallback: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  inactive: 'bg-gray-800 text-gray-500 border-gray-700',
};

function KeyRow({ k, stats, loading }: { k: ApiKeyHealth; stats: KeyStats | undefined; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const todayPct = stats && k.rateLimit !== 'N/A' ? Math.min(100, Math.round((stats.today / Math.max(stats.today, 50)) * 100)) : 0;

  return (
    <>
      <tr
        className="bg-gray-900/20 hover:bg-gray-800/30 transition-colors cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Name + role badge */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-200 text-sm">{k.name}</span>
            {k.activeRole !== 'inactive' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${ROLE_BADGE[k.activeRole]}`}>
                {k.activeRole}
              </span>
            )}
            {k.model && (
              <span className="text-xs text-gray-500 font-mono">{k.model}</span>
            )}
          </div>
        </td>
        {/* Env var */}
        <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden md:table-cell">{k.key}</td>
        {/* Status */}
        <td className="px-4 py-3">
          {k.set
            ? <span className="flex items-center gap-1.5 text-green-400 text-xs font-semibold"><CheckCircleIcon className="h-4 w-4" />Configured</span>
            : <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold"><XCircleIcon className="h-4 w-4" />Missing</span>
          }
        </td>
        {/* Activity today */}
        <td className="px-4 py-3">
          {loading ? (
            <div className="h-3 bg-gray-800 rounded animate-pulse w-12" />
          ) : stats ? (
            <span className="text-xs text-gray-300 font-medium">{stats.today} {stats.label ?? 'calls'}</span>
          ) : (
            <span className="text-xs text-gray-600">—</span>
          )}
        </td>
        {/* Expand toggle */}
        <td className="px-3 py-3 text-gray-600">
          <ChevronRightIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </td>
      </tr>

      {/* Expanded detail row */}
      {open && (
        <tr className="bg-gray-950/60">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Purpose */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Purpose</p>
                <p className="text-xs text-gray-300 leading-relaxed">{k.purpose}</p>
              </div>
              {/* Rate limit & free tier */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rate Limit</p>
                <p className="text-xs text-gray-300">{k.rateLimit}</p>
                {k.freeLimit && (
                  <p className="text-xs text-emerald-500 mt-1">Free tier: {k.freeLimit}</p>
                )}
                {!k.freeLimit && (
                  <p className="text-xs text-gray-500 mt-1">{k.paidNote}</p>
                )}
              </div>
              {/* Usage stats */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Usage ({stats?.label ? stats.label.charAt(0).toUpperCase() + stats.label.slice(1) : 'AI Calls'})
                </p>
                {stats ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${todayPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{stats.today} today</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>7d: <span className="text-gray-300">{stats.week}</span></span>
                      <span>30d: <span className="text-gray-300">{stats.month}</span></span>
                      {stats.escalations > 0 && (
                        <span>
                          {stats.label ? 'Failed' : 'Escalations'}:{' '}
                          <span className="text-yellow-400">{stats.escalations}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No activity logged yet</p>
                )}
              </div>
            </div>
            {/* Env var + note */}
            <div className="mt-3 pt-3 border-t border-gray-800/60 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">ENV:</span>
                <code className="text-xs text-gray-400 bg-gray-900 px-2 py-0.5 rounded">{k.key}</code>
              </div>
              {k.paidNote && (
                <p className="text-xs text-gray-600 italic">{k.paidNote}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function HealthPanel() {
  const [services,  setServices]  = useState<ServiceHealth[]>([]);
  const [apiKeys,   setApiKeys]   = useState<ApiKeyHealth[]>([]);
  const [keyStats,  setKeyStats]  = useState<Record<string, KeyStats>>({});
  const [loading,   setLoading]   = useState(true);
  const [statsLoad, setStatsLoad] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [aiOffline, setAiOffline] = useState(false);

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

  const refresh = useCallback(() => { loadHealth(); loadStats(); }, [loadHealth, loadStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const svcBg = (s: string) => s === 'ok' ? 'bg-green-900/30 border-green-700/40' : 'bg-red-900/30 border-red-700/40';

  const configuredCount = apiKeys.filter((k) => k.set).length;
  const missingCount    = apiKeys.filter((k) => !k.set).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">System Health & API Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastFetch ? `Last checked: ${lastFetch.toLocaleTimeString()}` : 'Checking…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-green-400 bg-green-900/30 border border-green-800/40 px-3 py-1 rounded-full">
            {configuredCount} configured
          </span>
          {missingCount > 0 && (
            <span className="text-xs text-red-400 bg-red-900/30 border border-red-800/40 px-3 py-1 rounded-full">
              {missingCount} missing
            </span>
          )}
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Services */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Infrastructure Services</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading && services.length === 0
            ? [0,1,2].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-800/60 border border-gray-700/40 animate-pulse" />)
            : services.map((svc) => (
                <div key={svc.name} className={`rounded-xl p-4 border ${svcBg(svc.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <ServerIcon className="h-5 w-5 text-gray-400" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${svc.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                      {svc.status === 'ok' ? '● Online' : '● Offline'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{svc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{svc.detail}</p>
                </div>
              ))
          }
        </div>
      </div>

      {/* AI offline banner */}
      {aiOffline && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-700/40 bg-yellow-900/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-400">AI service is offline — AI key statuses cannot be determined until it reconnects.</p>
        </div>
      )}

      {/* API Keys table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Keys & Analytics</h3>
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <InformationCircleIcon className="h-3.5 w-3.5" />
            Click any row to expand details · Key values are never exposed
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60 border-b border-gray-700/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Service / Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Env Variable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Calls Today</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && apiKeys.length === 0
                ? [0,1,2,3,4].map((i) => (
                    <tr key={i} className="bg-gray-900/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
                      </td>
                    </tr>
                  ))
                : apiKeys.map((k) => (
                    <KeyRow key={k.key} k={k} stats={keyStats[k.provider]} loading={statsLoad} />
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── System Panel ─────────────────────────────────────────── */
function SystemPanel() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-white">System Settings</h2>
        <p className="text-xs text-gray-500 mt-0.5">Global configuration and environment variables for this deployment.</p>
      </div>

      {/* Info cards */}
      {[
        { icon: CpuChipIcon,  label: 'Environment',  value: import.meta.env.MODE ?? 'production',  color: 'text-blue-400'   },
        { icon: ServerIcon,   label: 'Platform',     value: 'Node.js / TypeScript',                color: 'text-green-400'  },
        { icon: ShieldCheckIcon, label: 'Auth',      value: 'JWT + Role-based access control',     color: 'text-purple-400' },
      ].map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/60 border border-gray-700/40">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gray-900/60 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
            <p className="text-sm text-white font-medium mt-0.5">{value}</p>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-4 flex gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-400">Environment variables are set on the server</p>
          <p className="text-xs text-amber-600 mt-1">
            Update credentials via your <code className="bg-amber-900/40 px-1 rounded">.env</code> file or deployment secrets manager. Restart the backend service after changes.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Security Panel ─────────────────────────────────────────── */
interface SecurityEventItem {
  _id: string; event: string; tenantId?: string; userId?: string;
  ip: string; userAgent: string; detail?: Record<string, unknown>; timestamp: string;
}
interface SecurityStats {
  by24h: Record<string, number>;
  by7d:  Record<string, number>;
  topIPs: { _id: string; count: number }[];
}
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
  'auth.login_failed':    'red',
  'webhook.sig_invalid':  'red',
  'tenant.access_denied': 'red',
  'websocket.auth_failed':'red',
  'ai.prompt_blocked':    'red',
  'ratelimit.violation':  'amber',
  'auth.token_expired':   'amber',
  'auth.token_invalid':   'amber',
  'auth.login_success':   'green',
  'auth.logout':          'green',
  'auth.password_reset':  'green',
  'auth.email_verified':  'green',
};
const SEV_CLS: Record<string, string> = {
  red:   'bg-red-900/40 text-red-300 border-red-700/40',
  amber: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  green: 'bg-green-900/40 text-green-300 border-green-700/40',
};
const ALL_EVENT_TYPES = [
  'auth.login_failed','auth.login_success','auth.logout',
  'auth.token_expired','auth.token_invalid','auth.password_reset','auth.email_verified',
  'ratelimit.violation','webhook.sig_invalid','websocket.auth_failed','tenant.access_denied',
  'ai.prompt_blocked',
];

function SecurityPanel() {
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
  const [lastRefresh,setLast]       = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (subTab === 'overview') {
        const [postRes, connRes, stRes] = await Promise.all([
          authService.adminGetSecurityPosture(),
          authService.adminGetConnectorHealth(),
          authService.adminGetSecurityStats(),
        ]);
        setPosture(postRes.data.data);
        setConnHealth(connRes.data.data);
        setStats(stRes.data.data);
      } else if (subTab === 'events') {
        const params: Record<string, string> = { limit: '100' };
        if (filter)   params.event = filter;
        if (ipFilter) params.ip    = ipFilter;
        const [evRes, stRes] = await Promise.all([
          authService.adminGetSecurityEvents(params),
          authService.adminGetSecurityStats(),
        ]);
        setEvents(evRes.data.data.events ?? []);
        setStats(stRes.data.data);
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
    { id: 'overview',  label: 'Overview',     icon: ShieldCheckIcon         },
    { id: 'events',    label: 'Events',        icon: ExclamationTriangleIcon  },
    { id: 'sessions',  label: 'Sessions',      icon: ComputerDesktopIcon      },
    { id: 'audit',     label: 'Audit Logs',    icon: ClipboardDocumentListIcon},
  ];

  const GRADE_CLS = {
    good:     { bar: 'bg-green-500',  text: 'text-green-400',  label: 'Good'     },
    warning:  { bar: 'bg-amber-500',  text: 'text-amber-400',  label: 'Warning'  },
    critical: { bar: 'bg-red-500',    text: 'text-red-400',    label: 'Critical' },
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Security Center</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
            {' · Auto-refreshes every 30s'}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-0">
        {SUBTABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              subTab === id
                ? 'border-brand-500 text-brand-400 bg-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {subTab === 'overview' && posture && connHealth && (
            <div className="space-y-6">
              {/* Health Score */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Security Health Score</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Computed from config + 24h event counts</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-extrabold ${GRADE_CLS[posture.grade].text}`}>{posture.score}</p>
                    <p className={`text-xs font-semibold ${GRADE_CLS[posture.grade].text}`}>{GRADE_CLS[posture.grade].label}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-6">
                  <div className={`h-2 rounded-full transition-all ${GRADE_CLS[posture.grade].bar}`} style={{ width: `${posture.score}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {posture.checks.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5">
                      {c.pass
                        ? <CheckCircleIcon className="h-4 w-4 text-green-400 shrink-0" />
                        : <XCircleIcon    className="h-4 w-4 text-red-400 shrink-0" />}
                      <span className={`text-xs ${c.pass ? 'text-gray-400' : 'text-red-300'}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Encryption Status */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Encryption & Auth Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'JWT Secret',        pass: posture.checks.find(c => c.id === 'jwt_secret')?.pass       ?? false },
                    { label: 'JWT Refresh Secret', pass: posture.checks.find(c => c.id === 'jwt_refresh')?.pass     ?? false },
                    { label: 'Encryption Key',    pass: posture.checks.find(c => c.id === 'encryption_key')?.pass   ?? false },
                    { label: 'Internal API Key',  pass: posture.checks.find(c => c.id === 'internal_key')?.pass     ?? false },
                    { label: 'Email Alerts',      pass: posture.checks.find(c => c.id === 'brevo_configured')?.pass ?? false },
                    { label: 'AES-256-GCM (Connector Credentials)', pass: true },
                    { label: 'bcrypt (Passwords)',                   pass: true },
                    { label: 'SHA-256 (Token Hashing)',              pass: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 py-1.5">
                      {item.pass
                        ? <CheckCircleIcon className="h-4 w-4 text-green-400 shrink-0" />
                        : <XCircleIcon    className="h-4 w-4 text-amber-400 shrink-0" />}
                      <span className={`text-xs ${item.pass ? 'text-gray-400' : 'text-amber-300'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector Health */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Connector Health</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />{connHealth.stats.healthy} Healthy</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"   />{connHealth.stats.failed} Failed</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-500" />{connHealth.stats.pending} Pending</span>
                  </div>
                </div>
                {connHealth.connectors.length === 0 ? (
                  <p className="text-xs text-gray-600 py-4 text-center">No connectors configured across any tenant</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-600 uppercase tracking-wider border-b border-gray-800">
                        <tr>
                          {['Type', 'Name', 'Tenant', 'Status', 'Last Sync', 'Error'].map((h) => (
                            <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {connHealth.connectors.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2.5 pr-4 font-mono text-gray-400 uppercase">{c.type}</td>
                            <td className="py-2.5 pr-4 text-gray-300">{c.name}</td>
                            <td className="py-2.5 pr-4 text-gray-500">{c.tenant}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`px-2 py-0.5 rounded-full font-medium border ${
                                c.syncStatus === 'success' ? 'bg-green-900/30 text-green-400 border-green-700/30' :
                                c.syncStatus === 'failed'  ? 'bg-red-900/30 text-red-400 border-red-700/30' :
                                'bg-gray-800 text-gray-500 border-gray-700'
                              }`}>{c.syncStatus || 'never'}</span>
                            </td>
                            <td className="py-2.5 pr-4 text-gray-500">
                              {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-2.5 text-red-400 max-w-xs truncate">
                              {c.syncError ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 24h snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Failed Logins',    value: posture.events24h.failedLogins24h,  color: 'red'   },
                  { label: 'Rate Limit Hits',  value: posture.events24h.rateLimitHits24h, color: 'amber' },
                  { label: 'Webhook Failures', value: posture.events24h.webhookFails24h,  color: 'amber' },
                  { label: 'Token Errors',     value: posture.events24h.tokenErrors24h,   color: 'blue'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl p-4 border ${color === 'red' ? 'bg-red-900/20 border-red-700/40' : color === 'amber' ? 'bg-amber-900/20 border-amber-700/40' : 'bg-blue-900/20 border-blue-700/40'}`}>
                    <p className={`text-2xl font-extrabold ${color === 'red' ? 'text-red-300' : color === 'amber' ? 'text-amber-300' : 'text-blue-300'}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label} (24h)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EVENTS ── */}
          {subTab === 'events' && (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Failed Logins',      value: stat24h['auth.login_failed']   ?? 0, color: 'red'   },
                  { label: 'Rate Limit Hits',    value: stat24h['ratelimit.violation']  ?? 0, color: 'amber' },
                  { label: 'Token Errors',       value: tokenErrs,                           color: 'amber' },
                  { label: 'Webhook Failures',   value: stat24h['webhook.sig_invalid']  ?? 0, color: 'red'   },
                  { label: 'Tenant Violations',  value: stat24h['tenant.access_denied'] ?? 0, color: 'red'   },
                  { label: 'Total Events (24h)', value: totalEvts,                           color: 'blue'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl p-4 border ${color === 'red' ? 'bg-red-900/20 border-red-700/40' : color === 'amber' ? 'bg-amber-900/20 border-amber-700/40' : 'bg-blue-900/20 border-blue-700/40'}`}>
                    <p className={`text-2xl font-extrabold ${color === 'red' ? 'text-red-300' : color === 'amber' ? 'text-amber-300' : 'text-blue-300'}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-600">
                  <option value="">All Event Types</option>
                  {ALL_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={ipFilter} onChange={(e) => setIpFilter(e.target.value)}
                  placeholder="Filter by IP…"
                  className="bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-600 w-44" />
              </div>

              {/* Events table */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                    <ShieldCheckIcon className="h-10 w-10 mb-3" />
                    <p className="text-sm font-medium">No security events in the selected range</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                      <tr>
                        {['Time', 'Event', 'Severity', 'Tenant', 'IP', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {events.map((ev) => {
                        const sev  = EVENT_SEVERITY[ev.event] ?? 'amber';
                        const isEx = expandedId === ev._id;
                        return (
                          <>
                            <tr key={ev._id} onClick={() => setExpanded(isEx ? null : ev._id)}
                              className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                {new Date(ev.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex text-xs font-mono px-2 py-0.5 rounded-full border ${SEV_CLS[sev]}`}>{ev.event}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold ${sev === 'red' ? 'text-red-400' : sev === 'amber' ? 'text-amber-400' : 'text-green-400'}`}>
                                  {sev === 'red' ? '● High' : sev === 'amber' ? '● Medium' : '● Low'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{ev.tenantId ? ev.tenantId.slice(-8) : '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-300 font-mono">{ev.ip}</td>
                              <td className="px-3 py-3 text-gray-600">
                                <ChevronRightIcon className={`h-4 w-4 transition-transform ${isEx ? 'rotate-90' : ''}`} />
                              </td>
                            </tr>
                            {isEx && (
                              <tr key={`${ev._id}-x`} className="bg-gray-800/30">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                      <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Detail</p>
                                      <pre className="text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto">{JSON.stringify(ev.detail ?? {}, null, 2)}</pre>
                                    </div>
                                    <div className="space-y-2">
                                      {ev.userId   && <p className="text-gray-400"><span className="text-gray-600">User ID: </span>{ev.userId}</p>}
                                      {ev.tenantId && <p className="text-gray-400"><span className="text-gray-600">Tenant: </span>{ev.tenantId}</p>}
                                      <p className="text-gray-400 break-all"><span className="text-gray-600">User Agent: </span>{ev.userAgent}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top IPs */}
              {stats && stats.topIPs.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top Offending IPs (24h)</h3>
                  <div className="space-y-2">
                    {stats.topIPs.map((item, i) => (
                      <div key={item._id} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
                          <code className="text-xs text-gray-300 font-mono">{item._id}</code>
                        </div>
                        <span className="text-xs font-semibold text-red-400">{item.count} hits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SESSIONS ── */}
          {subTab === 'sessions' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Active Sessions</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} currently active</p>
                </div>
              </div>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <WifiIcon className="h-10 w-10 mb-3" />
                  <p className="text-sm font-medium">No active sessions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                      <tr>
                        {['User', 'Role', 'IP / Location', 'Browser / OS', 'Signed In', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-white text-xs font-medium">
                              {s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userId.slice(-8)}
                            </p>
                            <p className="text-gray-500 text-xs">{s.user?.email ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                              {s.user?.role ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-300 font-mono">{s.ip}</p>
                            <p className="text-xs text-gray-600">{s.city}, {s.country}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-400">{s.browser}</p>
                            <p className="text-xs text-gray-600">{s.os}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(s.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleTerminateSession(s.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 text-xs hover:bg-red-900/50 transition-colors">
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
            </div>
          )}

          {/* ── AUDIT LOGS ── */}
          {subTab === 'audit' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Audit Log</h3>
                <p className="text-xs text-gray-500 mt-0.5">Admin accountability trail — who did what and when</p>
              </div>
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <ClipboardDocumentListIcon className="h-10 w-10 mb-3" />
                  <p className="text-sm font-medium">No audit events recorded yet</p>
                  <p className="text-xs mt-1">Events are logged as admins perform privileged actions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                      <tr>
                        {['Time', 'Actor', 'Role', 'Action', 'Target', 'IP'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-300">{log.actorEmail}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{log.actorRole}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono text-brand-400">{log.action}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{log.target ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Client Card ─────────────────────────────────────────── */
function ClientCard({ c, onClick, onToggle, onControls }: { c: Client; onClick: () => void; onToggle: (e: React.MouseEvent) => void; onControls: (e: React.MouseEvent) => void }) {
  const plan = PLAN_CONFIG[c.plan];
  const initials = c.adminUser
    ? `${c.adminUser.firstName[0]}${c.adminUser.lastName[0]}`
    : c.name.slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className="group bg-gray-900 border border-gray-800 hover:border-brand-600/60 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-brand-900/20"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600/30 to-brand-800/30 border border-brand-600/30 flex items-center justify-center text-sm font-bold text-brand-300">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-white group-hover:text-brand-300 transition-colors">{c.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {c.adminUser ? c.adminUser.email : 'No admin assigned'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${plan?.cls || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {plan?.label || c.plan}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isActive ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
            {c.isActive ? '● Active' : '● Inactive'}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { icon: UsersIcon,               label: 'Users',     v: c.userCount     },
          { icon: UserGroupIcon,           label: 'Customers', v: c.customerCount },
          { icon: ChatBubbleLeftRightIcon, label: 'Messages',  v: c.messageCount  },
          { icon: MegaphoneIcon,           label: 'Campaigns', v: c.campaignCount },
        ].map(({ icon: Icon, label, v }) => (
          <div key={label} className="bg-gray-800/60 rounded-xl p-2.5 text-center border border-gray-700/40">
            <Icon className="h-4 w-4 text-gray-500 mx-auto mb-1" />
            <p className="text-base font-bold text-white">{v}</p>
            <p className="text-xs text-gray-600">{label}</p>
          </div>
        ))}
      </div>

      {/* Connector badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(c.connectorTypes ?? []).length > 0
            ? (c.connectorTypes ?? []).map((type) => {
                const cfg = CONNECTOR_CONFIG[type];
                return (
                  <span key={type} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg?.bg || 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot || 'bg-gray-500'}`} />
                    {cfg?.label || type}
                  </span>
                );
              })
            : <span className="text-xs text-gray-700">No connectors</span>
          }
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2 flex-wrap">
          <button
            onClick={onControls}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border bg-amber-900/20 text-amber-400 border-amber-800/50 hover:bg-amber-900/50"
          >
            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
            Controls
          </button>
          <button
            onClick={onToggle}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border ${
              c.isActive
                ? 'bg-red-900/20 text-red-400 border-red-800/50 hover:bg-red-900/50'
                : 'bg-green-900/20 text-green-400 border-green-800/50 hover:bg-green-900/50'
            }`}>
            {c.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <span className="text-xs text-brand-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            View <ChevronRightIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{
    _id: string; firstName: string; lastName: string; email: string; role: string;
    emailVerified: boolean; createdAt: string;
    tenantId?: { name: string; slug: string; plan: string; isActive: boolean };
  }>>([]);
  const [tab, setTab]             = useState<'overview' | 'clients' | 'users' | 'logs' | 'health' | 'system' | 'security'>('overview');
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logService, setLogService] = useState<'all' | 'ai' | 'backend'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [selectedClient, setSelected] = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [resetModal, setResetModal] = useState<{ userId: string; email: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    Promise.all([authService.adminStats(), authService.adminClients(), authService.adminUsers()])
      .then(([s, c, u]) => { setStats(s.data.data); setClients(c.data.data); setAllUsers(u.data.data); })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const toggleClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await authService.toggleClient(id);
      setClients((prev) => prev.map((c) => c._id === id ? { ...c, isActive: res.data.data.isActive } : c));
      toast.success(res.data.message);
    } catch { toast.error('Failed to update client'); }
  };

  const handleVerifyEmail = async (userId: string) => {
    try {
      await authService.adminVerifyUserEmail(userId);
      setAllUsers((prev) => prev.map((u) => u._id === userId ? { ...u, emailVerified: true } : u));
      toast.success('Email verified — user can now log in');
    } catch { toast.error('Failed to verify email'); }
  };

  const handleResetUserPassword = async () => {
    if (!resetModal || resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setResetLoading(true);
    try {
      await authService.adminResetUserPassword(resetModal.userId, resetPassword);
      toast.success(`Password reset for ${resetModal.email}`);
      setResetModal(null);
      setResetPassword('');
    } catch { toast.error('Failed to reset password'); }
    finally { setResetLoading(false); }
  };

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.adminUser?.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: 'overview'  as const, label: 'Overview',                   icon: Squares2X2Icon              },
    { id: 'clients'   as const, label: `Clients (${clients.length})`,icon: BuildingOffice2Icon         },
    { id: 'users'     as const, label: `Users (${allUsers.length})`, icon: UsersIcon                   },
    { id: 'logs'      as const, label: 'Logs',                       icon: ClipboardDocumentCheckIcon  },
    { id: 'health'    as const, label: 'Health',                     icon: HeartIcon                   },
    { id: 'system'    as const, label: 'System',                     icon: KeyIcon                     },
    { id: 'security'  as const, label: 'Security',                   icon: ShieldCheckIcon             },
  ];

  const LEVEL_CLS: Record<string, string> = {
    info:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
    warn:  'bg-amber-900/40 text-amber-300 border-amber-700/40',
    error: 'bg-red-900/40 text-red-300 border-red-700/40',
    debug: 'bg-gray-800 text-gray-400 border-gray-700',
  };
  const LEVEL_ICON: Record<string, React.ElementType> = {
    info: InformationCircleIcon, warn: ExclamationTriangleIcon,
    error: XCircleIcon, debug: CheckCircleIcon,
  };

  const fetchAdminLogs = async (svc: 'all' | 'ai' | 'backend') => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (svc !== 'all') params.service = svc;
      const res = await (await import('../../services/api')).default
        .get<{ data: { logs: AdminLog[] } }>('/api/v1/admin/logs', { params });
      setAdminLogs(res.data.data.logs ?? []);
    } catch { setAdminLogs([]); }
    finally { setLogsLoading(false); }
  };

  // Load logs when tab switches to 'logs'
  if (tab === 'logs' && adminLogs.length === 0 && !logsLoading) fetchAdminLogs(logService);

  const statCards = [
    { label: 'Total Clients',       value: stats?.totalClients    ?? 0, icon: BuildingOffice2Icon,       gradient: 'from-blue-600 to-blue-800'    },
    { label: 'Total Users',         value: stats?.totalUsers      ?? 0, icon: UsersIcon,                 gradient: 'from-violet-600 to-violet-800' },
    { label: 'Total Customers',     value: stats?.totalCustomers  ?? 0, icon: UserGroupIcon,             gradient: 'from-emerald-600 to-emerald-800'},
    { label: 'Total Messages',      value: stats?.totalMessages   ?? 0, icon: ChatBubbleLeftRightIcon,   gradient: 'from-orange-600 to-orange-800'  },
    { label: 'Total Campaigns',     value: stats?.totalCampaigns  ?? 0, icon: MegaphoneIcon,             gradient: 'from-pink-600 to-pink-800'     },
    { label: 'Active CRM Connects', value: stats?.activeConnectors ?? 0, icon: LinkIcon,                gradient: 'from-teal-600 to-teal-800'     },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Navbar ── */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800/80 px-6 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <ShieldCheckIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">LeadRyze AI</span>
            <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Super Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 hidden sm:block">{user?.email}</span>
          <div className="h-5 w-px bg-gray-800" />
          <button
            onClick={() => { logout(); navigate('/admin/login'); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeftOnRectangleIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-gray-900/60 border border-gray-800 rounded-xl w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setTab(t.id as typeof tab); setSearch(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="flex gap-2">{[0,1,2].map((i) => <span key={i} className="h-3 w-3 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
          </div>
        ) : tab === 'overview' ? (

          /* ── OVERVIEW ── */
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {statCards.map(({ label, value, icon: Icon, gradient }) => (
                <div key={label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 shadow-lg`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-white">{value}</p>
                  <p className="text-xs text-white/60 mt-0.5">{label}</p>
                  <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-white/10" />
                </div>
              ))}
            </div>

            {/* Client cards grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">All Clients</h2>
                <span className="text-xs text-gray-600">Click any card to inspect</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((c) => (
                  <ClientCard key={c._id} c={c}
                    onClick={() => setSelected(c._id)}
                    onToggle={(e) => toggleClient(c._id, e)}
                    onControls={(e) => { e.stopPropagation(); setSelected(c._id); }}
                  />
                ))}
              </div>
            </div>
          </div>

        ) : tab === 'clients' ? (

          /* ── CLIENTS TABLE ── */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  className="pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-600 w-64" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    {['Client', 'Admin', 'Plan', 'Customers', 'Connectors', 'Campaigns', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredClients.map((c) => (
                    <tr key={c._id} onClick={() => setSelected(c._id)}
                      className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-bold text-brand-400">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{c.name}</p>
                            <p className="text-xs text-gray-600">{c.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.adminUser
                          ? <><p className="text-white text-xs">{c.adminUser.firstName} {c.adminUser.lastName}</p><p className="text-gray-600 text-xs">{c.adminUser.email}</p></>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_CONFIG[c.plan]?.cls || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                          {PLAN_CONFIG[c.plan]?.label || c.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">{c.customerCount}</td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">{c.connectorCount}</td>
                      <td className="px-4 py-3 text-gray-300 tabular-nums">{c.campaignCount}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${c.isActive ? 'text-green-400' : 'text-red-400'}`}>
                          {c.isActive ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={(e) => toggleClient(c._id, e)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            c.isActive ? 'bg-red-900/20 text-red-400 border-red-800/50 hover:bg-red-900/40' : 'bg-green-900/20 text-green-400 border-green-800/50 hover:bg-green-900/40'
                          }`}>
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600">No clients found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : tab === 'logs' ? (

          /* ── LOGS PANEL ── */
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
                {(['all', 'ai', 'backend'] as const).map((svc) => (
                  <button key={svc} onClick={() => { setLogService(svc); fetchAdminLogs(svc); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      logService === svc ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                    }`}>
                    {svc === 'ai'      && <CpuChipIcon className="h-3.5 w-3.5 text-purple-400" />}
                    {svc === 'backend' && <ServerIcon   className="h-3.5 w-3.5 text-blue-400" />}
                    {svc === 'ai' ? 'AI Agent' : svc === 'backend' ? 'Backend' : 'All Logs'}
                  </button>
                ))}
              </div>
              <button onClick={() => fetchAdminLogs(logService)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-300 transition">
                <ArrowPathIcon className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {logsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-500" />
                </div>
              ) : adminLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <ClipboardDocumentCheckIcon className="h-10 w-10 mb-3" />
                  <p className="text-sm font-medium">No logs yet</p>
                  <p className="text-xs mt-1">Logs appear as AI agents and backends process requests</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      {['Time', 'Tenant', 'Service', 'Level', 'Event', 'Message'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {adminLogs.map((log) => {
                      const LvlIcon = LEVEL_ICON[log.level] ?? InformationCircleIcon;
                      const isEx = expandedLog === log._id;
                      return (
                        <>
                          <tr key={log._id} onClick={() => setExpandedLog(isEx ? null : log._id)}
                            className="hover:bg-gray-800/30 cursor-pointer transition-colors">
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-300">
                              {log.tenantId?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                log.service === 'ai' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'
                              }`}>
                                {log.service === 'ai' ? <CpuChipIcon className="h-3 w-3" /> : <ServerIcon className="h-3 w-3" />}
                                {log.service === 'ai' ? 'AI' : 'Backend'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${LEVEL_CLS[log.level] ?? LEVEL_CLS.info}`}>
                                <LvlIcon className="h-3 w-3" />
                                {log.level}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-300 font-medium">{log.event}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-xs">{log.message}</td>
                          </tr>
                          {isEx && (
                            <tr key={`${log._id}-x`} className="bg-gray-800/30">
                              <td colSpan={6} className="px-6 py-4">
                                <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        ) : tab === 'users' ? (

          /* ── ALL USERS TABLE ── */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                  className="pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-600 w-64" />
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    {['User', 'Company', 'Role', 'Verified', 'Joined', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-white">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.tenantId
                          ? <><p className="text-white text-xs">{u.tenantId.name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PLAN_CONFIG[u.tenantId.plan]?.cls || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{PLAN_CONFIG[u.tenantId.plan]?.label || u.tenantId.plan}</span>
                            </>
                          : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{u.role.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        {u.emailVerified
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircleIcon className="h-4 w-4" />Verified</span>
                          : <span className="flex items-center gap-1 text-xs text-yellow-400"><ClockIcon className="h-4 w-4" />Pending</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!u.emailVerified && (
                            <button
                              onClick={() => handleVerifyEmail(u._id)}
                              className="flex items-center gap-1 text-xs bg-green-900/40 hover:bg-green-900/70 border border-green-700/50 text-green-400 px-2 py-1 rounded-lg transition-colors"
                              title="Force-verify email so user can log in"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" />Verify
                            </button>
                          )}
                          <button
                            onClick={() => { setResetModal({ userId: u._id, email: u.email }); setResetPassword(''); }}
                            className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded-lg transition-colors"
                            title="Reset password for this user"
                          >
                            <KeyIcon className="h-3.5 w-3.5" />Reset PW
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'health' ? (

          /* ── HEALTH ── */
          <HealthPanel />

        ) : tab === 'system' ? (

          /* ── SYSTEM SETTINGS ── */
          <SystemPanel />

        ) : tab === 'security' ? (

          /* ── SECURITY DASHBOARD ── */
          <SecurityPanel />

        ) : null}
      </div>

      {selectedClient && <TenantControlPanel clientId={selectedClient} onClose={() => setSelected(null)} />}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-base">Reset Password</h3>
              <button onClick={() => setResetModal(null)} className="text-gray-500 hover:text-gray-300">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Set a new password for <span className="text-white font-medium">{resetModal.email}</span>
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-600 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleResetUserPassword()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setResetModal(null)}
                className="flex-1 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetUserPassword}
                disabled={resetLoading || resetPassword.length < 8}
                className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {resetLoading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
