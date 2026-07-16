import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useBranchesQuery,
  useCreateBranch,
  useUpdateBranch,
  useDeactivateBranch,
} from '../../../modules/native-crm/queries/branch.queries';
import { Branch, useBranchStore } from '../../../stores/branch.store';

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

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this branch? Its data will remain accessible in All Branches view.')) return;
    await deactivate.mutateAsync(id);
  }

  function field(key: keyof typeof EMPTY_FORM, label: string, placeholder = '') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
        <input
          value={(form as any)[key] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Branches</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage sub-organizations under your account
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            disabled={limit !== null && used >= limit}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            + New Branch
          </button>
        )}
      </div>

      {/* Plan usage */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {limit === null
              ? `${used} branches (Enterprise — unlimited)`
              : `${used} of ${limit} branches used (${plan.charAt(0).toUpperCase() + plan.slice(1)} plan)`}
          </p>
          {limit !== null && (
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${used >= limit ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
        {limit !== null && used >= limit && (
          <span className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0">
            Upgrade to add more branches
          </span>
        )}
      </div>

      {/* Branch list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading branches...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">&#127963;</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">No branches yet</p>
          <p className="text-sm mt-1">Create your first branch to start segmenting your data</p>
          {isAdmin && <button onClick={openCreate} className="mt-4 text-sm text-indigo-600 hover:underline">+ Create Branch</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Branch</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Location</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">GST</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                {isAdmin && <th className="pb-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900 dark:text-white">{b.branchName}</p>
                    <p className="text-xs text-gray-400">{b.branchCode}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 capitalize">{b.branchType}</td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{[b.city, b.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{b.gstin || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {b.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openBranchSettings(b)}
                        className="text-xs px-2 py-1 rounded-md text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors mr-2"
                      >
                        ⚙ Settings
                      </button>
                      <button onClick={() => openEdit(b)} className="text-xs text-indigo-600 hover:underline mr-3">Edit</button>
                      {b.status === 'active' && (
                        <button onClick={() => handleDeactivate(b._id)} className="text-xs text-red-500 hover:underline">Deactivate</button>
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
          <div className="w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="font-semibold text-gray-900 dark:text-white">{editing ? 'Edit Branch' : 'New Branch'}</h2>
              <button onClick={() => setShowDrawer(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 flex-1">
              {/* Branch type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Branch Type</label>
                <select
                  value={form.branchType ?? 'branch'}
                  onChange={(e) => setForm((f) => ({ ...f, branchType: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
              <button onClick={() => setShowDrawer(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors">
                {saving ? 'Saving...' : (editing ? 'Update Branch' : 'Create Branch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
