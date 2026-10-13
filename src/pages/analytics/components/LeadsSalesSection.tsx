import React from 'react';
import { Target, DollarSign, Award, FileText, CheckCircle, BarChart3 } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from './KpiCard';

interface LeadsSalesSectionProps {
  data: any;
}

export const LeadsSalesSection: React.FC<LeadsSalesSectionProps> = ({ data }) => {
  if (!data?.dealsWonLost) {
    return (
      <div className="card text-center py-12 text-text-muted">
        No sales data available.
      </div>
    );
  }

  const {
    leadVolumeTimeline,
    leadsBySource,
    conversionFunnel,
    dealPipeline,
    dealsWonLost,
    financialFlow,
    topStaffPerformance,
  } = data;

  // Timeline chart
  const timelineDates = leadVolumeTimeline?.map((d: any) => d.date) || [];
  const leadTimelineData = {
    labels: timelineDates.length > 0 ? timelineDates : ['No Data'],
    datasets: [
      {
        label: 'Leads Created',
        data: leadVolumeTimeline?.map((d: any) => d.count) || [0],
        backgroundColor: '#009EB5',
        borderRadius: 4,
      },
    ],
  };

  // Funnel chart
  const funnelLabels = conversionFunnel?.map((f: any) => f.stage) || [];
  const funnelValues = conversionFunnel?.map((f: any) => f.count) || [];
  const funnelChartData = {
    labels: funnelLabels,
    datasets: [
      {
        label: 'Funnel Stage Count',
        data: funnelValues,
        backgroundColor: ['#009EB5', '#0284c7', '#2563eb', '#7c3aed', '#10b981'],
        borderRadius: 6,
      },
    ],
  };

  // Source chart
  const sourceLabels = Object.keys(leadsBySource || {});
  const sourceValues = Object.values(leadsBySource || {});
  const sourceChartData = {
    labels: sourceLabels.length > 0 ? sourceLabels : ['None'],
    datasets: [
      {
        data: sourceValues.length > 0 ? sourceValues : [0],
        backgroundColor: ['#009EB5', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#64748b'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Open Pipeline"
          value={`$${(dealsWonLost.openValue || 0).toLocaleString()}`}
          subtitle={`${dealsWonLost.openCount || 0} active deals`}
          icon={Target}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          tooltip="Combined value of all active unclosed opportunities."
          navigateTo="/crm/deals/all"
        />

        <KpiCard
          title="Won Revenue"
          value={`$${(dealsWonLost.wonValue || 0).toLocaleString()}`}
          subtitle={`${dealsWonLost.wonCount || 0} closed won`}
          icon={Award}
          iconBg="bg-success-500/10"
          iconColor="text-success-600"
          tooltip="Total deal volume successfully closed."
        />

        <KpiCard
          title="Deal Win Rate"
          value={dealsWonLost.winRate !== null && dealsWonLost.winRate !== undefined ? `${dealsWonLost.winRate}%` : 'N/A'}
          subtitle={
            (dealsWonLost.wonCount || 0) + (dealsWonLost.lostCount || 0) > 0
              ? `${dealsWonLost.wonCount || 0} won • ${dealsWonLost.lostCount || 0} lost`
              : '0 closed deals'
          }
          sampleSize={
            (dealsWonLost.wonCount || 0) + (dealsWonLost.lostCount || 0) > 0
              ? `${dealsWonLost.wonCount}/${(dealsWonLost.wonCount || 0) + (dealsWonLost.lostCount || 0)} closed`
              : '0 closed'
          }
          formula={dealsWonLost.formula || 'Won / (Won + Lost) closed deals'}
          icon={BarChart3}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          tooltip="Ratio of won deals over total closed deals (Won / (Won + Lost)). Excludes open pipeline deals."
        />

        <KpiCard
          title="Total Quoted"
          value={`$${(financialFlow.totalQuoted || 0).toLocaleString()}`}
          subtitle={`${financialFlow.quotationCount || 0} quotations`}
          icon={FileText}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          tooltip="Combined value of customer proposals issued."
          navigateTo="/native-crm/quotations"
        />

        <KpiCard
          title="Total Invoiced"
          value={`$${(financialFlow.totalInvoiced || 0).toLocaleString()}`}
          subtitle={`${financialFlow.invoiceCount || 0} invoices`}
          icon={DollarSign}
          iconBg="bg-indigo-500/10"
          iconColor="text-indigo-600"
          tooltip="Cumulative billing value invoiced to clients."
          navigateTo="/native-crm/invoices"
        />

        <KpiCard
          title="Total Collected"
          value={`$${(financialFlow.totalCollected || 0).toLocaleString()}`}
          subtitle={`${financialFlow.receiptCount || 0} receipts logged`}
          icon={CheckCircle}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          tooltip="Actual payments received and logged via receipts."
          navigateTo="/native-crm/receipts"
        />
      </div>

      {/* Funnel & Lead Volume Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Lead-to-Deal Conversion Funnel</h2>
          <p className="text-xs text-text-muted mb-4">Progression from initial capture to closed deals.</p>
          <div className="h-64">
            <Bar
              data={funnelChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y' as const,
                plugins: { legend: { display: false } },
                scales: {
                  x: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.1)' } },
                  y: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Lead Volume Timeline</h2>
          <p className="text-xs text-text-muted mb-4">Trend of new lead arrivals in the selected period.</p>
          <div className="h-64">
            <Bar
              data={leadTimelineData}
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

      {/* Sources & Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-1">Lead Sources & Channels</h2>
          <p className="text-xs text-text-muted mb-4">Channel attribution distribution for inbound leads.</p>
          <div className="max-w-xs mx-auto py-2">
            <Doughnut
              data={sourceChartData}
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
          <h2 className="text-base font-semibold text-text-primary mb-1">Top Sales Reps & Staff</h2>
          <p className="text-xs text-text-muted mb-4">Lead assignment distribution across sales representatives.</p>
          {topStaffPerformance.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">No assigned staff records</p>
          ) : (
            <div className="divide-y divide-border">
              {topStaffPerformance.map((staff: any) => (
                <div key={staff.staffId} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-ryze-600/10 text-ryze-600 font-semibold flex items-center justify-center text-xs">
                      {staff.staffName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{staff.staffName}</div>
                      <div className="text-xs text-text-muted">Staff ID: {staff.staffId}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ryze-600/10 text-ryze-600">
                      {staff.leadCount} leads
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deal Pipeline Distribution */}
      <div className="card">
        <h2 className="text-base font-semibold text-text-primary mb-1">Deal Stages & Progression</h2>
        <p className="text-xs text-text-muted mb-4">Values and deal counts distributed across each active pipeline stage.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {dealPipeline?.map((dp: any) => (
            <div key={dp.stage} className="p-3 rounded-xl border border-border bg-black/[0.01] dark:bg-white/[0.02]">
              <div className="text-xs font-medium text-text-muted capitalize truncate">{dp.stage.replace(/_/g, ' ')}</div>
              <div className="text-lg font-bold text-text-primary mt-1">${dp.totalValue.toLocaleString()}</div>
              <div className="text-xs text-text-muted mt-0.5">{dp.count} deals</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
