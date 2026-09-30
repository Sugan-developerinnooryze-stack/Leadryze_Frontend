import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import type { CrmRecord } from './types/crm.types';

interface Candidate {
  staffId: string;
  name:    string;
  free:    boolean;
  current: boolean;
}

interface TimelineEvent {
  _id?:        string;
  action:      string;
  description: string;
  createdAt:   string;
}

const ACTION_COLORS: Record<string, string> = {
  created:    'bg-success-500/15 text-success-700 dark:text-success-500',
  assigned:   'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  reassigned: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  updated:    'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',
};

/** Meeting-specific "who is this assigned to, and can I change it" section —
 * added to the shared RecordDrawer only for the meetings module (gated by
 * moduleName, see RecordDrawer.tsx), since no other module has a real
 * time-slot-aware candidate list to reassign against. Doubles as the
 * "no staff available -> assign manually" fallback UI: a busy candidate is
 * still listed, just marked, so a Supervisor can deliberately override
 * round robin's own decision. */
export default function MeetingAssignmentPanel({ record, apiBase, onReassigned }: {
  record: CrmRecord;
  apiBase: string;
  onReassigned: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [history, setHistory] = useState<TimelineEvent[]>([]);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [candRes, historyRes, detailRes] = await Promise.all([
        api.get(`${apiBase}/${record._id}/reassign-candidates`),
        api.get(`/api/v1/native-crm/timeline/meetings/${record._id}`),
        api.get(`${apiBase}/${record._id}`),
      ]);
      setCandidates(candRes.data.data?.candidates ?? []);
      setHistory(historyRes.data.data ?? []);
      setSupervisorName(detailRes.data.data?.supervisorName ?? null);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, record._id]);

  useEffect(() => { load(); }, [load]);

  const handleReassign = async () => {
    if (!selected) return;
    const chosen = candidates?.find((c) => c.staffId === selected);
    setReassigning(true);
    setReassignError(null);
    try {
      await api.put(`${apiBase}/${record._id}`, {
        assignedStaffId: selected,
        assignedStaffName: chosen?.name,
      });
      setSelected('');
      await load();
      onReassigned();
    } catch (err: any) {
      // A real, expected outcome — the chosen staff member already has a
      // real meeting at this exact time (the backend's own double-booking
      // guard) — surfaced as a clear inline message instead of a silent
      // failure or an uncaught console error.
      setReassignError(err?.response?.data?.message ?? 'Could not reassign — please try a different staff member or time.');
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-text-muted">Loading assignment info…</p>;
  }

  return (
    <div className="pt-2 border-t border-border space-y-3">
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assignment</p>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-text-muted">Assigned to</span><span className="font-medium text-text-primary">{(record.assignedStaffName as string) || 'Unassigned'}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Team</span><span className="font-medium text-text-primary">{(record.teamName as string) || '—'}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Supervisor</span><span className="font-medium text-text-primary">{supervisorName || '—'}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Source</span><span className="font-medium text-text-primary capitalize">{(record.source as string) || 'manual'}</span></div>
      </div>

      {candidates && candidates.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-text-primary">Reassign to</label>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setReassignError(null); }}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ryze-500 bg-background text-text-primary"
            >
              <option value="">Select staff…</option>
              {candidates.map((c) => (
                <option key={c.staffId} value={c.staffId} disabled={c.current}>
                  {c.name}{c.current ? ' (current)' : c.free ? ' — free' : ' — busy at this time'}
                </option>
              ))}
            </select>
            <button
              onClick={handleReassign}
              disabled={!selected || reassigning}
              className="px-3 py-2 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {reassigning ? 'Saving…' : 'Reassign'}
            </button>
          </div>
          {reassignError ? (
            <p className="text-[11px] text-red-500">{reassignError}</p>
          ) : (
            <p className="text-[11px] text-text-muted">
              Busy candidates are shown so you can pick them anyway — but if they already have a real meeting at this
              exact time, the reassignment will be blocked to prevent a double-booking.
            </p>
          )}
        </div>
      )}
      {candidates && candidates.length === 0 && (
        <p className="text-xs text-text-muted">No other active staff found to reassign to.</p>
      )}

      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 font-medium"
        >
          {expanded ? 'Hide' : 'Show'} assignment history ({history.length})
        </button>
        {expanded && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {history.length === 0 && <p className="text-xs text-text-muted">No history yet.</p>}
            {history.map((ev, i) => (
              <div key={ev._id ?? i} className="flex items-start gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ACTION_COLORS[ev.action] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
                  {ev.action.replace(/_/g, ' ')}
                </span>
                <span className="text-text-muted">{ev.description}</span>
                <span className="ml-auto text-text-muted shrink-0">
                  {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
