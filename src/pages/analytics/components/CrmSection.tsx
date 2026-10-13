import React from 'react';
import {
  Users,
  Building,
  CheckSquare,
  PhoneCall,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface CrmSectionProps {
  data: any;
}

export const CrmSection: React.FC<CrmSectionProps> = ({ data }) => {
  if (!data?.counts) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No CRM analytics available.
      </div>
    );
  }

  const { counts, tasks, meetings, calls } = data;

  // Task chart
  const taskChartData = {
    labels: ['Completed', 'Pending', 'Overdue'],
    datasets: [
      {
        data: [tasks.completed || 0, tasks.pending || 0, tasks.overdue || 0],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  // Calls distribution
  const callLabels = Object.keys(calls.byStatus || {});
  const callValues = Object.values(calls.byStatus || {});
  const callChartData = {
    labels: callLabels.length > 0 ? callLabels : ['None'],
    datasets: [
      {
        data: callValues.length > 0 ? callValues : [0],
        backgroundColor: ['#009EB5', '#10b981', '#f59e0b', '#ef4444'],
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Contacts"
          value={counts.contacts || 0}
          subtitle="Individual personas"
          icon={Users}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Individual contact records stored in Native CRM."
          navigateTo="/crm/contacts/all"
        />

        <KpiCard
          title="Companies"
          value={counts.companies || 0}
          subtitle="Corporate accounts"
          icon={Building}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-600"
          tooltip="Registered company organizations."
          navigateTo="/crm/companies/all"
        />

        <KpiCard
          title="Field Customers"
          value={counts.customers || 0}
          subtitle="Direct clients"
          icon={UserCheck}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Active customer accounts with service history."
          navigateTo="/native-crm/customers"
        />

        <KpiCard
          title="Active Tasks"
          value={tasks.total || 0}
          subtitle={`${tasks.overdue || 0} overdue`}
          icon={CheckSquare}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip="Tasks assigned across CRM leads and deals."
          navigateTo="/crm/tasks/all"
        />

        <KpiCard
          title="Logged Calls"
          value={calls.total || 0}
          subtitle={`${calls.totalDurationMinutes || 0} mins talk time`}
          icon={PhoneCall}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-600"
          tooltip="Total inbound and outbound call entries."
          navigateTo="/crm/calls/all"
        />

        <KpiCard
          title="Task Completion"
          value={`${tasks.completionRate || 0}%`}
          subtitle={`${tasks.completed || 0} tasks finished`}
          icon={Clock}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          tooltip="Percentage of tasks marked as completed or done."
        />
      </div>

      {/* Charts & Meetings List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Task Completion Health</h2>
          <p className="text-xs text-text-muted mb-4">Completed versus pending and overdue tasks.</p>
          <div className="max-w-xs mx-auto py-2">
            <Doughnut
              data={taskChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Call Logs & Outcomes</h2>
          <p className="text-xs text-text-muted mb-4">Breakdown of recorded calls by status.</p>
          <div className="h-64">
            <Bar
              data={callChartData}
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

        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Upcoming Meetings</h2>
          <p className="text-xs text-text-muted mb-4">Upcoming client engagements and consultations.</p>
          {meetings.upcoming?.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">No upcoming meetings scheduled</p>
          ) : (
            <div className="divide-y divide-border">
              {meetings.upcoming?.map((m: any) => (
                <div key={m._id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary truncate">{m.title}</span>
                    <span className="text-xs text-ryze-600 font-semibold bg-ryze-600/10 px-2 py-0.5 rounded-full">
                      {new Date(m.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-1 flex items-center justify-between">
                    <span>{m.assignedStaffName || 'Team member'}</span>
                    <span>{m.location || 'Online'}</span>
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
