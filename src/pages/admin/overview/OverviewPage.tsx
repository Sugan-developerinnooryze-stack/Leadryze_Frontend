import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingOffice2Icon, UsersIcon, UserGroupIcon, ChatBubbleLeftRightIcon,
  MegaphoneIcon, LinkIcon, ChevronRightIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { ActiveBadge } from '../shared/StatusBadge';
import { AdminLoadingState, AdminErrorState, AdminEmptyState } from '../shared/AdminCard';
import { PLAN_CONFIG, CONNECTOR_CONFIG } from '../shared/adminConfig';
import type { Stats, Client } from '../shared/adminTypes';

function ClientCard({ c, onClick, onToggle, onControls }: {
  c: Client; onClick: () => void; onToggle: (e: React.MouseEvent) => void; onControls: (e: React.MouseEvent) => void;
}) {
  const plan = PLAN_CONFIG[c.plan];
  const initials = c.adminUser
    ? `${c.adminUser.firstName[0]}${c.adminUser.lastName[0]}`
    : c.name.slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className="group bg-surface border border-border hover:border-ryze-300 dark:hover:border-ryze-700 rounded-xl p-5 cursor-pointer transition-all hover:shadow-md shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-ryze-600/10 border border-ryze-600/20 flex items-center justify-center text-sm font-bold text-ryze-600 dark:text-ryze-400 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors truncate">{c.name}</p>
            <p className="text-xs text-text-muted mt-0.5 truncate">{c.adminUser ? c.adminUser.email : 'No admin assigned'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${plan?.cls || 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>
            {plan?.label || c.plan}
          </span>
          <ActiveBadge active={c.isActive} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { icon: UsersIcon,               label: 'Users',     v: c.userCount     },
          { icon: UserGroupIcon,           label: 'Customers', v: c.customerCount },
          { icon: ChatBubbleLeftRightIcon, label: 'Messages',  v: c.messageCount  },
          { icon: MegaphoneIcon,           label: 'Campaigns', v: c.campaignCount },
        ].map(({ icon: Icon, label, v }) => (
          <div key={label} className="bg-background rounded-lg p-2.5 text-center border border-border">
            <Icon className="h-4 w-4 text-text-muted mx-auto mb-1" />
            <p className="text-base font-bold text-text-primary">{v}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(c.connectorTypes ?? []).length > 0
            ? (c.connectorTypes ?? []).map((type) => {
                const cfg = CONNECTOR_CONFIG[type];
                return (
                  <span key={type} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg?.bg || 'bg-black/[0.04] dark:bg-white/[0.06] border-border text-text-muted'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot || 'bg-text-muted'}`} />
                    {cfg?.label || type}
                  </span>
                );
              })
            : <span className="text-xs text-text-muted">No connectors</span>
          }
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onControls}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20"
          >
            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
            Controls
          </button>
          <button
            onClick={onToggle}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border ${
              c.isActive
                ? 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20 hover:bg-danger-500/20'
                : 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20 hover:bg-success-500/20'
            }`}>
            {c.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <span className="text-xs text-ryze-600 dark:text-ryze-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            View <ChevronRightIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([authService.adminStats(), authService.adminClients()])
      .then(([s, c]) => { setStats(s.data.data); setClients(c.data.data); })
      .catch(() => { setError(true); toast.error('Failed to load admin overview'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await authService.toggleClient(id);
      setClients((prev) => prev.map((c) => c._id === id ? { ...c, isActive: res.data.data.isActive } : c));
      toast.success(res.data.message);
    } catch { toast.error('Failed to update client'); }
  };

  const statCards = [
    { label: 'Total Clients',       value: stats?.totalClients     ?? 0, icon: BuildingOffice2Icon     },
    { label: 'Total Users',         value: stats?.totalUsers       ?? 0, icon: UsersIcon               },
    { label: 'Total Customers',     value: stats?.totalCustomers   ?? 0, icon: UserGroupIcon           },
    { label: 'Total Messages',      value: stats?.totalMessages    ?? 0, icon: ChatBubbleLeftRightIcon },
    { label: 'Total Campaigns',     value: stats?.totalCampaigns   ?? 0, icon: MegaphoneIcon           },
    { label: 'Active CRM Connects', value: stats?.activeConnectors ?? 0, icon: LinkIcon                },
  ];

  if (loading) return <AdminLoadingState label="Loading platform overview…" />;
  if (error) return <AdminErrorState description="Couldn't load platform stats or tenants." onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Platform Overview</h1>
        <p className="text-sm text-text-muted mt-0.5">Every tenant on LeadRyze AI, at a glance.</p>
      </div>

      {/* One cohesive strip, not six competing rainbow-gradient tiles —
         these are all the same kind of thing (a platform-wide count), so
         only the icon carries the teal accent, matching the tenant
         Dashboard's KPI strip pattern. */}
      <div className="flex flex-wrap divide-x divide-y sm:divide-y-0 divide-border bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4 flex-1 min-w-[180px]">
            <div className="p-2.5 bg-ryze-600/10 rounded-xl shrink-0">
              <Icon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">{label}</p>
              <p className="text-2xl font-bold text-text-primary tracking-tight tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">All Clients</h2>
          <span className="text-xs text-text-muted">Click any card to inspect</span>
        </div>
        {clients.length === 0 ? (
          <AdminEmptyState icon={BuildingOffice2Icon} title="No tenants yet" description="New tenants will appear here as they sign up or are created." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <ClientCard key={c._id} c={c}
                onClick={() => navigate(`/admin/tenants/${c._id}`)}
                onToggle={(e) => toggleClient(c._id, e)}
                onControls={(e) => { e.stopPropagation(); navigate(`/admin/tenants/${c._id}?tab=controls`); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
