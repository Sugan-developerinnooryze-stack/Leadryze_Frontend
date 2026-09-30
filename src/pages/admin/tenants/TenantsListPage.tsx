import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, BuildingOffice2Icon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { AdminCard, AdminLoadingState, AdminErrorState, AdminEmptyState } from '../shared/AdminCard';
import { ActiveBadge, StatusBadge } from '../shared/StatusBadge';
import { PLAN_CONFIG } from '../shared/adminConfig';
import type { Client } from '../shared/adminTypes';
import CreateTenantModal from './CreateTenantModal';
import CredentialsRevealModal from './CredentialsRevealModal';

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

// Undefined means 'approved' — same convention as the backend (pre-existing
// tenants and every Flow-A direct-creation tenant have no gate to clear).
function effectiveApprovalStatus(c: Client): 'pending' | 'approved' | 'rejected' {
  return c.approvalStatus ?? 'approved';
}

export default function TenantsListPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [search, setSearch]   = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [approveResult, setApproveResult] = useState<{ loginId: string; email: string; temporaryPassword: string; emailSent: boolean } | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    authService.adminClients()
      .then((c) => setClients(c.data.data))
      .catch(() => { setError(true); toast.error('Failed to load tenants'); })
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

  const approveTenant = async (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!c.adminUser?.emailVerified) return;
    setActingOn(c._id);
    try {
      const res = await authService.adminApproveTenant(c._id);
      const { loginId, email, temporaryPassword, emailSent } = res.data.data;
      setApproveResult({ loginId, email, temporaryPassword, emailSent });
      setClients((prev) => prev.map((x) => x._id === c._id ? { ...x, approvalStatus: 'approved' } : x));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve tenant');
    } finally {
      setActingOn(null);
    }
  };

  const rejectTenant = async (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Reject the signup for ${c.name}? They will not be able to log in.`)) return;
    setActingOn(c._id);
    try {
      await authService.adminRejectTenant(c._id);
      setClients((prev) => prev.map((x) => x._id === c._id ? { ...x, approvalStatus: 'rejected' } : x));
      toast.success('Tenant signup rejected');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject tenant');
    } finally {
      setActingOn(null);
    }
  };

  const filtered = clients
    .filter((c) => statusTab === 'all' || effectiveApprovalStatus(c) === statusTab)
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.adminUser?.email ?? '').toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return <AdminLoadingState label="Loading tenants…" />;
  if (error) return <AdminErrorState description="Couldn't load the tenant list." onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Tenants</h1>
          <p className="text-sm text-text-muted mt-0.5">{clients.length} tenant{clients.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants…"
              className="pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-ryze-500 focus:border-transparent w-64" />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Create Tenant
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              statusTab === tab ? 'bg-ryze-600 text-white' : 'bg-surface border border-border text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <AdminCard>
          <AdminEmptyState icon={BuildingOffice2Icon} title={search ? 'No tenants match your search' : 'No tenants yet'} />
        </AdminCard>
      ) : (
        <AdminCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border text-text-muted text-xs uppercase tracking-wider">
                {['Tenant', 'Admin', 'Plan', 'Customers', 'Connectors', 'Campaigns', 'Status', 'Approval', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c._id} onClick={() => navigate(`/admin/tenants/${c._id}`)}
                  className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-ryze-600/10 border border-ryze-600/20 flex items-center justify-center text-xs font-bold text-ryze-600 dark:text-ryze-400">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{c.name}</p>
                        <p className="text-xs text-text-muted">{c.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.adminUser
                      ? <><p className="text-text-primary text-xs">{c.adminUser.firstName} {c.adminUser.lastName}</p><p className="text-text-muted text-xs">{c.adminUser.email}</p></>
                      : <span className="text-text-muted text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${PLAN_CONFIG[c.plan]?.cls || 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>
                      {PLAN_CONFIG[c.plan]?.label || c.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary tabular-nums">{c.customerCount}</td>
                  <td className="px-4 py-3 text-text-primary tabular-nums">{c.connectorCount}</td>
                  <td className="px-4 py-3 text-text-primary tabular-nums">{c.campaignCount}</td>
                  <td className="px-4 py-3"><ActiveBadge active={c.isActive} /></td>
                  <td className="px-4 py-3">
                    {effectiveApprovalStatus(c) === 'pending' ? (
                      <div className="flex flex-col gap-1">
                        <StatusBadge label="Pending" tone="warning" />
                        <StatusBadge
                          label={c.adminUser?.emailVerified ? 'Email verified' : 'Email not verified'}
                          tone={c.adminUser?.emailVerified ? 'success' : 'neutral'}
                          dot={false}
                        />
                      </div>
                    ) : effectiveApprovalStatus(c) === 'rejected' ? (
                      <StatusBadge label="Rejected" tone="danger" />
                    ) : (
                      <StatusBadge label="Approved" tone="success" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {effectiveApprovalStatus(c) === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => approveTenant(c, e)}
                          disabled={!c.adminUser?.emailVerified || actingOn === c._id}
                          title={!c.adminUser?.emailVerified ? "Can't approve until the tenant admin's email is verified" : undefined}
                          className="text-xs px-2.5 py-1 rounded-lg border bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20 hover:bg-success-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => rejectTenant(c, e)}
                          disabled={actingOn === c._id}
                          className="text-xs px-2.5 py-1 rounded-lg border bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20 hover:bg-danger-500/20 disabled:opacity-40 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button onClick={(e) => toggleClient(c._id, e)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          c.isActive ? 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20 hover:bg-danger-500/20' : 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20 hover:bg-success-500/20'
                        }`}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {showCreate && (
        <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {approveResult && (
        <CredentialsRevealModal
          title="Tenant approved"
          loginId={approveResult.loginId}
          email={approveResult.email}
          password={approveResult.temporaryPassword}
          emailSent={approveResult.emailSent}
          onClose={() => setApproveResult(null)}
        />
      )}
    </div>
  );
}
