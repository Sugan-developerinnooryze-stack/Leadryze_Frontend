import { useMemo, useState } from 'react';
import type { FC, SVGProps } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UsersIcon, BriefcaseIcon, CurrencyRupeeIcon, UserPlusIcon,
  ClipboardDocumentListIcon, LifebuoyIcon,
  LinkIcon, ExclamationTriangleIcon, BoltIcon,
  PhoneIcon, CalendarDaysIcon, ChartBarIcon, ChartPieIcon,
  BuildingOffice2Icon, DocumentTextIcon, ShoppingCartIcon,
  CubeIcon, TruckIcon, TagIcon, ReceiptPercentIcon, DocumentIcon,
  MegaphoneIcon, PaperClipIcon, TableCellsIcon, GlobeAltIcon, EnvelopeIcon,
  CreditCardIcon, ArrowPathIcon, FolderIcon, StarIcon, WrenchScrewdriverIcon,
  UserGroupIcon, ClockIcon, ShieldCheckIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';
import { useBranchStore } from '../../stores/branch.store';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import { usePermission, useAnyPermission } from '../../hooks/usePermission';
import { useLeadsQuery, useLeadsStatsQuery } from '../../modules/native-crm/queries/leads.queries';
import { useDealsQuery, useDealsStatsQuery } from '../../modules/native-crm/queries/deals.queries';
import { useTasksListQuery, useTasksStatsQuery } from '../../modules/native-crm/queries/tasks.queries';
import { useTicketsStatsQuery, useTicketsSlaCountQuery } from '../../modules/native-crm/queries/tickets.queries';
import { useWorkordersListQuery, useWorkordersStatsQuery } from '../../modules/native-crm/queries/workorders.queries';
import { useMeetingsQuery } from '../../modules/native-crm/queries/meetings.queries';
import { useConnectorsQuery } from '../../modules/connectors/queries/connectors.queries';
import { useFlowRunStatsQuery } from '../../modules/native-crm/queries/automation-flows.queries';
import { useInvoicesListQuery } from '../../modules/native-crm/queries/invoices.queries';
import {
  useDashboardStatsQuery, useUnassignedLeadsCountQuery,
  useManagementActivityStatsQuery, useCustomersStatsQuery, useRecentActivityQuery,
} from '../../modules/dashboard/queries/dashboard.queries';
import StatCard, { type StatCardTrend } from '../../components/dashboard/StatCard';
import PipelineFunnel from '../../components/dashboard/PipelineFunnel';
import AttentionItem from '../../components/dashboard/AttentionItem';
import ConnectorStatusPill from '../../components/dashboard/ConnectorStatusPill';
import DateRangeSwitcher, { type DashboardRange } from '../../components/dashboard/DateRangeSwitcher';
import QuickActionButton from '../../components/dashboard/QuickActionButton';
import EntranceCard from '../../components/dashboard/EntranceCard';
import EmptyState from '../../components/dashboard/EmptyState';
import KanbanColumn from '../../components/dashboard/KanbanColumn';
import ActivityTimelineItem from '../../components/dashboard/ActivityTimelineItem';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

/* ── Module icons map for Synced CRM Modules grid ───────────────────── */
const MODULE_ICON_MAP: Record<string, HeroIcon> = {
  Accounts: BuildingOffice2Icon, Companies: BuildingOffice2Icon,
  Contacts: UserGroupIcon, Leads: UserPlusIcon,
  Deals: BriefcaseIcon, Potentials: BriefcaseIcon, Opportunities: BriefcaseIcon,
  Tasks: ClipboardDocumentListIcon, Meetings: CalendarDaysIcon, Events: CalendarDaysIcon,
  Calls: PhoneIcon, Activities: BoltIcon, Campaigns: MegaphoneIcon,
  Notes: DocumentTextIcon, Attachments: PaperClipIcon, Documents: FolderIcon,
  Products: CubeIcon, Vendors: TruckIcon, PriceBooks: TagIcon, Quotes: ReceiptPercentIcon,
  Invoices: DocumentIcon, SalesOrders: ShoppingCartIcon, PurchaseOrders: ShoppingCartIcon,
  Cases: LifebuoyIcon, Tickets: LifebuoyIcon, Solutions: BoltIcon,
  Reports: ChartBarIcon, Analytics: ChartPieIcon,
  Payments: CreditCardIcon, Revenue: CurrencyRupeeIcon, Subscriptions: ArrowPathIcon,
  Partners: GlobeAltIcon, Competitors: StarIcon, Integrations: WrenchScrewdriverIcon,
  Webforms: GlobeAltIcon, EmailTemplates: EnvelopeIcon,
};

function getModuleIcon(name: string): HeroIcon {
  if (MODULE_ICON_MAP[name]) return MODULE_ICON_MAP[name];
  const n = name.toLowerCase();
  if (/account|company/i.test(n))     return BuildingOffice2Icon;
  if (/deal|opportunit/i.test(n))     return BriefcaseIcon;
  if (/task|todo/i.test(n))           return ClipboardDocumentListIcon;
  if (/meet|event|calendar/i.test(n)) return CalendarDaysIcon;
  if (/call|phone/i.test(n))          return PhoneIcon;
  if (/campaign|market/i.test(n))     return MegaphoneIcon;
  if (/product|item/i.test(n))        return CubeIcon;
  if (/case|ticket|support/i.test(n)) return LifebuoyIcon;
  if (/user|contact|lead/i.test(n))   return UserGroupIcon;
  if (/payment|money/i.test(n))       return CreditCardIcon;
  if (/email|mail/i.test(n))          return EnvelopeIcon;
  return TableCellsIcon;
}

