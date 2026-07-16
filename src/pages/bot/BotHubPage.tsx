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
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: { escalated?: boolean };
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
  crm_query:       { label: 'CRM Query',     color: 'bg-blue-100 text-blue-700',    icon: CircleStackIcon },
  crm_filter:      { label: 'CRM Filter',    color: 'bg-indigo-100 text-indigo-700', icon: FunnelIcon },
  crm_search:      { label: 'CRM Search',    color: 'bg-cyan-100 text-cyan-700',    icon: MagnifyingGlassIcon },
  lead_capture:    { label: 'Lead Captured', color: 'bg-green-100 text-green-700',  icon: UserPlusIcon },
  knowledge_query: { label: 'Knowledge',     color: 'bg-purple-100 text-purple-700', icon: BoltIcon },
  escalation:      { label: 'Escalated',     color: 'bg-red-100 text-red-700',      icon: ExclamationTriangleIcon },
  email_sent:      { label: 'Email Sent',    color: 'bg-orange-100 text-orange-700', icon: EnvelopeIcon },
  general:         { label: 'General',       color: 'bg-gray-100 text-gray-600',    icon: ChatBubbleLeftRightIcon },
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
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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

  if (loading) return <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-gray-300 animate-spin" /></div>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{total} total sessions</p>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s._id} className="card overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === s.sessionId ? null : s.sessionId)}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${s.escalated ? 'bg-red-100' : 'bg-brand-100'}`}>
                {s.escalated
                  ? <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  : <ChatBubbleLeftRightIcon className="h-4 w-4 text-brand-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {s.visitorName || s.visitorEmail || `Session ${s.sessionId.slice(-8)}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.messages.length} messages · {timeSince(s.updatedAt)}
                  {s.visitorEmail && <span className="ml-2 text-brand-500">{s.visitorEmail}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.escalated && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Escalated</span>
                )}
                {expanded === s.sessionId
                  ? <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  : <ChevronRightIcon className="h-4 w-4 text-gray-400" />}
              </div>
            </button>

            {expanded === s.sessionId && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3 max-h-96 overflow-y-auto">
                {s.messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(total / 20)}</span>
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
        <p className="text-sm text-gray-500">{total} actions</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setType(''); setPage(1); }}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${!typeFilter ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >All</button>
          {ACTION_TYPES.map(t => {
            const m = ACTION_META[t];
            return (
              <button
                key={t}
                onClick={() => { setType(t); setPage(1); }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${typeFilter === t ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >{m?.label || t}</button>
            );
          })}
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-gray-300 animate-spin" /></div>
        : (
          <div className="space-y-2">
            {actions.length === 0 && (
              <div className="card p-12 text-center text-gray-400">
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
                        <span className="text-xs text-gray-400 capitalize">{a.metadata?.channel}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">{a.summary}</p>
                    {a.userMessage && (
                      <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{a.userMessage}"</p>
                    )}
                    {a.metadata?.filterExpression && (
                      <p className="text-xs text-indigo-600 mt-0.5">Filter: {a.metadata?.filterExpression} → {a.metadata?.filteredCount} matches</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeSince(a.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(total / 30)}</span>
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

  if (loading) return <div className="flex justify-center py-16"><ArrowPathIcon className="h-6 w-6 text-gray-300 animate-spin" /></div>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{total} leads captured via chat</p>
      {leads.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
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
              <p className="text-sm font-medium text-gray-900">{l.visitorName || 'Unknown Visitor'}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {l.visitorEmail && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <EnvelopeIcon className="h-3 w-3" />{l.visitorEmail}
                  </span>
                )}
                {l.visitorPhone && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <PhoneIcon className="h-3 w-3" />{l.visitorPhone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {l.escalated && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium block mb-1">Escalated</span>
              )}
              <p className="text-xs text-gray-400">{fmt(l.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(total / 20)}</span>
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
        <h1 className="text-2xl font-bold text-gray-900">Bot Hub</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track every conversation, AI action, and lead captured by your chatbot</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Sessions"   value={stats?.totalSessions   ?? 0} color="text-brand-600" />
        <StatCard label="Last 7 Days"      value={stats?.recentSessions  ?? 0} sub="sessions" color="text-blue-600" />
        <StatCard label="CRM Queries"      value={stats?.crmQueries      ?? 0} color="text-indigo-600" />
        <StatCard label="Leads Captured"   value={stats?.leadsCapture    ?? 0} color="text-green-600" />
        <StatCard label="Escalations"      value={stats?.escalations     ?? 0} color="text-red-500" />
        <StatCard label="Knowledge Queries" value={stats?.knowledgeQueries ?? 0} color="text-purple-600" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
