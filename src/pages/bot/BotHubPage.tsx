import { useState, useEffect, useCallback } from 'react';
import {
  ChatBubbleLeftRightIcon,
  BoltIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

/* ── Types ─────────────────────────────────────────────────────── */
interface Stats {
  totalSessions: number;
  recentSessions: number;
  crmQueries: number;
  leadsCapture: number;
  escalations: number;
  knowledgeQueries: number;
  byType: Record<string, number>;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'staff' | 'system';
  content: string;
  timestamp: string;
  metadata?: { escalated?: boolean; staffName?: string };
}

interface Session {
  _id: string;
  sessionId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  channel: string;
  escalated: boolean;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AIAction {
  _id: string;
  sessionId: string;
  actionType: string;
  summary: string;
  userMessage: string;
  metadata?: {
    channel?: string;
    module?: string;
    recordCount?: number;
    filteredCount?: number;
    filterExpression?: string;
    leadName?: string;
    leadEmail?: string;
    leadPhone?: string;
  };
  createdAt: string;
}

interface Lead {
  _id: string;
  sessionId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  channel: string;
  escalated: boolean;
  createdAt: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */
const ACTION_META: Record<string, { label: string; color: string; icon: typeof BoltIcon }> = {
  crm_query:       { label: 'CRM Query',     color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',       icon: CircleStackIcon },
  crm_filter:      { label: 'CRM Filter',    color: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', icon: FunnelIcon },
  crm_search:      { label: 'CRM Search',    color: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',        icon: MagnifyingGlassIcon },
  lead_capture:    { label: 'Lead Captured', color: 'bg-success-500/15 text-success-700 dark:text-success-500',                icon: UserPlusIcon },
  knowledge_query: { label: 'Knowledge',     color: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400', icon: BoltIcon },
  escalation:      { label: 'Escalated',     color: 'bg-danger-500/15 text-danger-700 dark:text-danger-500',                   icon: ExclamationTriangleIcon },
  email_sent:      { label: 'Email Sent',    color: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400', icon: EnvelopeIcon },
  general:         { label: 'General',       color: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',    icon: ChatBubbleLeftRightIcon },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Stat Card ───────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Sessions Tab ────────────────────────────────────────────────── */
function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/v1/bot/chat-history', { params: { page, limit: 20 } });
      setSessions(r.data.data.sessions || []);
      setTotal(r.data.data.total || 0);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-text-muted animate-spin" /></div>;

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">{total} total sessions</p>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s._id} className="card overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-background transition-colors"
              onClick={() => setExpanded(expanded === s.sessionId ? null : s.sessionId)}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${s.escalated ? 'bg-red-100' : 'bg-ryze-600/15'}`}>
                {s.escalated
                  ? <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  : <ChatBubbleLeftRightIcon className="h-4 w-4 text-ryze-600 dark:text-ryze-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {s.visitorName || s.visitorEmail || `Session ${s.sessionId.slice(-8)}`}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {s.messages.length} messages · {timeSince(s.updatedAt)}
                  {s.visitorEmail && <span className="ml-2 text-ryze-500">{s.visitorEmail}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.escalated && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Escalated</span>
                )}
                {expanded === s.sessionId
                  ? <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                  : <ChevronRightIcon className="h-4 w-4 text-text-muted" />}
              </div>
            </button>

            {expanded === s.sessionId && (
              <div className="border-t border-border bg-background p-4 space-y-3 max-h-96 overflow-y-auto">
                {s.messages.map((msg, i) => (
                  msg.role === 'system' ? (
                    <div key={i} className="flex justify-center">
                      <span className="text-[11px] text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{msg.content}</span>
                    </div>
                  ) : (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-ryze-600 text-white rounded-tr-sm'
                        : msg.role === 'staff'
                          ? 'bg-emerald-600/10 border border-emerald-600/20 text-text-primary rounded-tl-sm'
                          : 'bg-surface border border-border text-text-primary rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-text-muted self-center">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── Activity Tab ────────────────────────────────────────────────── */
function ActivityTab() {
  const [actions, setActions]   = useState<AIAction[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [typeFilter, setType]   = useState('');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/v1/bot/ai-actions', {
        params: { page, limit: 30, ...(typeFilter ? { type: typeFilter } : {}) },
      });
      setActions(r.data.data.actions || []);
      setTotal(r.data.data.total || 0);
    } finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const ACTION_TYPES = ['crm_query', 'crm_filter', 'lead_capture', 'knowledge_query', 'escalation', 'general'];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-sm text-text-muted">{total} actions</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setType(''); setPage(1); }}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${!typeFilter ? 'bg-ryze-600 text-white border-ryze-600' : 'border-border text-text-muted hover:bg-background'}`}
          >All</button>
          {ACTION_TYPES.map(t => {
            const m = ACTION_META[t];
            return (
              <button
                key={t}
                onClick={() => { setType(t); setPage(1); }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${typeFilter === t ? 'bg-ryze-600 text-white border-ryze-600' : 'border-border text-text-muted hover:bg-background'}`}
              >{m?.label || t}</button>
            );
          })}
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-text-muted animate-spin" /></div>
        : (
          <div className="space-y-2">
            {actions.length === 0 && (
              <div className="card p-12 text-center text-text-muted">
                <BoltIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity yet. Start chatting to see AI actions here.</p>
              </div>
            )}
            {actions.map((a) => {
              const meta = ACTION_META[a.actionType] || ACTION_META.general;
              const Icon = meta.icon;
              return (
                <div key={a._id} className="card p-4 flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                      {a.metadata?.channel && (
                        <span className="text-xs text-text-muted capitalize">{a.metadata?.channel}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary mt-1">{a.summary}</p>
                    {a.userMessage && (
                      <p className="text-xs text-text-muted mt-0.5 italic truncate">"{a.userMessage}"</p>
                    )}
                    {a.metadata?.filterExpression && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Filter: {a.metadata?.filterExpression} → {a.metadata?.filteredCount} matches</p>
                    )}
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{timeSince(a.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-text-muted self-center">Page {page} of {Math.ceil(total / 30)}</span>
          <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── Leads Tab ───────────────────────────────────────────────────── */
function LeadsTab() {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/v1/bot/leads', { params: { page, limit: 20 } });
      setLeads(r.data.data.leads || []);
      setTotal(r.data.data.total || 0);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-text-muted animate-spin" /></div>;

  return (
    <div>
      <p className="text-sm text-text-muted mb-4">{total} leads captured via chat</p>
      {leads.length === 0 && (
        <div className="card p-12 text-center text-text-muted">
          <UserPlusIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No leads captured yet. Visitors who share contact info will appear here.</p>
        </div>
      )}
      <div className="space-y-2">
        {leads.map((l) => (
          <div key={l._id} className="card p-4 flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <UserPlusIcon className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{l.visitorName || 'Unknown Visitor'}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {l.visitorEmail && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <EnvelopeIcon className="h-3 w-3" />{l.visitorEmail}
                  </span>
                )}
                {l.visitorPhone && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <PhoneIcon className="h-3 w-3" />{l.visitorPhone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {l.escalated && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium block mb-1">Escalated</span>
              )}
              <p className="text-xs text-text-muted">{fmt(l.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-text-muted self-center">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function BotHubPage() {
  const [tab, setTab]       = useState<'sessions' | 'activity' | 'leads'>('sessions');
  const [stats, setStats]   = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/api/v1/bot/ai-actions/stats')
      .then(r => setStats(r.data.data))
      .catch(() => {});
  }, []);

  const TABS = [
    { key: 'sessions', label: 'Sessions',  icon: ChatBubbleLeftRightIcon },
    { key: 'activity', label: 'AI Activity', icon: BoltIcon },
    { key: 'leads',    label: 'Leads Captured', icon: UserPlusIcon },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Bot Hub</h1>
        <p className="text-sm text-text-muted mt-0.5">Track every conversation, AI action, and lead captured by your chatbot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Sessions"   value={stats?.totalSessions   ?? 0} color="text-ryze-600 dark:text-ryze-400" />
        <StatCard label="Last 7 Days"      value={stats?.recentSessions  ?? 0} sub="sessions" color="text-blue-600 dark:text-blue-400" />
        <StatCard label="CRM Queries"      value={stats?.crmQueries      ?? 0} color="text-indigo-600 dark:text-indigo-400" />
        <StatCard label="Leads Captured"   value={stats?.leadsCapture    ?? 0} color="text-success-600 dark:text-success-500" />
        <StatCard label="Escalations"      value={stats?.escalations     ?? 0} color="text-danger-500" />
        <StatCard label="Knowledge Queries" value={stats?.knowledgeQueries ?? 0} color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'leads'    && <LeadsTab />}
    </div>
  );
}
