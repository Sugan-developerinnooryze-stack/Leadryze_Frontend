import { useEffect, useState, useRef, FormEvent } from 'react';
import { MagnifyingGlassIcon, PlusIcon, FunnelIcon, Cog6ToothIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { usePermission } from '../../hooks/usePermission';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Customer {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  leadSource?: string;
  channel: string;
  externalId?: string;
  sources?: string[];
  recordType: 'lead' | 'contact' | 'customer';
  status: string;
  tags: string[];
  createdAt: string;
  customFields?: Record<string, unknown>;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  new:       'bg-blue-50 text-blue-700 border border-blue-200',
  contacted: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  qualified: 'bg-green-50 text-green-700 border border-green-200',
  booked:    'bg-purple-50 text-purple-700 border border-purple-200',
  lost:      'bg-red-50 text-red-700 border border-red-200',
};

const SOURCE_ICON: Record<string, string> = {
  zoho: '🔵', hubspot: '🟠', salesforce: '☁️',
  web: '🌐', whatsapp: '💬', email: '📧', instagram: '📸', phone: '📞',
};

const EMPTY_FORM = { name: '', email: '', phone: '', company: '', channel: 'web', status: 'new', tags: '' };

const EMPTY_EDIT = {
  name: '', firstName: '', lastName: '',
  email: '', phone: '', company: '', leadSource: '',
  status: 'new', recordType: 'lead' as Customer['recordType'],
  tags: '',
};

const COL_PREF_KEY = (tenantId: string) => `lrz_cols_${tenantId}`;

const str = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'name' in v) return (v as { name: string }).name;
  return String(v);
};

const INPUT = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-300';
const LBL   = 'block text-xs font-medium text-gray-500 mb-1';

/* ─── Avatar ─────────────────────────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>
      {initials || '?'}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */
