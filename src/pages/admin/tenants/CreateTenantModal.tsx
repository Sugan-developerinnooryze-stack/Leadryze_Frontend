import { useState } from 'react';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import CredentialsRevealModal from './CredentialsRevealModal';

const PLAN_OPTIONS = ['starter', 'growth', 'professional', 'enterprise'] as const;

const input = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400 focus:border-transparent';
const label = 'block text-xs font-semibold text-text-muted mb-1.5';

export default function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<(typeof PLAN_OPTIONS)[number]>('starter');
  const [domain, setDomain] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [result, setResult] = useState<{ loginId: string; email: string; temporaryPassword: string; emailSent: boolean } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Business name is required'); return; }
    if (!adminFirstName.trim() || !adminLastName.trim()) { toast.error('Tenant admin first and last name are required'); return; }
    if (!adminEmail.trim()) { toast.error('Tenant admin email is required'); return; }

    setSaving(true);
    try {
      const res = await authService.adminCreateTenant({
        name: name.trim(), plan, domain: domain.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined, contactPhone: contactPhone.trim() || undefined,
        adminFirstName: adminFirstName.trim(), adminLastName: adminLastName.trim(), adminEmail: adminEmail.trim(),
      });
      const { loginId, temporaryPassword, emailSent } = res.data.data;
      setResult({ loginId, email: adminEmail.trim(), temporaryPassword, emailSent });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <CredentialsRevealModal
        title="Tenant created"
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
        <h3 className="text-text-primary font-semibold text-base">Create Tenant</h3>
        <p className="text-sm text-text-muted mt-1 mb-4">
          Generates a Client ID and initial password, then emails them to the tenant admin.
        </p>

        <div className="space-y-3">
          <div>
            <label className={label}>Business Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Acme Services Pvt Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Plan</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} className={input}>
                {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Domain (optional)</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} className={input} placeholder="acme.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Business Contact Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={input} placeholder="optional" />
            </div>
            <div>
              <label className={label}>Business Contact Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={input} placeholder="optional" />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 mt-3">Tenant Admin</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>First Name *</label>
                <input value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Last Name *</label>
                <input value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} className={input} />
              </div>
            </div>
            <div className="mt-3">
              <label className={label}>Email *</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={input} placeholder="admin@acme.com" />
              <p className="mt-1 text-[11px] text-text-muted">Credentials are emailed here. No verification step for this path.</p>
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
            {saving ? 'Creating…' : 'Create Tenant'}
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
