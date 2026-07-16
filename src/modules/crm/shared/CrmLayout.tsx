import { useState, useEffect, useCallback, Fragment, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon,
  MagnifyingGlassIcon, FunnelIcon, ArrowDownTrayIcon,
  TableCellsIcon, ChevronDownIcon, ChevronUpIcon,
  ChevronUpDownIcon, AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon, DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import type { FC, SVGProps } from 'react';
import api from '../../../services/api';
import CrmField from './CrmField';
import ColumnEditor from './ColumnEditor';
import { statusColor } from './crm.colors';
import type { FieldConfig, ModulePageConfig, CrmRecord, CrmPageMeta } from './types/crm.types';
import { useCustomFieldsQuery } from '../../native-crm/queries/custom-fields.queries';
import type { NativeCustomField } from '../../native-crm/queries/custom-fields.queries';
import CustomFieldRenderer from '../../native-crm/shared/CustomFieldRenderer';

/* ── Constants ──────────────────────────────────────────────────────────────── */
const SKIP_KEYS = new Set([
  '_id', 'tenantId', '__v', 'createdBy', 'updatedAt', 'createdAt',
  'customFields', 'tags', 'numId',
]);

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function StatusBadge({ value }: { value: string }) {
  if (!value || value === '—') return <span className="text-gray-400 text-sm">—</span>;
  const c = statusColor(value);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c.bg} ${c.text}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function fmtVal(v: unknown, type: FieldConfig['type']): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (type === 'date' && s.includes('T')) return s.slice(0, 10);
  if (type === 'datetime' && s.includes('T')) return s.slice(0, 16).replace('T', ' ');
  if (type === 'currency') return `$${Number(s).toLocaleString()}`;
  return s;
}

function getCellValue(row: CrmRecord, col: FieldConfig): string {
  if (col.key.startsWith('cf__')) {
    const subKey = col.key.slice(4);
    const cfs = row.customFields as Record<string, unknown> | undefined;
    return String(cfs?.[subKey] ?? '');
  }
  return fmtVal(row[col.key], col.type);
}

/* ── Dynamic column derivation ──────────────────────────────────────────────── */
function deriveAllColumns(
  configFields: FieldConfig[],
  records: CrmRecord[],
  customFields: NativeCustomField[],
): FieldConfig[] {
  const all: FieldConfig[] = [...configFields];
  const existingKeys = new Set(configFields.map((f) => f.key));

  if (records.length > 0) {
    for (const key of Object.keys(records[0])) {
      if (SKIP_KEYS.has(key) || existingKeys.has(key)) continue;
      all.push({ key, label: toLabel(key), type: 'text' });
      existingKeys.add(key);
    }
  }

  for (const cf of customFields.filter((f) => f.isActive)) {
    const cfKey = `cf__${cf.fieldKey}`;
    if (existingKeys.has(cfKey)) continue;
    all.push({ key: cfKey, label: cf.label, type: (cf.fieldType as FieldConfig['type']) ?? 'text' });
    existingKeys.add(cfKey);
  }

  return all;
}

