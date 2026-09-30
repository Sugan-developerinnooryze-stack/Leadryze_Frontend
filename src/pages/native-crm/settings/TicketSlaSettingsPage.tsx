import { useState, useEffect } from 'react';
import { ClockIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useTicketSlaPolicyQuery, useTicketSlaPolicyUpdate } from '../../../modules/native-crm/queries/ticket-sla-policy.queries';

interface PriorityRow { priority: 'low' | 'medium' | 'high' | 'critical'; firstResponseMinutes: number; resolutionMinutes: number; }

const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins % 60 === 0) return `${mins / 60}h`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TicketSlaSettingsPage() {
  const { data, isLoading } = useTicketSlaPolicyQuery();
  const update = useTicketSlaPolicyUpdate();
  const [enabled, setEnabled] = useState(true);
  const [warningPercent, setWarningPercent] = useState(80);
  const [policies, setPolicies] = useState<PriorityRow[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled ?? true);
    setWarningPercent(data.warningPercent ?? 80);
    setPolicies(data.policies ?? []);
  }, [data]);

  const updateRow = (priority: string, field: 'firstResponseMinutes' | 'resolutionMinutes', value: number) => {
    setPolicies((prev) => prev.map((p) => (p.priority === priority ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    await update.mutateAsync({ enabled, warningPercent, policies });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-ryze-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
            <ClockIcon className="h-5 w-5 text-text-muted" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">Ticket SLA Policy</h1>
            <p className="text-xs text-text-muted">First-response and resolution time targets per priority, plus the warning threshold before a breach.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 disabled:opacity-60"
        >
          {saved ? <><CheckIcon className="h-4 w-4" />Saved</> : update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-3xl">
        <div className="bg-surface rounded-xl border border-border shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Enable SLA tracking</p>
            <p className="text-xs text-text-muted mt-0.5">Turns off due-date computation and warning/breach automation matching for new tickets.</p>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enabled ? 'bg-ryze-600' : 'bg-black/[0.06] dark:bg-white/[0.08]'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-surface shadow transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
          <label className="block text-sm font-medium text-text-primary mb-1">Warning threshold</label>
          <p className="text-xs text-text-muted mb-2">The earlier SLA tier fires at this percentage of the way to the due date — e.g. 80% warns before a breach, giving staff a chance to respond first.</p>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={99} value={warningPercent}
              onChange={(e) => setWarningPercent(Math.min(99, Math.max(1, Number(e.target.value))))}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm bg-background text-text-primary"
            />
            <span className="text-sm text-text-muted">%</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Per-priority targets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background text-text-muted text-xs uppercase">
                  <th className="text-left py-2 px-4 font-semibold">Priority</th>
                  <th className="text-left py-2 px-4 font-semibold">First Response (minutes)</th>
                  <th className="text-left py-2 px-4 font-semibold">Resolution (minutes)</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.priority} className="border-t border-border">
                    <td className="py-2.5 px-4 font-medium text-text-primary">{PRIORITY_LABELS[p.priority] ?? p.priority}</td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number" min={1} value={p.firstResponseMinutes}
                        onChange={(e) => updateRow(p.priority, 'firstResponseMinutes', Math.max(1, Number(e.target.value)))}
                        className="w-24 px-2 py-1.5 border border-border rounded-lg text-sm bg-background text-text-primary"
                      />
                      <span className="ml-2 text-xs text-text-muted">{fmtMinutes(p.firstResponseMinutes)}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number" min={1} value={p.resolutionMinutes}
                        onChange={(e) => updateRow(p.priority, 'resolutionMinutes', Math.max(1, Number(e.target.value)))}
                        className="w-24 px-2 py-1.5 border border-border rounded-lg text-sm bg-background text-text-primary"
                      />
                      <span className="ml-2 text-xs text-text-muted">{fmtMinutes(p.resolutionMinutes)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
