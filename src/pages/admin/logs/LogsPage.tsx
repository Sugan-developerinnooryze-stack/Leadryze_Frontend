import { useEffect, useState, Fragment } from 'react';
import {
  ArrowPathIcon, CpuChipIcon, ServerIcon, ClipboardDocumentCheckIcon,
  InformationCircleIcon, ExclamationTriangleIcon, XCircleIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { AdminCard, AdminEmptyState } from '../shared/AdminCard';
import type { AdminLog } from '../shared/adminTypes';

const LEVEL_CLS: Record<string, string> = {
  info:  'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  warn:  'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  error: 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20',
  debug: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border',
};
const LEVEL_ICON: Record<string, React.ElementType> = {
  info: InformationCircleIcon, warn: ExclamationTriangleIcon,
  error: XCircleIcon, debug: CheckCircleIcon,
};

export default function LogsPage() {
  const [logs, setLogs]       = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState<'all' | 'ai' | 'backend'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async (svc: 'all' | 'ai' | 'backend') => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (svc !== 'all') params.service = svc;
      const res = await api.get<{ data: { logs: AdminLog[] } }>('/api/v1/admin/logs', { params });
      setLogs(res.data.data.logs ?? []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(service); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Logs</h1>
          <p className="text-sm text-text-muted mt-0.5">Live AI agent and backend activity, across every tenant.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/[0.04] dark:bg-white/[0.06] rounded-xl p-1 gap-1">
            {(['all', 'ai', 'backend'] as const).map((svc) => (
              <button key={svc} onClick={() => { setService(svc); fetchLogs(svc); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  service === svc ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}>
                {svc === 'ai'      && <CpuChipIcon className="h-3.5 w-3.5 text-purple-500" />}
                {svc === 'backend' && <ServerIcon   className="h-3.5 w-3.5 text-blue-500" />}
                {svc === 'ai' ? 'AI Agent' : svc === 'backend' ? 'Backend' : 'All Logs'}
              </button>
            ))}
          </div>
          <button onClick={() => fetchLogs(service)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-surface border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-primary transition">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <AdminCard>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : logs.length === 0 ? (
          <AdminEmptyState icon={ClipboardDocumentCheckIcon} title="No logs yet" description="Logs appear as AI agents and backends process requests." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border text-text-muted text-xs uppercase tracking-wider">
                {['Time', 'Tenant', 'Service', 'Level', 'Event', 'Message'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const LvlIcon = LEVEL_ICON[log.level] ?? InformationCircleIcon;
                const isEx = expanded === log._id;
                return (
                  <Fragment key={log._id}>
                    <tr onClick={() => setExpanded(isEx ? null : log._id)} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-primary">{log.tenantId?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.service === 'ai' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        }`}>
                          {log.service === 'ai' ? <CpuChipIcon className="h-3 w-3" /> : <ServerIcon className="h-3 w-3" />}
                          {log.service === 'ai' ? 'AI' : 'Backend'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${LEVEL_CLS[log.level] ?? LEVEL_CLS.info}`}>
                          <LvlIcon className="h-3 w-3" />
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-primary font-medium">{log.event}</td>
                      <td className="px-4 py-3 text-xs text-text-muted truncate max-w-xs">{log.message}</td>
                    </tr>
                    {isEx && (
                      <tr className="bg-black/[0.015] dark:bg-white/[0.02]">
                        <td colSpan={6} className="px-6 py-4">
                          <pre className="text-xs text-text-muted bg-surface border border-border rounded-lg p-3 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminCard>
    </div>
  );
}
