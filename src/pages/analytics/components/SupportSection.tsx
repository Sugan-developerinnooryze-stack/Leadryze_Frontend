import React from 'react';
import { Ticket, AlertTriangle, ShieldAlert, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface SupportSectionProps {
  data: any;
}

export const SupportSection: React.FC<SupportSectionProps> = ({ data }) => {
  if (!data?.ticketCounts) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No support ticket analytics available.
      </div>
    );
  }

  const { ticketCounts, byPriority, ticketsTimeline, agingBuckets } = data;

  // Timeline
  const timelineDates = ticketsTimeline?.map((t: any) => t.date) || [];
  const timelineChartData = {
    labels: timelineDates.length > 0 ? timelineDates : ['No Data'],
    datasets: [
      {
        label: 'Created',
        data: ticketsTimeline?.map((t: any) => t.created) || [0],
        backgroundColor: '#f59e0b',
        borderRadius: 4,
      },
      {
        label: 'Resolved',
        data: ticketsTimeline?.map((t: any) => t.resolved) || [0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  };

  // Priority
  const priLabels = Object.keys(byPriority || {});
  const priValues = Object.values(byPriority || {});
  const priorityChartData = {
    labels: priLabels.length > 0 ? priLabels : ['None'],
    datasets: [
      {
        data: priValues.length > 0 ? priValues : [0],
        backgroundColor: ['#ef4444', '#f97316', '#3b82f6', '#10b981'],
        borderWidth: 0,
      },
    ],
  };

  // Aging buckets
  const agingLabels = Object.keys(agingBuckets || {});
  const agingValues = Object.values(agingBuckets || {});
  const agingChartData = {
    labels: agingLabels,
    datasets: [
      {
        label: 'Open Tickets',
        data: agingValues,
        backgroundColor: '#009EB5',
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Tickets"
          value={ticketCounts.total || 0}
          subtitle="All time requests"
          icon={Ticket}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Total support requests submitted."
          navigateTo="/crm/tickets/all"
        />

        <KpiCard
          title="Open & Working"
          value={(ticketCounts.open || 0) + (ticketCounts.inProgress || 0)}
          subtitle={`${ticketCounts.open || 0} new • ${ticketCounts.inProgress || 0} in progress`}
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip="Active tickets currently awaiting resolution."
          navigateTo="/crm/tickets/all"
        />

        <KpiCard
          title="Overdue Tickets"
          value={ticketCounts.overdue || 0}
          subtitle="Passed resolution date"
          icon={AlertTriangle}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-600"
          tooltip="Unresolved tickets that have exceeded their target resolution time."
        />

        <KpiCard
          title="SLA Breaches"
          value={ticketCounts.slaBreaches || 0}
          subtitle={`${ticketCounts.slaWarnings || 0} warnings active`}
          icon={ShieldAlert}
          iconBg="bg-danger-500/10"
          iconColor="text-danger-600"
          tooltip="Tickets that have breached their agreed Service Level Agreement threshold."
        />

        <KpiCard
          title="SLA Compliance"
          value={ticketCounts.hasSlaData ? `${ticketCounts.slaComplianceRate}%` : 'N/A'}
          subtitle={ticketCounts.hasSlaData ? 'On-time performance' : 'No SLA records'}
          sampleSize={ticketCounts.hasSlaData ? `${Math.max(0, ticketCounts.total - (ticketCounts.slaBreaches || 0))}/${ticketCounts.total}` : undefined}
          formula="(Total - Breached) / Total Tickets * 100"
          icon={ShieldCheck}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Percentage of tickets resolved within SLA target duration. Shows N/A when no tickets exist."
        />

        <KpiCard
          title="Resolved Tickets"
          value={(ticketCounts.resolved || 0) + (ticketCounts.closed || 0)}
          subtitle={`${ticketCounts.closed || 0} closed`}
          icon={CheckCircle2}
          iconBg="bg-success-500/10"
          iconColor="text-success-600"
          tooltip="Tickets marked as successfully resolved or closed."
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-text-primary mb-1">Ticket Volume & Resolution Timeline</h2>
          <p className="text-xs text-text-muted mb-4">Comparison of newly created tickets against resolved requests.</p>
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
          <h2 className="text-base font-semibold text-text-primary mb-1">Tickets by Priority</h2>
          <p className="text-xs text-text-muted mb-4">Severity distribution of customer issues.</p>
          <div className="max-w-xs mx-auto py-2">
            <Doughnut
              data={priorityChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Ticket Aging */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-1">Open Ticket Aging Distribution</h2>
        <p className="text-xs text-text-muted mb-4">How long active tickets have remained open without resolution.</p>
        <div className="h-56">
          <Bar
            data={agingChartData}
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
      </div>
    </div>
  );
};
