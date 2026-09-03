import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShareIcon, PlusIcon, TrashIcon, BoltIcon, PencilIcon, RectangleStackIcon,
  ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, XCircleIcon, Squares2X2Icon,
  PauseCircleIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useAutomationFlowsQuery, useDeleteAutomationFlow, useUpdateAutomationFlow, useFlowRunStatsQuery } from '../../../modules/native-crm/queries/automation-flows.queries';
import { useAutomationSettingsQuery, useUpdateAutomationSettings } from '../../../modules/native-crm/queries/automation-settings.queries';
import TemplateGalleryModal from './TemplateGalleryModal';

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Same gradient-card shape as DashboardPage.tsx's own StatCard — a local
 * copy rather than a shared import, since that page doesn't export one and
 * this is a small, self-contained page-header summary, not a reason to
 * factor out a new shared component. */
function StatCard({ label, value, icon: Icon, gradient, sub }: {
  label: string; value: string | number; icon: ComponentType<SVGProps<SVGSVGElement>>; gradient: string; sub?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${gradient} text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/75">{label}</p>
          <p className="text-2xl font-extrabold mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-[10px] text-white/60 mt-1">{sub}</p>}
        </div>
        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
    </div>
  );
}

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'draft';

export default function AutomationFlowsPage() {
  const navigate = useNavigate();
  const { data: flows = [], isLoading } = useAutomationFlowsQuery();
  const { data: stats } = useFlowRunStatsQuery();
  const { data: settings } = useAutomationSettingsQuery();
  const updateSettingsMut = useUpdateAutomationSettings();
  const deleteMut = useDeleteAutomationFlow();
  const updateMut = useUpdateAutomationFlow();
  const [showGallery, setShowGallery] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const statsByFlowId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof stats>['perFlow'][number]>();
    for (const row of stats?.perFlow ?? []) map.set(row._id, row);
    return map;
  }, [stats]);

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      if (search.trim() && !f.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (statusFilter === 'enabled' && !f.enabled) return false;
      if (statusFilter === 'disabled' && f.enabled) return false;
      if (statusFilter === 'draft' && !f.draft) return false;
      return true;
    });
  }, [flows, search, statusFilter]);

  const disabledCount = flows.filter((f) => !f.enabled).length;
  const isPaused = !!settings?.automationsPaused;

  const handleTogglePause = () => {
    const next = !isPaused;
    const msg = next
      ? 'Pause ALL automation for this tenant? New flow runs and Simple Mode rules will stop firing immediately. Already-running or paused runs are not affected.'
      : 'Resume automation for this tenant? New triggers will start firing again immediately.';
    if (confirm(msg)) updateSettingsMut.mutate(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <ShareIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Automation Flows</h1>
            <p className="text-xs text-gray-500">Advanced Mode — branching, delays, approvals, sub-flows, and loops chained into one visual workflow</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/native-crm/settings/automations')}
          title="Simple Mode — one trigger, one action"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
        >
          <BoltIcon className="h-3.5 w-3.5" /> Simple Mode
        </button>
        <button
          onClick={() => setShowGallery(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
        >
          <RectangleStackIcon className="h-3.5 w-3.5" /> Browse Templates
        </button>
        <button
          onClick={() => navigate('/native-crm/settings/automation-flows/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New Flow
        </button>
      </div>

      {showGallery && (
        <TemplateGalleryModal
          onClose={() => setShowGallery(false)}
          onUseTemplate={(templateId) => navigate(`/native-crm/settings/automation-flows/new?templateId=${templateId}`)}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ── Global automation status — distinct from any single flow's own
            `enabled`, which only ever affects that one flow. This affects
            every flow AND every Simple Mode rule for the tenant at once. ── */}
        {isPaused ? (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-800">⚠ ALL AUTOMATIONS PAUSED</p>
                <p className="text-xs text-red-700 mt-1">Automation execution is currently stopped for this tenant — no new flow runs or Simple Mode rules will fire. Already-running or paused runs are not affected and will finish normally.</p>
                <p className="text-xs text-red-700 mt-1">Scheduled automation executions occurring while paused are skipped, not queued — they don't run automatically after you resume.</p>
                {settings?.lastChangedBy && (
                  <p className="text-[11px] text-red-500 mt-2">Paused by {settings.lastChangedBy}{settings.lastChangedAt ? ` • ${new Date(settings.lastChangedAt).toLocaleString()}` : ''}</p>
                )}
              </div>
              <button
                onClick={handleTogglePause}
                disabled={updateSettingsMut.isPending}
                className="shrink-0 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40"
              >
                Resume All Automations
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-gray-700">All Automations Active</span>
              {settings?.lastChangedBy && (
                <span className="text-[11px] text-gray-400">— resumed by {settings.lastChangedBy}{settings.lastChangedAt ? ` • ${new Date(settings.lastChangedAt).toLocaleString()}` : ''}</span>
              )}
            </div>
            <button
              onClick={handleTogglePause}
              disabled={updateSettingsMut.isPending}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
            >
              Pause All Automations
            </button>
          </div>
        )}

        {/* ── Summary row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Flows" value={flows.length} icon={Squares2X2Icon} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" />
          <StatCard label="Runs Today" value={stats?.summary.runsToday ?? 0} icon={ClockIcon} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
          <StatCard label="Failed Today" value={stats?.summary.failedToday ?? 0} icon={XCircleIcon} gradient="bg-gradient-to-br from-rose-500 to-rose-700" />
          <StatCard label="Disabled Flows" value={disabledCount} icon={PauseCircleIcon} gradient="bg-gradient-to-br from-gray-500 to-gray-700" />
        </div>

        {/* ── Filter chips + search ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'enabled', 'disabled', 'draft'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                  statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s === 'all' ? 'All' : s === 'enabled' ? 'Enabled' : s === 'disabled' ? 'Disabled' : 'Has Draft'}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flows…"
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-300"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        ) : flows.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShareIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No automation flows yet</p>
            <p className="text-xs mt-1">Create one to chain triggers, conditions, and actions visually</p>
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No flows match this filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFlows.map((flow) => {
              const triggerNode = flow.nodes.find((n) => n.type === 'trigger');
              const flowStats = statsByFlowId.get(flow._id);
              const successPct = flowStats && flowStats.totalRuns > 0 ? Math.round((flowStats.completedCount / flowStats.totalRuns) * 100) : null;
              return (
                <div key={flow._id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 hover:border-brand-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => navigate(`/native-crm/settings/automation-flows/${flow._id}`)}
                      className="text-sm font-semibold text-gray-900 hover:text-brand-600 text-left truncate"
                    >
                      {flow.name}
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-medium ${flow.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>{flow.enabled ? 'Enabled' : 'Disabled'}</span>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={flow.enabled}
                          onChange={(e) => updateMut.mutate({ id: flow._id, data: { enabled: e.target.checked } as any })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors relative">
                          <div className="absolute top-0.5 left-0.5 h-3.5 w-3.5 bg-white rounded-full transition-transform peer-checked:translate-x-3.5" />
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{flow.nodes.length} node(s)</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">v{flow.version ?? 1}</span>
                    {flow.draft && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Unpublished changes</span>
                    )}
                    {triggerNode && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{triggerNode.module} · {triggerNode.triggerType}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {flowStats ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Last run {timeAgo(flowStats.lastRunAt)}</span>
                        <span>{flowStats.totalRuns} run(s)</span>
                        {successPct !== null && <span className="text-emerald-600">{successPct}% success</span>}
                        {flowStats.failedCount > 0 && <span className="text-red-500">Failed: {flowStats.failedCount}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400">No runs yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
                    <button
                      onClick={() => navigate(`/native-crm/settings/automation-flows/${flow._id}`)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-600"
                    >
                      <PencilIcon className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${flow.name}"? This cannot be undone.`)) deleteMut.mutate(flow._id); }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 ml-auto"
                    >
                      <TrashIcon className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
