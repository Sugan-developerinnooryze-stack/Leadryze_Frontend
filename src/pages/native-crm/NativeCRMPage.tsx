import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon,
  MagnifyingGlassIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import {
  MODULE_CONFIGS, NATIVE_MODULES, STATUS_COLORS,
  type NativeModule, type FieldDef,
} from '../../config/native-crm.config';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface NativeRecord {
  _id:         string;
  module:      string;
  displayName: string;
  status:      string;
  fields:      Record<string, unknown>;
  createdAt:   string;
}

interface PageMeta { total: number; page: number; pages: number }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function StatusBadge({ value }: { value: string }) {
  const colors = STATUS_COLORS[value] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function fmtField(value: unknown, type: FieldDef['type']): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value);
  if (type === 'currency') return `${s}`;
  if (type === 'date' && s.includes('T')) return s.slice(0, 10);
  if (type === 'datetime' && s.includes('T')) return s.slice(0, 16).replace('T', ' ');
  return s;
}

/* ── Field Input ─────────────────────────────────────────────────────────── */
function FieldInput({
  field, value, onChange,
}: {
  field:    FieldDef;
  value:    string;
  onChange: (v: string) => void;
}) {
  const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors';

  if (field.type === 'select' && field.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select {field.label}</option>
        {field.options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value} rows={3}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${base} resize-none`}
      />
    );
  }

  const inputTypeMap: Record<string, string> = {
    text: 'text', email: 'email', phone: 'tel', number: 'number',
    date: 'date', datetime: 'datetime-local', currency: 'number',
    select: 'text', textarea: 'text',
  };
  const inputType = inputTypeMap[field.type] ?? 'text';

  return (
    <input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  );
}

/* ── Record Drawer ───────────────────────────────────────────────────────── */
function RecordDrawer({
  module, record, onClose, onSaved,
}: {
  module:   NativeModule;
  record:   NativeRecord | null;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const config = MODULE_CONFIGS[module];
  const isEdit = !!record;

  const initForm = useCallback(() => {
    const form: Record<string, string> = {};
    for (const f of config.fields) {
      form[f.key] = record ? String((record.fields as Record<string, unknown>)[f.key] ?? '') : '';
    }
    return form;
  }, [config.fields, record]);

  const [form,    setForm]    = useState<Record<string, string>>(initForm);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { setForm(initForm()); setErrors({}); }, [initForm]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.required && !form[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/v1/native-crm/${module}/${record._id}`, form);
      } else {
        await api.post(`/api/v1/native-crm/${module}`, form);
      }
      onSaved();
      onClose();
    } catch {
      setErrors({ _global: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? `Edit ${config.labelSingular}` : `New ${config.labelSingular}`}
            </h2>
            {isEdit && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{record.displayName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {errors._global && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors._global}</div>
          )}
          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                field={field}
                value={form[field.key] ?? ''}
                onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
              />
              {errors[field.key] && (
                <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${config.labelSingular}`}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Delete Confirm ──────────────────────────────────────────────────────── */
function DeleteConfirm({
  record, module, onClose, onDeleted,
}: {
  record:    NativeRecord;
  module:    NativeModule;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/native-crm/${module}/${record._id}`);
      onDeleted();
      onClose();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete Record</h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            Delete <span className="font-medium text-gray-700">{record.displayName}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {deleting && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function NativeCRMPage() {
  const { module: moduleParam } = useParams<{ module: string }>();
  const navigate = useNavigate();

  const module = (moduleParam as NativeModule) ?? 'contacts';
  const config = MODULE_CONFIGS[module];

  // Fallback if unknown module
  useEffect(() => {
    if (!MODULE_CONFIGS[module as NativeModule]) navigate('/native-crm/contacts', { replace: true });
  }, [module, navigate]);

  const [records,   setRecords]   = useState<NativeRecord[]>([]);
  const [meta,      setMeta]      = useState<PageMeta>({ total: 0, page: 1, pages: 1 });
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,      setPage]      = useState(1);

  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editRecord,    setEditRecord]    = useState<NativeRecord | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<NativeRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: NativeRecord[]; total: number; page: number; pages: number }>(
        `/api/v1/native-crm/${module}`, { params }
      );
      setRecords(res.data.data ?? []);
      setMeta({ total: res.data.total ?? 0, page: res.data.page ?? 1, pages: res.data.pages ?? 1 });
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [module, config, page, search, statusFilter]);

  useEffect(() => {
    setPage(1);
    setSearch('');
    setStatusFilter('');
  }, [module]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openCreate = () => { setEditRecord(null); setDrawerOpen(true); };
  const openEdit   = (r: NativeRecord) => { setEditRecord(r); setDrawerOpen(true); };

  if (!config) return null;

  const ModIcon    = config.icon;
  const statusField = config.statusField;
  const statusOptions = statusField
    ? config.fields.find((f) => f.key === statusField)?.options ?? []
    : [];

  /* ── Columns to display ─────────────────────────────────────────────── */
  const displayCols = config.listColumns.slice(0, 5);
  const colDefs = displayCols.map((key) => config.fields.find((f) => f.key === key)).filter(Boolean) as FieldDef[];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}>
              <ModIcon className="h-5 w-5" style={{ color: config.color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{config.label}</h1>
              <p className="text-sm text-gray-400">{meta.total} record{meta.total !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={`Search ${config.label.toLowerCase()}…`}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
              />
            </div>

            {/* Status filter */}
            {statusOptions.length > 0 && (
              <div className="relative">
                <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Add button */}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add {config.labelSingular}
            </button>
          </div>
        </div>

        {/* Module tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {NATIVE_MODULES.map(({ key, label, icon: TabIcon, color }) => (
            <button
              key={key}
              onClick={() => navigate(`/native-crm/${key}`)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                key === module
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              style={key === module ? { backgroundColor: color } : {}}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}>
              <ModIcon className="h-8 w-8" style={{ color: config.color }} />
            </div>
            <div>
              <p className="text-gray-600 font-medium">No {config.label.toLowerCase()} yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? `No results for "${search}"` : `Click "Add ${config.labelSingular}" to get started`}
              </p>
            </div>
            {!search && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add {config.labelSingular}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                {colDefs.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
                {statusField && !displayCols.includes(statusField) && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <Fragment key={r._id}>
                  <tr className="hover:bg-gray-50 transition-colors group">
                    {/* Display name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                          style={{ backgroundColor: config.color }}
                        >
                          {(r.displayName ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{r.displayName ?? '—'}</span>
                      </div>
                    </td>

                    {/* Dynamic columns */}
                    {colDefs.map((col) => {
                      const v = (r.fields as Record<string, unknown>)[col.key];
                      const isStatus = col.key === statusField;
                      return (
                        <td key={col.key} className="px-4 py-3 text-sm text-gray-600 max-w-[180px]">
                          {isStatus
                            ? <StatusBadge value={String(v ?? r.status)} />
                            : <span className="truncate block">{fmtField(v, col.type)}</span>
                          }
                        </td>
                      );
                    })}

                    {/* Status column if not already in displayCols */}
                    {statusField && !displayCols.includes(statusField) && (
                      <td className="px-4 py-3">
                        <StatusBadge value={r.status} />
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {meta.pages > 1 && (
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white">
          <span className="text-sm text-gray-500">
            Page {meta.page} of {meta.pages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              disabled={page === meta.pages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Record Drawer ─────────────────────────────────────────────── */}
      {drawerOpen && (
        <RecordDrawer
          module={module}
          record={editRecord}
          onClose={() => { setDrawerOpen(false); setEditRecord(null); }}
          onSaved={fetchRecords}
        />
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          module={module}
          record={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchRecords}
        />
      )}
    </div>
  );
}
