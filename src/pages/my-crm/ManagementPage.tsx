import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon, PencilIcon, TrashIcon,
  ClipboardDocumentListIcon, CalendarDaysIcon, UserGroupIcon,
  ClockIcon, ArrowPathIcon, EnvelopeIcon, PencilSquareIcon,
  SparklesIcon, CheckCircleIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import api from '../../services/api';
import ActivityModal, { ActivityDTO, ActivityType } from './ActivityModal';

/* ── Types ─────────────────────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<ActivityType, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  task:        { label: 'Task',        icon: ClipboardDocumentListIcon, color: '#6366f1' },
  event:       { label: 'Event',       icon: CalendarDaysIcon,          color: '#3b82f6' },
  booking:     { label: 'Booking',     icon: UserGroupIcon,             color: '#10b981' },
  appointment: { label: 'Appointment', icon: ClockIcon,                 color: '#f97316' },
  schedule:    { label: 'Schedule',    icon: ArrowPathIcon,             color: '#8b5cf6' },
  followup:    { label: 'Follow-up',   icon: EnvelopeIcon,              color: '#ef4444' },
  custom:      { label: 'Custom',      icon: PencilSquareIcon,          color: '#64748b' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: 'Pending',     bg: 'bg-yellow-100', text: 'text-yellow-800' },
  in_progress:{ label: 'In Progress', bg: 'bg-blue-100',   text: 'text-blue-800'   },
  completed:  { label: 'Completed',   bg: 'bg-green-100',  text: 'text-green-800'  },
  cancelled:  { label: 'Cancelled',   bg: 'bg-gray-100',   text: 'text-gray-500'   },
};

const CHANNEL_COLORS: Record<string, string> = {
  zoho: '#ef4444', hubspot: '#f97316', salesforce: '#3b82f6',
  mysql: '#10b981', postgresql: '#8b5cf6', mongodb: '#22c55e',
};

const TABS: { key: ActivityType | 'all'; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'task',        label: 'Tasks' },
  { key: 'event',       label: 'Events' },
  { key: 'booking',     label: 'Bookings' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'followup',    label: 'Follow-ups' },
  { key: 'custom',      label: 'Custom' },
];

interface StatsData {
  total: number;
  byType: Record<string, number>;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fmtDate(d?: string) {
  if (!d) return null;
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return null; }
}

function getActivityDate(a: ActivityDTO) {
  return a.startDate || a.dueDate || a.endDate;
}

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function ManagementPage() {
  const [tab,        setTab]        = useState<ActivityType | 'all'>('all');
  const [activities, setActivities] = useState<ActivityDTO[]>([]);
  const [stats,      setStats]      = useState<StatsData | null>(null);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState<ActivityDTO | undefined>();

  const LIMIT = 20;

  const fetchActivities = useCallback(async (pg: number, t: ActivityType | 'all') => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: pg, limit: LIMIT };
      if (t !== 'all') params.type = t;
      const res = await api.get('/api/v1/activities', { params });
      setActivities(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/activities/stats');
      setStats(res.data.data);
    } catch {}
  }, []);

  useEffect(() => {
    setPage(1);
    fetchActivities(1, tab);
  }, [tab, fetchActivities]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, activities]);

  // Refresh when AI schedules/updates a meeting via chat
  useEffect(() => {
    const handler = () => { fetchActivities(1, tab); fetchStats(); };
    window.addEventListener('leadryze:activity-updated', handler);
    return () => window.removeEventListener('leadryze:activity-updated', handler);
  }, [tab, fetchActivities, fetchStats]);

  function handleSaved() {
    fetchActivities(page, tab);
    fetchStats();
  }

  function openEdit(a: ActivityDTO) {
    setEditTarget(a);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this activity?')) return;
    try {
      await api.delete(`/api/v1/activities/${id}`);
      fetchActivities(page, tab);
      fetchStats();
    } catch {}
  }

  async function toggleStatus(a: ActivityDTO) {
    const next = a.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.put(`/api/v1/activities/${a._id}`, { status: next });
      fetchActivities(page, tab);
      fetchStats();
    } catch {}
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
            <SparklesIcon className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Management</h1>
            <p className="text-xs text-gray-500">Tasks, bookings, follow-ups & more</p>
          </div>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Add New
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-white border-b border-gray-100 shrink-0">
          {[
            { label: 'Total',       value: stats.total,      icon: SparklesIcon,          color: 'text-brand-600', bg: 'bg-brand-50' },
            { label: 'Pending',     value: stats.pending,    icon: ExclamationCircleIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'In Progress', value: stats.inProgress, icon: ArrowPathIcon,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'Completed',   value: stats.completed,  icon: CheckCircleIcon,       color: 'text-green-600',  bg: 'bg-green-50'  },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-6 py-2 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {TABS.map(t => {
          const count = t.key === 'all' ? stats?.total : stats?.byType[t.key];
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Activity list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <SparklesIcon className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No activities yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "+ Add New" to create your first activity</p>
          </div>
        )}

        {!loading && activities.map(a => {
          const cfg     = TYPE_CONFIG[a.type] || TYPE_CONFIG.custom;
          const stCfg   = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
          const dateStr = fmtDate(getActivityDate(a));
          const isDone  = a.status === 'completed';

          return (
            <div
              key={a._id}
              className={`bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow ${isDone ? 'opacity-70' : ''}`}
            >
              <div className="h-0.5" style={{ backgroundColor: a.color || cfg.color }} />
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Status toggle */}
                <button
                  onClick={() => toggleStatus(a)}
                  title={isDone ? 'Mark pending' : 'Mark complete'}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isDone ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {isDone && <CheckCircleIcon className="h-3 w-3 text-white" />}
                </button>

                {/* Type icon */}
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cfg.color}18` }}>
                  <cfg.icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-gray-900 truncate ${isDone ? 'line-through text-gray-400' : ''}`}>
                        {a.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* Type badge */}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: cfg.color }}>
                          {a.customType || cfg.label}
                        </span>
                        {/* Status badge */}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stCfg.bg} ${stCfg.text}`}>
                          {stCfg.label}
                        </span>
                        {/* Priority */}
                        {a.priority && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            a.priority === 'high' ? 'bg-red-100 text-red-700' :
                            a.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {a.priority}
                          </span>
                        )}
                        {/* Date */}
                        {dateStr && <span className="text-[10px] text-gray-400">{dateStr}</span>}
                      </div>

                      {/* Linked person */}
                      {a.linkedPerson && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[a.linkedPerson.channel] || '#64748b' }} />
                          <span className="text-xs text-gray-500 truncate">{a.linkedPerson.displayName}</span>
                          <span className="text-[10px] text-gray-400">· {a.linkedPerson.module}</span>
                        </div>
                      )}

                      {/* Notes preview */}
                      {a.notes && (
                        <p className="text-xs text-gray-400 mt-1 truncate max-w-sm">{a.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(a._id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 bg-white border-t border-gray-100 shrink-0">
          <button
            disabled={page === 1}
            onClick={() => { const p = page-1; setPage(p); fetchActivities(p, tab); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Prev</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => { const p = page+1; setPage(p); fetchActivities(p, tab); }}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Next</button>
        </div>
      )}

      <ActivityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editActivity={editTarget}
      />
    </div>
  );
}
