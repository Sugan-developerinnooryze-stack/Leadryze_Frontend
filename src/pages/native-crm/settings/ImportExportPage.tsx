import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowsRightLeftIcon, ArrowUpTrayIcon, DocumentArrowDownIcon,
  CheckCircleIcon, ExclamationTriangleIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  useImportLeadsCsv, useLeadImportTriageQuery, useResolveTriageItem, ImportSummary,
} from '../../../modules/native-crm/queries/lead-import.queries';
import { useImportDealsCsv, DealImportSummary } from '../../../modules/native-crm/queries/deal-import.queries';

const LEAD_IMPORT_COLUMNS = [
  'firstName', 'lastName', 'email', 'phone', 'mobile', 'company', 'designation',
  'source', 'status', 'city', 'state', 'country', 'leadOwner', 'expectedRevenue', 'tags',
];
const DEAL_IMPORT_COLUMNS = [
  'title', 'amount', 'currency', 'stage', 'closeDate', 'contactName', 'companyName', 'notes', 'tags',
];

function downloadTemplate(columns: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([columns]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, filename);
}

function RejectedRows({ rejected, labelOf }: { rejected: ImportSummary['rejected']; labelOf: (data: Record<string, any>) => string }) {
  const [show, setShow] = useState(false);
  if (rejected.length === 0) return null;
  return (
    <div>
      <button onClick={() => setShow((v) => !v)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
        {show ? 'Hide' : 'Show'} rejected rows
      </button>
      {show && (
        <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
          {rejected.map((r) => (
            <div key={r.row} className="text-xs bg-red-50 rounded-lg px-3 py-2">
              <span className="font-semibold text-red-700">Row {r.row}</span>
              <span className="text-gray-600"> — {labelOf(r.data)}: </span>
              <span className="text-red-600">{r.errors.join('; ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Leads ──────────────────────────────────────────────────────────────────── */
function LeadSummaryCard({ summary }: { summary: ImportSummary }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">Import complete — batch {summary.batchId.slice(-8)}</p>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="bg-emerald-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{summary.created}</p>
          <p className="text-[11px] text-emerald-700">Created</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-gray-700 tabular-nums">{summary.duplicates}</p>
          <p className="text-[11px] text-gray-500">Duplicates skipped</p>
        </div>
        <div className="bg-amber-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-amber-700 tabular-nums">{summary.triage}</p>
          <p className="text-[11px] text-amber-700">Sent to triage</p>
        </div>
        <div className="bg-red-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-red-700 tabular-nums">{summary.rejected.length}</p>
          <p className="text-[11px] text-red-700">Rejected</p>
        </div>
      </div>
      <RejectedRows rejected={summary.rejected} labelOf={(d) => d.firstName || d.email || '(no name)'} />
    </div>
  );
}

function TriageQueue() {
  const { data: items = [], isLoading } = useLeadImportTriageQuery();
  const resolveMut = useResolveTriageItem();

  if (isLoading) return null;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
        <UserGroupIcon className="h-7 w-7 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No leads waiting for review.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {items.map((item) => {
        const row = item.rawRow;
        return (
          <div key={item._id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {[row.firstName, row.lastName].filter(Boolean).join(' ')} {row.company ? `· ${row.company}` : ''}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {row.email || row.phone} — matches {item.matchedLeadIds.length} existing lead(s) at this email domain
              </p>
            </div>
            <button
              onClick={() => resolveMut.mutate({ id: item._id, action: 'skip' })}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0"
            >
              Skip
            </button>
            <button
              onClick={() => resolveMut.mutate({ id: item._id, action: 'create' })}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shrink-0"
            >
              Create as new lead
            </button>
          </div>
        );
      })}
    </div>
  );
}

function LeadImportSection() {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const importMut = useImportLeadsCsv();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      setRows(data);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows?.length) return;
    const result = await importMut.mutateAsync(rows);
    setSummary(result);
    setRows(null);
    setFileName('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">1. Upload a file</p>
          <button onClick={() => downloadTemplate(LEAD_IMPORT_COLUMNS, 'leads_import_template.xlsx')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
            <DocumentArrowDownIcon className="h-4 w-4" /> Download template
          </button>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
        />
        {rows && (
          <div className="mt-3 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
            <span className="text-xs text-gray-600 flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" /> {fileName} — {rows.length} row(s) parsed
            </span>
            <button
              onClick={handleImport}
              disabled={importMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {importMut.isPending ? 'Importing…' : `Import ${rows.length} lead(s)`}
            </button>
          </div>
        )}
        {importMut.isError && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4" /> Import failed — please try again.
          </p>
        )}
      </div>

      {summary && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-3">2. Result</p>
          <LeadSummaryCard summary={summary} />
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">Admin triage queue</p>
        <TriageQueue />
      </div>
    </div>
  );
}

/* ── Deals ──────────────────────────────────────────────────────────────────── */
function DealSummaryCard({ summary }: { summary: DealImportSummary }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">Import complete — batch {summary.batchId.slice(-8)}</p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-emerald-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{summary.created}</p>
          <p className="text-[11px] text-emerald-700">Created</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-gray-700 tabular-nums">{summary.duplicates}</p>
          <p className="text-[11px] text-gray-500">Duplicates skipped</p>
        </div>
        <div className="bg-red-50 rounded-lg px-3 py-2.5">
          <p className="text-lg font-bold text-red-700 tabular-nums">{summary.rejected.length}</p>
          <p className="text-[11px] text-red-700">Rejected</p>
        </div>
      </div>
      <RejectedRows rejected={summary.rejected} labelOf={(d) => d.title || '(no title)'} />
    </div>
  );
}

function DealImportSection() {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState<DealImportSummary | null>(null);
  const importMut = useImportDealsCsv();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      setRows(data);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows?.length) return;
    const result = await importMut.mutateAsync(rows);
    setSummary(result);
    setRows(null);
    setFileName('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">1. Upload a file</p>
          <button onClick={() => downloadTemplate(DEAL_IMPORT_COLUMNS, 'deals_import_template.xlsx')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
            <DocumentArrowDownIcon className="h-4 w-4" /> Download template
          </button>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
        />
        {rows && (
          <div className="mt-3 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
            <span className="text-xs text-gray-600 flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" /> {fileName} — {rows.length} row(s) parsed
            </span>
            <button
              onClick={handleImport}
              disabled={importMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {importMut.isPending ? 'Importing…' : `Import ${rows.length} deal(s)`}
            </button>
          </div>
        )}
        {importMut.isError && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4" /> Import failed — please try again.
          </p>
        )}
      </div>

      {summary && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-3">2. Result</p>
          <DealSummaryCard summary={summary} />
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
type Tab = 'leads' | 'deals';

export default function ImportExportPage() {
  const [tab, setTab] = useState<Tab>('leads');

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
          <ArrowsRightLeftIcon className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Import Leads &amp; Deals</h1>
          <p className="text-xs text-gray-500">Validated CSV import — exact duplicates are skipped automatically{tab === 'leads' ? ', ambiguous matches wait for your review below' : ''}</p>
        </div>
      </div>

      <div className="px-6 pt-4 shrink-0">
        <div className="flex gap-1 border-b border-gray-200 max-w-3xl mx-auto">
          {(['leads', 'deals'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === 'leads' ? <LeadImportSection /> : <DealImportSection />}
      </div>
    </div>
  );
}
