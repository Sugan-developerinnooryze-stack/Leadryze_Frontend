import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDownTrayIcon, ChevronDownIcon, DocumentArrowDownIcon,
  ArrowUpTrayIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';
import type { FieldConfig, CrmRecord } from './types/crm.types';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';
import { useStaffNameMap } from '../../native-crm/shared/useStaffNameMap';
import { useUserNameMap } from '../../native-crm/shared/useUserNameMap';
import { useCompanyNameMap } from '../../native-crm/shared/useCompanyNameMap';

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

// LR-UI-003: a 'staffSelect' field stores the staff's business-id
// ("4066EA51-ST-0002"), not their name — this used to render that raw id
// verbatim. staffNameMap/userNameMap/companyNameMap are all optional so
// every other caller (and every other field type) is completely unaffected.
export function fmtVal(
  v: unknown, type: FieldConfig['type'],
  staffNameMap?: Map<string, string>, userNameMap?: Map<string, string>, companyNameMap?: Map<string, string>,
): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (type === 'staffSelect' && staffNameMap) return staffNameMap.get(s) ?? s;
  if (type === 'userSelect' && userNameMap) return userNameMap.get(s) ?? s;
  if (type === 'companySelect' && companyNameMap) return companyNameMap.get(s) ?? s;
  if (type === 'date') return formatDate(s);
  if (type === 'datetime') return formatDateTime(s);
  if (type === 'currency') return `$${Number(s).toLocaleString()}`;
  // LR-UI-005: a 'select'/'categorySelect' field's raw stored value is a
  // snake_case/camelCase code (e.g. "closed_won", "in_progress") — shown
  // here verbatim before this, since no FieldConfig carries a separate
  // display label for its own options list (just string[] of the same
  // codes). Humanize for readability, same safe transform already used by
  // RecordTimeline.tsx's MetadataChips for the identical kind of raw value.
  if (type === 'select' || type === 'categorySelect') {
    const spaced = s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  }
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

/** LR-REPORT-001: exportExcel()/exportCsvFn() below used to reuse
 * getCellValue()/fmtVal() — meant for on-screen display — which baked a "$"
 * into every currency cell (breaking SUM in the exported file and any
 * re-import) and wrote "—" for a blank cell (not a parseable empty value).
 * This is the same data, formatted for a file instead of a screen: plain
 * numbers, and a truly empty string for "no value". */
export function getExportValue(
  row: CrmRecord,
  col: FieldConfig,
  staffNameMap?: Map<string, string>,
  userNameMap?: Map<string, string>,
  companyNameMap?: Map<string, string>,
): string {
  let v: unknown;
  if (col.key.startsWith('cf__')) {
    const cfs = row.customFields as Record<string, unknown> | undefined;
    v = cfs?.[col.key.slice(4)];
  } else {
    v = row[col.key];
  }
  if (v === null || v === undefined || v === '') return '';
  if (col.type === 'currency') return String(Number(v));
  const s = String(v);
  if (col.type === 'staffSelect' && staffNameMap) return staffNameMap.get(s) ?? s;
  if (col.type === 'userSelect' && userNameMap) return userNameMap.get(s) ?? s;
  if (col.type === 'companySelect' && companyNameMap) return companyNameMap.get(s) ?? s;
  if (col.type === 'date') return formatDate(s);
  if (col.type === 'datetime') return formatDateTime(s);
  if (col.type === 'select' || col.type === 'categorySelect') {
    const spaced = s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  }
  return s;
}

/** LR-REPORT-001: Returns typed values (number, Date, boolean, string) for XLSX export
 * so Excel formats numbers and dates with native types (enabling =SUM() and chronological sorting). */
