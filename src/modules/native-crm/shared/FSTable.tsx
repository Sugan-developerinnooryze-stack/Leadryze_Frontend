import { useState, useEffect, useMemo, useRef, type ComponentType } from 'react';
import * as XLSX from 'xlsx';
import {
  PencilSquareIcon, TrashIcon, AdjustmentsHorizontalIcon,
  XMarkIcon, Bars3Icon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  DocumentArrowDownIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import type { FSColumnDef } from './types';
import api from '../../../services/api';
import { useBranchStore } from '../../../stores/branch.store';

/* ── Utilities ───────────────────────────────────────────────────────────── */

const SKIP_KEYS = new Set([
  '_id', 'tenantId', '__v', 'numId', 'createdBy',
  'updatedAt', 'createdAt', 'customFields', 'tags',
]);

// Keys that are auto-generated module IDs (not user-importable)
const MODULE_OWN_ID: Record<string, string> = {
  categories: 'categoryId',  services:   'serviceId',
  teams:      'teamId',       staffs:     'staffId',
  customers:  'customerId',   sites:      'siteId',
  parts:      'partId',       workorders: 'workOrderId',
  quotations: 'quotationId',  contracts:  'contractId',
  invoices:   'invoiceId',    receipts:   'receiptId',
  expenses:   'expenseId',    activities: 'activityId',
  products:   'productId',    assets:     'assetId',
  vehicles:   'vehicleId',
};

function toLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function deriveAllColumns(predefined: FSColumnDef[], data: any[]): FSColumnDef[] {
  if (!data.length) return predefined;
  const result: FSColumnDef[] = [...predefined];
  const existingKeys = new Set(predefined.map((c) => c.key));
  const firstRow = data[0];
  const cfKeys   = new Set(Object.keys(firstRow.customFields ?? {}));

  for (const key of Object.keys(firstRow)) {
    if (SKIP_KEYS.has(key) || existingKeys.has(key) || cfKeys.has(key)) continue;
    const val = firstRow[key];
    // Skip arrays and objects — they can't be rendered as plain cell text
    if (Array.isArray(val) || (val !== null && typeof val === 'object')) continue;
    result.push({ key, label: toLabel(key) });
    existingKeys.add(key);
  }

  const cf = firstRow.customFields;
  if (cf && typeof cf === 'object') {
    for (const subKey of Object.keys(cf)) {
      const colKey   = `cf__${subKey}`;
      const captured = subKey;
      if (!existingKeys.has(colKey)) {
        result.push({
          key:    colKey,
          label:  toLabel(captured),
          render: (row: any) => {
            const v = row.customFields?.[captured];
            return v !== undefined && v !== null && v !== '' ? String(v) : '—';
          },
        });
        existingKeys.add(colKey);
      }
    }
  }
  return result;
}

/** Get raw string value for export/template (skip JSX render functions) */
function getCellValue(row: any, col: FSColumnDef, branchMap?: Map<string, string>): string {
  if (col.exportValue) return col.exportValue(row);
  if (col.key.startsWith('cf__')) {
    const subKey = col.key.slice(4);
    const v = row.customFields?.[subKey];
    return v !== undefined && v !== null ? String(v) : '';
  }
  if (col.key === 'branchId' && branchMap) {
    const id = row.branchId;
    if (!id) return 'Default';
    return branchMap.get(String(id)) ?? 'Default';
  }
  const v = row[col.key];
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return '';
  return String(v);
}

/** Build POST payload from imported row (map label→key, handle customFields) */
function buildImportPayload(
  row: Record<string, string>,
  allCols: FSColumnDef[],
): Record<string, any> {
  const payload: Record<string, any> = {};
  const customFields: Record<string, any> = {};

  for (const [label, raw] of Object.entries(row)) {
    const val = raw?.toString().trim();
    if (!val) continue;
    const col = allCols.find((c) => c.label === label);
    if (!col) continue;
    if (col.key.startsWith('cf__')) {
      customFields[col.key.slice(4)] = val;
    } else {
      payload[col.key] = val;
    }
  }
  if (Object.keys(customFields).length) payload.customFields = customFields;
  return payload;
}

/* ── Column Picker ───────────────────────────────────────────────────────── */
interface PickerProps {
  allCols:  FSColumnDef[];
  visible:  string[];
  onChange: (keys: string[]) => void;
  onClose:  () => void;
}

function ColumnPicker({ allCols, visible, onChange, onClose }: PickerProps) {
  const [draft,       setDraft]       = useState<string[]>(visible);
  const [dragIdx,     setDragIdx]     = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const toggle = (key: string) =>
    setDraft((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  const remove = (key: string) => setDraft((p) => p.filter((k) => k !== key));

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragOverIdx(null); return; }
    const next = [...draft];
    const [removed] = next.splice(dragIdx, 1);
    next.splice(i, 0, removed);
    setDraft(next);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const apply = () => {
    onChange(draft.length ? draft : allCols[0] ? [allCols[0].key] : []);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-surface-elevated rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">Edit Columns</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left — PROPERTIES */}
            <div className="w-1/2 border-r border-border flex flex-col">
              <p className="px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border shrink-0">
                Properties ({allCols.length})
              </p>
              <div className="flex-1 overflow-y-auto py-1">
                {allCols.map((col) => (
                  <label key={col.key} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                    <input
                      type="checkbox"
                      checked={draft.includes(col.key)}
                      onChange={() => toggle(col.key)}
                      className="h-3.5 w-3.5 rounded border-border text-ryze-600 focus:ring-ryze-400"
                    />
                    <span className="text-xs text-text-primary truncate">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Right — SELECTED (draggable) */}
            <div className="w-1/2 flex flex-col">
              <p className="px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border shrink-0 flex items-center justify-between">
                <span>Selected Columns</span>
                <span className="text-ryze-600 dark:text-ryze-400 font-semibold">{draft.length}</span>
              </p>
              <div className="flex-1 overflow-y-auto py-1" onDragOver={(e) => e.preventDefault()}>
                {draft.length === 0 && <p className="px-4 py-3 text-xs text-text-muted">No columns selected</p>}
                {draft.map((key, i) => {
                  const col = allCols.find((c) => c.key === key);
                  if (!col) return null;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      onDragOver={(e) => { e.preventDefault(); if (dragIdx !== i) setDragOverIdx(i); }}
                      onDrop={(e) => handleDrop(e, i)}
                      className={[
                        'flex items-center gap-2 px-3 py-2 transition-colors cursor-grab active:cursor-grabbing select-none',
                        dragOverIdx === i && dragIdx !== i ? 'bg-ryze-600/10 border-t-2 border-ryze-400' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]',
                        dragIdx === i ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <Bars3Icon className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <span className="flex-1 text-xs text-text-primary truncate">{col.label}</span>
                      <button type="button" onClick={() => remove(key)} className="text-text-muted hover:text-danger-500 transition-colors shrink-0">
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
            <button onClick={() => setDraft(allCols.map((c) => c.key))} className="text-xs text-ryze-600 dark:text-ryze-400 hover:underline">
              Select all
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                Cancel
              </button>
              <button onClick={apply} className="px-3 py-1.5 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Import Modal ────────────────────────────────────────────────────────── */
interface ImportModalProps {
  moduleKey: string;
  allCols:   FSColumnDef[];
  onClose:   () => void;
  onDone:    () => void;
}

function ImportModal({ moduleKey, allCols, onClose, onDone }: ImportModalProps) {
  const [rows,     setRows]     = useState<any[]>([]);
  const [status,   setStatus]   = useState<'idle' | 'parsed' | 'importing' | 'done'>('idle');
  const [results,  setResults]  = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb    = XLSX.read(ev.target?.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json  = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
        if (!json.length) { setErrorMsg('File is empty or has no data rows.'); return; }
        setRows(json);
        setStatus('parsed');
      } catch {
        setErrorMsg('Could not parse file. Please use the downloaded template.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStatus('importing');
    let ok = 0, fail = 0;
    const payloads = rows.map((r) => buildImportPayload(r, allCols));
    const results  = await Promise.allSettled(
      payloads.map((p) => api.post(`/api/v1/native-crm/${moduleKey}`, p))
    );
    results.forEach((r) => r.status === 'fulfilled' ? ok++ : fail++);
    setResults({ ok, fail });
    setStatus('done');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-surface-elevated rounded-xl shadow-2xl w-full max-w-md pointer-events-auto flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Import {toLabel(moduleKey)}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {status === 'idle' && (
              <>
                <p className="text-xs text-text-muted">
                  Upload a CSV or Excel file matching the template format. Each row becomes one record.
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-ryze-400 hover:bg-ryze-600/5 transition-colors"
                >
                  <ArrowUpTrayIcon className="h-8 w-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm font-medium text-text-primary">Click to select file</p>
                  <p className="text-xs text-text-muted mt-0.5">.xlsx or .csv</p>
                  <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFile} />
                </div>
                {errorMsg && <p className="text-xs text-danger-500">{errorMsg}</p>}
              </>
            )}

            {status === 'parsed' && (
              <>
                <div className="bg-success-500/10 rounded-lg px-4 py-3 text-sm text-success-700 dark:text-success-500">
                  <span className="font-semibold">{rows.length} rows</span> ready to import
                </div>
                <div className="max-h-32 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-b border-border">
                          {Object.values(r).slice(0, 3).map((v, j) => (
                            <td key={j} className="px-3 py-1.5 text-text-muted truncate max-w-[120px]">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 5 && <p className="px-3 py-1.5 text-xs text-text-muted">+{rows.length - 5} more rows…</p>}
                </div>
              </>
            )}

            {status === 'importing' && (
              <div className="text-center py-6">
                <div className="flex gap-1.5 justify-center mb-3">
                  {[0,1,2].map((i) => (
                    <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-text-muted">Importing {rows.length} records…</p>
              </div>
            )}

            {status === 'done' && (
              <div className="space-y-2">
                {results.ok > 0 && (
                  <div className="bg-success-500/10 rounded-lg px-4 py-3 text-sm text-success-700 dark:text-success-500">
                    ✓ <span className="font-semibold">{results.ok} records</span> imported successfully
                  </div>
                )}
                {results.fail > 0 && (
                  <div className="bg-danger-500/10 rounded-lg px-4 py-3 text-sm text-danger-600 dark:text-danger-500">
                    ✗ <span className="font-semibold">{results.fail} records</span> failed
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 pb-4 flex gap-2 justify-end">
            {status === 'done' ? (
              <button onClick={() => { onDone(); onClose(); }} className="px-4 py-2 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 transition-colors">
                Done
              </button>
            ) : status === 'parsed' ? (
              <>
                <button onClick={() => { setRows([]); setStatus('idle'); if (fileRef.current) fileRef.current.value = ''; }} className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                  Change file
                </button>
                <button onClick={handleImport} className="px-4 py-2 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 transition-colors">
                  Import {rows.length} rows
                </button>
              </>
            ) : (
              <button onClick={onClose} className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── FSTable ─────────────────────────────────────────────────────────────── */
interface FSTableProps {
  columns:          FSColumnDef[];
  data:             any[];
  loading:          boolean;
  total:            number;
  page:             number;
  limit?:           number;
  totalPages:       number;
  onPageChange:     (p: number) => void;
  onEdit:           (row: any) => void;
  onDelete:         (row: any) => void;
  emptyIcon:        ComponentType<{ className?: string }>;
  emptyLabel:       string;
  onRowClick?:      (row: any) => void;
  moduleKey?:       string;
  onRefresh?:       () => void;
  extraRowActions?: (row: any) => React.ReactNode;
  /** Rendered in the same right-aligned toolbar row as File/Edit columns,
   * just to their left — e.g. a date-range filter. Only shown when a caller
   * actually passes one; most FSTable pages don't. */
  extraToolbar?:    React.ReactNode;
  /** HTTP status of the list query's own error, if any (e.g. 403) — lets the
   * table distinguish "you don't have permission" from "genuinely empty,"
   * which otherwise render identically and hide real permission problems
   * (a role with a stale/missing permission grant looks indistinguishable
   * from "no records yet" with no way to tell which one it actually is). */
  errorStatus?:     number;
  /** LR-UX-004: a 403 means either "you lack the RBAC permission" or "this
   * module isn't enabled for your plan" — two different problems with two
   * different fixes, previously shown as the identical generic permission
   * message even to a Tenant Admin, who can't grant themselves a
   * permission they're missing because the real cause is a disabled
   * module. Pass the server's own error message (it already distinguishes
   * the two) through; falls back to the old generic text if omitted, so
   * every existing caller that doesn't pass this is unaffected. */
  errorMessage?:    string;
}

export default function FSTable({
  columns, data, loading, total, page, limit = 20, totalPages,
  onPageChange, onEdit, onDelete, emptyIcon: EmptyIcon, emptyLabel, onRowClick,
  moduleKey, onRefresh, extraRowActions, errorStatus, errorMessage, extraToolbar,
}: FSTableProps) {
  const storageKey = moduleKey ? `fs-cols-${moduleKey}` : null;
  const branches = useBranchStore((s) => s.branches);
  const branchMap = useMemo(
    () => new Map(branches.map((b) => [b._id, b.branchName])),
    [branches],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // All available columns (predefined + auto-derived from response data)
  const allCols = useMemo(() => deriveAllColumns(columns, data), [columns, data]);

  // exportOnly cols are always appended in export but never shown in table or column picker
  const allTableCols   = useMemo(() => allCols.filter((c) => !c.exportOnly), [allCols]);
  const exportOnlyCols = useMemo(() => allCols.filter((c) =>  c.exportOnly), [allCols]);

  // Columns importable via template (skip auto-IDs and internal fields)
  const importCols = useMemo(() => {
    const ownId = moduleKey ? MODULE_OWN_ID[moduleKey] : undefined;
    return allTableCols.filter((c) => !SKIP_KEYS.has(c.key) && c.key !== ownId);
  }, [allTableCols, moduleKey]);

  const [visible, setVisible] = useState<string[]>(() => {
    if (storageKey) {
      try { const s = localStorage.getItem(storageKey); if (s) return JSON.parse(s); } catch {/* */}
    }
    return columns.filter((c) => !c.exportOnly).map((c) => c.key);
  });

  // Tracks every column key this module has ever encountered, so the
  // auto-add effect below can tell "brand new column" apart from "user
  // deliberately unchecked this in Edit Columns" — without this, any column
  // the user hides gets silently re-added the next time allTableCols recomputes.
  const seenKey = moduleKey ? `fs-cols-seen-${moduleKey}` : null;
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (storageKey) {
      try { const s = localStorage.getItem(storageKey); if (s) { setVisible(JSON.parse(s)); return; } } catch {/* */}
    }
    setVisible(columns.filter((c) => !c.exportOnly).map((c) => c.key));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  useEffect(() => {
    // LR-UI-001: no moduleKey means nothing persists across mounts (an
    // embedded related-list table, e.g. Company's Contacts/Deals tabs) — but
    // seeding this as an EMPTY Set meant the very next effect below treated
    // every raw auto-derived field (branchId, isLocked, clientId, ...) as
    // "newly discovered" on every single mount and force-added all of them,
    // silently defeating the caller's own curated `columns` prop. Seed with
    // the curated set instead, so only genuinely new fields (added to the
    // API response after this component was built) would ever auto-append —
    // and since there's no persistence here, that's a no-op difference from
    // moduleKey-backed tables' own first-run behavior just above.
    if (!seenKey) { seenRef.current = new Set(columns.map((c) => c.key)); return; }
    try {
      const s = localStorage.getItem(seenKey);
      if (s) {
        seenRef.current = new Set(JSON.parse(s));
        return;
      }
    } catch {/* */}
    // First run after this feature shipped (or first-ever visit): treat every
    // column currently known as already "seen" so nothing already hidden by
    // the user gets force-reselected.
    seenRef.current = new Set(allTableCols.map((c) => c.key));
    try { localStorage.setItem(seenKey, JSON.stringify([...seenRef.current])); } catch {/* */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  // Auto-add column keys that appear in allTableCols but have never been seen
  // before (handles sub-field columns added after the user's first visit).
  // Columns the user has seen and manually unchecked are left alone.
  useEffect(() => {
    const seen = seenRef.current;
    const newKeys = allTableCols.filter((c) => !seen.has(c.key)).map((c) => c.key);
    allTableCols.forEach((c) => seen.add(c.key));
    if (seenKey) { try { localStorage.setItem(seenKey, JSON.stringify([...seen])); } catch {/* */} }
    if (!newKeys.length) return;
    setVisible((prev) => {
      const additions = newKeys.filter((k) => !prev.includes(k));
      if (!additions.length) return prev;
      const next = [...prev, ...additions];
      if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {/* */} }
      return next;
    });
  }, [allTableCols, storageKey, seenKey]);

  const saveVisible = (keys: string[]) => {
    setVisible(keys);
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch {/* */} }
  };

  const safeVisible    = visible.filter((k) => allTableCols.some((c) => c.key === k));
  const orderedVisible = safeVisible.map((k) => allTableCols.find((c) => c.key === k)).filter(Boolean) as FSColumnDef[];

  // Export = visible table cols + always-appended exportOnly cols
  const exportCols = useMemo(() => [...orderedVisible, ...exportOnlyCols], [orderedVisible, exportOnlyCols]);

  /* ── Export helpers ──────────────────────────────────────────────────── */

  const exportToCSV = (rows: any[], cols: FSColumnDef[], filename: string) => {
    const headers = cols.map((c) => c.label);
    const csvRows = [
      headers.join(','),
      ...rows.map((row) => cols.map((c) => {
        const v = getCellValue(row, c, branchMap);
        return `"${v.replace(/"/g, '""')}"`;
      }).join(',')),
    ];
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
  };

  const exportToExcel = (rows: any[], cols: FSColumnDef[], filename: string) => {
    const wsData = [
      cols.map((c) => c.label),
      ...rows.map((row) => cols.map((c) => getCellValue(row, c, branchMap))),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = cols.map(() => ({ wch: 30 }));

    // Make URL values clickable hyperlinks (images, PDFs, etc.)
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && cell.t === 's' && typeof cell.v === 'string') {
          const urls = (cell.v as string).split(', ').filter((u) => u.startsWith('http://') || u.startsWith('https://'));
          if (urls.length === 1) {
            cell.l = { Target: urls[0] };
            cell.v = urls[0];
          } else if (urls.length > 1) {
            // Multiple image URLs — keep as comma-separated text (Excel can't hyperlink multi-value cells)
            cell.v = urls.join('\n');
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, toLabel(moduleKey ?? 'Data'));
    XLSX.writeFile(wb, filename);
  };

  const downloadTemplate = () => {
    const filename = `${moduleKey ?? 'template'}_import_template.xlsx`;
    exportToExcel([], importCols, filename);
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const name = moduleKey ?? 'export';
    const ts   = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      exportToCSV(data, exportCols, `${name}_${ts}.csv`);
    } else {
      exportToExcel(data, exportCols, `${name}_${ts}.xlsx`);
    }
  };

  /* ── Loading skeleton ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Permission-denied state — never rendered identically to "empty" ──── */
  if (errorStatus === 403) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-muted">
        <LockClosedIcon className="h-12 w-12 mb-3 text-amber-400" />
        <p className="text-sm font-medium text-text-primary">
          {errorMessage && errorMessage.toLowerCase().includes('not enabled') ? "This module isn't available" : "You don't have permission to view this"}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {errorMessage ?? 'Ask a Tenant Admin to grant access under Settings → Permissions.'}
        </p>
      </div>
    );
  }

  /* ── Toolbar (shared between empty + data states) ────────────────────── */
  const Toolbar = moduleKey ? (
    <div className="flex items-center justify-end px-4 pt-2 pb-1 shrink-0 gap-2">
      {extraToolbar}

      {/* File actions dropdown (Export / Template / Import) */}
      <FileActionsDropdown
        onExportExcel={() => handleExport('excel')}
        onExportCsv={() => handleExport('csv')}
        onTemplate={downloadTemplate}
        onImport={() => setImportOpen(true)}
      />

      {/* Column picker */}
      <button
        onClick={() => setPickerOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
      >
        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
        Edit columns
        <span className="ml-0.5 text-ryze-600 dark:text-ryze-400 font-semibold">({safeVisible.length})</span>
      </button>
    </div>
  ) : null;

  /* ── Empty state ─────────────────────────────────────────────────────── */
  if (!data.length) {
    return (
      <div className="flex-1 flex flex-col">
        {Toolbar}
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-muted">
          <EmptyIcon className="h-12 w-12 mb-3 text-text-muted/70" />
          <p className="text-sm font-medium">{emptyLabel}</p>
        </div>
        {pickerOpen && <ColumnPicker allCols={allTableCols} visible={safeVisible} onChange={saveVisible} onClose={() => setPickerOpen(false)} />}
        {importOpen && moduleKey && <ImportModal moduleKey={moduleKey} allCols={importCols} onClose={() => setImportOpen(false)} onDone={() => onRefresh?.()} />}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {Toolbar}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              {/* S.No. — always first, never in picker */}
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-14">
                S.No.
              </th>
              {orderedVisible.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="sticky right-0 z-20 px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider bg-background shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {data.map((row, idx) => (
              <tr
                key={row._id ?? idx}
                className={`group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {/* S.No. cell */}
                <td className="px-4 py-3 text-xs text-text-muted tabular-nums font-medium whitespace-nowrap">
                  {row.isLocked && (
                    <span className="inline-block mr-1 text-amber-500" title="Record locked">&#128274;</span>
                  )}
                  {(page - 1) * limit + idx + 1}
                </td>
                {orderedVisible.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-text-primary whitespace-nowrap">
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                <td
                  className="sticky right-0 z-10 px-4 py-3 text-right bg-surface group-hover:bg-black/[0.02] dark:group-hover:bg-white/[0.03] transition-colors shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    {extraRowActions?.(row)}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(row); }} title="Edit" className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-colors">
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(row); }} title="Delete" className="p-1.5 rounded-lg text-text-muted hover:text-danger-600 dark:hover:text-danger-500 hover:bg-danger-500/10 transition-colors">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-surface shrink-0">
        <p className="text-xs text-text-muted">
          {total > 0 ? (
            <>Page <span className="font-medium text-text-primary">{page}</span> of <span className="font-medium text-text-primary">{totalPages}</span> &middot; <span className="font-medium text-text-primary">{total}</span> total</>
          ) : (
            <><span className="font-medium text-text-primary">{data.length}</span> record{data.length !== 1 ? 's' : ''}</>
          )}
        </p>
        <div className="flex gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>

      {pickerOpen && <ColumnPicker allCols={allCols} visible={safeVisible} onChange={saveVisible} onClose={() => setPickerOpen(false)} />}
      {importOpen && moduleKey && <ImportModal moduleKey={moduleKey} allCols={importCols} onClose={() => setImportOpen(false)} onDone={() => onRefresh?.()} />}
    </div>
  );
}

/* ── File Actions Dropdown ───────────────────────────────────────────────── */
interface FileActionsProps {
  onExportExcel: () => void;
  onExportCsv:   () => void;
  onTemplate:    () => void;
  onImport:      () => void;
}

function FileActionsDropdown({ onExportExcel, onExportCsv, onTemplate, onImport }: FileActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const item = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
      >
        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
        File
        <svg className={`h-3 w-3 ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated rounded-xl shadow-lg border border-border z-20 overflow-hidden py-1">
          {/* Export section */}
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Export</p>
          {item('Excel (.xlsx)', <ArrowDownTrayIcon className="h-3.5 w-3.5 text-success-600 dark:text-success-500" />, onExportExcel)}
          {item('CSV (.csv)',    <ArrowDownTrayIcon className="h-3.5 w-3.5 text-blue-500" />,  onExportCsv)}

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Import section */}
          <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Import</p>
          {item('Download Template', <DocumentArrowDownIcon className="h-3.5 w-3.5 text-text-muted" />, onTemplate)}
          {item('Import from File',  <ArrowUpTrayIcon      className="h-3.5 w-3.5 text-ryze-500" />, onImport)}
        </div>
      )}
    </div>
  );
}

/* ── Helper ──────────────────────────────────────────────────────────────── */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
