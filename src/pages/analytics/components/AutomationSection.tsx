import React from 'react';
import {
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Plug,
  Send,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface AutomationSectionProps {
  data: any;
}

export const AutomationSection: React.FC<AutomationSectionProps> = ({ data }) => {
  if (!data?.runsSummary) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No automation analytics available.
      </div>
    );
  }

  const { runsSummary, rulesSummary, executionTimeline, failingWorkflows, connectors, campaigns } = data;

  // Timeline
  const timelineDates = executionTimeline?.map((e: any) => e.date) || [];
  const timelineChartData = {
    labels: timelineDates.length > 0 ? timelineDates : ['No Data'],
    datasets: [
      {
        label: 'Success',
        data: executionTimeline?.map((e: any) => e.success) || [0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Failed',
        data: executionTimeline?.map((e: any) => e.failed) || [0],
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Active Rules"
          value={rulesSummary.activeRules || 0}
          subtitle={`${rulesSummary.totalRules || 0} total rules configured`}
          icon={Workflow}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Simple Mode rules currently active and listening."
          navigateTo="/native-crm/settings/automations"
        />

        <KpiCard
          title="Active Flows"
          value={rulesSummary.activeFlows || 0}
          subtitle={`${rulesSummary.totalFlows || 0} visual flows built`}
          icon={Radio}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-600"
          tooltip="Advanced Mode visual automation flows currently published."
          navigateTo="/native-crm/settings/automation-flows"
        />

        <KpiCard
          title="Execution Success"
          value={runsSummary.hasData ? `${runsSummary.successRate}%` : 'N/A'}
          subtitle={
            runsSummary.hasData
              ? `${runsSummary.failed || 0} failed runs`
              : 'No execution data'
          }
          sampleSize={runsSummary.hasData ? `${runsSummary.completed || 0}/${runsSummary.total || 0}` : undefined}
          formula="(Completed Runs / Total Runs) * 100"
          icon={CheckCircle2}
          iconBg="bg-success-500/10"
          iconColor="text-success-600"
          tooltip="Percentage of automated runs finished without error. Excludes periods with zero executions."
        />

        <KpiCard
          title="Total Executions"
          value={runsSummary.total || 0}
          subtitle={`${runsSummary.completed || 0} completed`}
          icon={AlertTriangle}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip="Total trigger evaluations in selected period."
          navigateTo="/native-crm/settings/automations/executions"
        />

        <KpiCard
          title="Active Connectors"
          value={connectors.active || 0}
          subtitle={`${connectors.total || 0} connected integrations`}
          icon={Plug}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          tooltip="External database and CRM data connectors in service."
          navigateTo="/connectors"
        />

        <KpiCard
          title="Campaigns"
          value={campaigns.total || 0}
          subtitle={`${campaigns.active || 0} actively broadcasting`}
          icon={Send}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Marketing campaigns delivering messages across email and SMS."
          navigateTo="/campaigns"
        />
      </div>

      {/* Execution Timeline & Failing Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Execution Volume Timeline</h2>
          <p className="text-xs text-text-muted mb-4">Successful runs compared with failed executions.</p>
          <div className="h-64">
            <Bar
              data={timelineChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.1)' } },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Frequently Failing Workflows</h2>
          <p className="text-xs text-text-muted mb-4">Flows that require attention or debugging.</p>
          {failingWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-success-500 mb-2" />
              <p className="text-sm font-medium text-text-primary">All automations running healthy</p>
              <p className="text-xs text-text-muted">No failing workflows recorded in this period.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {failingWorkflows.map((flow: any) => (
                <div key={flow.name} className="py-3 flex items-start justify-between">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{flow.name}</span>
                    {flow.lastError && (
                      <p className="text-xs text-danger-600 dark:text-danger-400 mt-0.5 line-clamp-1">
                        {flow.lastError}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-500/15 text-danger-700 dark:text-danger-400 shrink-0">
                    {flow.failCount} errors
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connectors Health Table */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-1">Connector Data & Sync Health</h2>
        <p className="text-xs text-text-muted mb-4">Live synchronization status across external connectors.</p>
        {connectors.list?.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No connectors configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-border text-xs text-text-muted uppercase">
                <tr>
                  <th className="py-2.5 px-3">Connector Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Active</th>
                  <th className="py-2.5 px-3">Sync Status</th>
                  <th className="py-2.5 px-3">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {connectors.list?.map((c: any) => (
                  <tr key={c._id}>
                    <td className="py-2.5 px-3 font-medium text-text-primary">{c.name}</td>
                    <td className="py-2.5 px-3 text-text-muted uppercase text-xs font-semibold">{c.type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-success-500/15 text-success-700' : 'bg-gray-200 text-gray-700'}`}>
                        {c.isActive ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        c.syncStatus === 'success'
                          ? 'bg-success-500/15 text-success-700'
                          : c.syncStatus === 'failed'
                          ? 'bg-danger-500/15 text-danger-700'
                          : 'bg-blue-500/15 text-blue-700'
                      }`}>
                        {c.syncStatus || 'idle'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-text-muted text-xs">
                      {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