export function getExportCellValue(
  row: CrmRecord,
  col: FieldConfig,
  staffNameMap?: Map<string, string>,
  userNameMap?: Map<string, string>,
  companyNameMap?: Map<string, string>,
): string | number | boolean | Date {
  let v: unknown;
  if (col.key.startsWith('cf__')) {
    const cfs = row.customFields as Record<string, unknown> | undefined;
    v = cfs?.[col.key.slice(4)];
  } else {
    v = row[col.key];
  }
  if (v === null || v === undefined || v === '') return '';

  if (col.type === 'currency' || col.type === 'number') {
    const num = Number(v);
    return isNaN(num) ? String(v) : num;
  }
  if (typeof v === 'boolean') {
    return v;
  }
  if (col.type === 'date' || col.type === 'datetime') {
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d;
    return String(v);
  }

  const s = String(v);
  if (col.type === 'staffSelect' && staffNameMap) return staffNameMap.get(s) ?? s;
  if (col.type === 'userSelect' && userNameMap) return userNameMap.get(s) ?? s;
  if (col.type === 'companySelect' && companyNameMap) return companyNameMap.get(s) ?? s;
  if (col.type === 'select' || col.type === 'categorySelect') {
    const spaced = s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
  }
  return s;
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
    if (val === '' || val === null || val === undefined) continue;
    const col = allCols.find((c) => c.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (!col) continue;

    let parsedVal: unknown = val;
    if (col.type === 'currency' || col.type === 'number') {
      const num = Number(val);
      if (!isNaN(num)) parsedVal = num;
    }

    if (col.key.startsWith('cf__')) {
      customFieldsMap[col.key.slice(4)] = parsedVal;
    } else {
      payload[col.key] = parsedVal;
    }
  }

  if (Object.keys(customFieldsMap).length > 0) payload.customFields = customFieldsMap;
  return payload;
}

interface RejectedRowInfo {
  rowNum: number;
  reason: string;
}

