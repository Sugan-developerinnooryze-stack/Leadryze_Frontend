import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BoltIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon,
  ArrowPathIcon, UserIcon, CalendarDaysIcon, EnvelopeIcon,
  ChatBubbleLeftRightIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

/* ── Types ─────────────────────────────────────────────────────────── */
type StepStatus = 'pending' | 'success' | 'failed' | 'skipped';
type RunStatus  = 'running' | 'completed' | 'partial' | 'failed';

interface MessageContent {
  subject?: string;
  body?:    string;
  text?:    string;
  to?:      string;
}

interface AutomationStep {
  name:            string;
  status:          StepStatus;
  result?:         string;
  error?:          string;
  executedAt?:     string;
  messageContent?: MessageContent;
}

interface AutomationRun {
  _id:           string;
  trigger:       string;
  triggerType:   string;
  customerName:  string;
  customerEmail?: string;
  customerPhone?: string;
  status:        RunStatus;
  steps:         AutomationStep[];
  createdAt:     string;
}

interface Stats { total: number; completed: number; partial: number; failed: number; running: number; }

/* ── Step metadata ──────────────────────────────────────────────────── */
const STEP_META = [
  { icon: UserIcon,             label: 'Find Customer'  },
  { icon: CalendarDaysIcon,     label: 'Create Meeting' },
  { icon: EnvelopeIcon,         label: 'Send Email'     },
  { icon: ChatBubbleLeftRightIcon, label: 'Send WhatsApp' },
];

