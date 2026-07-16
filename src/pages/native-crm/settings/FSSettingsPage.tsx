import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Cog6ToothIcon, CloudArrowUpIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  useFSSettingsQuery,
  useFSSettingsUpdate,
  useFSSettingsUpload,
  useTemplatePreferencesQuery,
  useTemplatePreferencesUpdate,
} from '../../../modules/native-crm/queries/fs-settings.queries';
import { useTenantLockAuditQuery } from '../../../modules/native-crm/queries/record-lock.queries';
import { useQueryClient } from '@tanstack/react-query';
import { useBranchesQuery, useCreateBranch } from '../../../modules/native-crm/queries/branch.queries';
import { Branch, useBranchStore } from '../../../stores/branch.store';

const TABS = ['Company', 'Address', 'Documents', 'Bank Details', 'Branding', 'Templates', 'Workflow', 'Permission'];

const LOCK_MODULES = [
  { module: 'leads',      label: 'Leads',       autoLockOnStatus: 'won',        statusLabel: 'Won' },
  { module: 'deals',      label: 'Deals',       autoLockOnStatus: 'closed_won', statusLabel: 'Closed Won' },
  { module: 'invoices',   label: 'Invoices',    autoLockOnStatus: 'paid',       statusLabel: 'Paid' },
  { module: 'contracts',  label: 'Contracts',   autoLockOnStatus: 'active',     statusLabel: 'Active' },
  { module: 'quotations', label: 'Quotations',  autoLockOnStatus: 'approved',   statusLabel: 'Approved' },
  { module: 'workorders', label: 'Work Orders', autoLockOnStatus: 'completed',  statusLabel: 'Completed' },
  { module: 'customers',  label: 'Customers',   autoLockOnStatus: '',           statusLabel: 'Manual only' },
  { module: 'contacts',   label: 'Contacts',    autoLockOnStatus: '',           statusLabel: 'Manual only' },
] as const;

const DOC_TYPES = [
  { key: 'invoice',   label: 'Invoice'       },
  { key: 'quotation', label: 'Quotation'      },
  { key: 'contract',  label: 'Contract'       },
  { key: 'workorder', label: 'Work Order'     },
] as const;

const VARIANTS = [
  {
    value: 'classic',
    label: 'Classic',
    desc:  'Clean table layout, grey header band, left-aligned logo.',
    preview: (
      <svg viewBox="0 0 160 100" className="w-full h-full">
        <rect width="160" height="100" fill="#f9fafb" />
        <rect x="8" y="8" width="144" height="16" rx="2" fill="#e5e7eb" />
        <rect x="8" y="30" width="60" height="6" rx="1" fill="#d1d5db" />
        <rect x="8" y="40" width="40" height="4" rx="1" fill="#e5e7eb" />
        <rect x="8" y="50" width="144" height="1" fill="#e5e7eb" />
        {([120,144,100,132] as number[]).map((w, i) => (
          <rect key={i} x="8" y={54 + i * 6} width={w} height="3" rx="1" fill="#f3f4f6" />
        ))}
        <rect x="100" y="80" width="52" height="12" rx="2" fill="#e5e7eb" />
      </svg>
    ),
  },
  {
    value: 'modern',
    label: 'Modern',
    desc:  'Dark navy header, white text, bold totals box.',
    preview: (
      <svg viewBox="0 0 160 100" className="w-full h-full">
        <rect width="160" height="100" fill="#f9fafb" />
        <rect x="0" y="0" width="160" height="24" fill="#0f172a" />
        <rect x="8" y="6" width="50" height="6" rx="1" fill="#334155" />
        <rect x="100" y="6" width="52" height="6" rx="1" fill="#334155" />
        <rect x="8" y="30" width="60" height="5" rx="1" fill="#d1d5db" />
        <rect x="8" y="40" width="40" height="4" rx="1" fill="#e5e7eb" />
        <rect x="8" y="50" width="144" height="1" fill="#e5e7eb" />
        {[54,60,66,72].map(y => (
          <rect key={y} x="8" y={y} width="144" height="3" rx="1" fill="#f3f4f6" />
        ))}
        <rect x="100" y="80" width="52" height="14" rx="2" fill="#0f172a" />
      </svg>
    ),
  },
  {
    value: 'minimal',
    label: 'Minimal',
    desc:  'No fills, thin dividers only, compact serif typography.',
    preview: (
      <svg viewBox="0 0 160 100" className="w-full h-full">
        <rect width="160" height="100" fill="#ffffff" />
        <rect x="8" y="10" width="144" height="1" fill="#d1d5db" />
        <rect x="8" y="12" width="60" height="7" rx="1" fill="#9ca3af" />
        <rect x="8" y="22" width="40" height="4" rx="1" fill="#e5e7eb" />
        <rect x="8" y="32" width="144" height="1" fill="#e5e7eb" />
        {[36,42,48,54].map(y => (
          <rect key={y} x="8" y={y} width="144" height="2" rx="1" fill="#f3f4f6" />
        ))}
        <rect x="8" y="62" width="144" height="1" fill="#d1d5db" />
        <rect x="108" y="70" width="44" height="4" rx="1" fill="#e5e7eb" />
        <rect x="108" y="78" width="44" height="6" rx="1" fill="#374151" />
      </svg>
    ),
  },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-3 border-b border-gray-100 last:border-0">
      <label className="text-sm font-medium text-gray-700 pt-2">{label}</label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
    />
  );
}