interface ImportSummaryResult {
  total: number;
  imported: number;
  duplicates: number;
  rejected: RejectedRowInfo[];
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
  const [rows,        setRows]        = useState<Record<string, string>[]>([]);
  const [progress,    setProgress]    = useState('');
  const [headerError, setHeaderError] = useState('');
  const [result,      setResult]      = useState<ImportSummaryResult | null>(null);
  const [loading,     setLoading]     = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeaderError('');
    setResult(null);
    setProgress('');
    setRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          setHeaderError('The uploaded file contains no sheets.');
          return;
        }
        const ws = wb.Sheets[sheetName];
        const headerRow = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] || [];
        const fileHeaders = (Array.isArray(headerRow) ? headerRow : [])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean);

        if (fileHeaders.length === 0) {
          setHeaderError('The uploaded file is empty.');
          return;
        }

        const templateLabels = new Set(importCols.map((c) => c.label.trim().toLowerCase()));
        const matchedHeaders = fileHeaders.filter((h) => templateLabels.has(h.trim().toLowerCase()));

        // Case A check: If no headers match template labels or First Name is missing when expected
        const requiresFirstName = importCols.some((c) => c.key === 'firstName');
        const matchesFirstName = fileHeaders.some(
          (h) => h.toLowerCase() === 'first name' || (requiresFirstName && h.toLowerCase() === 'first_name')
        );

        if (matchedHeaders.length === 0 || (requiresFirstName && !matchesFirstName)) {
          setHeaderError('Headers do not match the template. Please download and use the template file.');
          return;
        }

        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        if (!data.length) {
          setHeaderError('The uploaded file contains no data rows.');
          return;
        }

        setRows(data);
        setProgress(`${data.length} row${data.length > 1 ? 's' : ''} ready to import.`);
      } catch (err: any) {
        setHeaderError('Failed to parse file: ' + (err.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setLoading(true);
    setProgress('Importing…');
    let done = 0;
    let duplicates = 0;
    const rejected: RejectedRowInfo[] = [];

    const importUrl = `${apiBase}${apiBase.includes('?') ? '&' : '?'}skipDuplicates=true`;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const payload = buildImportPayload(row, importCols);
      try {
        const res = await api.post(importUrl, payload);
        if (res.data?.data?.duplicate || res.data?.data?.skipped) {
          duplicates++;
        } else {
          done++;
        }
      } catch (err: any) {
        const res = err?.response?.data;
        let reason = '';
        if (res?.issues && Array.isArray(res.issues) && res.issues.length > 0) {
          reason = String(res.issues[0]);
        } else if (res?.errors && typeof res.errors === 'object') {
          const firstKey = Object.keys(res.errors)[0];
          const val = res.errors[firstKey];
          const text = Array.isArray(val) ? val[0] : String(val);
          reason = `${firstKey}: ${text}`;
        } else {
          reason = res?.message || err?.message || 'Validation failed';
        }
        // If reason has a field prefix like "expectedRevenue: Expected Revenue must be ≥ 0", strip it
        reason = reason.replace(/^expectedRevenue:\s*/i, '');
        rejected.push({
          rowNum: i + 1,
          reason,
        });
      }
      setProgress(`Importing… ${done + duplicates + rejected.length}/${rows.length}`);
    }

    setLoading(false);
    setResult({
      total: rows.length,
      imported: done,
      duplicates,
      rejected,
    });
    if (done > 0) {
      onDone();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Import from File</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Upload an Excel (.xlsx) or CSV file. Column headers must match the template.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="w-full text-sm text-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-black/[0.04] dark:bg-white/[0.06] file:text-text-primary hover:file:bg-black/[0.06] dark:bg-white/[0.08] cursor-pointer mb-4"
          />

          {headerError && (
            <div className="p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium">
              {headerError}
            </div>
          )}

          {progress && !result && <p className="text-xs text-text-muted mb-4">{progress}</p>}

          {result && (
            <div className="mb-4 p-4 rounded-xl border border-border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">Import Summary</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-black/[0.05] dark:bg-white/[0.05] text-text-muted">
                  {result.imported} of {result.total} imported
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                {result.imported} imported
                {result.duplicates > 0 ? `, ${result.duplicates} duplicate${result.duplicates > 1 ? 's' : ''} skipped` : ''}
                {result.rejected.length > 0 ? `, ${result.rejected.length} rejected` : ''}
                {result.rejected.length > 0 ? ` – row ${result.rejected[0].rowNum}: ${result.rejected[0].reason}` : ''}
              </p>
              {result.rejected.length > 1 && (
                <div className="mt-2 max-h-36 overflow-y-auto space-y-1 text-xs text-red-600 dark:text-red-400">
                  {result.rejected.slice(1).map((rej) => (
                    <div key={rej.rowNum}>
                      • Row {rej.rowNum}: {rej.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result ? (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Close
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!rows.length || loading || !!headerError}
                className="flex-1 px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Importing…' : `Import${rows.length > 0 ? ` (${rows.length})` : ''}`}
              </button>
            </div>
          )}
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
  const staffNameMap = useStaffNameMap();
  const userNameMap = useUserNameMap();
  const companyNameMap = useCompanyNameMap();

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
      ...tableCols.map((c) => getExportCellValue(r, c, staffNameMap, userNameMap, companyNameMap)),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data], { cellDates: true });

    // Set number and date formats on typed cells so Excel displays them cleanly
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let C = 1; C <= tableCols.length; C++) {
      const col = tableCols[C - 1];
      if (col.type === 'currency') {
        for (let R = 1; R <= range.e.r; R++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.t === 'n') cell.z = '#,##0.00';
        }
      } else if (col.type === 'date') {
        for (let R = 1; R <= range.e.r; R++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && (cell.t === 'd' || cell.t === 'n')) cell.z = 'yyyy-mm-dd';
        }
      } else if (col.type === 'datetime') {
        for (let R = 1; R <= range.e.r; R++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && (cell.t === 'd' || cell.t === 'n')) cell.z = 'yyyy-mm-dd hh:mm:ss';
        }
      }
    }

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
        ...tableCols.map((c) => esc(getExportValue(r, c, staffNameMap, userNameMap, companyNameMap))),
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
        className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-text-muted hover:bg-background transition-colors"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span className="hidden sm:inline">File</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[200px]">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-green-600" />
            Export Excel
          </button>
          <button
            onClick={exportCsvFn}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-ryze-600 dark:text-ryze-400" />
            Export CSV
          </button>
          <div className="border-t border-border my-1" />
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4 text-text-muted" />
            Download Template
          </button>
          <button
            onClick={() => { setOpen(false); setImportOpen(true); }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
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
