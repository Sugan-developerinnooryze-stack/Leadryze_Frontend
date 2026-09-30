import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, KeyIcon, ArrowPathIcon, CheckCircleIcon, ClockIcon, UsersIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { AdminCard, AdminLoadingState, AdminErrorState, AdminEmptyState } from '../shared/AdminCard';
import { ConfirmDangerousAction } from '../shared/ConfirmDangerousAction';
import { PLAN_CONFIG, timeAgo } from '../shared/adminConfig';
import { CopyIconButton } from '../shared/CopyIconButton';
import CredentialsRevealModal from '../tenants/CredentialsRevealModal';
import AddUserModal from './AddUserModal';

interface AdminUserRow {
  _id: string; firstName: string; lastName: string; email: string; role: string;
  emailVerified: boolean; createdAt: string;
  tenantId?: { name: string; slug: string; plan: string; isActive: boolean; clientId?: string };
  // This user's own login identifier — the tenant's Client ID for a Tenant
  // Admin, or ClientID-U001 style for anyone else. Distinct per person,
  // unlike tenantId.clientId above which is the same for everyone at a
  // company.
  loginId?: string;
  // Present only when a Super Admin issued/regenerated this credential —
  // never for a self-chosen password.
  password?: string | null;
}

export default function UsersPage() {
  const [users, setUsers]     = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [search, setSearch]   = useState('');
  const [resetModal, setResetModal] = useState<{ userId: string; email: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState<{ userId: string; email: string } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [regeneratingFor, setRegeneratingFor] = useState<string | null>(null);
  const [regenResult, setRegenResult] = useState<{ loginId: string; email: string; temporaryPassword: string; emailSent: boolean } | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    authService.adminUsers()
      .then((u) => setUsers(u.data.data))
      .catch(() => { setError(true); toast.error('Failed to load users'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleVerifyEmail = async () => {
    if (!confirmVerify) return;
    setVerifyLoading(true);
    try {
      await authService.adminVerifyUserEmail(confirmVerify.userId);
      setUsers((prev) => prev.map((u) => u._id === confirmVerify.userId ? { ...u, emailVerified: true } : u));
      toast.success('Email verified — user can now log in');
      setConfirmVerify(null);
    } catch {
      toast.error('Failed to verify email');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setResetLoading(true);
    try {
      await authService.adminResetUserPassword(resetModal.userId, resetPassword);
      toast.success(`Password reset for ${resetModal.email}`);
      setUsers((prev) => prev.map((x) => x._id === resetModal.userId ? { ...x, password: resetPassword } : x));
      setResetModal(null);
      setResetPassword('');
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegeneratePasswordFor = async (u: AdminUserRow) => {
    if (!window.confirm(`Regenerate the password for ${u.email}? A new password will be emailed to them and the old one will stop working immediately.`)) return;
    setRegeneratingFor(u._id);
    try {
      const res = await authService.adminResetUserPassword(u._id, undefined, true);
      const { password, emailSent, loginId } = res.data.data;
      setRegenResult({ loginId: loginId ?? u.tenantId?.clientId ?? '(no Login ID on this account)', email: u.email, temporaryPassword: password, emailSent });
      // Update the inline display immediately, without a full reload.
      setUsers((prev) => prev.map((x) => x._id === u._id ? { ...x, password } : x));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to regenerate password');
    } finally {
      setRegeneratingFor(null);
    }
  };

  const filtered = users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <AdminLoadingState label="Loading users…" />;
  if (error) return <AdminErrorState description="Couldn't load the platform user list." onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-muted mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} across every tenant</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-ryze-500 focus:border-transparent w-64" />
          </div>
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Add User
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <AdminCard><AdminEmptyState icon={UsersIcon} title={search ? 'No users match your search' : 'No users yet'} /></AdminCard>
      ) : (
        <AdminCard>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border text-text-muted text-xs uppercase tracking-wider">
                {['User', 'Company', 'Password', 'Role', 'Verified', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-border flex items-center justify-center text-xs font-bold text-text-muted">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{u.firstName} {u.lastName}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-text-muted font-mono">{u.email}</p>
                          <CopyIconButton value={u.email} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.tenantId
                      ? <>
                          <p className="text-text-primary text-xs">{u.tenantId.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PLAN_CONFIG[u.tenantId.plan]?.cls || 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border'}`}>{PLAN_CONFIG[u.tenantId.plan]?.label || u.tenantId.plan}</span>
                          {(u.loginId ?? u.tenantId.clientId) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-[11px] text-text-muted font-mono">{u.loginId ?? u.tenantId.clientId}</p>
                              <CopyIconButton value={u.loginId ?? u.tenantId.clientId ?? ''} />
                            </div>
                          )}
                        </>
                      : <span className="text-text-muted text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.password
                      ? <div className="flex items-center gap-1"><p className="text-xs text-text-primary font-mono">{u.password}</p><CopyIconButton value={u.password} /></div>
                      : <span className="text-xs italic text-text-muted/60">self-changed</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-black/[0.04] dark:bg-white/[0.06] border border-border text-text-muted px-2 py-0.5 rounded-full">{u.role.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    {u.emailVerified
                      ? <span className="flex items-center gap-1 text-xs text-success-700 dark:text-success-500"><CheckCircleIcon className="h-4 w-4" />Verified</span>
                      : <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><ClockIcon className="h-4 w-4" />Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!u.emailVerified && (
                        <button
                          onClick={() => setConfirmVerify({ userId: u._id, email: u.email })}
                          className="flex items-center gap-1 text-xs bg-success-500/10 hover:bg-success-500/20 border border-success-500/20 text-success-700 dark:text-success-500 px-2 py-1 rounded-lg transition-colors"
                          title="Force-verify email so user can log in"
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5" />Verify
                        </button>
                      )}
                      <button
                        onClick={() => { setResetModal({ userId: u._id, email: u.email }); setResetPassword(''); }}
                        className="flex items-center gap-1 text-xs bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] border border-border text-text-primary px-2 py-1 rounded-lg transition-colors"
                        title="Set a specific password yourself — no email sent"
                      >
                        <KeyIcon className="h-3.5 w-3.5" />Reset PW
                      </button>
                      <button
                        onClick={() => handleRegeneratePasswordFor(u)}
                        disabled={regeneratingFor === u._id}
                        className="flex items-center gap-1 text-xs bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] border border-border text-text-primary px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
                        title="Auto-generate a new password and email it to them"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${regeneratingFor === u._id ? 'animate-spin' : ''}`} />Regenerate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setResetModal(null)}>
          <div role="dialog" aria-modal="true" className="bg-surface-elevated border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-primary font-semibold text-base">Reset Password</h3>
              <button onClick={() => setResetModal(null)} aria-label="Cancel" className="text-text-muted hover:text-text-primary">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-text-muted text-sm mb-4">
              Set a new password for <span className="text-text-primary font-medium">{resetModal.email}</span>. They'll need to use it on their next sign-in.
            </p>
            <input
              type="password"
              autoFocus
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-ryze-500 focus:border-transparent mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
            />
            <div className="flex gap-3">
              <button onClick={() => setResetModal(null)} className="flex-1 px-4 py-2 text-sm bg-surface hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-border text-text-primary rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || resetPassword.length < 8}
                className="flex-1 px-4 py-2 text-sm bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {resetLoading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDangerousAction
        open={!!confirmVerify}
        title="Force-verify this email?"
        consequences={[
          `${confirmVerify?.email ?? 'This user'} will be able to log in immediately, without clicking a verification link`,
          'Use this only when you\'ve confirmed the person\'s identity another way',
        ]}
        confirmWord={confirmVerify?.email ?? ''}
        confirmLabel="Verify Email"
        loading={verifyLoading}
        onCancel={() => setConfirmVerify(null)}
        onConfirm={handleVerifyEmail}
      />

      {showAddUser && (
        <AddUserModal onClose={() => setShowAddUser(false)} onCreated={load} />
      )}

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
