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
        <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <ClockIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Ticket SLA Policy</h1>
            <p className="text-xs text-gray-500">First-response and resolution time targets per priority, plus the warning threshold before a breach.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
        >
          {saved ? <><CheckIcon className="h-4 w-4" />Saved</> : update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-3xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Enable SLA tracking</p>
            <p className="text-xs text-gray-500 mt-0.5">Turns off due-date computation and warning/breach automation matching for new tickets.</p>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enabled ? 'bg-brand-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Warning threshold</label>
          <p className="text-xs text-gray-500 mb-2">The earlier SLA tier fires at this percentage of the way to the due date — e.g. 80% warns before a breach, giving staff a chance to respond first.</p>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={99} value={warningPercent}
              onChange={(e) => setWarningPercent(Math.min(99, Math.max(1, Number(e.target.value))))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Per-priority targets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="text-left py-2 px-4 font-semibold">Priority</th>
                  <th className="text-left py-2 px-4 font-semibold">First Response (minutes)</th>
                  <th className="text-left py-2 px-4 font-semibold">Resolution (minutes)</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.priority} className="border-t border-gray-100">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{PRIORITY_LABELS[p.priority] ?? p.priority}</td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number" min={1} value={p.firstResponseMinutes}
                        onChange={(e) => updateRow(p.priority, 'firstResponseMinutes', Math.max(1, Number(e.target.value)))}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="ml-2 text-xs text-gray-400">{fmtMinutes(p.firstResponseMinutes)}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <input
                        type="number" min={1} value={p.resolutionMinutes}
                        onChange={(e) => updateRow(p.priority, 'resolutionMinutes', Math.max(1, Number(e.target.value)))}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="ml-2 text-xs text-gray-400">{fmtMinutes(p.resolutionMinutes)}</span>
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
