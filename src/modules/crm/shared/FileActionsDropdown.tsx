import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDownTrayIcon, ChevronDownIcon, DocumentArrowDownIcon,
  ArrowUpTrayIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';
import type { FieldConfig, CrmRecord } from './types/crm.types';

/* Extracted from CrmLayout.tsx so any module's page (including bespoke ones
 * like Leads, which don't run through CrmLayout at all) can reuse the exact
 * same Export/Template/Import behavior instead of a duplicated copy. */

export const SKIP_KEYS = new Set([
  '_id', 'tenantId', '__v', 'createdBy', 'updatedAt', 'createdAt',
  'customFields', 'tags', 'numId',
  // Managed by FsRelationPicker/RecordDrawer, not meant for ad-hoc raw
  // display as a table column (relatedId is a bare Mongo _id).
  'relatedModule', 'relatedId', 'relatedLabel',
]);

function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function fmtVal(v: unknown, type: FieldConfig['type']): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (type === 'date' && s.includes('T')) return s.slice(0, 10);
  if (type === 'datetime' && s.includes('T')) return s.slice(0, 16).replace('T', ' ');
  if (type === 'currency') return `$${Number(s).toLocaleString()}`;
  return s;
}

export function getCellValue(row: CrmRecord, col: FieldConfig): string {
  if (col.key.startsWith('cf__')) {
    const subKey = col.key.slice(4);
    const cfs = row.customFields as Record<string, unknown> | undefined;
    return String(cfs?.[subKey] ?? '');
  }
  return fmtVal(row[col.key], col.type);
}

/** Merges a module's declared fields with whatever extra keys show up on
 * loaded records (so nothing is silently un-exportable) plus active tenant
 * custom fields. */
export function deriveAllColumns(
  configFields: FieldConfig[],
  records: CrmRecord[],
  customFields: { _id: string; fieldKey: string; label: string; fieldType: string; isActive: boolean }[],
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
export default function FileActionsDropdown({
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