export default function CustomersPage() {
  const user         = useAuthStore((s) => s.user);
  const canCreate    = usePermission('customers.create');
  const canEdit      = usePermission('customers.edit');
  const canDelete    = usePermission('customers.delete');
  const activeChannels = useSourceFilterStore((s) => s.activeChannels);
  const { flags }    = useFeatureFlagsStore();
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [search, setSearch]             = useState('');
  const [tab, setTab]                   = useState<'all' | 'lead' | 'contact' | 'customer'>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [selected, setSelected]         = useState<Customer | null>(null);
  const [page, setPage]                 = useState(1);
  const [showColPicker, setShowColPicker] = useState(false);
  const [extraCols, setExtraCols]         = useState<string[]>([]);
  const colPickerRef = useRef<HTMLDivElement>(null);

  /* ── Edit / Delete state (drawer only) ── */
  const [editMode, setEditMode]       = useState(false);
  const [editForm, setEditForm]       = useState(EMPTY_EDIT);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');
  const [confirmDel, setConfirmDel]   = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const PER_PAGE = 20;

  useEffect(() => {
    if (!user?.tenantId) return;
    try {
      const saved = localStorage.getItem(COL_PREF_KEY(user.tenantId));
      if (saved) setExtraCols(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [user?.tenantId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchCustomers = () => {
    if (!user?.tenantId) return;
    setIsLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '500' });
    if (activeChannels.length > 0) params.set('channels', activeChannels.join(','));
    api.get(`/api/v1/customers?${params}`)
      .then((r) => setAllCustomers(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, [user?.tenantId, activeChannels]);
  useEffect(() => { setPage(1); }, [tab, search, statusFilter]);

  const allCustomFieldKeys = Array.from(
    new Set(allCustomers.flatMap((c) => Object.keys(c.customFields || {})))
  ).sort();

  const toggleCol = (key: string) => {
    const next = extraCols.includes(key)
      ? extraCols.filter((k) => k !== key)
      : [...extraCols, key];
    setExtraCols(next);
    if (user?.tenantId) localStorage.setItem(COL_PREF_KEY(user.tenantId), JSON.stringify(next));
  };

  const filtered = allCustomers.filter((c) => {
    const matchTab    = tab === 'all' || c.recordType === tab;
    const matchStatus = !statusFilter || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.company ?? '').toLowerCase().includes(q);
    return matchTab && matchStatus && matchSearch;
  });

  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const counts = {
    all:      allCustomers.length,
    lead:     allCustomers.filter((c) => c.recordType === 'lead').length,
    contact:  allCustomers.filter((c) => c.recordType === 'contact').length,
    customer: allCustomers.filter((c) => c.recordType === 'customer').length,
  };

  /* ── Add Customer (existing, unchanged) ── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/v1/customers', {
        name: form.name, email: form.email || undefined,
        phone: form.phone || undefined, company: form.company || undefined,
        channel: form.channel, status: form.status, recordType: 'customer',
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success('Customer added!');
      setShowModal(false); setForm(EMPTY_FORM); fetchCustomers();
    } catch { toast.error('Failed to add customer'); }
    finally { setSaving(false); }
  };

  const f = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  /* ── Open edit mode ── */
  const openEdit = (c: Customer) => {
    setEditForm({
      name:        c.name,
      firstName:   c.firstName  || '',
      lastName:    c.lastName   || '',
      email:       c.email      || '',
      phone:       c.phone      || '',
      company:     str(c.company),
      leadSource:  str(c.leadSource),
      status:      c.status,
      recordType:  c.recordType,
      tags:        c.tags.join(', '),
    });
    setEditError('');
    setConfirmDel(false);
    setEditMode(true);
  };

  const closeDrawer = () => {
    setSelected(null);
    setEditMode(false);
    setEditError('');
    setConfirmDel(false);
  };

  /* ── Update customer → backend PUT → write-back to CRM ── */
  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await api.put(`/api/v1/customers/${selected._id}`, {
        name:       editForm.name       || undefined,
        firstName:  editForm.firstName  || undefined,
        lastName:   editForm.lastName   || undefined,
        email:      editForm.email      || undefined,
        phone:      editForm.phone      || undefined,
        company:    editForm.company    || undefined,
        leadSource: editForm.leadSource || undefined,
        status:     editForm.status,
        recordType: editForm.recordType,
        tags: editForm.tags
          ? editForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
      });
      const fresh: Customer = updated.data.data;
      // Update list in-place so table reflects immediately
      setAllCustomers((prev) => prev.map((c) => c._id === fresh._id ? fresh : c));
      setSelected(fresh);
      setEditMode(false);
      toast.success('Customer updated — syncing to CRM…');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Update failed';
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Delete customer → backend DELETE → write-back to CRM ── */
  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    setEditError('');
    try {
      await api.delete(`/api/v1/customers/${selected._id}`);
      setAllCustomers((prev) => prev.filter((c) => c._id !== selected._id));
      closeDrawer();
      toast.success('Customer deleted — removing from CRM…');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Delete failed';
      setEditError(msg);
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  const ef = (k: keyof typeof EMPTY_EDIT) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditForm((p) => ({ ...p, [k]: e.target.value }));

  const TABS: { id: typeof tab; label: string }[] = [
    { id: 'all',      label: `All (${counts.all})` },
    ...(flags.customers_tabLeads    !== false ? [{ id: 'lead'     as const, label: `Leads (${counts.lead})`         }] : []),
    ...(flags.customers_tabContacts !== false ? [{ id: 'contact'  as const, label: `Contacts (${counts.contact})`   }] : []),
    ...(flags.customers_tabDirect   !== false ? [{ id: 'customer' as const, label: `Direct (${counts.customer})`    }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{filtered.length} records</p>
        </div>
        {canCreate && (
          <button className="btn-primary gap-2" onClick={() => setShowModal(true)}>
            <PlusIcon className="h-4 w-4" /> Add Customer
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-brand-500 text-brand-700 bg-brand-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 py-2 text-sm" placeholder="Search name, email, company…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <select className="input py-2 text-sm w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="booked">Booked</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        {allCustomFieldKeys.length > 0 && (
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setShowColPicker((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                extraCols.length > 0
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Columns
              {extraCols.length > 0 && (
                <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {extraCols.length}
                </span>
              )}
            </button>

            {showColPicker && (
              <div className="absolute right-0 top-full mt-2 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-64 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  CRM fields — toggle to show as column
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Synced from Zoho/HubSpot. New fields appear here after sync.
                </p>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {allCustomFieldKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extraCols.includes(key)}
                        onChange={() => toggleCol(key)}
                        className="rounded text-brand-600"
                      />
                      <span className="text-sm text-gray-700">{key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                {extraCols.length > 0 && (
                  <button
                    onClick={() => { setExtraCols([]); if (user?.tenantId) localStorage.removeItem(COL_PREF_KEY(user.tenantId)); }}
                    className="mt-3 w-full text-xs text-red-500 hover:text-red-700 py-1"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
        {isLoading ? (
          <div className="animate-pulse p-4 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-medium">No records found</p>
            <p className="text-sm mt-1">{search ? 'Try a different search term' : 'Connect your CRM or add customers manually'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Source</th>
                {extraCols.map((col) => (
                  <th key={col} className="px-4 py-3 whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((c) => (
                <tr key={c._id} onClick={() => { setSelected(c); setEditMode(false); setConfirmDel(false); setEditError(''); }}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} />
                      <p className="font-medium text-gray-900 leading-tight">{c.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{str(c.company) || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-48 truncate">{str(c.email) || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{str(c.phone) || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(c.sources && c.sources.length > 0 ? c.sources : [c.channel]).map((s) => (
                        <span key={s} title={s} className="text-base">{SOURCE_ICON[s] || '🌐'}</span>
                      ))}
                      {(!c.sources || c.sources.length <= 1) && (
                        <span className="text-gray-500 capitalize text-xs ml-1">{str(c.leadSource) || c.channel}</span>
                      )}
                    </div>
                  </td>
                  {extraCols.map((col) => (
                    <td key={col} className="px-4 py-3 text-gray-600 max-w-40 truncate whitespace-nowrap">
                      {str(c.customFields?.[col]) || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      c.recordType === 'lead'    ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                      c.recordType === 'contact' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                                                   'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      {c.recordType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] || 'bg-gray-50 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {format(new Date(c.createdAt), 'dd MMM yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                    page === i + 1 ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-200'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Detail / Edit Drawer ───────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={closeDrawer} />
          <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">

            {/* Drawer header */}
            <div className="px-5 py-4 border-b flex items-center justify-between gap-2 shrink-0">
              <h2 className="font-bold text-gray-900">
                {editMode ? 'Edit Customer' : 'Record Detail'}
              </h2>
              <div className="flex items-center gap-1.5">
                {!editMode && (
                  <>
                    {canEdit && (
                      <button
                        onClick={() => openEdit(selected)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setConfirmDel(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <TrashIcon className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </>
                )}
                {editMode && (
                  <>
                    <button
                      form="edit-customer-form"
                      type="submit"
                      disabled={editSaving}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setEditError(''); setConfirmDel(false); }}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button onClick={closeDrawer} className="p-1.5 hover:bg-gray-100 rounded-lg ml-1">
                  <XMarkIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Error banner */}
            {editError && (
              <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 shrink-0">
                {editError}
              </div>
            )}

            {/* Delete confirmation */}
            {confirmDel && !editMode && (
              <div className="mx-5 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg shrink-0">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Delete "{selected.name}"? This will also remove it from the source CRM.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDel(false)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── View Mode ── */}
            {!editMode && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                    {selected.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base">{selected.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        selected.recordType === 'lead'    ? 'bg-orange-100 text-orange-700' :
                        selected.recordType === 'contact' ? 'bg-teal-100 text-teal-700' :
                                                            'bg-gray-100 text-gray-700'
                      }`}>{selected.recordType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[selected.status]}`}>
                        {selected.status}
                      </span>
                    </div>
                  </div>
                </div>

                {selected.sources && selected.sources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected.sources.map((s) => (
                      <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-medium">
                        {SOURCE_ICON[s] || '🌐'} {s}
                      </span>
                    ))}
                  </div>
                )}

                {[
                  { label: 'Email',       value: selected.email },
                  { label: 'Phone',       value: selected.phone },
                  { label: 'Company',     value: str(selected.company) },
                  { label: 'Lead Source', value: str(selected.leadSource) },
                  { label: 'Created',     value: format(new Date(selected.createdAt), 'dd MMM yyyy, hh:mm a') },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="flex justify-between text-sm border-b border-gray-50 pb-3">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="text-gray-900 text-right max-w-48 truncate">{value}</span>
                  </div>
                ) : null)}

                {selected.customFields && Object.keys(selected.customFields).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
                      CRM Fields ({Object.keys(selected.customFields).length})
                    </p>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-56 overflow-y-auto">
                      {Object.entries(selected.customFields).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs gap-2">
                          <span className="text-gray-400 shrink-0">{k.replace(/_/g, ' ')}</span>
                          <span className="text-gray-700 text-right font-medium truncate max-w-36">{str(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tags.map((t) => (
                        <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Edit Mode ── */}
            {editMode && (
              <form
                id="edit-customer-form"
                onSubmit={handleUpdate}
                className="flex-1 overflow-y-auto p-5 space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LBL}>First Name</label>
                    <input className={INPUT} value={editForm.firstName} onChange={ef('firstName')} placeholder="First" />
                  </div>
                  <div>
                    <label className={LBL}>Last Name</label>
                    <input className={INPUT} value={editForm.lastName} onChange={ef('lastName')} placeholder="Last" />
                  </div>
                </div>

                <div>
                  <label className={LBL}>Full Name *</label>
                  <input className={INPUT} required value={editForm.name} onChange={ef('name')} placeholder="Full name" />
                </div>

                <div>
                  <label className={LBL}>Email</label>
                  <input className={INPUT} type="email" value={editForm.email} onChange={ef('email')} placeholder="email@example.com" />
                </div>

                <div>
                  <label className={LBL}>Phone</label>
                  <input className={INPUT} value={editForm.phone} onChange={ef('phone')} placeholder="+91 9876543210" />
                </div>

                <div>
                  <label className={LBL}>Company</label>
                  <input className={INPUT} value={editForm.company} onChange={ef('company')} placeholder="Acme Ltd" />
                </div>

                <div>
                  <label className={LBL}>Lead Source</label>
                  <input className={INPUT} value={editForm.leadSource} onChange={ef('leadSource')} placeholder="Advertisement, Web, etc." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LBL}>Status</label>
                    <select className={INPUT} value={editForm.status} onChange={ef('status')}>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="booked">Booked</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Type</label>
                    <select className={INPUT} value={editForm.recordType} onChange={ef('recordType')}>
                      <option value="lead">Lead</option>
                      <option value="contact">Contact</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={LBL}>Tags <span className="text-gray-400 font-normal">(comma separated)</span></label>
                  <input className={INPUT} value={editForm.tags} onChange={ef('tags')} placeholder="hot-lead, enterprise" />
                </div>

                <div className="pt-1 text-xs text-gray-400 border-t border-gray-100">
                  Changes save locally and sync back to the source CRM automatically.
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add Customer Modal (unchanged) ───────────────────────── */}
      <Modal open={showModal} title="Add Customer" onClose={() => { setShowModal(false); setForm(EMPTY_FORM); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" placeholder="John Doe" value={form.name} onChange={f('name')} required />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" placeholder="Acme Ltd" value={form.company} onChange={f('company')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="john@example.com" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 9876543210" value={form.phone} onChange={f('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Channel</label>
              <select className="input" value={form.channel} onChange={f('channel')}>
                <option value="web">Web</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={f('status')}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="booked">Booked</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Tags <span className="text-gray-400 font-normal">(comma separated)</span></label>
            <input className="input" placeholder="hot-lead, enterprise" value={form.tags} onChange={f('tags')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Customer'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