function TextareaInput({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
    />
  );
}

function ImageUpload({ field, currentUrl, label }: { field: string; currentUrl?: string; label: string }) {
  const uploadMutation = useFSSettingsUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ field, file });
  };

  return (
    <div className="flex items-center gap-3">
      {currentUrl && (
        <img src={currentUrl} alt={label} className="h-12 w-12 object-contain rounded border border-gray-200 bg-gray-50" />
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploadMutation.isPending}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        <CloudArrowUpIcon className="h-4 w-4 text-gray-500" />
        {uploadMutation.isPending ? 'Uploading…' : `Upload ${label}`}
      </button>
      {uploadMutation.isSuccess && <CheckIcon className="h-4 w-4 text-green-500" />}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

const MODULE_LABELS: Record<string, string> = {
  leads: 'Leads', deals: 'Deals', invoices: 'Invoices', contracts: 'Contracts',
  quotations: 'Quotations', workorders: 'Work Orders', customers: 'Customers', contacts: 'Contacts',
};

function LockAuditLog() {
  const [moduleFilter, setModuleFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const { data, isLoading, refetch, isFetching } = useTenantLockAuditQuery({
    module: moduleFilter || undefined,
    page,
    limit: 10,
  });

  const items: any[] = data?.items ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + '  ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  const emptyMsg = moduleFilter
    ? `No lock/unlock events for ${MODULE_LABELS[moduleFilter] ?? moduleFilter} yet. Enable auto-lock above and change a record's status to trigger the first entry.`
    : 'No audit entries yet. Lock or unlock any record to see activity here.';

  return (
    <div className="pt-4 border-t border-gray-100">
      {/* Header row */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs font-semibold text-gray-800">Lock / Unlock Audit Log</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Records actual lock &amp; unlock events on individual records — not config changes.
            Toggling auto-lock above only enables the feature; entries appear here when a record is actually locked.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 ml-3 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-3 mt-3">
        <span className="text-[11px] text-gray-500">Filter by module:</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setModuleFilter(''); setPage(1); }}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
              moduleFilter === '' ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >All</button>
          {Object.entries(MODULE_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { setModuleFilter(k); setPage(1); }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                moduleFilter === k ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >{v}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-8 px-4 text-center">
          <p className="text-xs text-gray-400">{emptyMsg}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">Module</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">Action</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">Reason</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">Performed By</th>
                  <th className="text-left font-medium text-gray-500 px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((entry: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/60">
                    <td className="px-3 py-2.5 font-medium text-gray-700">
                      {MODULE_LABELS[entry.entityModule] ?? entry.entityModule}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        entry.action === 'locked'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {entry.action === 'locked' ? '🔒' : '🔓'} {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[200px] truncate" title={entry.reason}>
                      {entry.reason}
                    </td>
                    <td className="px-3 py-2.5">
                      {entry.performedBy === 'system' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-medium">&#9881; system</span>
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]" title={entry.performedBy}>
                          {entry.performedBy.length > 16 ? entry.performedBy.slice(0, 8) + '...' + entry.performedBy.slice(-4) : entry.performedBy}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{fmt(entry.performedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-gray-400">{total} total {total === 1 ? 'entry' : 'entries'}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-[11px] rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >Prev</button>
                <span className="text-[11px] text-gray-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-[11px] rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >Next</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function FSSettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [saved,     setSaved]     = useState(false);
  const { data: settings, isLoading } = useFSSettingsQuery();
  const updateMutation = useFSSettingsUpdate();
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: templatePrefs }       = useTemplatePreferencesQuery();
  const prefsMutation                  = useTemplatePreferencesUpdate();
  const [savedPref, setSavedPref]      = useState<string | null>(null);

  const qc = useQueryClient();
  const { currentBranch, setBranch, branches } = useBranchStore();
  useBranchesQuery(false);
  const createBranchMutation = useCreateBranch();
  const [addCompanyOpen,   setAddCompanyOpen]   = useState(false);
  const [newBranchName,    setNewBranchName]    = useState('');
  const [newBranchType,    setNewBranchType]    = useState<'branch' | 'headquarters' | 'warehouse'>('branch');
  const [addCompanySaving, setAddCompanySaving] = useState(false);

  function handleCompanySwitch(branch: Branch | null) {
    setBranch(branch);
    setForm({});
    qc.invalidateQueries({ queryKey: ['native-crm', 'fs-settings'] });
  }

  async function handleAddCompany() {
    if (!newBranchName.trim()) return;
    setAddCompanySaving(true);
    try {
      const res = await createBranchMutation.mutateAsync({ branchName: newBranchName, branchType: newBranchType });
      const created = res.data.data as Branch;
      setAddCompanyOpen(false);
      setNewBranchName('');
      setNewBranchType('branch');
      handleCompanySwitch(created);
    } finally {
      setAddCompanySaving(false);
    }
  }

  const handleSetDefault = async (docType: string, variant: string) => {
    await prefsMutation.mutateAsync({ [docType]: variant });
    setSavedPref(`${docType}-${variant}`);
    setTimeout(() => setSavedPref(null), 2000);
  };

  const merged = { ...settings, ...form };
  const set = (key: string) => (val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    await updateMutation.mutateAsync(form);
    setForm({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Cog6ToothIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Field Service Settings</h1>
            <p className="text-xs text-gray-500">Company info, branding, prefixes, and bank details</p>
          </div>
        </div>
        {activeTab !== 5 && (
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || Object.keys(form).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saved ? <><CheckIcon className="h-4 w-4" /> Saved</> : updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Company tabs — switch between Default Company and each branch */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 shrink-0">
        <div className="flex items-center gap-0.5 pt-3 overflow-x-auto">
          <button
            onClick={() => handleCompanySwitch(null)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px transition-colors whitespace-nowrap ${
              !currentBranch
                ? 'bg-white border-gray-200 text-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            Default Company
          </button>
          {branches.filter((b) => b.status === 'active').map((branch) => (
            <button
              key={branch._id}
              onClick={() => handleCompanySwitch(branch)}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 -mb-px transition-colors whitespace-nowrap ${
                currentBranch?._id === branch._id
                  ? 'bg-white border-gray-200 text-gray-900 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {branch.branchName}
            </button>
          ))}
          <button
            onClick={() => setAddCompanyOpen(true)}
            className="shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 rounded-t-lg transition-colors whitespace-nowrap"
          >
            + Add Company
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 shrink-0">
        <nav className="flex gap-1">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">

          {/* Tab 0: Company Info */}
          {activeTab === 0 && (
            <div>
              {/* Client ID — read-only */}
              {/* {merged.clientId && (
                <div className="mb-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Your Client ID</p>
                    <p className="text-2xl font-mono font-bold text-gray-900 tracking-widest">{merged.clientId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Unique identifier for your account</p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(merged.clientId)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-white text-sm text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Copy Client ID"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              )} */}
              <FieldRow label="Company Name"><TextInput value={merged.companyName} onChange={set('companyName')} placeholder="Acme Services Pty Ltd" /></FieldRow>
              <FieldRow label="Company Logo"><ImageUpload field="companyLogo" currentUrl={merged.companyLogo} label="Logo" /></FieldRow>
              <FieldRow label="GSTIN / Tax ID"><TextInput value={merged.gstin} onChange={set('gstin')} /></FieldRow>
              <FieldRow label="PAN"><TextInput value={merged.pan} onChange={set('pan')} /></FieldRow>
              <FieldRow label="Business Reg. Number"><TextInput value={merged.businessRegNumber} onChange={set('businessRegNumber')} /></FieldRow>
              <FieldRow label="Company Email"><TextInput value={merged.companyEmail} onChange={set('companyEmail')} placeholder="info@company.com" /></FieldRow>
              <FieldRow label="Phone"><TextInput value={merged.phone} onChange={set('phone')} /></FieldRow>
              <FieldRow label="WhatsApp"><TextInput value={merged.whatsapp} onChange={set('whatsapp')} /></FieldRow>
              <FieldRow label="Website"><TextInput value={merged.website} onChange={set('website')} placeholder="https://www.company.com" /></FieldRow>
            </div>
          )}

          {/* Tab 1: Address */}
          {activeTab === 1 && (
            <div>
              <FieldRow label="Address Line 1"><TextInput value={merged.address1} onChange={set('address1')} /></FieldRow>
              <FieldRow label="Address Line 2"><TextInput value={merged.address2} onChange={set('address2')} /></FieldRow>
              <FieldRow label="City"><TextInput value={merged.city} onChange={set('city')} /></FieldRow>
              <FieldRow label="State"><TextInput value={merged.state} onChange={set('state')} /></FieldRow>
              <FieldRow label="Country"><TextInput value={merged.country} onChange={set('country')} /></FieldRow>
              <FieldRow label="Postal Code"><TextInput value={merged.postalCode} onChange={set('postalCode')} /></FieldRow>
              <FieldRow label="Timezone">
                <select value={merged.timezone ?? 'UTC'} onChange={(e) => set('timezone')(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {['UTC','Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth','Asia/Kolkata','America/New_York','America/Los_Angeles','Europe/London'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Currency">
                <select value={merged.currency ?? 'AUD'} onChange={(e) => set('currency')(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {['AUD','USD','GBP','EUR','INR','CAD','NZD','SGD'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FieldRow>
            </div>
          )}

          {/* Tab 2: Document Settings */}
          {activeTab === 2 && (
            <div>
              <FieldRow label="Invoice Prefix"><TextInput value={merged.invoicePrefix} onChange={set('invoicePrefix')} placeholder="INV" /></FieldRow>
              <FieldRow label="Quotation Prefix"><TextInput value={merged.quotationPrefix} onChange={set('quotationPrefix')} placeholder="QUO" /></FieldRow>
              <FieldRow label="Work Order Prefix"><TextInput value={merged.workOrderPrefix} onChange={set('workOrderPrefix')} placeholder="WO" /></FieldRow>
              <FieldRow label="Contract Prefix"><TextInput value={merged.contractPrefix} onChange={set('contractPrefix')} placeholder="CON" /></FieldRow>
              <FieldRow label="Receipt Prefix"><TextInput value={merged.receiptPrefix} onChange={set('receiptPrefix')} placeholder="RCP" /></FieldRow>
              <FieldRow label="Auto Client ID Prefix"><TextInput value={merged.autoClientIdPrefix} onChange={set('autoClientIdPrefix')} placeholder="LRZ" /></FieldRow>
              <FieldRow label="Tax Rate (%)">
                <input type="number" min={0} max={100} step={0.01}
                  value={merged.taxPercentage ?? 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </FieldRow>
            </div>
          )}

          {/* Tab 3: Bank Details */}
          {activeTab === 3 && (
            <div>
              <FieldRow label="Bank Name"><TextInput value={merged.bankName} onChange={set('bankName')} /></FieldRow>
              <FieldRow label="Account Name"><TextInput value={merged.accountName} onChange={set('accountName')} /></FieldRow>
              <FieldRow label="Account Number"><TextInput value={merged.accountNumber} onChange={set('accountNumber')} /></FieldRow>
              <FieldRow label="BSB / IFSC Code"><TextInput value={merged.ifscCode} onChange={set('ifscCode')} /></FieldRow>
              <FieldRow label="Branch"><TextInput value={merged.branch} onChange={set('branch')} /></FieldRow>
              <FieldRow label="UPI ID"><TextInput value={merged.upiId} onChange={set('upiId')} /></FieldRow>
              <FieldRow label="Payment QR Code"><ImageUpload field="qrCodeImage" currentUrl={merged.qrCodeImage} label="QR Code" /></FieldRow>
            </div>
          )}

          {/* Tab 4: Branding & Templates */}
          {activeTab === 4 && (
            <div>
              <FieldRow label="Company Signature"><ImageUpload field="companySignature" currentUrl={merged.companySignature} label="Signature" /></FieldRow>
              <FieldRow label="Company Stamp"><ImageUpload field="stampImage" currentUrl={merged.stampImage} label="Stamp" /></FieldRow>
              <FieldRow label="Terms & Conditions"><TextareaInput value={merged.termsAndConditions} onChange={set('termsAndConditions')} rows={5} /></FieldRow>
              <FieldRow label="Invoice Footer"><TextareaInput value={merged.invoiceFooter} onChange={set('invoiceFooter')} /></FieldRow>
              <FieldRow label="Quotation Footer"><TextareaInput value={merged.quotationFooter} onChange={set('quotationFooter')} /></FieldRow>
              <FieldRow label="Contract Footer"><TextareaInput value={merged.contractFooter} onChange={set('contractFooter')} /></FieldRow>
              <FieldRow label="Work Order Footer"><TextareaInput value={merged.workorderFooter} onChange={set('workorderFooter')} /></FieldRow>
            </div>
          )}

          {/* Tab 6: Workflow & Scheduling */}
          {activeTab === 6 && (() => {
            const ALL_STEPS = [
              { key: 'quotation', label: 'Quotation' },
              { key: 'contract',  label: 'Contract'  },
              { key: 'workorder', label: 'Work Order' },
              { key: 'invoice',   label: 'Invoice'   },
            ];

            const currentSteps: string[] = (form.workflowSteps ?? merged.workflowSteps) || ['quotation', 'workorder', 'invoice'];
            const autoGenerate: boolean  = form.autoGenerateWorkOrders ?? merged.autoGenerateWorkOrders ?? false;
            const hardBlock:    boolean  = form.staffHardBlock         ?? merged.staffHardBlock         ?? false;
            const defaultDuration        = form.defaultDurationHours   ?? merged.defaultDurationHours   ?? 1;

            const isActive = (key: string) => currentSteps.includes(key);

            const toggleStep = (key: string) => {
              const next = isActive(key)
                ? currentSteps.filter((s) => s !== key)
                : [...currentSteps, key];
              setForm((prev) => ({ ...prev, workflowSteps: next }));
            };

            const moveStep = (key: string, dir: -1 | 1) => {
              const idx  = currentSteps.indexOf(key);
              const next = [...currentSteps];
              const swap = idx + dir;
              if (swap < 0 || swap >= next.length) return;
              [next[idx], next[swap]] = [next[swap], next[idx]];
              setForm((prev) => ({ ...prev, workflowSteps: next }));
            };

            const STEP_COLORS: Record<string, string> = {
              quotation: 'bg-blue-50 border-blue-200 text-blue-700',
              contract:  'bg-purple-50 border-purple-200 text-purple-700',
              workorder: 'bg-amber-50 border-amber-200 text-amber-700',
              invoice:   'bg-green-50 border-green-200 text-green-700',
            };

            return (
              <div className="space-y-8">
                {/* Workflow Builder shortcut */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-800">
                  <div>
                    <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Visual Workflow Builder</p>
                    <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-0.5">Create named pipeline templates with drag-and-drop</p>
                  </div>
                  <Link
                    to="/native-crm/workflow-builder"
                    className="flex-shrink-0 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
                  >
                    Open Workflow Builder →
                  </Link>
                </div>

                {/* Document Workflow Order */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Document Workflow Order</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Select which documents are part of your pipeline and drag them into order. "Create from" buttons on each document will follow this sequence.
                  </p>

                  {/* Active steps — ordered */}
                  <div className="space-y-2 mb-4">
                    {currentSteps.map((key, idx) => {
                      const step = ALL_STEPS.find((s) => s.key === key);
                      if (!step) return null;
                      return (
                        <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${STEP_COLORS[key]}`}>
                          <span className="text-xs font-bold w-5 text-center opacity-60">{idx + 1}</span>
                          <span className="text-sm font-medium flex-1">{step.label}</span>
                          <button onClick={() => moveStep(key, -1)} disabled={idx === 0}
                            className="p-1 rounded hover:bg-white/60 disabled:opacity-30 transition-colors">
                            <ChevronUpIcon className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveStep(key, 1)} disabled={idx === currentSteps.length - 1}
                            className="p-1 rounded hover:bg-white/60 disabled:opacity-30 transition-colors">
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => toggleStep(key)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/70 hover:bg-white transition-colors opacity-70 hover:opacity-100">
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inactive steps — add */}
                  <div className="flex flex-wrap gap-2">
                    {ALL_STEPS.filter((s) => !isActive(s.key)).map((step) => (
                      <button key={step.key} onClick={() => toggleStep(step.key)}
                        className="px-3 py-1.5 text-xs font-medium border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                        + Add {step.label}
                      </button>
                    ))}
                    {ALL_STEPS.every((s) => isActive(s.key)) && (
                      <span className="text-xs text-gray-400 italic">All steps included</span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Auto-generate Work Orders */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Auto-generate Work Orders from Contracts</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When ON, the system automatically creates a Work Order each time a contract's service date arrives.
                      When OFF, you create Work Orders manually from the contract.
                    </p>
                  </div>
                  <button
                    onClick={() => setForm((prev) => ({ ...prev, autoGenerateWorkOrders: !autoGenerate }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      autoGenerate ? 'bg-brand-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                      autoGenerate ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Staff Hard Block */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Staff Hard Block</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When ON, busy staff are hidden from the dropdown when assigning a scheduled date.
                      When OFF, busy staff are shown with a red "Busy" badge as a soft warning.
                    </p>
                  </div>
                  <button
                    onClick={() => setForm((prev) => ({ ...prev, staffHardBlock: !hardBlock }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      hardBlock ? 'bg-brand-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                      hardBlock ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Default Work Order Duration */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Default Work Order Duration</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pre-filled duration for new work orders. When a scheduled date &amp; time is set,
                      staff are blocked only for this window (plus the same buffer before and after)
                      instead of the whole day.
                    </p>
                  </div>
                  {(() => {
                    const total = Number(defaultDuration) || 0;
                    let dHrs  = Math.floor(Math.min(Math.max(total, 0), 24));
                    let dMins = Math.round((Math.min(Math.max(total, 0), 24) - dHrs) * 60);
                    if (dMins === 60) { dHrs += 1; dMins = 0; }
                    const setHM = (h: number, m: number) => {
                      const joined = h >= 24 ? 24 : h + m / 60;
                      setForm((prev) => ({ ...prev, defaultDurationHours: joined }));
                    };
                    const sel = 'text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 shrink-0';
                    return (
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={dHrs} onChange={(e) => setHM(parseInt(e.target.value, 10), dMins)} className={sel}>
                          {Array.from({ length: 25 }, (_, i) => (
                            <option key={i} value={i}>{i} hr{i !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                        <select
                          value={dHrs === 24 ? 0 : dMins}
                          disabled={dHrs === 24}
                          onChange={(e) => setHM(dHrs, parseInt(e.target.value, 10))}
                          className={`${sel} disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* Tab 5: PDF Templates */}
          {activeTab === 5 && (
            <div className="space-y-8">
              <p className="text-xs text-gray-500">
                Choose the default PDF layout for each document type. You can still override this per-document when downloading.
              </p>
              {DOC_TYPES.map(({ key, label }) => {
                const current = templatePrefs?.[key] ?? 'classic';
                return (
                  <div key={key}>
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">{label}</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {VARIANTS.map(v => {
                        const isActive  = current === v.value;
                        const justSaved = savedPref === `${key}-${v.value}`;
                        return (
                          <div
                            key={v.value}
                            onClick={() => handleSetDefault(key, v.value)}
                            className={`relative cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                              isActive
                                ? 'border-brand-500 shadow-md'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {/* Thumbnail */}
                            <div className="h-24 bg-gray-50 flex items-center justify-center p-2">
                              {v.preview}
                            </div>
                            {/* Label + action */}
                            <div className="px-3 py-2 bg-white border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-800">{v.label}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{v.desc}</p>
                              <div className="mt-2">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600">
                                    <CheckIcon className="h-3 w-3" />
                                    {justSaved ? 'Saved!' : 'Default'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Click to set default</span>
                                )}
                              </div>
                            </div>
                            {isActive && (
                              <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center">
                                <CheckIcon className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 7: Permission / Record Locking */}
          {activeTab === 7 && (() => {
            const lockingConfig: any[] = merged.lockingConfig ?? [];
            const getRuleFor = (mod: string) =>
              lockingConfig.find((r: any) => r.module === mod) ?? { module: mod, autoLock: false, autoLockOnStatus: '', unlockRoles: ['TENANT_ADMIN', 'SUPER_ADMIN'] };
            const setRule = (mod: string, patch: Partial<{ autoLock: boolean; autoLockOnStatus: string }>) => {
              const current = lockingConfig.filter((r: any) => r.module !== mod);
              const existing = getRuleFor(mod);
              const updated  = [...current, { ...existing, ...patch }];
              setForm((prev) => ({ ...prev, lockingConfig: updated }));
            };
            return (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Record Locking</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    When auto-lock is ON for a module, records are automatically locked when they reach the trigger status.
                    Locked records are read-only for regular users. Admins can unlock with a mandatory reason.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Module</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 px-4">Auto-Lock</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 px-4">Trigger Status</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pl-4">Who Can Unlock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {LOCK_MODULES.map(({ module, label, autoLockOnStatus, statusLabel }) => {
                        const rule = getRuleFor(module);
                        return (
                          <tr key={module} className="py-3">
                            <td className="py-3 pr-4 font-medium text-gray-800">{label}</td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setRule(module, { autoLock: !rule.autoLock, autoLockOnStatus: autoLockOnStatus || rule.autoLockOnStatus })}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                  rule.autoLock ? 'bg-brand-500' : 'bg-gray-200'
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                                  rule.autoLock ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                              </button>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {autoLockOnStatus ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  rule.autoLock ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'
                                }`}>{statusLabel}</span>
                              ) : (
                                <span className="text-gray-400">Manual only</span>
                              )}
                            </td>
                            <td className="py-3 pl-4 text-xs text-gray-500">Admin</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Who can unlock records?</p>
                  <div className="flex gap-4">
                    {['TENANT_ADMIN', 'SUPER_ADMIN'].map((role) => (
                      <label key={role} className="flex items-center gap-2 text-xs text-gray-600 cursor-default">
                        <input type="checkbox" checked readOnly className="rounded accent-brand-500" />
                        {role}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Unlock rights are fixed to admin roles and cannot be changed.</p>
                </div>

                {/* PII & Field Visibility */}
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">PII & Field Visibility</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Controls which roles can see sensitive fields (phone, email, address, GST, PAN).
                    Admins always see full values. Toggle on to allow Managers to view them too.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Module</th>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 px-4">Fields Protected</th>
                          <th className="text-left text-xs font-medium text-gray-500 pb-2 pl-4">Managers Can View</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          { key: 'customers', label: 'Customers', fields: 'Phone, Email, Address, GST, PAN' },
                          { key: 'leads',     label: 'Leads',     fields: 'Phone, Email, Address, WhatsApp' },
                          { key: 'contacts',  label: 'Contacts',  fields: 'Phone, Email' },
                          { key: 'staffs',    label: 'Staff',     fields: 'Phone, Email' },
                          { key: 'sites',     label: 'Sites',     fields: 'Address, Phone' },
                        ].map((mod) => {
                          const piiConfig: any[] = merged.piiConfig ?? [];
                          const cfg = piiConfig.find((p: any) => p.module === mod.key);
                          const managerCanView = cfg?.viewRoles?.includes('MANAGER') ?? false;
                          const toggleManager = () => {
                            const others = piiConfig.filter((p: any) => p.module !== mod.key);
                            const newRoles = managerCanView
                              ? (cfg?.viewRoles ?? []).filter((r: string) => r !== 'MANAGER')
                              : [...(cfg?.viewRoles ?? []), 'MANAGER'];
                            setForm((prev: any) => ({
                              ...prev,
                              piiConfig: [...others, { module: mod.key, viewRoles: newRoles }],
                            }));
                          };
                          return (
                            <tr key={mod.key} className="py-3">
                              <td className="py-3 pr-4 font-medium text-gray-800">{mod.label}</td>
                              <td className="py-3 px-4 text-xs text-gray-400">{mod.fields}</td>
                              <td className="py-3 pl-4">
                                <button
                                  onClick={toggleManager}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                    managerCanView ? 'bg-indigo-500' : 'bg-gray-200'
                                  }`}
                                >
                                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                                    managerCanView ? 'translate-x-4' : 'translate-x-0'
                                  }`} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3">Agents and regular users always see masked values. Changes apply after Save.</p>
                </div>

                <LockAuditLog />
              </div>
            );
          })()}

        </div>
      </div>

      {/* Add Company mini-modal */}
      {addCompanyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Add Company / Branch</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. Chennai Office"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={newBranchType}
                  onChange={(e) => setNewBranchType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="branch">Branch Office</option>
                  <option value="headquarters">Headquarters</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setAddCompanyOpen(false); setNewBranchName(''); }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompany}
                disabled={addCompanySaving || !newBranchName.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {addCompanySaving ? 'Creating…' : 'Create & Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
