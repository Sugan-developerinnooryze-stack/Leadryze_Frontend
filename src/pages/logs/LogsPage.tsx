import { useState, useEffect, useCallback } from 'react';
import {
  CpuChipIcon,
  ServerIcon,
  ArrowPathIcon,
  FunnelIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface LogEntry {
  _id: string;
  service: 'ai' | 'backend';
  level: 'info' | 'warn' | 'error' | 'debug';
  event: string;
  message: string;
  metadata: Record<string, unknown>;
  sessionId?: string;
  createdAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

/* ── Event → visual config ─────────────────────────────────────────────────── */
type ActionKind = 'create' | 'update' | 'delete' | 'sync' | 'sync_error' | 'ai' | 'guardrail' | 'warn';

function getActionKind(event: string): ActionKind {
  if (event.endsWith('.created') || event.endsWith('_create') || event.endsWith('.added'))  return 'create';
  if (event.endsWith('.deleted') || event.endsWith('_delete') || event.endsWith('.removed')) return 'delete';
  if (event.includes('sync_failed') || event.includes('.error'))                              return 'sync_error';
  if (event.includes('.sync') || event.includes('sync.'))                                     return 'sync';
  if (event.startsWith('guardrail.'))                                                         return 'guardrail';
  if (event.startsWith('agent.escalation'))                                                   return 'warn';
  if (event.startsWith('agent.') || event.startsWith('ai.'))                                 return 'ai';
  if (event.endsWith('.updated') || event.endsWith('_update') || event.includes('.record.updated')) return 'update';
  return 'update';
}

const ACTION_CONFIG: Record<ActionKind, {
  label: string;
  icon: React.ElementType;
  badge: string;
  row: string;
  dot: string;
}> = {
  create:     { label: 'Created',    icon: PlusCircleIcon,        badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',  row: 'hover:bg-emerald-50/60',  dot: 'bg-emerald-500' },
  update:     { label: 'Updated',    icon: PencilSquareIcon,      badge: 'bg-blue-100 text-blue-700 border-blue-300',           row: 'hover:bg-blue-50/60',     dot: 'bg-blue-500' },
  delete:     { label: 'Deleted',    icon: TrashIcon,             badge: 'bg-red-100 text-red-700 border-red-300',              row: 'hover:bg-red-50/60',      dot: 'bg-red-500' },
  sync:       { label: 'Sync',       icon: ArrowsRightLeftIcon,   badge: 'bg-violet-100 text-violet-700 border-violet-300',     row: 'hover:bg-violet-50/60',   dot: 'bg-violet-500' },
  sync_error: { label: 'Sync Error', icon: XCircleIcon,           badge: 'bg-red-100 text-red-700 border-red-300',              row: 'hover:bg-red-50/60',      dot: 'bg-red-500' },
  ai:         { label: 'AI',         icon: ChatBubbleLeftRightIcon,badge: 'bg-purple-100 text-purple-700 border-purple-300',    row: 'hover:bg-purple-50/60',   dot: 'bg-purple-500' },
  guardrail:  { label: 'Guardrail',  icon: ShieldExclamationIcon, badge: 'bg-amber-100 text-amber-700 border-amber-300',        row: 'hover:bg-amber-50/60',    dot: 'bg-amber-500' },
  warn:       { label: 'Warning',    icon: ExclamationTriangleIcon,badge: 'bg-orange-100 text-orange-700 border-orange-300',   row: 'hover:bg-orange-50/60',   dot: 'bg-orange-500' },
};

const EVENT_LABEL: Record<string, string> = {
  'agent.response':               'AI Response',
  'agent.escalation':             'Escalation',
  'guardrail.prompt_injection':   'Prompt Injection',
  'guardrail.content_moderation': 'Content Flagged',
  'connector.created':            'Connector Added',
  'connector.updated':            'Connector Updated',
  'connector.deleted':            'Connector Removed',
  'connector.sync':               'CRM Sync',
  'connector.sync_failed':        'Sync Failed',
  'crm.record.created':           'Records Added',
  'crm.record.updated':           'Record Changed',
  'customer.created':             'Customer Created',
  'customer.updated':             'Customer Updated',
  'customer.deleted':             'Customer Deleted',
  'customer.synced_create':       'Customer Imported',
  'customer.synced_update':       'Customer Changed',
  'campaign.created':             'Campaign Created',
  'campaign.updated':             'Campaign Updated',
  'campaign.deleted':             'Campaign Deleted',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

/* ── Legend pills ────────────────────────────────────────────────────────────── */
function Legend() {
  const items: Array<{ kind: ActionKind; label: string }> = [
    { kind: 'create',    label: 'Created'   },
    { kind: 'update',    label: 'Updated'   },
    { kind: 'delete',    label: 'Deleted'   },
    { kind: 'sync',      label: 'Sync'      },
    { kind: 'ai',        label: 'AI'        },
    { kind: 'guardrail', label: 'Guardrail' },
    { kind: 'warn',      label: 'Warning'   },
    { kind: 'sync_error',label: 'Error'     },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map(({ kind, label }) => {
        const cfg = ACTION_CONFIG[kind];
        return (
          <span key={kind} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<'ai' | 'backend' | 'all'>('all');
  const [level, setLevel]         = useState('');
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: LIMIT, offset: page * LIMIT };
      if (activeTab !== 'all') params.service = activeTab;
      if (level) params.level = level;
      const res = await api.get<{ data: LogsResponse }>('/api/v1/logs', { params });
      setLogs(res.data.data.logs);
      setTotal(res.data.data.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, level, page]);

  useEffect(() => { setPage(0); }, [activeTab, level]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every CRM change, sync, and AI event — with full detail
          </p>
        </div>
        <button onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Legend */}
      <Legend />

      {/* Tabs + Level filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['all', 'ai', 'backend'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'ai'      && <CpuChipIcon className="h-4 w-4 text-purple-500" />}
              {tab === 'backend' && <ServerIcon   className="h-4 w-4 text-blue-500"   />}
              {tab === 'all'     && <FunnelIcon   className="h-4 w-4 text-gray-400"   />}
              {tab === 'ai' ? 'AI Agent' : tab === 'backend' ? 'Backend' : 'All Logs'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{total > 0 ? `${total} entries` : 'No logs'}</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ServerIcon className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No logs yet</p>
            <p className="text-xs mt-1">Logs appear here as events happen</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-36">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-20">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide w-32">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const kind   = getActionKind(log.event);
                const cfg    = ACTION_CONFIG[kind];
                const Icon   = cfg.icon;
                const isEx   = expanded === log._id;
                const hasMetadata = Object.keys(log.metadata || {}).length > 0;

                return (
                  <>
                    <tr
                      key={log._id}
                      onClick={() => hasMetadata && setExpanded(isEx ? null : log._id)}
                      className={`transition-colors ${cfg.row} ${hasMetadata ? 'cursor-pointer' : ''}`}
                    >
                      {/* Time */}
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap font-mono">
                        {formatTime(log.createdAt)}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.service === 'ai'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.service === 'ai'
                            ? <CpuChipIcon className="h-3 w-3" />
                            : <ServerIcon  className="h-3 w-3" />}
                          {log.service === 'ai' ? 'AI' : 'Backend'}
                        </span>
                      </td>

                      {/* Action badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {EVENT_LABEL[log.event] ?? cfg.label}
                        </span>
                      </td>

                      {/* Message */}
                      <td className="px-4 py-3 text-gray-700 text-sm max-w-xl">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className={`leading-snug ${isEx ? '' : 'line-clamp-1'}`}>
                            {log.message}
                          </span>
                          {hasMetadata && !isEx && (
                            <span className="ml-auto shrink-0 text-xs text-gray-400 hover:text-gray-600">
                              ▼ details
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isEx && (
                      <tr key={`${log._id}-detail`} className="bg-gray-50 border-b border-gray-200">
                        <td colSpan={4} className="px-6 py-4">
                          <div className="space-y-3 text-xs">
                            {log.sessionId && (
                              <div className="flex gap-2">
                                <span className="font-medium text-gray-500 w-20 shrink-0">Session</span>
                                <span className="font-mono text-gray-700">{log.sessionId}</span>
                              </div>
                            )}
                            {/* Render changedFields specially if present */}
                            {Array.isArray((log.metadata as Record<string, unknown>)?.changedFields) && (
                              <div>
                                <span className="font-semibold text-gray-600 block mb-2">Changed Fields</span>
                                <div className="flex flex-col gap-1.5">
                                  {((log.metadata as Record<string, unknown>).changedFields as Array<{ field: string; from: unknown; to: unknown }>).map((cf, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <span className="font-mono font-semibold text-gray-700 w-32 shrink-0">{cf.field}</span>
                                      <span className="text-red-600 line-through max-w-xs truncate">{String(cf.from ?? '—')}</span>
                                      <span className="text-gray-400 shrink-0">→</span>
                                      <span className="text-emerald-700 font-medium max-w-xs truncate">{String(cf.to ?? '—')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* All metadata as JSON (except changedFields already rendered) */}
                            {Object.keys(log.metadata || {}).filter(k => k !== 'changedFields').length > 0 && (
                              <div>
                                <span className="font-semibold text-gray-600 block mb-1">Metadata</span>
                                <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-600 leading-relaxed">
                                  {JSON.stringify(
                                    Object.fromEntries(
                                      Object.entries(log.metadata || {}).filter(([k]) => k !== 'changedFields')
                                    ),
                                    null, 2
                                  )}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