function buildImportPayload(
  row: Record<string, string>,
  allCols: FieldConfig[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const customFieldsMap: Record<string, unknown> = {};

  for (const [label, val] of Object.entries(row)) {
    if (!val) continue;
    const col = allCols.find((c) => c.label === label);
    if (!col) continue;
    if (col.key.startsWith('cf__')) {
      customFieldsMap[col.key.slice(4)] = val;
    } else {
      payload[col.key] = val;
    }
  }

  if (Object.keys(customFieldsMap).length > 0) payload.customFields = customFieldsMap;
  return payload;
}

/* ── ImportModal ────────────────────────────────────────────────────────────── */
function ImportModal({
  importCols, apiBase, onClose, onDone,
}: {
  importCols: FieldConfig[];
  apiBase:    string;
  onClose:    () => void;
  onDone:     () => void;
}) {
  const [rows,     setRows]     = useState<Record<string, string>[]>([]);
  const [progress, setProgress] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target?.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      setRows(data);
      setProgress(`${data.length} rows parsed. Click Import to upload.`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setLoading(true);
    let done = 0;
    for (const row of rows) {
      const payload = buildImportPayload(row, importCols);
      try { await api.post(apiBase, payload); done++; } catch {}
      setProgress(`Importing… ${done}/${rows.length}`);
    }
    setProgress(`Done! ${done} of ${rows.length} imported.`);
    setLoading(false);
    setTimeout(onDone, 1200);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Import from File</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload an Excel (.xlsx) or CSV file. Column headers must match the template.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer mb-4"
          />
          {progress && <p className="text-xs text-gray-500 mb-4">{progress}</p>}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!rows.length || loading}
              className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {loading && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? 'Importing…' : `Import${rows.length > 0 ? ` (${rows.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── FileActionsDropdown ────────────────────────────────────────────────────── */
function FileActionsDropdown({
  moduleName, tableCols, allCols, sortedRecords, selectedIds, apiBase, onRefresh, page, limit,
}: {
  moduleName:    string;
  tableCols:     FieldConfig[];
  allCols:       FieldConfig[];
  sortedRecords: CrmRecord[];
  selectedIds:   Set<string>;
  apiBase:       string;
  onRefresh:     () => void;
  page:          number;
  limit:         number;
}) {
  const [open,       setOpen]       = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rows = selectedIds.size > 0
    ? sortedRecords.filter((r) => selectedIds.has(r._id))
    : sortedRecords;

  const importCols = allCols.filter(
    (c) => !SKIP_KEYS.has(c.key) && !c.key.startsWith('_'),
  );

  const exportExcel = () => {
    const headers = ['S.No.', ...tableCols.map((c) => c.label)];
    const data = rows.map((r, i) => [
      (page - 1) * limit + i + 1,
      ...tableCols.map((c) => getCellValue(r, c)),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, moduleName);
    XLSX.writeFile(wb, `${moduleName}.xlsx`);
    setOpen(false);
  };

  const exportCsvFn = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      ['S.No.', ...tableCols.map((c) => c.label)].join(','),
      ...rows.map((r, i) => [
        (page - 1) * limit + i + 1,
        ...tableCols.map((c) => esc(getCellValue(r, c))),
      ].join(',')),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `${moduleName}.csv`;
    a.click();
    setOpen(false);
  };

  const downloadTemplate = () => {
    const headers = importCols.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${moduleName}_template.xlsx`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span className="hidden sm:inline">File</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-green-600" />
            Export Excel
          </button>
          <button
            onClick={exportCsvFn}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-blue-600" />
            Export CSV
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4 text-gray-500" />
            Download Template
          </button>
          <button
            onClick={() => { setOpen(false); setImportOpen(true); }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpTrayIcon className="h-4 w-4 text-purple-600" />
            Import from File
          </button>
        </div>
      )}

      {importOpen && (
        <ImportModal
          importCols={importCols}
          apiBase={apiBase}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ── RecordDrawer ───────────────────────────────────────────────────────────── */
function RecordDrawer({
  config, record, moduleName, onClose, onSaved,
}: {
  config:     ModulePageConfig;
  record:     CrmRecord | null;
  moduleName: string;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const isEdit = !!record;

  const { data: rawCustomFields = [] } = useCustomFieldsQuery(moduleName);
  const activeCustomFields = rawCustomFields.filter((cf) => cf.isActive);

  const initForm = useCallback(() => {
    const f: Record<string, string> = {};
    for (const field of config.fields) f[field.key] = record ? String(record[field.key] ?? '') : '';
    return f;
  }, [config.fields, record]);

  const initCustomForm = useCallback(() => {
    const cf: Record<string, unknown> = {};
    const existingCF = record?.customFields as Record<string, unknown> | undefined;
    for (const f of activeCustomFields) {
      cf[f.fieldKey] = existingCF?.[f.fieldKey] ?? '';
    }
    return cf;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, activeCustomFields.map((f) => f._id).join(',')]);

  const [form,       setForm]       = useState<Record<string, string>>(initForm);
  const [customForm, setCustomForm] = useState<Record<string, unknown>>(initCustomForm);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { setForm(initForm()); setErrors({}); }, [initForm]);
  useEffect(() => { setCustomForm(initCustomForm()); }, [initCustomForm]);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.required && !form[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
      if (f.type === 'email' && form[f.key] && !/^[\w.+%-]+@[\w.-]+\.\w{2,}$/.test(form[f.key]))
        errs[f.key] = 'Not a valid email address';
    }
    for (const f of activeCustomFields) {
      if (f.required && !customForm[f.fieldKey]) errs[`cf_${f.fieldKey}`] = `${f.label} is required`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (addAnother = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (activeCustomFields.length > 0) payload.customFields = customForm;
      if (isEdit) await api.put(`${config.apiBase}/${record!._id}`, payload);
      else        await api.post(config.apiBase, payload);
      onSaved();
      if (addAnother) { setForm(initForm()); setCustomForm(initCustomForm()); setErrors({}); }
      else onClose();
    } catch {
      setErrors({ _global: 'Save failed. Please try again.' });
    } finally { setSaving(false); }
  };

  const nameOf = record
    ? String(record.firstName && record.lastName
        ? `${record.firstName} ${record.lastName}`
        : record.name ?? record.title ?? record.subject ?? record.contactName ?? record._id)
    : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? `Edit ${config.labelSingular}` : `Create ${config.labelSingular}`}
            </h2>
            {isEdit && <p className="text-xs text-gray-400 mt-0.5 truncate">{nameOf}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {errors._global && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors._global}
            </div>
          )}
          {config.fields.map((field) => (
            <CrmField
              key={field.key}
              field={field}
              value={form[field.key] ?? ''}
              onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
              error={errors[field.key]}
            />
          ))}

          {/* Custom Fields section */}
          {activeCustomFields.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Custom Fields
              </p>
              <div className="space-y-4">
                {activeCustomFields.map((cf) => (
                  <div key={cf._id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {cf.label}
                      {cf.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <CustomFieldRenderer
                      field={cf}
                      value={customForm[cf.fieldKey]}
                      onChange={(val) => setCustomForm((prev) => ({ ...prev, [cf.fieldKey]: val }))}
                    />
                    {errors[`cf_${cf.fieldKey}`] && (
                      <p className="text-xs text-red-500 mt-1">{errors[`cf_${cf.fieldKey}`]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0">
          {isEdit ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Create and add another
              </button>
              <button
                onClick={onClose}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── DeleteConfirm ──────────────────────────────────────────────────────────── */
function DeleteConfirm({
  config, record, onClose, onDeleted,
}: {
  config:    ModulePageConfig;
  record:    CrmRecord;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const nameOf = String(
    record.firstName && record.lastName
      ? `${record.firstName} ${record.lastName}`
      : record.name ?? record.title ?? record.subject ?? record.contactName ?? 'this record'
  );
  const handle = async () => {
    setBusy(true);
    try { await api.delete(`${config.apiBase}/${record._id}`); onDeleted(); onClose(); }
    catch { setBusy(false); }
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-center text-gray-900 mb-1">Delete {config.labelSingular}</h3>
          <p className="text-sm text-center text-gray-500 mb-6">
            Delete <span className="font-medium text-gray-700">{nameOf}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handle}
              disabled={busy}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              {busy && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── BulkDeleteConfirm ──────────────────────────────────────────────────────── */
function BulkDeleteConfirm({
  count, onClose, onConfirm,
}: {
  count: number; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-center text-gray-900 mb-1">Delete {count} records</h3>
          <p className="text-sm text-center text-gray-500 mb-6">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Delete {count}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── SortIcon ───────────────────────────────────────────────────────────────── */
function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: 'asc' | 'desc' }) {
  if (sortKey !== col)
    return <ChevronUpDownIcon className="h-3.5 w-3.5 text-gray-300 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
  return sortDir === 'asc'
    ? <ChevronUpIcon className="h-3.5 w-3.5 text-blue-600 ml-1 inline" />
    : <ChevronDownIcon className="h-3.5 w-3.5 text-blue-600 ml-1 inline" />;
}

/* ── Main CrmLayout ─────────────────────────────────────────────────────────── */
type SortDir = 'asc' | 'desc';
type ViewTab = 'all' | 'my' | 'unassigned';

interface CrmLayoutProps {
  config:    ModulePageConfig;
  iconColor: string;
  Icon:      FC<SVGProps<SVGSVGElement> & { className?: string }>;
}

export default function CrmLayout({ config, iconColor, Icon }: CrmLayoutProps) {
  /* ── module key (e.g. "contacts") ── */
  const moduleName = useMemo(
    () => config.apiBase.split('/').pop() ?? config.label.toLowerCase(),
    [config.apiBase, config.label],
  );

  /* ── data ── */
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [meta,    setMeta]    = useState<CrmPageMeta>({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  /* ── filters / pagination ── */
  const [search,  setSearch]  = useState('');
  const [statusF, setStatusF] = useState('');
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(20);
  const [viewTab, setViewTab] = useState<ViewTab>('all');

  /* ── sort ── */
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* ── UI toggles ── */
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [editRecord,       setEditRecord]       = useState<CrmRecord | null>(null);
  const [deleteTarget,     setDeleteTarget]     = useState<CrmRecord | null>(null);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [filterOpen,       setFilterOpen]       = useState(false);
  const [bulkDeleteOpen,   setBulkDeleteOpen]   = useState(false);

  /* ── custom fields ── */
  const { data: rawCustomFields = [] } = useCustomFieldsQuery(moduleName);
  const activeCustomFields = rawCustomFields.filter((cf) => cf.isActive);

  /* ── all derived columns (config + response + custom fields) ── */
  const allDerivedFields = useMemo(
    () => deriveAllColumns(config.fields, records, activeCustomFields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.fields, records, activeCustomFields.map((f) => f._id).join(',')],
  );

  /* ── column visibility with localStorage persistence ── */
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`crm-cols-${moduleName}`);
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return config.fields.filter((f) => f.tableCol).map((f) => f.key);
  });

  const handleApplyColumns = (keys: string[]) => {
    setVisibleKeys(keys);
    try { localStorage.setItem(`crm-cols-${moduleName}`, JSON.stringify(keys)); } catch {}
  };

  const tableCols = useMemo(
    () => visibleKeys
      .map((k) => allDerivedFields.find((f) => f.key === k))
      .filter(Boolean) as FieldConfig[],
    [allDerivedFields, visibleKeys],
  );

  /* ── bulk selection ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── derived ── */
  const statusOptions = config.statusField
    ? (config.fields.find((f) => f.key === config.statusField)?.options ?? [])
    : [];

  /* ── fetch ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (search)  params.search = search;
      if (statusF) params.status = statusF;
      const res = await api.get<{ data: CrmRecord[]; meta: CrmPageMeta }>(config.apiBase, { params });
      setRecords(res.data.data ?? []);
      setMeta(res.data.meta ?? { total: 0, page: 1, totalPages: 1 });
      setSelectedIds(new Set());
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [config.apiBase, page, limit, search, statusF]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* ── client-side sort ── */
  const sortedRecords = useMemo(() => {
    if (!sortKey) return records;
    return [...records].sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [records, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  /* ── bulk select ── */
  const allSelected  = sortedRecords.length > 0 && selectedIds.size === sortedRecords.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(sortedRecords.map((r) => r._id)));
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* ── bulk delete ── */
  const handleBulkDelete = async () => {
    await Promise.all([...selectedIds].map((id) => api.delete(`${config.apiBase}/${id}`)));
    setBulkDeleteOpen(false);
    fetchRecords();
  };

  /* ── helpers ── */
  const openCreate = () => { setEditRecord(null); setDrawerOpen(true); };
  const openEdit   = (r: CrmRecord) => { setEditRecord(r); setDrawerOpen(true); };
  const displayName = (r: CrmRecord) =>
    String(r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.name ?? r.title ?? r.subject ?? r.contactName ?? '—');

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── View tabs ─────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 px-6 shrink-0">
        <div className="flex items-center -mb-px overflow-x-auto">
          {(['all', 'my', 'unassigned'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setViewTab(tab); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                viewTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'all' ? `All ${config.label}` : tab === 'my' ? `My ${config.label}` : 'Unassigned'}
              {tab === 'all' && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  viewTab === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {meta.total}
                </span>
              )}
            </button>
          ))}
          <button
            className="ml-auto p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
            title="Add view"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0 flex-wrap bg-white">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Table view badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 bg-white cursor-default select-none">
            <TableCellsIcon className="h-4 w-4" />
            <span>Table view</span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
          </div>

          {/* Edit columns */}
          <button
            onClick={() => setColumnEditorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Edit columns ({visibleKeys.length})</span>
          </button>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${
                statusF
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {statusF && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute top-full mt-1.5 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
                    {config.statusField?.replace(/_/g, ' ') ?? 'Status'}
                  </p>
                  <div className="space-y-0.5">
                    <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        checked={statusF === ''}
                        onChange={() => { setStatusF(''); setPage(1); }}
                        className="text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">All</span>
                    </label>
                    {statusOptions.map((o) => (
                      <label key={o} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          checked={statusF === o}
                          onChange={() => { setStatusF(o); setPage(1); setFilterOpen(false); }}
                          className="text-blue-600 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 capitalize">{o.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                  {statusF && (
                    <button
                      onClick={() => { setStatusF(''); setFilterOpen(false); }}
                      className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 text-left px-2 py-1 hover:bg-gray-50 rounded transition-colors"
                    >
                      Clear filter ×
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Active sort chip */}
          {sortKey && (
            <button
              onClick={() => setSortKey('')}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {sortDir === 'asc' ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{config.fields.find((f) => f.key === sortKey)?.label ?? sortKey}</span>
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}

          {/* Sort (shortcut) */}
          {!sortKey && (
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ChevronUpDownIcon className="h-4 w-4" />
              Sort
            </button>
          )}

          {/* File dropdown (Export Excel/CSV + Template + Import) */}
          <FileActionsDropdown
            moduleName={moduleName}
            tableCols={tableCols}
            allCols={allDerivedFields}
            sortedRecords={sortedRecords}
            selectedIds={selectedIds}
            apiBase={config.apiBase}
            onRefresh={fetchRecords}
            page={page}
            limit={limit}
          />

          {/* Add button */}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add {config.labelSingular}s</span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── Bulk actions bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-blue-50 border-b border-blue-200 shrink-0">
          <span className="text-sm font-semibold text-blue-800">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 bg-white rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${iconColor}20` }}
            >
              <Icon className="h-8 w-8" style={{ color: iconColor }} />
            </div>
            <div>
              <p className="text-gray-700 font-semibold">No {config.label.toLowerCase()} yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || statusF
                  ? 'No records match your filters'
                  : `Click "Add ${config.labelSingular}s" to get started`}
              </p>
            </div>
            {!search && !statusF && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="h-4 w-4" /> Add {config.labelSingular}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {/* Bulk checkbox */}
                <th className="px-4 py-3 w-10 shrink-0">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                {/* S.No. — always first */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 select-none">
                  S.No.
                </th>
                {/* Name — always second */}
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                  onClick={() => handleSort('_displayName')}
                >
                  Name <SortIcon col="_displayName" sortKey={sortKey} sortDir={sortDir} />
                </th>
                {/* Dynamic visible columns */}
                {tableCols.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer group select-none whitespace-nowrap"
                    onClick={() => handleSort(c.key)}
                  >
                    {c.label} <SortIcon col={c.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                {/* Create date — always last */}
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer group select-none whitespace-nowrap"
                  onClick={() => handleSort('createdAt')}
                >
                  Create Date <SortIcon col="createdAt" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRecords.map((r, idx) => {
                const isSel = selectedIds.has(r._id);
                const sno   = (page - 1) * limit + idx + 1;
                return (
                  <Fragment key={r._id}>
                    <tr className={`transition-colors group ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {/* Checkbox */}
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(r._id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      {/* S.No. */}
                      <td className="px-4 py-3 text-sm text-gray-400 tabular-nums w-16">
                        {sno}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                            style={{ backgroundColor: iconColor }}
                          >
                            {displayName(r).slice(0, 2).toUpperCase()}
                          </div>
                          <button
                            onClick={() => openEdit(r)}
                            className="text-sm font-medium text-blue-700 hover:underline truncate max-w-[160px] text-left"
                          >
                            {displayName(r)}
                          </button>
                        </div>
                      </td>
                      {/* Dynamic cols */}
                      {tableCols.map((col) => {
                        const v = col.key.startsWith('cf__')
                          ? (r.customFields as Record<string, unknown> | undefined)?.[col.key.slice(4)]
                          : r[col.key];
                        const isStatus = col.type === 'select';

                        // Image preview
                        const isImgUrl = typeof v === 'string' && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(v);
                        const isImgArr = Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(v[0]);
                        const isVidUrl = typeof v === 'string' && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(v);
                        const isVidArr = Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(v[0]);

                        return (
                          <td key={col.key} className="px-4 py-3 text-sm text-gray-600 max-w-[180px]">
                            {isImgUrl ? (
                              <img src={v as string} className="h-8 w-8 rounded object-cover border border-gray-200" />
                            ) : isImgArr ? (
                              <div className="flex items-center gap-1">
                                <img src={(v as string[])[0]} className="h-8 w-8 rounded object-cover border border-gray-200" />
                                {(v as string[]).length > 1 && <span className="text-xs text-gray-400">+{(v as string[]).length - 1}</span>}
                              </div>
                            ) : isVidUrl ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                                1 video
                              </span>
                            ) : isVidArr ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6l2 2h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                                {(v as string[]).length} videos
                              </span>
                            ) : isStatus ? (
                              <StatusBadge value={String(v ?? '')} />
                            ) : (
                              <span className="truncate block">{fmtVal(v, col.type)}</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Create date */}
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {r.createdAt ? fmtVal(r.createdAt, 'date') : '—'}
                      </td>
                      {/* Row actions */}
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {meta.total > 0
              ? `${(page - 1) * limit + 1}–${Math.min(page * limit, meta.total)} of ${meta.total}`
              : '0 records'}
          </span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 px-1">{page} / {meta.totalPages || 1}</span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Portals ───────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <RecordDrawer
          config={config}
          record={editRecord}
          moduleName={moduleName}
          onClose={() => { setDrawerOpen(false); setEditRecord(null); }}
          onSaved={fetchRecords}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          config={config}
          record={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={fetchRecords}
        />
      )}
      {bulkDeleteOpen && (
        <BulkDeleteConfirm
          count={selectedIds.size}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
      {columnEditorOpen && (
        <ColumnEditor
          allFields={allDerivedFields}
          visibleKeys={visibleKeys}
          onApply={handleApplyColumns}
          onClose={() => setColumnEditorOpen(false)}
        />
      )}
    </div>
  );
}
