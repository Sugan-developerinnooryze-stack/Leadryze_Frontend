import { useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import {
  RefreshCw,
  LayoutDashboard,
  Target,
  Users,
  Ticket,
  Briefcase,
  Workflow,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useBranchStore } from '../../stores/branch.store';
import { DateRangePicker, DateFilterState } from './components/DateRangePicker';
import { OverviewSection } from './components/OverviewSection';
import { LeadsSalesSection } from './components/LeadsSalesSection';
import { CrmSection } from './components/CrmSection';
import { SupportSection } from './components/SupportSection';
import { FieldServiceSection } from './components/FieldServiceSection';
import { AutomationSection } from './components/AutomationSection';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

type AnalyticsTab =
  | 'overview'
  | 'leads-sales'
  | 'crm'
  | 'support'
  | 'field-service'
  | 'automation';

const TABS: { id: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads-sales', label: 'Leads & Sales', icon: Target },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'support', label: 'Support', icon: Ticket },
  { id: 'field-service', label: 'Field Service', icon: Briefcase },
  { id: 'automation', label: 'Automation', icon: Workflow },
];

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const { branches, currentBranch, setBranch } = useBranchStore();

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ preset: 'this_month' });
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const getEndpointForTab = (tab: AnalyticsTab) => {
    switch (tab) {
      case 'overview':
        return '/api/v1/analytics/dashboard';
      case 'leads-sales':
        return '/api/v1/analytics/leads-sales';
      case 'crm':
        return '/api/v1/analytics/crm';
      case 'support':
        return '/api/v1/analytics/support';
      case 'field-service':
        return '/api/v1/analytics/field-service';
      case 'automation':
        return '/api/v1/analytics/automation';
      default:
        return '/api/v1/analytics/dashboard';
    }
  };

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (!user?.tenantId) return;
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('tenantId', user.tenantId);
        params.set('timezone', userTimezone);
        if (dateFilter.preset) params.set('preset', dateFilter.preset);
        if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
        if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);
        if (currentBranch?._id) params.set('branchId', currentBranch._id);

        const endpoint = getEndpointForTab(activeTab);
        const res = await api.get(`${endpoint}?${params.toString()}`);
        setData(res.data.data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.error('Failed to load analytics:', err);
        setError(err.response?.data?.message || 'Failed to load analytics data.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.tenantId, activeTab, dateFilter, currentBranch?._id, userTimezone]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    setDateFilter({ preset: 'this_month' });
    setBranch(null);
    toast.success('Filters reset to default (This Month)');
  };

  const handleExportWorkbook = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsExporting(true);
    const toastId = toast.loading(`Generating full platform business report (${format.toUpperCase()})...`);
    try {
      const params = new URLSearchParams();
      params.set('section', activeTab);
      params.set('format', format);
      params.set('timezone', userTimezone);
      if (dateFilter.preset) params.set('preset', dateFilter.preset);
      if (dateFilter.startDate) params.set('startDate', dateFilter.startDate);
      if (dateFilter.endDate) params.set('endDate', dateFilter.endDate);
      if (currentBranch?._id) params.set('branchId', currentBranch._id);

      const res = await api.get(`/api/v1/analytics/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const contentType = String(res.headers['content-type'] || '');
      const isZip = contentType.includes('zip') || (format === 'csv' && (activeTab === 'overview' || activeTab === 'leads-sales'));
      const ext = format === 'xlsx' ? 'xlsx' : isZip ? 'zip' : 'csv';
      const blobType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : isZip
        ? 'application/zip'
        : 'text/csv;charset=utf-8;';

      const blob = new Blob([res.data], { type: blobType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateTag = new Date().toISOString().split('T')[0];
      const filename = `LeadRyze_AI_Analytics_Report_${activeTab}_${dateFilter.preset || 'custom'}_${dateTag}.${ext}`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(
        format === 'xlsx'
          ? 'Comprehensive 13-sheet Excel workbook downloaded!'
          : isZip
          ? 'Complete multi-dataset CSV archive (.zip) downloaded!'
          : 'CSV report downloaded!',
        { id: toastId }
      );
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to generate export report.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Analytics & Reports
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
            <span>Business intelligence across your LeadRyze AI workspace.</span>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1 text-text-muted">
              <Globe className="w-3 h-3 text-ryze-600" />
              {userTimezone}
            </span>
            {lastUpdated && (
              <>
                <span className="hidden sm:inline">•</span>
                <span>Refreshed: {lastUpdated}</span>
              </>
            )}
          </div>
        </div>

        {/* Global Control Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter */}
          {branches.length > 0 && (
            <div className="relative">
              <select
                value={currentBranch?._id || ''}
                onChange={(e) => {
                  const b = branches.find((br) => br._id === e.target.value) || null;
                  setBranch(b);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-border bg-surface text-text-primary focus:ring-ryze-500 focus:border-ryze-500 shadow-sm"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Picker */}
          <DateRangePicker filter={dateFilter} onChange={setDateFilter} periodLabel={data?.dateRange?.shortPeriodLabel} />

          {/* Reset Action */}
          {(dateFilter.preset !== 'this_month' || currentBranch) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface text-text-muted hover:text-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors shadow-sm"
              title="Reset to default (This Month) filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-border bg-surface text-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors shadow-sm disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw
              className={`w-4 h-4 text-ryze-600 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Complete Excel Workbook Export Action */}
          <div className="inline-flex items-center rounded-xl shadow-sm">
            <button
              type="button"
              onClick={() => handleExportWorkbook('xlsx')}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-l-xl bg-ryze-600 text-white hover:bg-ryze-700 transition-colors disabled:opacity-60"
              title="Export complete 13-sheet Excel report workbook"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportWorkbook('csv')}
              disabled={isExporting}
              className="inline-flex items-center px-2.5 py-2 text-xs font-semibold rounded-r-xl border-l border-ryze-700 bg-ryze-600 text-white hover:bg-ryze-700 transition-colors disabled:opacity-60"
              title="Export as CSV summary"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Section Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-ryze-600 text-white shadow-sm font-semibold'
                  : 'bg-surface text-text-muted hover:text-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {lastUpdated && (
          <div className="ml-auto text-xs text-text-muted hidden md:block whitespace-nowrap">
            Updated: {lastUpdated}
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-700 dark:text-danger-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card h-28 bg-black/[0.03] dark:bg-white/[0.04]" />
            <div className="card h-28 bg-black/[0.03] dark:bg-white/[0.04]" />
            <div className="card h-28 bg-black/[0.03] dark:bg-white/[0.04]" />
            <div className="card h-28 bg-black/[0.03] dark:bg-white/[0.04]" />
          </div>
          <div className="card h-72 bg-black/[0.03] dark:bg-white/[0.04]" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card h-64 bg-black/[0.03] dark:bg-white/[0.04]" />
            <div className="card h-64 bg-black/[0.03] dark:bg-white/[0.04]" />
          </div>
        </div>
      ) : (
        /* Tab Views */
        <div>
          {activeTab === 'overview' && <OverviewSection data={data} />}
          {activeTab === 'leads-sales' && <LeadsSalesSection data={data} />}
          {activeTab === 'crm' && <CrmSection data={data} />}
          {activeTab === 'support' && <SupportSection data={data} />}
          {activeTab === 'field-service' && <FieldServiceSection data={data} />}
          {activeTab === 'automation' && <AutomationSection data={data} />}
        </div>
      )}
    </div>
  );
}