const MODULE_STYLE = {
  icon: 'text-ryze-600 dark:text-ryze-400',
  bg: 'bg-ryze-500/10 dark:bg-ryze-400/15',
  border: 'border-border',
  num: 'text-text-primary',
};

const CONNECTOR_THEME: Record<string, { dot: string; label: string; bar: string; pill: string }> = {
  zoho:       { dot: 'bg-blue-500',   label: 'Zoho CRM',   bar: 'bg-blue-500',   pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60' },
  hubspot:    { dot: 'bg-orange-500', label: 'HubSpot',    bar: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/60' },
  salesforce: { dot: 'bg-sky-500',    label: 'Salesforce', bar: 'bg-sky-500',    pill: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/60' },
  mysql:      { dot: 'bg-teal-500',   label: 'MySQL',      bar: 'bg-teal-500',   pill: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/60' },
  postgresql: { dot: 'bg-indigo-500', label: 'PostgreSQL', bar: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60' },
  mongodb:    { dot: 'bg-green-500',  label: 'MongoDB',    bar: 'bg-green-500',  pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60' },
  rest:       { dot: 'bg-purple-500', label: 'REST API',   bar: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/60' },
};

const STATUS_CONFIG: Record<string, { bar: string; dot: string }> = {
  new:               { bar: 'bg-blue-500',    dot: 'bg-blue-500'    },
  contacted:         { bar: 'bg-violet-500',  dot: 'bg-violet-500'  },
  qualified:         { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  meeting_scheduled: { bar: 'bg-sky-500',     dot: 'bg-sky-500'     },
  proposal_sent:     { bar: 'bg-amber-500',   dot: 'bg-amber-500'   },
  negotiation:       { bar: 'bg-orange-500',  dot: 'bg-orange-500'  },
  won:               { bar: 'bg-teal-500',    dot: 'bg-teal-500'    },
  converted:         { bar: 'bg-teal-500',    dot: 'bg-teal-500'    },
  lost:              { bar: 'bg-rose-500',    dot: 'bg-rose-500'    },
  on_hold:           { bar: 'bg-gray-400',    dot: 'bg-gray-400'    },
  disqualified:      { bar: 'bg-rose-400',    dot: 'bg-rose-400'    },
};

const LEAD_BADGE: Record<string, string> = {
  new:               'text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-200/50',
  contacted:         'text-violet-700 dark:text-violet-400 bg-violet-500/10 border border-violet-200/50',
  qualified:         'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-200/50',
  meeting_scheduled: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border border-sky-200/50',
  proposal_sent:     'text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-200/50',
  negotiation:       'text-orange-700 dark:text-orange-400 bg-orange-500/10 border border-orange-200/50',
  won:               'text-teal-700 dark:text-teal-400 bg-teal-500/10 border border-teal-200/50',
  converted:         'text-teal-700 dark:text-teal-400 bg-teal-500/10 border border-teal-200/50',
  lost:              'text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-200/50',
  on_hold:           'text-gray-600 dark:text-gray-400 bg-gray-500/10 border border-gray-200/50',
  disqualified:      'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-200/50',
};

function keywordBadgeClass(status: string): string | undefined {
  const s = status.toLowerCase();
  if (/won|complet|clos|book|paid|deliver|done/.test(s))   return 'text-teal-700 dark:text-teal-400 bg-teal-500/10 border border-teal-200/50';
  if (/lost|cancel|reject|overdue|fail|breach/.test(s))    return 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-200/50';
  if (/progress|negotiat|review/.test(s))                  return 'text-orange-700 dark:text-orange-400 bg-orange-500/10 border border-orange-200/50';
  if (/schedul|proposal|meeting|quote|sent/.test(s))       return 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border border-sky-200/50';
  if (/new|open|draft|qualif|pending|prospect/.test(s))    return 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-200/50';
  return undefined;
}

const LEAD_SOURCE_THEME: Record<string, { dot: string; label: string; bar: string }> = {
  website:      { dot: 'bg-blue-500',    label: 'Website',      bar: 'bg-blue-500'    },
  landing_page: { dot: 'bg-cyan-500',    label: 'Landing Page', bar: 'bg-cyan-500'    },
  chatbot:      { dot: 'bg-violet-500',  label: 'AI Chatbot',   bar: 'bg-violet-500'  },
  whatsapp:     { dot: 'bg-emerald-500', label: 'WhatsApp',     bar: 'bg-emerald-500' },
  facebook:     { dot: 'bg-indigo-500',  label: 'Facebook',     bar: 'bg-indigo-500'  },
  google:       { dot: 'bg-rose-500',    label: 'Google',       bar: 'bg-rose-500'    },
  manual:       { dot: 'bg-slate-500',   label: 'Manual Entry', bar: 'bg-slate-500'   },
  csv:          { dot: 'bg-teal-500',    label: 'CSV Import',   bar: 'bg-teal-500'    },
  api:          { dot: 'bg-sky-500',     label: 'API',          bar: 'bg-sky-500'     },
  referral:     { dot: 'bg-amber-500',   label: 'Referral',     bar: 'bg-amber-500'   },
  other:        { dot: 'bg-slate-400',   label: 'Other',        bar: 'bg-slate-400'   },
};

interface ModuleInfo { module: string; count: number; }
type CRMModules = Record<string, ModuleInfo[]>;

function computeTrend(current: number, prior: number | null | undefined): StatCardTrend | null {
  if (prior === null || prior === undefined || prior === 0) return null;
  if (current === 0) return null; // Avoid alarming -100% on newly selected zero-period ranges
  const deltaPct = ((current - prior) / prior) * 100;
  return { deltaPct, direction: deltaPct > 0.5 ? 'up' : deltaPct < -0.5 ? 'down' : 'flat' };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const queryClient    = useQueryClient();
  const user           = useAuthStore((s) => s.user);
  const activeChannels = useSourceFilterStore((s) => s.activeChannels);
  const currentBranch  = useBranchStore((s) => s.currentBranch);
  const flags          = useFeatureFlagsStore((s) => s.flags);

  const [range, setRange]           = useState<DashboardRange>('month');
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo]     = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRangeChange = (r: DashboardRange, from?: string, to?: string) => {
    setRange(r);
    setCustomFrom(from);
    setCustomTo(to);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  /* ── Permission + feature-flag gates ───────────────────────────────── */
  const canCustomers   = usePermission('fs.customers.view')        && flags.fs_customers;
  const canLeads       = usePermission('native_crm.leads.view')    && flags.fs_leads;
  const canDeals       = usePermission('native_crm.deals.view')    && flags.native_deals;
  const canTasks       = usePermission('native_crm.tasks.view')    && flags.native_tasks;
  const canTickets     = usePermission('native_crm.tickets.view')  && flags.native_tickets;
  const canWorkorders  = usePermission('fs.workorders.view')       && flags.fs_workorders;
  const canConnectors  = usePermission('connector.view')           && flags.nav_connectors;
  const canManagement  = usePermission('native_crm.activities.view') && flags.nav_myCrm;
  const canInvoices    = usePermission('fs.invoices.view')         && flags.fs_invoices;
  const canMeetings    = usePermission('native_crm.meetings.view') && flags.native_meetings;
  const canInviteUser  = usePermission('users.create');
  const canAutomations = usePermission('native_crm.automation_rules.view');

  const canAttention = useAnyPermission(
    'native_crm.tasks.view', 'native_crm.tickets.view', 'native_crm.leads.view',
    'connector.view', 'fs.workorders.view', 'native_crm.automation_rules.view',
  );
  const canPipeline  = useAnyPermission('native_crm.leads.view', 'native_crm.deals.view');
  const canTaskWo    = canTasks || canWorkorders;

  /* ── Business Data Queries ─────────────────────────────────────────── */
  const customersStats  = useCustomersStatsQuery(range, customFrom, customTo);
  const leadsStats      = useLeadsStatsQuery(range, customFrom, customTo);
  const dealsStats      = useDealsStatsQuery(range, customFrom, customTo);
  const tasksStats      = useTasksStatsQuery(range, customFrom, customTo);
  const ticketsStats    = useTicketsStatsQuery(range, customFrom, customTo);
  const workordersStats = useWorkordersStatsQuery(range, customFrom, customTo);
  const managementStats = useManagementActivityStatsQuery(range, customFrom, customTo);
  const dashboardStats  = useDashboardStatsQuery(range, customFrom, customTo);
  const flowRunStats    = useFlowRunStatsQuery();
  const connectors      = useConnectorsQuery();
  const unassignedLeads = useUnassignedLeadsCountQuery();
  const ticketsWarning  = useTicketsSlaCountQuery('warning');
  const ticketsBreached = useTicketsSlaCountQuery('breached');
  const invoicesList    = useInvoicesListQuery({ limit: 1 }, { enabled: canInvoices });

  /* ── Operations lists (Recent records) ─────────────────────────────── */
  const recentLeads      = useLeadsQuery({ limit: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const recentDeals      = useDealsQuery({ limit: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const recentTasks      = useTasksListQuery({ limit: 5 });
  const recentWorkorders = useWorkordersListQuery({ limit: 5 });
  const recentActivity   = useRecentActivityQuery(8);
  const upcomingMeetings = useMeetingsQuery({ upcoming: true, limit: 15 });

  const activeChannel = activeChannels.length === 1 ? activeChannels[0] : null;
  const activeTheme   = activeChannel ? CONNECTOR_THEME[activeChannel] : null;

  /* ── Connector Synced CRM Modules ─────────────────────────────────── */
  const crmModulesQuery = useQuery({
    queryKey: ['crm', 'modules', activeChannels, currentBranch?._id],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeChannels.length > 0) params.set('channels', activeChannels.join(','));
      return api.get(`/api/v1/crm/modules?${params}`).then((r) => (r.data.data ?? {}) as CRMModules);
    },
  });
  const crmModules = crmModulesQuery.data ?? {};
  const visibleModules: ModuleInfo[] = activeChannel ? (crmModules[activeChannel] || []) : Object.values(crmModules).flat();
  const totalCRM = visibleModules.reduce((a, m) => a + m.count, 0);

  const s = dashboardStats.data ?? { totalLeads: 0, newToday: 0, appointments: 0, appointmentsToday: 0, conversionRate: 0, bySource: {}, byStatus: {} };
  const maxStatus   = Math.max(1, ...Object.values(s.byStatus));
  const maxSource   = Math.max(1, ...Object.values(s.bySource));
  const totalStatus = Object.values(s.byStatus).reduce((a, b) => a + b, 0) || 1;

  /* ── Sales Pipeline Funnel Stages ──────────────────────────────────── */
  const qualifiedCount = useMemo(() => {
    const entry = (leadsStats.data?.pipeline ?? []).find((p) => p._id === 'qualified');
    return entry?.count ?? 0;
  }, [leadsStats.data]);

  const pipelineStages = useMemo(() => [
    { key: 'leads',     label: 'Leads',     count: leadsStats.data?.total ?? 0, colorClass: 'bg-ryze-500' },
    { key: 'qualified', label: 'Qualified', count: qualifiedCount,               colorClass: 'bg-blue-500' },
    { key: 'deals',     label: 'Deals',     count: dealsStats.data?.total ?? 0, colorClass: 'bg-emerald-500' },
  ], [leadsStats.data, dealsStats.data, qualifiedCount]);

  const taskWoStages = useMemo(() => {
    const rows: { key: string; label: string; count: number; colorClass?: string }[] = [];
    if (canTasks && tasksStats.data) {
      Object.entries(tasksStats.data.byStatus).forEach(([k, v]) =>
        rows.push({ key: `task-${k}`, label: `Task · ${k.replace(/_/g, ' ')}`, count: v, colorClass: 'bg-ryze-500' }));
    }
    if (canWorkorders && workordersStats.data) {
      Object.entries(workordersStats.data.byStatus).forEach(([k, v]) =>
        rows.push({ key: `wo-${k}`, label: `Work Order · ${k.replace(/_/g, ' ')}`, count: v, colorClass: 'bg-blue-500' }));
    }
    return rows;
  }, [canTasks, tasksStats.data, canWorkorders, workordersStats.data]);

  const failedConnectors = (connectors.data ?? []).filter((c) => c.syncStatus === 'failed').length;
  const hasConnectors    = (connectors.data ?? []).length > 0;
  const failedAutomations = flowRunStats.data?.summary.failedToday ?? 0;

  /* ── Attention Required condition check ────────────────────────────── */
  const isAttentionLoading =
    (canTasks && tasksStats.isLoading) ||
    (canWorkorders && workordersStats.isLoading) ||
    (canTickets && (ticketsBreached.isLoading || ticketsWarning.isLoading)) ||
    (canLeads && unassignedLeads.isLoading) ||
    (canConnectors && connectors.isLoading) ||
    (canAutomations && flowRunStats.isLoading);

  const hasAttentionItems =
    (canTasks && (tasksStats.data?.overdue ?? 0) > 0) ||
    (canWorkorders && (workordersStats.data?.overdue ?? 0) > 0) ||
    (canTickets && (ticketsBreached.data ?? 0) > 0) ||
    (canTickets && (ticketsWarning.data ?? 0) > 0) ||
    (canLeads && (unassignedLeads.data ?? 0) > 0) ||
    (canConnectors && failedConnectors > 0) ||
    (canAutomations && failedAutomations > 0);

  /* ── Operations Kanban row mappings ────────────────────────────────── */
  const leadRows = useMemo<{ id: string; label: string; badge: string; badgeColorClass?: string; to?: string }[]>(() => (
    (recentLeads.data?.items ?? []).map((l: any) => {
      const status = String(l.status ?? 'new');
      return {
        id: l._id,
        label: l.firstName ? `${l.firstName} ${l.lastName ?? ''}`.trim() : (l.company || 'Untitled lead'),
        badge: status.replace(/_/g, ' '),
        badgeColorClass: LEAD_BADGE[status.toLowerCase()],
      };
    })
  ), [recentLeads.data]);

  const dealRows = useMemo<{ id: string; label: string; badge: string; badgeColorClass?: string; to?: string }[]>(() => (
    (recentDeals.data?.items ?? []).map((d: any) => {
      const stage = String(d.stage ?? 'prospect');
      return {
        id: d._id,
        label: d.title || 'Untitled deal',
        badge: stage.replace(/_/g, ' '),
        badgeColorClass: keywordBadgeClass(stage),
      };
    })
  ), [recentDeals.data]);

  const taskRows = useMemo<{ id: string; label: string; badge: string; badgeColorClass?: string; to?: string }[]>(() => (
    (recentTasks.data?.items ?? []).map((t) => {
      const status = t.taskStatus ?? 'open';
      return {
        id: t._id,
        label: t.title || 'Untitled task',
        badge: status.replace(/_/g, ' '),
        badgeColorClass: keywordBadgeClass(status),
      };
    })
  ), [recentTasks.data]);

  const workorderRows = useMemo<{ id: string; label: string; badge: string; badgeColorClass?: string; to?: string }[]>(() => (
    (recentWorkorders.data?.items ?? []).map((w: any) => {
      const status = String(w.status ?? 'open');
      return {
        id: w._id,
        label: w.title || w.workOrderId || 'Untitled work order',
        badge: status.replace(/_/g, ' '),
        badgeColorClass: keywordBadgeClass(status),
        to: `/native-crm/workorders/${w._id}`,
      };
    })
  ), [recentWorkorders.data]);

  /* ── Today's Schedule meetings ─────────────────────────────────────── */
  const todaysMeetings = useMemo(() => {
    const items = upcomingMeetings.data?.items ?? [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    return items
      .filter((m) => {
        const t = new Date(m.startDate).getTime();
        return t >= todayStart && t < todayEnd;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [upcomingMeetings.data]);

  return (
    <div className="space-y-8 pb-10">

      {/* ══ 1. HEADER & WORKSPACE SUMMARY ════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold text-text-primary tracking-tight">
              {greeting()}, <span className="text-ryze-600 dark:text-ryze-400">{user?.firstName || 'there'}</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Workspace
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1 flex items-center gap-2">
            <span>Executive performance summary</span>
            {currentBranch?.branchName && (
              <>
                <span className="text-border">•</span>
                <span className="font-medium text-text-primary">{currentBranch.branchName}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTheme && (
            <div className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs ${activeTheme.pill}`}>
              <span className={`h-2 w-2 rounded-full ${activeTheme.dot} animate-pulse`} />
              {activeTheme.label} · Filtered
            </div>
          )}

          <button
            onClick={handleManualRefresh}
            title="Refresh dashboard data"
            className="p-2.5 rounded-xl bg-surface border border-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-all duration-150 shadow-xs"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-ryze-600' : ''}`} />
          </button>

          <DateRangeSwitcher value={range} customFrom={customFrom} customTo={customTo} onChange={onRangeChange} />
        </div>
      </div>

      {/* ══ 2. BUSINESS KPI CARDS (RESPONSIVE GRID) ══════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-ryze-600 dark:text-ryze-400">
              Native CRM &amp; Revenue Metrics
            </h2>
            <span className="text-xs text-text-muted font-normal">({range})</span>
          </div>
          <span className="text-xs text-text-muted hidden sm:inline">Click card to open module</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {canCustomers && (
            <StatCard
              label="Customers"
              subtitle="All registered accounts"
              icon={UsersIcon}
              isLoading={customersStats.isLoading}
              value={customersStats.data?.totalCustomers ?? 0}
              trend={computeTrend(customersStats.data?.totalCustomers ?? 0, customersStats.data?.priorTotal)}
              trendLabel={`vs prior ${range}`}
              sparklineData={customersStats.data?.daily}
              to="/native-crm/customers"
              accent="teal"
              delayMs={0}
            />
          )}

          {canLeads && (
            <StatCard
              label="Leads"
              subtitle="Captured prospects"
              icon={UserPlusIcon}
              isLoading={leadsStats.isLoading}
              value={leadsStats.data?.total ?? 0}
              trend={computeTrend(leadsStats.data?.total ?? 0, leadsStats.data?.priorTotal)}
              trendLabel={`vs prior ${range}`}
              sparklineData={leadsStats.data?.daily}
              to="/native-crm/leads"
              accent="blue"
              delayMs={50}
            />
          )}

          {canDeals && (
            <StatCard
              label="Active Deals"
              subtitle="In sales pipeline"
              icon={BriefcaseIcon}
              isLoading={dealsStats.isLoading}
              value={dealsStats.data?.total ?? 0}
              trend={computeTrend(dealsStats.data?.total ?? 0, dealsStats.data?.priorTotal)}
              trendLabel={`vs prior ${range}`}
              sparklineData={dealsStats.data?.daily}
              to="/native-crm/deals"
              accent="indigo"
              delayMs={100}
            />
          )}

          {canDeals && (
            <StatCard
              label="Revenue"
              subtitle="Won deal value"
              icon={CurrencyRupeeIcon}
              format="currency"
              isLoading={dealsStats.isLoading}
              value={dealsStats.data?.totalValue ?? 0}
              trend={computeTrend(dealsStats.data?.totalValue ?? 0, dealsStats.data?.priorTotalValue)}
              trendLabel={`vs prior ${range}`}
              sparklineData={dealsStats.data?.daily}
              to="/native-crm/deals"
              accent="emerald"
              delayMs={150}
            />
          )}
        </div>

        {/* Secondary KPI bar: Tickets, Work Orders, Invoices */}
        {(canTickets || canWorkorders || canInvoices) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {canTickets && (
              <StatCard
                label="Tickets"
                subtitle="Customer support issues"
                icon={LifebuoyIcon}
                isLoading={ticketsStats.isLoading}
                value={ticketsStats.data?.total ?? 0}
                to="/native-crm/tickets"
                accent="amber"
                delayMs={200}
              />
            )}
            {canWorkorders && (
              <StatCard
                label="Work Orders"
                subtitle="Field service jobs"
                icon={WrenchScrewdriverIcon}
                isLoading={workordersStats.isLoading}
                value={workordersStats.data?.total ?? 0}
                to="/native-crm/workorders"
                accent="rose"
                delayMs={250}
              />
            )}
            {canInvoices && (
              <StatCard
                label="Invoices"
                subtitle="Billing & customer invoices"
                icon={DocumentIcon}
                isLoading={invoicesList.isLoading}
                value={invoicesList.data?.meta?.total ?? 0}
                to="/native-crm/invoices"
                accent="purple"
                delayMs={300}
              />
            )}
          </div>
        )}
      </div>

      {/* ══ 3. ATTENTION REQUIRED (ACTIONABLE EXCEPTION CENTER) ═══════════ */}
      {canAttention && (
        <EntranceCard delayMs={80} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${
                isAttentionLoading
                  ? 'bg-slate-500/10 text-slate-500'
                  : hasAttentionItems
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isAttentionLoading ? (
                  <ClockIcon className="h-5 w-5 animate-pulse" />
                ) : hasAttentionItems ? (
                  <ExclamationTriangleIcon className="h-5 w-5" />
                ) : (
                  <ShieldCheckIcon className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-text-primary">Attention Required</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {isAttentionLoading
                    ? 'Checking active alerts and monitoring status…'
                    : hasAttentionItems
                    ? 'Active items requiring immediate response'
                    : 'Exception monitoring status'}
                </p>
              </div>
            </div>

            {isAttentionLoading ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 animate-pulse">
                Checking status…
              </span>
            ) : hasAttentionItems ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60">
                Action Required
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
                100% Healthy
              </span>
            )}
          </div>

          {isAttentionLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse border border-border/50" />
              ))}
            </div>
          ) : hasAttentionItems ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {canWorkorders && (workordersStats.data?.overdue ?? 0) > 0 && (
                <AttentionItem
                  icon={ExclamationTriangleIcon}
                  severity="critical"
                  count={workordersStats.data!.overdue}
                  to="/native-crm/workorders?status=overdue"
                  label={`${workordersStats.data!.overdue} overdue work order${workordersStats.data!.overdue === 1 ? '' : 's'}`}
                />
              )}

              {canTasks && (tasksStats.data?.overdue ?? 0) > 0 && (
                <AttentionItem
                  icon={ExclamationTriangleIcon}
                  severity="critical"
                  count={tasksStats.data!.overdue}
                  to="/native-crm/tasks?status=overdue"
                  label={`${tasksStats.data!.overdue} overdue task${tasksStats.data!.overdue === 1 ? '' : 's'}`}
                />
              )}

              {canTickets && (ticketsBreached.data ?? 0) > 0 && (
                <AttentionItem
                  icon={LifebuoyIcon}
                  severity="critical"
                  count={ticketsBreached.data}
                  to="/native-crm/tickets?slaStatus=breached"
                  label={`${ticketsBreached.data} ticket${ticketsBreached.data === 1 ? '' : 's'} breached SLA`}
                />
              )}

              {canTickets && (ticketsWarning.data ?? 0) > 0 && (
                <AttentionItem
                  icon={LifebuoyIcon}
                  severity="warning"
                  count={ticketsWarning.data}
                  to="/native-crm/tickets?slaStatus=warning"
                  label={`${ticketsWarning.data} ticket${ticketsWarning.data === 1 ? '' : 's'} approaching SLA`}
                />
              )}

              {canLeads && (unassignedLeads.data ?? 0) > 0 && (
                <AttentionItem
                  icon={UserPlusIcon}
                  severity="warning"
                  count={unassignedLeads.data}
                  to="/native-crm/leads?owner=unassigned"
                  label={`${unassignedLeads.data} unassigned lead${unassignedLeads.data === 1 ? '' : 's'}`}
                />
              )}

              {canAutomations && failedAutomations > 0 && (
                <AttentionItem
                  icon={BoltIcon}
                  severity="critical"
                  count={failedAutomations}
                  to="/native-crm/settings/automation-flows/executions?status=failed"
                  label={`${failedAutomations} failed automation${failedAutomations === 1 ? '' : 's'} today`}
                />
              )}

              {canConnectors && failedConnectors > 0 && (
                <AttentionItem
                  icon={LinkIcon}
                  severity="critical"
                  count={failedConnectors}
                  to="/connectors"
                  label={`${failedConnectors} connector sync issue${failedConnectors === 1 ? '' : 's'}`}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">All systems operational.</span> No overdue tasks, work orders, SLA breaches, or connector errors require immediate attention.
              </div>
            </div>
          )}
        </EntranceCard>
      )}

      {/* ══ 4. QUICK ACTIONS ═════════════════════════════════════════════ */}
      <EntranceCard delayMs={100} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-bold text-text-primary">Quick Actions</h2>
            <p className="text-xs text-text-muted mt-0.5">Jump directly to record creation flows</p>
          </div>
          <span className="text-xs text-text-muted">Shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {canCustomers && (
            <QuickActionButton
              icon={UsersIcon}
              label="New Customer"
              description="Register account"
              to="/native-crm/customers"
              accent="teal"
            />
          )}
          {canLeads && (
            <QuickActionButton
              icon={UserPlusIcon}
              label="New Lead"
              description="Add prospect"
              to="/native-crm/leads"
              accent="blue"
            />
          )}
          {canDeals && (
            <QuickActionButton
              icon={BriefcaseIcon}
              label="New Deal"
              description="Create pipeline"
              to="/native-crm/deals"
              accent="indigo"
            />
          )}
          {canTickets && (
            <QuickActionButton
              icon={LifebuoyIcon}
              label="New Ticket"
              description="Raise support"
              to="/native-crm/tickets"
              accent="amber"
            />
          )}
          {canWorkorders && (
            <QuickActionButton
              icon={ClipboardDocumentListIcon}
              label="New Work Order"
              description="Schedule field service"
              to="/native-crm/workorders"
              accent="rose"
            />
          )}
          {canInvoices && (
            <QuickActionButton
              icon={DocumentIcon}
              label="New Invoice"
              description="Billing & receipt"
              to="/native-crm/invoices"
              accent="emerald"
            />
          )}
          {canInviteUser && (
            <QuickActionButton
              icon={UserGroupIcon}
              label="Invite User"
              description="Add team member"
              to="/settings"
              accent="purple"
            />
          )}
        </div>
      </EntranceCard>

      {/* ══ 5. OPERATIONS OVERVIEW (4-COLUMN KANBAN) ═════════════════════ */}
      {(canLeads || canDeals || canTasks || canWorkorders) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">Operations Overview</h2>
              <p className="text-xs text-text-muted mt-0.5">Live operational columns across active CRM workflows</p>
            </div>
            <span className="text-xs text-text-muted">Recently updated</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {canLeads && (
              <KanbanColumn
                title="Leads"
                icon={UserPlusIcon}
                isLoading={leadsStats.isLoading || recentLeads.isLoading}
                count={leadsStats.data?.allTimeTotal ?? leadsStats.data?.total ?? 0}
                rows={leadRows}
                viewAllTo="/native-crm/leads"
                viewAllLabel="View all leads"
                emptyLabel="No leads recorded"
                delayMs={120}
              />
            )}
            {canDeals && (
              <KanbanColumn
                title="Deals"
                icon={BriefcaseIcon}
                isLoading={dealsStats.isLoading || recentDeals.isLoading}
                count={dealsStats.data?.allTimeTotal ?? dealsStats.data?.total ?? 0}
                rows={dealRows}
                viewAllTo="/native-crm/deals"
                viewAllLabel="View all deals"
                emptyLabel="No deals recorded"
                delayMs={150}
              />
            )}
            {canTasks && (
              <KanbanColumn
                title="Tasks"
                icon={ClipboardDocumentListIcon}
                isLoading={tasksStats.isLoading || recentTasks.isLoading}
                count={tasksStats.data?.allTimeTotal ?? tasksStats.data?.total ?? 0}
                rows={taskRows}
                viewAllTo="/crm/tasks"
                viewAllLabel="View all tasks"
                emptyLabel="No tasks assigned"
                delayMs={180}
              />
            )}
            {canWorkorders && (
              <KanbanColumn
                title="Work Orders"
                icon={WrenchScrewdriverIcon}
                isLoading={workordersStats.isLoading || recentWorkorders.isLoading}
                count={workordersStats.data?.allTimeTotal ?? workordersStats.data?.total ?? 0}
                rows={workorderRows}
                viewAllTo="/native-crm/workorders"
                viewAllLabel="View all work orders"
                emptyLabel="No work orders open"
                delayMs={210}
              />
            )}
          </div>
        </div>
      )}

      {/* ══ 6. SALES PIPELINE  +  TASKS & WORK ORDERS ═════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {canPipeline && (
          <EntranceCard delayMs={130} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-bold text-text-primary">Sales Pipeline Funnel</h2>
                <p className="text-xs text-text-muted mt-0.5">Prospect qualification to won deals</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-text-muted">
                Conversion: {s.conversionRate || 0}%
              </span>
            </div>
            <PipelineFunnel stages={pipelineStages} emptyLabel="No leads or deals yet" />
          </EntranceCard>
        )}

        {canTaskWo && (
          <EntranceCard delayMs={160} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-bold text-text-primary">Tasks &amp; Work Orders Distribution</h2>
                <p className="text-xs text-text-muted mt-0.5">Status breakdown of field and administrative jobs</p>
              </div>
              <span className="text-xs text-text-muted">Total items: {taskWoStages.reduce((acc, cur) => acc + cur.count, 0)}</span>
            </div>
            <PipelineFunnel stages={taskWoStages} emptyLabel="No active tasks or work orders yet" />
          </EntranceCard>
        )}
      </div>

      {/* ══ 7. RECENT ACTIVITY  +  TODAY'S SCHEDULE ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EntranceCard delayMs={180} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">Recent Activity Feed</h2>
              <p className="text-xs text-text-muted mt-0.5">Real-time audit log of team actions</p>
            </div>
            <span className="text-xs text-text-muted">Latest 8 entries</span>
          </div>

          {(recentActivity.data ?? []).length === 0 ? (
            <EmptyState icon={BoltIcon} title="No recent activity yet" />
          ) : (
            <div className="divide-y divide-border/60">
              {(recentActivity.data ?? []).map((entry) => (
                <ActivityTimelineItem
                  key={entry._id}
                  action={entry.action}
                  description={entry.description}
                  createdAt={entry.createdAt}
                />
              ))}
            </div>
          )}
        </EntranceCard>

        {canMeetings && (
          <EntranceCard delayMs={210} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-bold text-text-primary">Today's Schedule</h2>
                <p className="text-xs text-text-muted mt-0.5">Upcoming client calls and team appointments</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-ryze-500/10 text-ryze-600 dark:text-ryze-400">
                {todaysMeetings.length} today
              </span>
            </div>

            {todaysMeetings.length === 0 ? (
              <EmptyState icon={CalendarDaysIcon} title="No meetings scheduled for today" />
            ) : (
              <div className="divide-y divide-border/60">
                {todaysMeetings.map((m) => (
                  <div key={m._id} className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg bg-ryze-500/10 text-ryze-600 dark:text-ryze-400 tabular-nums shrink-0">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {new Date(m.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-primary truncate">{m.title}</p>
                      {(m.assignedStaffName || m.location) && (
                        <p className="text-[11px] text-text-muted mt-0.5 truncate">
                          {[m.assignedStaffName, m.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </EntranceCard>
        )}
      </div>

      {/* ══ 8. CUSTOMER & TEAM OPERATIONS SUMMARY ═════════════════════════ */}
      {(canCustomers || canManagement || canLeads || canTickets) && (
        <EntranceCard delayMs={230} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">Customer &amp; Team Operations</h2>
              <p className="text-xs text-text-muted mt-0.5">Key operational throughput for active period</p>
            </div>
            <span className="text-xs text-text-muted">Live stats</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {canCustomers && (
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">New customers</p>
                <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{customersStats.data?.newToday ?? 0}</p>
              </div>
            )}
            {canLeads && (
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Meetings today</p>
                <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{s.appointmentsToday}</p>
              </div>
            )}
            {canTickets && (
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tickets ({range})</p>
                <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{ticketsStats.data?.total ?? 0}</p>
              </div>
            )}
            {canManagement && (
              <>
                <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Team tasks</p>
                  <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{managementStats.data?.total ?? 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">In progress</p>
                  <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{managementStats.data?.inProgress ?? 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-border/70">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-extrabold text-text-primary tabular-nums mt-1">{managementStats.data?.completed ?? 0}</p>
                </div>
              </>
            )}
          </div>
        </EntranceCard>
      )}

      {/* ══ 9. NATIVE LEADS ANALYTICS (CHANNEL & STATUS) ══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EntranceCard delayMs={260} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">Leads by Channel (Source)</h2>
              <p className="text-xs text-text-muted mt-0.5">Acquisition volume across inbound channels</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-primary tabular-nums">
              {s.totalLeads} total
            </span>
          </div>

          {Object.keys(s.bySource).length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No channel lead data yet" />
          ) : (
            <div className="space-y-3.5">
              {Object.entries(s.bySource).sort(([, a], [, b]) => b - a).map(([src, count]) => {
                const t = LEAD_SOURCE_THEME[src];
                const pct = Math.round((count / maxSource) * 100);
                const share = Math.round((count / (s.totalLeads || 1)) * 100);
                return (
                  <div key={src} className="p-2 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${t?.dot || 'bg-gray-400'} shadow-xs`} />
                        <span className="text-xs font-bold text-text-primary">{t?.label || src}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-text-primary tabular-nums">{count}</span>
                        <span className="text-[11px] text-text-muted tabular-nums font-semibold">{share}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${t?.bar || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </EntranceCard>

        <EntranceCard delayMs={290} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[17px] font-bold text-text-primary">Leads by Status</h2>
              <p className="text-xs text-text-muted mt-0.5">Pipeline stage breakdown</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-primary tabular-nums">
              {totalStatus} total
            </span>
          </div>

          {Object.keys(s.byStatus).length === 0 ? (
            <EmptyState icon={ChartPieIcon} title="No status lead data yet" />
          ) : (
            <>
              {/* Multi-segment visual bar */}
              <div className="flex h-3 rounded-full overflow-hidden mb-5 gap-0.5 shadow-xs">
                {Object.entries(s.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status.toLowerCase()];
                  const pct = (count / totalStatus) * 100;
                  return (
                    <div
                      key={status}
                      className={`h-full transition-all duration-700 ${cfg?.bar || 'bg-gray-300'} first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${pct}%` }}
                      title={`${status}: ${count}`}
                    />
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {Object.entries(s.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status.toLowerCase()];
                  const pct = Math.round((count / maxStatus) * 100);
                  const share = Math.round((count / totalStatus) * 100);
                  return (
                    <div key={status} className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dot || 'bg-gray-300'} shadow-xs`} />
                      <span className="text-xs font-bold text-text-primary capitalize flex-1">{status.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2.5 w-44">
                        <div className="flex-1 h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cfg?.bar || 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-extrabold text-text-primary tabular-nums w-6 text-right">{count}</span>
                        <span className="text-[11px] text-text-muted tabular-nums w-8 text-right font-semibold">{share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </EntranceCard>
      </div>

      {/* ══ 10. CONNECTED DATA & INTEGRATIONS (CONSOLIDATED) ══════════════ */}
      {hasConnectors && (
        <div className="space-y-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-ryze-600 dark:text-ryze-400">
                Connected Data &amp; Integrations
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Real-time synchronized data from connected enterprise CRMs (Zoho, Salesforce, HubSpot)
              </p>
            </div>
            {activeTheme && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${activeTheme.pill}`}>
                {activeTheme.label} Connected
              </span>
            )}
          </div>

          {canConnectors && (
            <EntranceCard delayMs={60} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-bold text-text-primary">Connector Health &amp; Sync Status</h3>
                <span className="text-xs text-text-muted">Real-time status</span>
              </div>
              <div className="divide-y divide-border/60">
                {(connectors.data ?? []).map((c) => (
                  <ConnectorStatusPill
                    key={c._id}
                    name={c.name}
                    syncStatus={c.syncStatus}
                    lastSyncAt={c.lastSyncAt}
                    syncError={c.syncError}
                  />
                ))}
              </div>
            </EntranceCard>
          )}

          {visibleModules.length > 0 && (
            <EntranceCard delayMs={100} className="bg-surface rounded-2xl border border-border shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[17px] font-bold text-text-primary">Synchronized Module Records</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="font-extrabold text-text-primary tabular-nums">{totalCRM.toLocaleString()}</span>
                  <span>total synced records</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
                {visibleModules.map(({ module, count }) => {
                  const ModIcon = getModuleIcon(module);
                  const pct = totalCRM > 0 ? Math.round((count / totalCRM) * 100) : 0;
                  return (
                    <div
                      key={module}
                      className={`bg-surface rounded-xl border ${MODULE_STYLE.border} p-4 flex flex-col justify-between hover:shadow-md hover:border-ryze-400/40 transition-all duration-200 cursor-default group`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg ${MODULE_STYLE.bg} group-hover:scale-105 transition-transform`}>
                          <ModIcon className={`h-4 w-4 ${MODULE_STYLE.icon}`} />
                        </div>
                        <span className={`text-[11px] font-bold ${MODULE_STYLE.icon}`}>{pct}%</span>
                      </div>
                      <div>
                        <p className={`text-xl sm:text-2xl font-extrabold tabular-nums ${MODULE_STYLE.num}`}>{count.toLocaleString()}</p>
                        <p className="text-xs text-text-muted mt-0.5 truncate font-medium">{module}</p>
                      </div>
                      <div className="h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-ryze-600 rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </EntranceCard>
          )}
        </div>
      )}

    </div>
  );
}
