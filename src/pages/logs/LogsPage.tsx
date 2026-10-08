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
  create:     { label: 'Created',    icon: PlusCircleIcon,        badge: 'bg-success-500/15 text-success-700 dark:text-success-500 border-success-500/30',  row: 'hover:bg-success-500/10',  dot: 'bg-emerald-500' },
  update:     { label: 'Updated',    icon: PencilSquareIcon,      badge: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/40',           row: 'hover:bg-blue-50/60 dark:hover:bg-blue-500/10',     dot: 'bg-blue-500' },
  delete:     { label: 'Deleted',    icon: TrashIcon,             badge: 'bg-danger-500/15 text-danger-700 dark:text-danger-500 border-danger-500/30',              row: 'hover:bg-danger-500/10',      dot: 'bg-red-500' },
  sync:       { label: 'Sync',       icon: ArrowsRightLeftIcon,   badge: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/40',     row: 'hover:bg-violet-50/60 dark:hover:bg-violet-500/10',   dot: 'bg-violet-500' },
  sync_error: { label: 'Sync Error', icon: XCircleIcon,           badge: 'bg-danger-500/15 text-danger-700 dark:text-danger-500 border-danger-500/30',              row: 'hover:bg-danger-500/10',      dot: 'bg-red-500' },
  ai:         { label: 'AI',         icon: ChatBubbleLeftRightIcon,badge: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/40',    row: 'hover:bg-purple-50/60 dark:hover:bg-purple-500/10',   dot: 'bg-purple-500' },
  guardrail:  { label: 'Guardrail',  icon: ShieldExclamationIcon, badge: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40',        row: 'hover:bg-amber-50/60 dark:hover:bg-amber-500/10',    dot: 'bg-amber-500' },
  warn:       { label: 'Warning',    icon: ExclamationTriangleIcon,badge: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40',   row: 'hover:bg-orange-50/60 dark:hover:bg-orange-500/10',   dot: 'bg-orange-500' },
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
          <h1 className="text-2xl font-bold text-text-primary">Activity Logs</h1>
          <p className="text-sm text-text-muted mt-0.5">
            AI agent activity and CRM sync events — with full detail. For CRM record changes (Create/Update/Delete), see Native Logs.
          </p>
        </div>
        <button onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border border-border rounded-lg hover:bg-background transition">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Legend */}
      <Legend />

      {/* Tabs + Level filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-black/[0.04] dark:bg-white/[0.06] rounded-xl p-1 gap-1">
          {(['all', 'ai', 'backend'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-surface shadow text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}>
              {tab === 'ai'      && <CpuChipIcon className="h-4 w-4 text-purple-500" />}
              {tab === 'backend' && <ServerIcon   className="h-4 w-4 text-blue-500"   />}
              {tab === 'all'     && <FunnelIcon   className="h-4 w-4 text-text-muted"   />}
              {tab === 'ai' ? 'AI Agent' : tab === 'backend' ? 'Backend' : 'All Logs'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">{total > 0 ? `${total} entries` : 'No logs'}</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <ServerIcon className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No logs yet</p>
            <p className="text-xs mt-1">Logs appear here as events happen</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-text-muted text-xs uppercase tracking-wide w-36">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-text-muted text-xs uppercase tracking-wide w-20">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-text-muted text-xs uppercase tracking-wide w-32">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-text-muted text-xs uppercase tracking-wide">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap font-mono">
                        {formatTime(log.createdAt)}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.service === 'ai'
                            ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400'
                            : 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted'
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
                      <td className="px-4 py-3 text-text-primary text-sm max-w-xl">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className={`leading-snug ${isEx ? '' : 'line-clamp-1'}`}>
                            {log.message}
                          </span>
                          {hasMetadata && !isEx && (
                            <span className="ml-auto shrink-0 text-xs text-text-muted hover:text-text-primary">
                              ▼ details
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isEx && (
                      <tr key={`${log._id}-detail`} className="bg-background border-b border-border">
                        <td colSpan={4} className="px-6 py-4">
                          <div className="space-y-3 text-xs">
                            {log.sessionId && (
                              <div className="flex gap-2">
                                <span className="font-medium text-text-muted w-20 shrink-0">Session</span>
                                <span className="font-mono text-text-primary">{log.sessionId}</span>
                              </div>
                            )}
                            {/* Render changedFields specially if present */}
                            {Array.isArray((log.metadata as Record<string, unknown>)?.changedFields) && (
                              <div>
                                <span className="font-semibold text-text-muted block mb-2">Changed Fields</span>
                                <div className="flex flex-col gap-1.5">
                                  {((log.metadata as Record<string, unknown>).changedFields as Array<{ field: string; from: unknown; to: unknown }>).map((cf, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                                      <span className="font-mono font-semibold text-text-primary w-32 shrink-0">{cf.field}</span>
                                      <span className="text-red-600 line-through max-w-xs truncate">{String(cf.from ?? '—')}</span>
                                      <span className="text-text-muted shrink-0">→</span>
                                      <span className="text-emerald-700 font-medium max-w-xs truncate">{String(cf.to ?? '—')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* All metadata as JSON (except changedFields already rendered) */}
                            {Object.keys(log.metadata || {}).filter(k => k !== 'changedFields').length > 0 && (
                              <div>
                                <span className="font-semibold text-text-muted block mb-1">Metadata</span>
                                <pre className="bg-surface border border-border rounded-lg p-3 overflow-x-auto text-text-muted leading-relaxed">
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
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 border border-border rounded-lg hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-border rounded-lg hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
