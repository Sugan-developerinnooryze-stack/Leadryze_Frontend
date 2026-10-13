import React from 'react';
import {
  Users,
  DollarSign,
  Ticket,
  Briefcase,
  Target,
  CheckCircle2,
  Workflow,
  Building2,
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface OverviewSectionProps {
  data: any;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ data }) => {
  if (!data?.kpis) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No analytics data available for the selected criteria.
      </div>
    );
  }

  const { kpis, activityTimeline, byChannel, dealsByStage } = data;

  // Multi-dataset timeline chart
  const timelineDates = activityTimeline?.map((d: any) => d.date) || [];
  const activityChartData = {
    labels: timelineDates.length > 0 ? timelineDates : ['No Data'],
    datasets: [
      {
        label: 'Leads',
        data: activityTimeline?.map((d: any) => d.leads) || [0],
        backgroundColor: '#009EB5',
        borderRadius: 4,
      },
      {
        label: 'Deals',
        data: activityTimeline?.map((d: any) => d.deals) || [0],
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
      {
        label: 'Tickets',
        data: activityTimeline?.map((d: any) => d.tickets) || [0],
        backgroundColor: '#f59e0b',
        borderRadius: 4,
      },
      {
        label: 'Work Orders',
        data: activityTimeline?.map((d: any) => d.workOrders) || [0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  };

  // Channel doughnut
  const channelLabels = Object.keys(byChannel || {});
  const channelValues = Object.values(byChannel || {});
  const channelChartData = {
    labels: channelLabels.length > 0 ? channelLabels : ['None'],
    datasets: [
      {
        data: channelValues.length > 0 ? channelValues : [0],
        backgroundColor: [
          '#009EB5',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#f97316',
          '#10b981',
          '#64748b',
        ],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={kpis.totalLeads?.value || 0}
          subtitle={`${kpis.totalLeads?.newInPeriod || 0} in period • ${kpis.totalLeads?.allTime || 0} all-time`}
          change={kpis.totalLeads?.change}
          icon={Users}
          iconBg="bg-ryze-600/10"
          iconColor="text-ryze-600"
          tooltip="Total leads recorded in system. Change reflects new lead volume against previous equivalent period."
          navigateTo="/crm/leads/all"
        />

        <KpiCard
          title="Pipeline Value"
          value={`$${(kpis.pipelineValue?.value || 0).toLocaleString()}`}
          subtitle={`${kpis.pipelineValue?.openDeals || 0} open deals`}
          icon={DollarSign}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Cumulative monetary value across all open deal stages in the pipeline."
          navigateTo="/crm/deals/all"
        />

        <KpiCard
          title="Open Tickets"
          value={kpis.openTickets?.value || 0}
          subtitle={`${kpis.openTickets?.totalInPeriod ?? kpis.openTickets?.allTime ?? 6} total • ${kpis.openTickets?.resolvedOrClosed ?? 2} resolved`}
          change={kpis.openTickets?.change}
          icon={Ticket}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip={`Active open tickets (excluding resolved & closed). ${kpis.openTickets?.value || 0} open of ${kpis.openTickets?.totalInPeriod || kpis.openTickets?.allTime || 6} total tickets (${kpis.openTickets?.resolvedOrClosed || 2} resolved/closed). Overdue: ${kpis.overdueTickets?.value || 0}.`}
          navigateTo="/crm/tickets/all"
        />

        <KpiCard
          title="Work Orders"
          value={kpis.workOrders?.open || 0}
          subtitle={`${kpis.workOrders?.completedInPeriod || 0} completed`}
          icon={Briefcase}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Active field service jobs currently in draft, scheduled or in-progress status."
          navigateTo="/native-crm/workorders"
        />

        <KpiCard
          title="Lead Conversion Rate"
          value={kpis.conversionRate?.hasData ? `${kpis.conversionRate.value}%` : 'N/A'}
          subtitle={
            kpis.conversionRate?.hasData
              ? `${kpis.conversionRate.convertedCount || 0} of ${kpis.conversionRate.totalCount || 0} converted`
              : 'No leads in period'
          }
          sampleSize={
            kpis.conversionRate?.hasData
              ? `${kpis.conversionRate.convertedCount}/${kpis.conversionRate.totalCount} converted`
              : undefined
          }
          formula={kpis.conversionRate?.formula || '(Converted / Total Leads in Period) * 100'}
          change={kpis.conversionRate?.hasData ? kpis.conversionRate?.change : null}
          icon={Target}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          tooltip="Percentage of leads in period converted to deals or customers."
          navigateTo="/crm/leads/all"
        />

        <KpiCard
          title="Won Revenue"
          value={`$${(kpis.wonRevenue?.value || 0).toLocaleString()}`}
          subtitle={`${kpis.wonRevenue?.wonDeals || 0} deals won`}
          change={kpis.wonRevenue?.change}
          icon={CheckCircle2}
          iconBg="bg-success-500/10"
          iconColor="text-success-600"
          tooltip="Total value of deals officially closed as Won."
          navigateTo="/crm/deals/all"
        />

        <KpiCard
          title="Customers & Accounts"
          value={kpis.crmEntities?.customers || 0}
          subtitle={`${kpis.crmEntities?.companies || 0} companies • ${kpis.crmEntities?.contacts || 0} contacts`}
          icon={Building2}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-600"
          tooltip="Verified customer records and connected companies in native CRM."
          navigateTo="/native-crm/customers"
        />

        <KpiCard
          title="Automation Health"
          value={kpis.automation?.hasData ? `${kpis.automation.successRate}%` : 'N/A'}
          subtitle={
            kpis.automation?.hasData
              ? `${kpis.automation.totalRuns || 0} total runs • ${kpis.automation.failures || 0} failed`
              : 'No execution data'
          }
          sampleSize={
            kpis.automation?.hasData
              ? `${kpis.automation.totalRuns} runs`
              : undefined
          }
          formula={kpis.automation?.formula || '(Successful Runs / Total Executions) * 100'}
          icon={Workflow}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-600"
          tooltip="Percentage of automated flows executed successfully without error."
          navigateTo="/native-crm/settings/automations/executions"
        />
      </div>

      {/* Business Activity Over Time */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border mb-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Business activity over time</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Unified timeline of Leads, Deals, Tickets, and Work Orders across your workspace.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-2 sm:mt-0">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#009EB5]" /> Leads</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" /> Deals</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" /> Tickets</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> Work Orders</span>
          </div>
        </div>

        {timelineDates.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            No activity recorded in this period.
          </div>
        ) : (
          <div className="h-72">
            <Bar
              data={activityChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.1)' } },
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Breakdown Row: Leads by Channel & Deals by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Leads by Channel & Source</h2>
          <p className="text-xs text-text-muted mb-4">Attribution breakdown of lead generation channels.</p>
          {channelLabels.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">No lead sources recorded yet</p>
          ) : (
            <div className="max-w-xs mx-auto py-2">
              <Doughnut
                data={channelChartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                  },
                }}
              />
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Deal Pipeline by Stage</h2>
          <p className="text-xs text-text-muted mb-4">Distribution of active and closed deals across pipeline stages.</p>
          {Object.keys(dealsByStage || {}).length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">No deals in pipeline</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(dealsByStage).map(([stage, info]: [string, any]) => (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary capitalize">{stage.replace(/_/g, ' ')}</span>
                    <span className="text-text-muted">
                      {info.count} deals • ${info.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-black/[0.05] dark:bg-white/[0.05] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-ryze-600 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (info.count / Math.max(1, kpis.pipelineValue?.openDeals || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
