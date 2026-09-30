import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import CredentialsRevealModal from '../tenants/CredentialsRevealModal';
import type { Client } from '../shared/adminTypes';

const ROLE_OPTIONS = ['TENANT_ADMIN', 'MANAGER', 'AGENT', 'USER'] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generatePreviewPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  return out;
}

const input = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400 focus:border-transparent';
const label = 'block text-xs font-semibold text-text-muted mb-1.5';

export default function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tenants, setTenants] = useState<Client[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('AGENT');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [result, setResult] = useState<{ loginId: string; email: string; temporaryPassword: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    authService.adminClients()
      .then((res) => setTenants(res.data.data))
      .catch(() => toast.error('Failed to load company list'))
      .finally(() => setLoadingTenants(false));
  }, []);

  const selectedTenant = tenants.find((t) => t._id === tenantId);

  const handleSubmit = async () => {
    if (!tenantId) { toast.error('Choose a company'); return; }
    if (!firstName.trim() || !lastName.trim()) { toast.error('First and last name are required'); return; }
    if (!email.trim()) { toast.error('Email is required'); return; }
    if (password && password.length < 8) { toast.error('Password must be at least 8 characters, or leave it blank to auto-generate'); return; }

    setSaving(true);
    try {
      const res = await authService.adminCreateUser({
        tenantId, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), role,
        ...(password ? { password } : {}),
      });
      const { loginId, temporaryPassword, emailSent } = res.data.data;
      setResult({ loginId, email: email.trim(), temporaryPassword, emailSent });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <CredentialsRevealModal
        title="User created"
        loginId={result.loginId}
        email={result.email}
        password={result.temporaryPassword}
        emailSent={result.emailSent}
        onClose={() => { onCreated(); onClose(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-surface-elevated border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-text-primary font-semibold text-base">Add User</h3>
        <p className="text-sm text-text-muted mt-1 mb-4">
          Adds a user to an existing company and emails them their login credentials.
        </p>

        <div className="space-y-3">
          <div>
            <label className={label}>Company *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={loadingTenants}
              className={input}
            >
              <option value="">{loadingTenants ? 'Loading…' : 'Select a company'}</option>
              {tenants.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>
              Company Client ID <span className="ml-1 font-normal text-text-muted normal-case">(for reference)</span>
            </label>
            <input value={selectedTenant?.clientId ?? '—'} readOnly disabled className={`${input} bg-background text-text-muted font-mono cursor-not-allowed`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>First Name *</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Last Name *</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="person@company.com" />
            <p className="mt-1 text-[11px] text-text-muted">Their own Login ID (shown after creation) is based on the Client ID above — used as-is for a Tenant Admin, or with a unique suffix for any other role.</p>
          </div>

          <div>
            <label className={label}>Role *</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={input}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Password <span className="font-normal text-text-muted normal-case">(leave blank to auto-generate)</span></label>
            <div className="flex items-center gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Auto-generated if left blank"
                className={`${input} font-mono`}
              />
              <button
                type="button"
                onClick={() => setPassword(generatePreviewPassword())}
                className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating…' : 'Create User'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
