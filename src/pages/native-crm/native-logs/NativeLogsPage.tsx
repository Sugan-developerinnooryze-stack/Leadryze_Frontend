import { useState, Fragment } from 'react';
import {
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useNativeLogsQuery, type NativeCrmLogEntry } from '../../../modules/native-crm/queries/native-logs.queries';
import { useQueryClient } from '@tanstack/react-query';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const ACTION_LABELS: Record<string, string> = {
  create:     'Create',
  update:     'Update',
  delete:     'Delete',
  error:      'Error',
  permission: 'Permission',
};

const ACTION_BADGE: Record<string, string> = {
  create:     'bg-emerald-100 text-emerald-700',
  update:     'bg-blue-100 text-blue-700',
  delete:     'bg-red-100 text-red-700',
  error:      'bg-rose-100 text-rose-800',
  permission: 'bg-purple-100 text-purple-700',
};

const MODULES = [
  'contacts','companies','deals','tasks','tickets','calls','meetings',
  'customers','leads','workorders','quotations','contracts','invoices','receipts',
  'expenses','parts','services','categories','teams','staffs','sites',
  'products','assets','vehicles','branches','activities',
];

function toTitle(s: string) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

/** Keys where before[k] !== after[k] */
function changedKeys(before: Record<string,any> | null, after: Record<string,any> | null): string[] {
  const b = before ?? {};
  const a = after  ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const SKIP = new Set(['_id','__v','tenantId','createdAt','updatedAt']);
  return [...keys].filter((k) => !SKIP.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Diff of granted/revoked permission keys between before/after snapshots */
function permissionDiff(log: NativeCrmLogEntry) {
  const roleName = (log.after as any)?.roleName ?? (log.before as any)?.roleName ?? 'Role';
  const before: string[] = (log.before as any)?.permissions ?? [];
  const after:  string[] = (log.after  as any)?.permissions ?? [];
  const beforeSet = new Set(before);
  const afterSet  = new Set(after);
  const granted = after.filter((k) => !beforeSet.has(k));
  const revoked = before.filter((k) => !afterSet.has(k));
  return { roleName, granted, revoked, total: after.length };
}

/* ── Summary text ─────────────────────────────────────────────────────────── */
function summary(log: NativeCrmLogEntry): string {
  if (log.action === 'create') return 'New record created';
  if (log.action === 'delete') return 'Record deleted';
  if (log.action === 'error')  return (log.error ?? `HTTP ${log.statusCode}`).slice(0, 70);
  if (log.action === 'permission') {
    const { roleName, granted, revoked, total } = permissionDiff(log);
    const parts = [];
    if (granted.length) parts.push(`+${granted.length} granted`);
    if (revoked.length) parts.push(`-${revoked.length} revoked`);
    return `${roleName}: ${parts.length ? parts.join(', ') : `${total} permission(s) set`}`;
  }
  const changed = changedKeys(log.before, log.after);
  return changed.length ? `${changed.length} field${changed.length > 1 ? 's' : ''} changed` : 'Record updated';
}

/* ── Detail panel ─────────────────────────────────────────────────────────── */
function DetailPanel({ log }: { log: NativeCrmLogEntry }) {
  /* PERMISSION */
  if (log.action === 'permission') {
    const { roleName, granted, revoked, total } = permissionDiff(log);
    return (
      <div className="border border-purple-200 rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-200 flex items-center gap-2">
          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Permissions Updated</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800">{roleName}</span>
          <span className="ml-auto text-xs text-gray-400">{total} total permission{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">
              Granted ({granted.length})
            </p>
            {granted.length === 0 ? (
              <p className="text-xs text-gray-400">No new permissions granted</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {granted.map((k) => (
                  <span key={k} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1.5">
              Revoked ({revoked.length})
            </p>
            {revoked.length === 0 ? (
              <p className="text-xs text-gray-400">No permissions revoked</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {revoked.map((k) => (
                  <span key={k} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 line-through">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ERROR */
  if (log.action === 'error') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Error</span>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-rose-200 text-rose-800">HTTP {log.statusCode}</span>
        </div>
        <p className="text-sm text-rose-800 font-medium">{log.error}</p>
        <p className="text-xs text-rose-500 mt-1 font-mono">{log.url}</p>
      </div>
    );
  }

  /* DELETE */
  if (log.action === 'delete') {
    const fields = log.before ?? {};
    const SKIP = new Set(['_id','__v','tenantId']);
    const keys = Object.keys(fields).filter((k) => !SKIP.has(k));
    return (
      <div className="border border-red-200 rounded-lg overflow-hidden">
        <div className="bg-red-50 px-4 py-2 border-b border-red-200">
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Deleted Record</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2">
          {keys.map((k) => (
            <div key={k}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{toTitle(k)}</p>
              <p className="text-xs text-gray-700 mt-0.5">{renderValue(fields[k])}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* CREATE */
  if (log.action === 'create') {
    const fields = log.after ?? {};
    const SKIP = new Set(['_id','__v','tenantId']);
    const keys = Object.keys(fields).filter((k) => !SKIP.has(k));
    return (
      <div className="border border-emerald-200 rounded-lg overflow-hidden">
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Created Record</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2">
          {keys.map((k) => (
            <div key={k}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{toTitle(k)}</p>
              <p className="text-xs text-emerald-800 mt-0.5">{renderValue(fields[k])}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* UPDATE */
  const changed = changedKeys(log.before, log.after);
  if (!changed.length) {
    return <p className="text-xs text-gray-400 px-2 py-3">No field differences detected.</p>;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-4">
        <span className="text-xs font-semibold text-red-600">Before</span>
        <span className="text-gray-300">→</span>
        <span className="text-xs font-semibold text-emerald-600">After</span>
        <span className="ml-auto text-xs text-gray-400">{changed.length} field{changed.length > 1 ? 's' : ''} changed</span>
      </div>
      <div className="divide-y divide-gray-100">
        {changed.map((k) => (
          <div key={k} className="px-4 py-2 grid grid-cols-3 gap-4 items-start">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide pt-0.5">{toTitle(k)}</p>
            <div className="bg-red-50 rounded px-2 py-1">
              <p className="text-xs text-red-700 line-through">{renderValue((log.before ?? {})[k])}</p>
            </div>
            <div className="bg-emerald-50 rounded px-2 py-1">
              <p className="text-xs text-emerald-700 font-medium">{renderValue((log.after ?? {})[k])}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function NativeLogsPage() {
  const qc = useQueryClient();

  const [page,       setPage]       = useState(1);
  const [actionTab,  setActionTab]  = useState('');
  const [module,     setModule]     = useState('');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [search,     setSearch]     = useState('');
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const params = {
    page,
    limit: 20,
    ...(actionTab  ? { action: actionTab }   : {}),
    ...(module     ? { module }              : {}),
    ...(startDate  ? { startDate }           : {}),
    ...(endDate    ? { endDate }             : {}),
    ...(search     ? { search }              : {}),
  };

  const { data, isLoading, isFetching } = useNativeLogsQuery(params);
  const items = data?.items ?? [];
  const meta  = data?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const resetFilters = () => {
    setPage(1);
    setActionTab('');
    setModule('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  const handleTab = (t: string) => { setActionTab(t); setPage(1); };

  const ACTION_TABS = ['', 'create', 'update', 'delete', 'permission', 'error'] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-gray-100 shrink-0">
            <ClipboardDocumentListIcon className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Native Logs</h1>
            <p className="text-xs text-gray-500">{meta.total} total entries</p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['native-crm', 'native-logs'] })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0 space-y-2">
        {/* Action tabs */}
        <div className="flex items-center gap-1">
          {ACTION_TABS.map((t) => (
            <button
              key={t}
              onClick={() => handleTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                actionTab === t
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t ? ACTION_LABELS[t] : 'All'}
            </button>
          ))}
        </div>

        {/* Row 2: module + date + search */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Module picker */}
          <select
            value={module}
            onChange={(e) => { setModule(e.target.value); setPage(1); }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
          >
            <option value="">All Modules</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>{toTitle(m)}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
          />

          {/* Actor search */}
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search actor…"
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
          />

          {(module || startDate || endDate || search) && (
            <button onClick={resetFilters} className="text-xs text-brand-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex gap-2">
              {[0,1,2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <ClipboardDocumentListIcon className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No activity logged yet.</p>
            <p className="text-xs mt-1">Logs will appear here after any Create, Update, or Delete operation.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {items.map((log, idx) => {
                const isOpen = expanded === log._id;
                return (
                  <Fragment key={log._id}>
                    <tr
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : log._id)}
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                        {(page - 1) * 20 + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-gray-800">{log.actorName || log.actorId}</p>
                        {log.actorRole && (
                          <span className="text-[10px] text-gray-400 capitalize">{log.actorRole.toLowerCase()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 capitalize">{log.module}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 max-w-[120px] truncate">
                        {log.resourceId || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px] truncate">
                        {summary(log)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen
                          ? <ChevronDownIcon  className="h-4 w-4" />
                          : <ChevronRightIcon className="h-4 w-4" />}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-4">
                          <DetailPanel log={log} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white shrink-0">
          <p className="text-xs text-gray-500">
            Page <span className="font-medium text-gray-700">{meta.page}</span> of{' '}
            <span className="font-medium text-gray-700">{meta.totalPages}</span> &middot;{' '}
            <span className="font-medium text-gray-700">{meta.total}</span> total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
