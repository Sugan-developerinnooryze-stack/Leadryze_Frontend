import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useBranchesQuery,
  useCreateBranch,
  useUpdateBranch,
  useDeactivateBranch,
} from '../../../modules/native-crm/queries/branch.queries';
import { Branch, useBranchStore } from '../../../stores/branch.store';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';

const BRANCH_TYPES = [
  { value: 'headquarters', label: 'Headquarters' },
  { value: 'branch',       label: 'Branch Office' },
  { value: 'warehouse',    label: 'Warehouse' },
];

const EMPTY_FORM: Partial<Branch> & { branchName: string } = {
  branchName: '',
  branchType: 'branch',
  city: '', state: '', country: '', postalCode: '',
  email: '', phone: '', gstin: '', pan: '',
  address1: '', address2: '',
};

export default function BranchesPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setBranch } = useBranchStore();
  const { data, isLoading } = useBranchesQuery(true);
  const createBranch   = useCreateBranch();
  const updateBranch   = useUpdateBranch();
  const deactivate     = useDeactivateBranch();

  function openBranchSettings(branch: Branch) {
    setBranch(branch);
    qc.invalidateQueries();
    navigate('/native-crm/settings');
  }

  const [showDrawer, setShowDrawer]   = useState(false);
  const [editing, setEditing]         = useState<Branch | null>(null);
  const [form, setForm]               = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);

  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');
  const items   = data?.items ?? [];
  const plan    = data?.plan ?? 'starter';
  const used    = data?.used ?? 0;
  const limit   = data?.limit ?? null;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowDrawer(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({ ...branch });
    setError('');
    setShowDrawer(true);
  }

  async function handleSave() {
    if (!form.branchName?.trim()) { setError('Branch name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateBranch.mutateAsync({ id: editing._id, data: form });
      } else {
        await createBranch.mutateAsync(form as any);
      }
      setShowDrawer(false);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    await deactivate.mutateAsync(deactivateTarget._id);
  }

  function field(key: keyof typeof EMPTY_FORM, label: string, placeholder = '') {
    return (
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
        <input
          value={(form as any)[key] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Branches</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Manage sub-organizations under your account
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            disabled={limit !== null && used >= limit}
            className="px-4 py-2 text-sm font-medium text-white bg-ryze-600 hover:bg-ryze-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            + New Branch
          </button>
        )}
      </div>

      {/* Plan usage */}
      <div className="mb-6 p-4 bg-background rounded-xl border border-border flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">
            {limit === null
              ? `${used} branches (Enterprise — unlimited)`
              : `${used} of ${limit} branches used (${plan.charAt(0).toUpperCase() + plan.slice(1)} plan)`}
          </p>
          {limit !== null && (
            <div className="mt-2 h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${used >= limit ? 'bg-danger-500' : 'bg-ryze-500'}`}
                style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
        {limit !== null && used >= limit && (
          <span className="text-xs text-danger-600 dark:text-danger-500 font-medium shrink-0">
            Upgrade to add more branches
          </span>
        )}
      </div>

      {/* Branch list */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading branches...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-4xl mb-3">&#127963;</p>
          <p className="font-medium text-text-muted">No branches yet</p>
          <p className="text-sm mt-1">Create your first branch to start segmenting your data</p>
          {isAdmin && <button onClick={openCreate} className="mt-4 text-sm text-ryze-600 dark:text-ryze-400 hover:underline">+ Create Branch</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-3 font-medium text-text-muted">Branch</th>
                <th className="pb-3 font-medium text-text-muted">Type</th>
                <th className="pb-3 font-medium text-text-muted">Location</th>
                <th className="pb-3 font-medium text-text-muted">GST</th>
                <th className="pb-3 font-medium text-text-muted">Status</th>
                {isAdmin && <th className="pb-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((b) => (
                <tr key={b._id} className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-text-primary">{b.branchName}</p>
                    <p className="text-xs text-text-muted">{b.branchCode}</p>
                  </td>
                  <td className="py-3 pr-4 text-text-muted capitalize">{b.branchType}</td>
                  <td className="py-3 pr-4 text-text-muted">{[b.city, b.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-3 pr-4 text-text-muted">{b.gstin || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'active' ? 'bg-success-500/15 text-success-700 dark:text-success-500' : 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
                      {b.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openBranchSettings(b)}
                        className="text-xs px-2 py-1 rounded-md text-ryze-600 dark:text-ryze-400 border border-ryze-100 dark:border-ryze-800/40 bg-ryze-50 dark:bg-ryze-900/20 hover:bg-ryze-100 dark:hover:bg-ryze-900/30 transition-colors mr-2"
                      >
                        ⚙ Settings
                      </button>
                      <button onClick={() => openEdit(b)} className="text-xs text-ryze-600 dark:text-ryze-400 hover:underline mr-3">Edit</button>
                      {b.status === 'active' ? (
                        <button onClick={() => setDeactivateTarget(b)} className="text-xs text-danger-500 hover:underline">Deactivate</button>
                      ) : (
                        <button onClick={() => updateBranch.mutateAsync({ id: b._id, data: { status: 'active' } })} className="text-xs text-success-600 dark:text-success-500 hover:underline">Reactivate</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowDrawer(false)} />
          <div className="w-full max-w-md bg-surface shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="font-semibold text-text-primary">{editing ? 'Edit Branch' : 'New Branch'}</h2>
              <button onClick={() => setShowDrawer(false)} className="text-text-muted hover:text-text-primary text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 flex-1">
              {/* Branch type */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Branch Type</label>
                <select
                  value={form.branchType ?? 'branch'}
                  onChange={(e) => setForm((f) => ({ ...f, branchType: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-text-primary"
                >
                  {BRANCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {field('branchName', 'Branch Name *', 'e.g. Chennai Office')}
              {field('email', 'Email')}
              {field('phone', 'Phone')}
              {field('gstin', 'GSTIN')}
              {field('pan', 'PAN')}
              {field('address1', 'Address Line 1')}
              {field('address2', 'Address Line 2')}
              <div className="grid grid-cols-2 gap-3">
                {field('city', 'City')}
                {field('state', 'State')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field('country', 'Country')}
                {field('postalCode', 'Postal Code')}
              </div>
              {error && <p className="text-sm text-danger-600 dark:text-danger-500">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
              <button onClick={() => setShowDrawer(false)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-ryze-600 hover:bg-ryze-700 disabled:opacity-60 rounded-lg transition-colors">
                {saving ? 'Saving...' : (editing ? 'Update Branch' : 'Create Branch')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <FSDeleteModal
          label={deactivateTarget.branchName}
          icon={ExclamationTriangleIcon}
          tone="warning"
          title={`Deactivate "${deactivateTarget.branchName}"?`}
          description="Its data will remain accessible in All Branches view — this just stops new records being assigned to it."
          confirmLabel="Deactivate"
          confirmingLabel="Deactivating…"
          onClose={() => setDeactivateTarget(null)}
          onConfirm={confirmDeactivate}
        />
      )}
    </div>
  );
}
