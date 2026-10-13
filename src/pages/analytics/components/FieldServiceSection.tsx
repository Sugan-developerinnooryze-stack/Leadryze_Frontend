import React from 'react';
import { Briefcase, Clock, CheckCircle2, AlertOctagon, TrendingUp, DollarSign } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface FieldServiceSectionProps {
  data: any;
}

export const FieldServiceSection: React.FC<FieldServiceSectionProps> = ({ data }) => {
  if (!data?.workOrderCounts) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No field service analytics available.
      </div>
    );
  }

  const { workOrderCounts, byStatus, workOrderTimeline, financialSummary } = data;

  // Timeline
  const timelineDates = workOrderTimeline?.map((w: any) => w.date) || [];
  const timelineChartData = {
    labels: timelineDates.length > 0 ? timelineDates : ['No Data'],
    datasets: [
      {
        label: 'Scheduled',
        data: workOrderTimeline?.map((w: any) => w.scheduled) || [0],
        backgroundColor: '#009EB5',
        borderRadius: 4,
      },
      {
        label: 'Completed',
        data: workOrderTimeline?.map((w: any) => w.completed) || [0],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  };

  // Status chart
  const statusLabels = Object.keys(byStatus || {});
  const statusValues = Object.values(byStatus || {});
  const statusChartData = {
    labels: statusLabels.length > 0 ? statusLabels : ['None'],
    datasets: [
      {
        data: statusValues.length > 0 ? statusValues : [0],
        backgroundColor: ['#64748b', '#009EB5', '#f59e0b', '#10b981', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Work Orders"
          value={workOrderCounts.total || 0}
          subtitle="All recorded jobs"
          icon={Briefcase}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Total field service work orders logged in system."
          navigateTo="/native-crm/workorders"
        />

        <KpiCard
          title="Active Jobs"
          value={workOrderCounts.activeJobs || 0}
          subtitle={`${workOrderCounts.scheduled || 0} scheduled • ${workOrderCounts.inProgress || 0} in progress`}
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip="Jobs currently scheduled or actively being executed by technicians."
          navigateTo="/native-crm/workorders"
        />

        <KpiCard
          title="Completed Jobs"
          value={workOrderCounts.completed || 0}
          subtitle="Successfully closed"
          icon={CheckCircle2}
          iconBg="bg-success-500/10"
          iconColor="text-success-600"
          tooltip="Work orders marked as complete."
        />

        <KpiCard
          title="Overdue Jobs"
          value={workOrderCounts.overdue || 0}
          subtitle="Passed scheduled date"
          icon={AlertOctagon}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-600"
          tooltip="Unfinished jobs past their scheduled delivery window."
        />

        <KpiCard
          title="Completion Rate"
          value={workOrderCounts.total > 0 ? `${workOrderCounts.completionRate || 0}%` : 'N/A'}
          subtitle={workOrderCounts.total > 0 ? "Turnaround effectiveness" : "No work orders"}
          sampleSize={workOrderCounts.total > 0 ? `${workOrderCounts.completed || 0}/${workOrderCounts.total}` : undefined}
          formula="(Completed Jobs / Total Jobs) * 100"
          icon={TrendingUp}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          tooltip="Percentage of completed work orders over total work orders."
        />

        <KpiCard
          title="Service Collected"
          value={`$${(financialSummary?.totalCollected || 0).toLocaleString()}`}
          subtitle={`$${(financialSummary?.totalInvoiced || 0).toLocaleString()} invoiced`}
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Revenue collected directly against work orders and services."
          navigateTo="/native-crm/receipts"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-text-primary mb-1">Work Order Execution Timeline</h2>
          <p className="text-xs text-text-muted mb-4">Volume of jobs scheduled versus completed over time.</p>
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
          <h2 className="text-base font-semibold text-text-primary mb-1">Work Orders by Status</h2>
          <p className="text-xs text-text-muted mb-4">Operational status distribution of field tasks.</p>
          <div className="max-w-xs mx-auto py-2">
            <Doughnut
              data={statusChartData}
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
    </div>
  );
};