/* ── Step dot ───────────────────────────────────────────────────────── */
function StepDot({ step, idx }: { step: AutomationStep; idx: number }) {
  const meta = STEP_META[idx];
  const Icon = meta?.icon ?? BoltIcon;

  const dotClass =
    step.status === 'success' ? 'bg-green-500 text-white border-green-500' :
    step.status === 'failed'  ? 'bg-red-500 text-white border-red-500' :
    step.status === 'skipped' ? 'bg-yellow-400 text-white border-yellow-400' :
    step.status === 'pending' ? 'bg-gray-200 text-gray-400 border-gray-200' :
    'bg-blue-500 text-white border-blue-500 animate-pulse';

  const tooltip =
    step.result  ? step.result :
    step.error   ? step.error  :
    step.status === 'pending' ? 'Pending' :
    step.status;

  return (
    <div className="flex flex-col items-center gap-1 group relative" style={{ minWidth: 56 }}>
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${dotClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-[9px] text-gray-500 text-center leading-tight whitespace-nowrap">
        {meta?.label ?? step.name}
      </span>
      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bottom-full mb-2 hidden group-hover:flex z-10 pointer-events-none">
          <div className="bg-gray-800 text-white text-[10px] rounded-lg px-2 py-1.5 max-w-[180px] text-center leading-snug shadow-xl">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Run card ───────────────────────────────────────────────────────── */
function RunCard({ run, onDelete }: { run: AutomationRun; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusCfg = {
    completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircleIcon },
    partial:   { label: 'Partial',   bg: 'bg-yellow-100', text: 'text-yellow-700', icon: ExclamationCircleIcon },
    failed:    { label: 'Failed',    bg: 'bg-red-100',    text: 'text-red-700',    icon: ExclamationCircleIcon },
    running:   { label: 'Running',   bg: 'bg-blue-100',   text: 'text-blue-700',   icon: ArrowPathIcon },
  }[run.status] ?? { label: run.status, bg: 'bg-gray-100', text: 'text-gray-600', icon: ClockIcon };

  const StatusIcon = statusCfg.icon;

  const timeAgo = (() => {
    const diff = Date.now() - new Date(run.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Color accent top bar */}
      <div className={`h-0.5 ${
        run.status === 'completed' ? 'bg-green-400' :
        run.status === 'partial'   ? 'bg-yellow-400' :
        run.status === 'failed'    ? 'bg-red-400' :
        'bg-blue-400'
      }`} />

      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Trigger message */}
            <p className="text-sm font-semibold text-gray-900 truncate" title={run.trigger}>
              "{run.trigger}"
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <UserIcon className="h-3 w-3" />
                {run.customerName}
              </span>
              {run.customerEmail && (
                <span className="text-xs text-gray-400 truncate max-w-[160px]">{run.customerEmail}</span>
              )}
              <span className="text-[10px] text-gray-400">{timeAgo}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
              <StatusIcon className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </span>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {expanded
                ? <ChevronUpIcon   className="h-4 w-4" />
                : <ChevronDownIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { if (confirm('Delete this automation run?')) onDelete(run._id); }}
              className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step pipeline */}
        <div className="flex items-start gap-0 mt-3 overflow-x-auto pb-1">
          {run.steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <StepDot step={step} idx={idx} />
              {idx < run.steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-0.5 shrink-0 rounded-full ${
                  run.steps[idx + 1]?.status === 'pending' ? 'bg-gray-200' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
            {run.steps.map((step, idx) => {
              const meta  = STEP_META[idx];
              const text  = step.result || step.error;
              const color =
                step.status === 'success' ? 'text-green-700' :
                step.status === 'failed'  ? 'text-red-600'   :
                step.status === 'skipped' ? 'text-yellow-600' :
                'text-gray-500';
              const mc = step.messageContent;
              const isEmail = !!(mc?.subject || mc?.body);
              const isSms   = !!(mc?.text) && !isEmail;
              return (
                <div key={idx}>
                  {/* Step status row */}
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-semibold w-24 shrink-0 ${color}`}>
                      {meta?.label ?? step.name}
                    </span>
                    <span className={`text-[10px] ${color}`}>{text ?? step.status}</span>
                  </div>

                  {/* Email inbox preview */}
                  {isEmail && mc && (
                    <div className="mt-1.5 ml-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden text-[11px]">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100">
                        <EnvelopeIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">{mc.subject ?? '(no subject)'}</span>
                        {mc.to && <span className="ml-auto text-gray-400 text-[10px] shrink-0">To: {mc.to}</span>}
                      </div>
                      {mc.body ? (
                        <div
                          className="px-3 py-2 text-gray-600 leading-relaxed overflow-x-auto max-h-32 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: mc.body }}
                        />
                      ) : null}
                    </div>
                  )}

                  {/* SMS inbox preview */}
                  {isSms && mc && (
                    <div className="mt-1.5 ml-24 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden text-[11px]">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100">
                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="font-semibold text-gray-700">SMS</span>
                        {mc.to && <span className="ml-auto text-gray-400 text-[10px] shrink-0">To: {mc.to}</span>}
                      </div>
                      <div className="px-3 py-2 text-gray-600 leading-relaxed">
                        <div className="inline-block bg-green-50 border border-green-100 rounded-xl rounded-tl-none px-3 py-2 max-w-full text-gray-700">
                          {mc.text}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
const STATUS_TABS: { key: RunStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'completed', label: 'Completed' },
  { key: 'partial',   label: 'Partial'   },
  { key: 'failed',    label: 'Failed'    },
  { key: 'running',   label: 'Running'   },
];

export default function AutomationPage() {
  const [tab,      setTab]      = useState<RunStatus | 'all'>('all');
  const [runs,     setRuns]     = useState<AutomationRun[]>([]);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LIMIT = 20;

  const fetchRuns = useCallback(async (pg: number, status: RunStatus | 'all') => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: pg, limit: LIMIT };
      if (status !== 'all') params.status = status;
      const res = await api.get('/api/v1/automation-runs', { params });
      setRuns(res.data.data?.items ?? []);
      setTotal(res.data.data?.total ?? 0);
      setStats(res.data.data?.stats ?? null);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchRuns(1, tab);
  }, [tab, fetchRuns]);

  // Auto-refresh every 8s when any run is "running"
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running');
    if (hasRunning) {
      intervalRef.current = setInterval(() => fetchRuns(page, tab), 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runs, page, tab, fetchRuns]);

  // Refresh when AI schedules/updates a meeting via chat
  useEffect(() => {
    const handler = () => fetchRuns(1, tab);
    window.addEventListener('leadryze:activity-updated', handler);
    return () => window.removeEventListener('leadryze:activity-updated', handler);
  }, [tab, fetchRuns]);

  async function handleDeleteRun(id: string) {
    try {
      await api.delete(`/api/v1/automation-runs/${id}`);
      fetchRuns(page, tab);
    } catch {}
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
            <BoltIcon className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Automation Flows</h1>
            <p className="text-xs text-gray-500">AI-triggered actions tracked step by step</p>
          </div>
        </div>
        <button
          onClick={() => fetchRuns(page, tab)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 px-6 py-3 bg-white border-b border-gray-100 shrink-0">
          {[
            { label: 'Total',     value: stats.total,     icon: BoltIcon,              color: 'text-brand-600',  bg: 'bg-brand-50'  },
            { label: 'Completed', value: stats.completed, icon: CheckCircleIcon,       color: 'text-green-600',  bg: 'bg-green-50'  },
            { label: 'Partial',   value: stats.partial,   icon: ExclamationCircleIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Failed',    value: stats.failed,    icon: ExclamationCircleIcon, color: 'text-red-600',    bg: 'bg-red-50'    },
            { label: 'Running',   value: stats.running,   icon: ArrowPathIcon,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
              <div>
                <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-6 py-2 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {STATUS_TABS.map(t => {
          const count = t.key === 'all' ? stats?.total : stats?.[t.key as keyof Stats];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Run list ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BoltIcon className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No automation flows yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Try saying <span className="font-semibold text-gray-600">"Schedule a meeting with [name] tomorrow 3pm"</span> in the chat
            </p>
          </div>
        )}

        {!loading && runs.map(run => <RunCard key={run._id} run={run} onDelete={handleDeleteRun} />)}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 bg-white border-t border-gray-100 shrink-0">
          <button
            disabled={page === 1}
            onClick={() => { const p = page - 1; setPage(p); fetchRuns(p, tab); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Prev</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => { const p = page + 1; setPage(p); fetchRuns(p, tab); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Next</button>
        </div>
      )}
    </div>
  );
}
