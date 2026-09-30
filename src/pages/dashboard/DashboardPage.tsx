import { useMemo, useState } from 'react';
import type { FC, SVGProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UsersIcon, BriefcaseIcon, CurrencyRupeeIcon, UserPlusIcon,
  ClipboardDocumentListIcon, LifebuoyIcon,
  LinkIcon, ExclamationTriangleIcon, BoltIcon,
  PhoneIcon, CalendarDaysIcon, ChartBarIcon, ChartPieIcon,
  BuildingOffice2Icon, DocumentTextIcon, ShoppingCartIcon,
  CubeIcon, TruckIcon, TagIcon, ReceiptPercentIcon, DocumentIcon,
  MegaphoneIcon, PaperClipIcon, TableCellsIcon, GlobeAltIcon, EnvelopeIcon,
  CreditCardIcon, ArrowPathIcon, FolderIcon, StarIcon, WrenchScrewdriverIcon,
  UserGroupIcon, ClockIcon,
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

/* ── Module icons (kept from the previous dashboard — still the CRM
   Modules grid's icon lookup, unchanged) ─────────────────────────────── */
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
const MODULE_STYLE = { icon: 'text-ryze-600 dark:text-ryze-400', bg: 'bg-ryze-600/10', border: 'border-border', num: 'text-text-primary' };

const CONNECTOR_THEME: Record<string, { dot: string; label: string; bar: string; pill: string }> = {
  zoho:       { dot: 'bg-blue-500',   label: 'Zoho CRM',   bar: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-700'   },
  hubspot:    { dot: 'bg-orange-500', label: 'HubSpot',    bar: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700'},
  salesforce: { dot: 'bg-sky-500',    label: 'Salesforce', bar: 'bg-sky-500',    pill: 'bg-sky-100 text-sky-700'     },
  mysql:      { dot: 'bg-teal-500',   label: 'MySQL',      bar: 'bg-teal-500',   pill: 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400'     },
  postgresql: { dot: 'bg-indigo-500', label: 'PostgreSQL', bar: 'bg-indigo-500', pill: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'},
  mongodb:    { dot: 'bg-green-500',  label: 'MongoDB',    bar: 'bg-green-500',  pill: 'bg-success-500/15 text-success-700 dark:text-success-500' },
  rest:       { dot: 'bg-purple-500', label: 'REST API',   bar: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700'},
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
/** Kanban row badge colors — Lead statuses are a fixed system enum, so
 * these reuse STATUS_CONFIG's own color families 1:1 (same palette as the
 * "Leads by Status" chart further down this page). Deal/Task/WorkOrder
 * statuses aren't all fixed enums (Deal stages are tenant-customizable —
 * see deal.schema.ts's own comment), so those go through a keyword
 * classifier instead of an exact-match table below; every branch returns a
 * complete literal class string (never a dynamically-built one — Tailwind's
 * JIT scanner only picks up whole class names present verbatim in source),
 * and an unrecognized/custom status just falls through to KanbanRow's own
 * neutral default. */
const LEAD_BADGE: Record<string, string> = {
  new:               'text-blue-700 dark:text-blue-400 bg-blue-500/10',
  contacted:         'text-violet-700 dark:text-violet-400 bg-violet-500/10',
  qualified:         'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
  meeting_scheduled: 'text-sky-700 dark:text-sky-400 bg-sky-500/10',
  proposal_sent:     'text-amber-700 dark:text-amber-400 bg-amber-500/10',
  negotiation:       'text-orange-700 dark:text-orange-400 bg-orange-500/10',
  won:               'text-teal-700 dark:text-teal-400 bg-teal-500/10',
  converted:         'text-teal-700 dark:text-teal-400 bg-teal-500/10',
  lost:              'text-rose-700 dark:text-rose-400 bg-rose-500/10',
  on_hold:           'text-gray-600 dark:text-gray-400 bg-gray-500/10',
  disqualified:      'text-rose-600 dark:text-rose-400 bg-rose-500/10',
};
function keywordBadgeClass(status: string): string | undefined {
  const s = status.toLowerCase();
  if (/won|complet|clos|book|paid|deliver|done/.test(s))   return 'text-teal-700 dark:text-teal-400 bg-teal-500/10';
  if (/lost|cancel|reject|overdue|fail|breach/.test(s))    return 'text-rose-700 dark:text-rose-400 bg-rose-500/10';
  if (/progress|negotiat|review/.test(s))                  return 'text-orange-700 dark:text-orange-400 bg-orange-500/10';
  if (/schedul|proposal|meeting|quote|sent/.test(s))       return 'text-sky-700 dark:text-sky-400 bg-sky-500/10';
  if (/new|open|draft|qualif|pending|prospect/.test(s))    return 'text-blue-700 dark:text-blue-400 bg-blue-500/10';
  return undefined;
}

const LEAD_SOURCE_THEME: Record<string, { dot: string; label: string; bar: string }> = {
  website:      { dot: 'bg-blue-500',    label: 'Website',      bar: 'bg-blue-500'    },
  landing_page: { dot: 'bg-cyan-500',    label: 'Landing Page', bar: 'bg-cyan-500'    },
  chatbot:      { dot: 'bg-violet-500',  label: 'AI Chatbot',   bar: 'bg-violet-500'  },
  whatsapp:     { dot: 'bg-green-500',   label: 'WhatsApp',     bar: 'bg-green-500'   },
  facebook:     { dot: 'bg-indigo-500',  label: 'Facebook',     bar: 'bg-indigo-500'  },
  google:       { dot: 'bg-red-500',     label: 'Google',       bar: 'bg-red-500'     },
  manual:       { dot: 'bg-gray-400',    label: 'Manual Entry', bar: 'bg-gray-400'    },
  csv:          { dot: 'bg-teal-500',    label: 'CSV Import',   bar: 'bg-teal-500'    },
  api:          { dot: 'bg-sky-500',     label: 'API',          bar: 'bg-sky-500'     },
  referral:     { dot: 'bg-amber-500',   label: 'Referral',     bar: 'bg-amber-500'   },
  other:        { dot: 'bg-slate-400',   label: 'Other',        bar: 'bg-slate-400'   },
};

interface ModuleInfo { module: string; count: number; }
type CRMModules = Record<string, ModuleInfo[]>;

/** null prior (no baseline, or a zero baseline) → no trend shown at all,
 * rather than a fake/Infinity% delta. */
function computeTrend(current: number, prior: number | null | undefined): StatCardTrend | null {
  if (prior === null || prior === undefined || prior === 0) return null;
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
  const user           = useAuthStore((s) => s.user);
  const activeChannels = useSourceFilterStore((s) => s.activeChannels);
  const currentBranch  = useBranchStore((s) => s.currentBranch);
  const flags          = useFeatureFlagsStore((s) => s.flags);

  const [range, setRange] = useState<DashboardRange>('month');
  const [customFrom, setCustomFrom] = useState<string | undefined>();
  const [customTo, setCustomTo]     = useState<string | undefined>();
  const onRangeChange = (r: DashboardRange, from?: string, to?: string) => {
    setRange(r);
    setCustomFrom(from);
    setCustomTo(to);
  };

  /* ── Permission + tenant-feature-flag gates — same dual system Sidebar.tsx
     uses (canNav && canNavFlag). A widget only ever renders when BOTH the
     role permission AND the tenant's feature flag allow it. ── */
  const canCustomers  = usePermission('fs.customers.view')        && flags.fs_customers;
  const canLeads      = usePermission('native_crm.leads.view')    && flags.fs_leads;
  const canDeals       = usePermission('native_crm.deals.view')    && flags.native_deals;
  const canTasks       = usePermission('native_crm.tasks.view')    && flags.native_tasks;
  const canTickets     = usePermission('native_crm.tickets.view')  && flags.native_tickets;
  const canWorkorders  = usePermission('fs.workorders.view')       && flags.fs_workorders;
  const canConnectors  = usePermission('connector.view')           && flags.nav_connectors;
  const canManagement  = usePermission('native_crm.activities.view') && flags.nav_myCrm;
  const canInvoices    = usePermission('fs.invoices.view')         && flags.fs_invoices;
  const canMeetings    = usePermission('native_crm.meetings.view') && flags.native_meetings;
  const canInviteUser  = usePermission('users.create');

  const canAttention = useAnyPermission(
    'native_crm.tasks.view', 'native_crm.tickets.view', 'native_crm.leads.view',
    'connector.view', 'fs.workorders.view',
  );
  const canPipeline  = useAnyPermission('native_crm.leads.view', 'native_crm.deals.view');
  const canTaskWo    = canTasks || canWorkorders;

  /* ── Data — every hook fires unconditionally (hooks can't be
     conditional); an unpermitted widget's query is harmless because the
     backend independently enforces requirePermission + requireModuleEnabled
     on every one of these endpoints regardless of what the frontend asked
     for — see this session's RBAC audit for why that's the real boundary. ── */
  const customersStats = useCustomersStatsQuery(range, customFrom, customTo);
  const leadsStats      = useLeadsStatsQuery(range, customFrom, customTo);
  const dealsStats      = useDealsStatsQuery(range, customFrom, customTo);
  const tasksStats      = useTasksStatsQuery(range, customFrom, customTo);
  const ticketsStats    = useTicketsStatsQuery(range, customFrom, customTo);
  const workordersStats = useWorkordersStatsQuery(range, customFrom, customTo);
  const managementStats = useManagementActivityStatsQuery(range, customFrom, customTo);
  const dashboardStats  = useDashboardStatsQuery(range, customFrom, customTo);
  const connectors      = useConnectorsQuery();
  const unassignedLeads = useUnassignedLeadsCountQuery();
  const ticketsWarning  = useTicketsSlaCountQuery('warning');
  const ticketsBreached = useTicketsSlaCountQuery('breached');

  /* ── Operations Overview (Kanban) + Recent Activity + Today's Schedule —
     Phase 1.5 additions. Same unconditional-fetch convention as above. ── */
  const recentLeads      = useLeadsQuery({ limit: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const recentDeals      = useDealsQuery({ limit: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const recentTasks      = useTasksListQuery({ limit: 5 });
  const recentWorkorders = useWorkordersListQuery({ limit: 5 });
  const recentActivity   = useRecentActivityQuery(10);
  const upcomingMeetings = useMeetingsQuery({ upcoming: true, limit: 20 });

  const activeChannel = activeChannels.length === 1 ? activeChannels[0] : null;
  const activeTheme   = activeChannel ? CONNECTOR_THEME[activeChannel] : null;

  /* ── Legacy CRM Modules grid data — connector-synced record counts,
     unrelated to role/permission scoping (see crm-record.service.ts).
     Converted from the old plain useState/useEffect to react-query, same
     convention as everything else on this page now. ── */
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

  /* ── Sales / Pipeline funnel — a simplified 3-stage view (Leads →
     Qualified → Deals), not the full tenant-customizable pipeline (that's
     what the Leads/Deals pages themselves already show in full detail). ── */
  const qualifiedCount = useMemo(() => {
    const entry = (leadsStats.data?.pipeline ?? []).find((p) => p._id === 'qualified');
    return entry?.count ?? 0;
  }, [leadsStats.data]);
  const pipelineStages = useMemo(() => [
    { key: 'leads',     label: 'Leads',     count: leadsStats.data?.total ?? 0, colorClass: 'bg-ryze-500' },
    { key: 'qualified', label: 'Qualified', count: qualifiedCount,               colorClass: 'bg-blue-500' },
    { key: 'deals',     label: 'Deals',     count: dealsStats.data?.total ?? 0, colorClass: 'bg-success-500' },
  ], [leadsStats.data, dealsStats.data, qualifiedCount]);

  const taskWoStages = useMemo(() => {
    const rows: { key: string; label: string; count: number; colorClass?: string }[] = [];
    if (canTasks && tasksStats.data) {
      Object.entries(tasksStats.data.byStatus).forEach(([k, v]) => rows.push({ key: `task-${k}`, label: `Task · ${k.replace(/_/g, ' ')}`, count: v, colorClass: 'bg-ryze-500' }));
    }
    if (canWorkorders && workordersStats.data) {
      Object.entries(workordersStats.data.byStatus).forEach(([k, v]) => rows.push({ key: `wo-${k}`, label: `Work Order · ${k.replace(/_/g, ' ')}`, count: v, colorClass: 'bg-blue-500' }));
    }
    return rows;
  }, [canTasks, tasksStats.data, canWorkorders, workordersStats.data]);

  const failedConnectors = (connectors.data ?? []).filter((c) => c.syncStatus === 'failed').length;
  /* ── Data-source separation: Native CRM (everything above) vs Connected
     Data (this tenant's connector sync status + the connector-synced
     "CRM Modules" breakdown) — two genuinely different data domains that
     must never be summed together (see this page's own native vs.
     connector KPI split below). No connectors configured → the whole
     Connected Data section is omitted outright, not shown as an empty
     shell. ── */
  const hasConnectors = (connectors.data ?? []).length > 0;

  /* ── Operations Overview Kanban rows — each list hook already returns its
     5 most-recent records; just reshape into KanbanColumn's generic
     {id,label,badge} row shape. No detail-view route exists yet for
     Leads/Deals/Tasks (they open in-page, not at a dedicated URL), so
     those rows render unlinked; Work Orders does have one. ── */
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

  /* ── Today's Schedule — client-side filter of the "upcoming" meetings
     list down to just today's local calendar date (see meetings.queries.ts
     for why this isn't a backend param yet). ── */
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
    <div className="space-y-8">

      {/* ══ 1. TODAY'S OVERVIEW ═════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[30px] leading-tight font-bold text-text-primary">
            {greeting()}, <span>{user?.firstName}</span>
          </h1>
          <p className="text-sm text-text-muted mt-0.5">Here's what's happening across your workspace</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTheme && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${activeTheme.pill}`}>
              <span className={`h-2 w-2 rounded-full ${activeTheme.dot} animate-pulse`} />
              {activeTheme.label} · Live
            </div>
          )}
          <DateRangeSwitcher value={range} customFrom={customFrom} customTo={customTo} onChange={onRangeChange} />
        </div>
      </div>

      {/* ══ NATIVE CRM ═════════════════════════════════════════════════
         LeadRyze's own business data — every widget from here through the
         two charts at the end of this block reads exclusively from native
         CRM/Field Service endpoints, never the connector-synced records
         below. Nothing in this section is ever combined with a Connected
         Data number. ══════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-ryze-600 dark:text-ryze-400">Native CRM</h2>
        <p className="text-xs text-text-muted mt-0.5">LeadRyze's own business data</p>
      </div>

      <div className="flex flex-wrap divide-x divide-border bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {canCustomers && (
          <StatCard
            label="Customers" icon={UsersIcon} delayMs={0}
            value={customersStats.data?.totalCustomers ?? 0}
            trend={computeTrend(customersStats.data?.totalCustomers ?? 0, customersStats.data?.priorTotal)}
            trendLabel={`vs prior ${range}`}
            sparklineData={customersStats.data?.daily}
          />
        )}
        {canLeads && (
          <StatCard
            label="Leads" icon={UserPlusIcon} delayMs={60}
            value={leadsStats.data?.total ?? 0}
            trend={computeTrend(leadsStats.data?.total ?? 0, leadsStats.data?.priorTotal)}
            trendLabel={`vs prior ${range}`}
            sparklineData={leadsStats.data?.daily}
          />
        )}
        {canDeals && (
          <StatCard
            label="Deals" icon={BriefcaseIcon} delayMs={120}
            value={dealsStats.data?.total ?? 0}
            trend={computeTrend(dealsStats.data?.total ?? 0, dealsStats.data?.priorTotal)}
            trendLabel={`vs prior ${range}`}
            sparklineData={dealsStats.data?.daily}
          />
        )}
        {canDeals && (
          <StatCard
            label="Revenue" icon={CurrencyRupeeIcon} format="currency" delayMs={180}
            value={dealsStats.data?.totalValue ?? 0}
            trend={computeTrend(dealsStats.data?.totalValue ?? 0, dealsStats.data?.priorTotalValue)}
            trendLabel={`vs prior ${range}`}
            sparklineData={dealsStats.data?.daily}
          />
        )}
      </div>

      {/* ══ 2. ATTENTION REQUIRED ═══════════════════════════════════════ */}
      {canAttention && (
        <EntranceCard delayMs={60} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
          <h2 className="text-[17px] font-semibold text-text-primary mb-1">Attention Required</h2>
          <div className="divide-y divide-border">
            {canTasks && (tasksStats.data?.overdue ?? 0) > 0 && (
              <AttentionItem icon={ExclamationTriangleIcon} severity="critical" to="/native-crm/tasks"
                label={`${tasksStats.data!.overdue} overdue task${tasksStats.data!.overdue === 1 ? '' : 's'}`} />
            )}
            {canWorkorders && (workordersStats.data?.overdue ?? 0) > 0 && (
              <AttentionItem icon={ExclamationTriangleIcon} severity="critical" to="/native-crm/workorders"
                label={`${workordersStats.data!.overdue} overdue work order${workordersStats.data!.overdue === 1 ? '' : 's'}`} />
            )}
            {canTickets && (ticketsBreached.data ?? 0) > 0 && (
              <AttentionItem icon={LifebuoyIcon} severity="critical" to="/native-crm/tickets"
                label={`${ticketsBreached.data} ticket${ticketsBreached.data === 1 ? '' : 's'} breached SLA`} />
            )}
            {canTickets && (ticketsWarning.data ?? 0) > 0 && (
              <AttentionItem icon={LifebuoyIcon} severity="warning" to="/native-crm/tickets"
                label={`${ticketsWarning.data} ticket${ticketsWarning.data === 1 ? '' : 's'} approaching SLA`} />
            )}
            {canLeads && (unassignedLeads.data ?? 0) > 0 && (
              <AttentionItem icon={UserPlusIcon} severity="warning" to="/native-crm/leads"
                label={`${unassignedLeads.data} unassigned lead${unassignedLeads.data === 1 ? '' : 's'}`} />
            )}
            {canConnectors && failedConnectors > 0 && (
              <AttentionItem icon={LinkIcon} severity="critical" to="/connectors"
                label={`${failedConnectors} connector sync issue${failedConnectors === 1 ? '' : 's'}`} />
            )}
            {!(canTasks && (tasksStats.data?.overdue ?? 0) > 0)
              && !(canWorkorders && (workordersStats.data?.overdue ?? 0) > 0)
              && !(canTickets && ((ticketsBreached.data ?? 0) > 0 || (ticketsWarning.data ?? 0) > 0))
              && !(canLeads && (unassignedLeads.data ?? 0) > 0)
              && !(canConnectors && failedConnectors > 0) && (
              <p className="text-sm text-text-muted py-3">Nothing needs your attention right now.</p>
            )}
          </div>
        </EntranceCard>
      )}

      {/* ══ 3. QUICK ACTIONS ═════════════════════════════════════════════ */}
      <EntranceCard delayMs={90}>
        <h2 className="text-[17px] font-semibold text-text-primary mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {canCustomers && <QuickActionButton icon={UsersIcon} label="New Customer" to="/native-crm/customers" />}
          {canLeads && <QuickActionButton icon={UserPlusIcon} label="New Lead" to="/native-crm/leads" />}
          {canDeals && <QuickActionButton icon={BriefcaseIcon} label="New Deal" to="/native-crm/deals" />}
          {canWorkorders && <QuickActionButton icon={ClipboardDocumentListIcon} label="New Work Order" to="/native-crm/workorders" />}
          {canInvoices && <QuickActionButton icon={DocumentIcon} label="New Invoice" to="/native-crm/invoices" />}
          {canInviteUser && <QuickActionButton icon={UserGroupIcon} label="Invite User" to="/settings" />}
        </div>
      </EntranceCard>

      {/* ══ 4. OPERATIONS OVERVIEW ═══════════════════════════════════════ */}
      {(canLeads || canDeals || canTasks || canWorkorders) && (
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary mb-3">Operations Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {canLeads && (
              <KanbanColumn
                title="Leads" icon={UserPlusIcon} count={leadsStats.data?.allTimeTotal ?? 0}
                rows={leadRows} viewAllTo="/native-crm/leads" viewAllLabel="View all leads"
                emptyLabel="No leads yet" delayMs={120}
              />
            )}
            {canDeals && (
              <KanbanColumn
                title="Deals" icon={BriefcaseIcon} count={dealsStats.data?.allTimeTotal ?? 0}
                rows={dealRows} viewAllTo="/native-crm/deals" viewAllLabel="View all deals"
                emptyLabel="No deals yet" delayMs={150}
              />
            )}
            {canTasks && (
              <KanbanColumn
                title="Tasks" icon={ClipboardDocumentListIcon} count={tasksStats.data?.allTimeTotal ?? 0}
                rows={taskRows} viewAllTo="/native-crm/tasks" viewAllLabel="View all tasks"
                emptyLabel="No tasks yet" delayMs={180}
              />
            )}
            {canWorkorders && (
              <KanbanColumn
                title="Work Orders" icon={WrenchScrewdriverIcon} count={workordersStats.data?.allTimeTotal ?? 0}
                rows={workorderRows} viewAllTo="/native-crm/workorders" viewAllLabel="View all work orders"
                emptyLabel="No work orders yet" delayMs={210}
              />
            )}
          </div>
        </div>
      )}

      {/* ══ 5. SALES / PIPELINE  +  TASKS / WORK ORDERS ═══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canPipeline && (
          <EntranceCard delayMs={120} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
            <h2 className="text-[17px] font-semibold text-text-primary mb-4">Sales Pipeline</h2>
            <PipelineFunnel stages={pipelineStages} emptyLabel="No leads yet" />
          </EntranceCard>
        )}
        {canTaskWo && (
          <EntranceCard delayMs={150} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
            <h2 className="text-[17px] font-semibold text-text-primary mb-4">Tasks &amp; Work Orders</h2>
            <PipelineFunnel stages={taskWoStages} emptyLabel="No tasks or work orders yet" />
          </EntranceCard>
        )}
      </div>

      {/* ══ 6. RECENT ACTIVITY  +  TODAY'S SCHEDULE ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EntranceCard delayMs={210} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
          <h2 className="text-[17px] font-semibold text-text-primary mb-3">Recent Activity</h2>
          {(recentActivity.data ?? []).length === 0 ? (
            <EmptyState icon={BoltIcon} title="No recent activity yet" />
          ) : (
            <div className="divide-y divide-border">
              {(recentActivity.data ?? []).map((entry) => (
                <ActivityTimelineItem key={entry._id} action={entry.action} description={entry.description} createdAt={entry.createdAt} />
              ))}
            </div>
          )}
        </EntranceCard>

        {canMeetings && (
          <EntranceCard delayMs={240} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
            <h2 className="text-[17px] font-semibold text-text-primary mb-3">Today's Schedule</h2>
            {todaysMeetings.length === 0 ? (
              <EmptyState icon={CalendarDaysIcon} title="No meetings scheduled today" />
            ) : (
              <div className="divide-y divide-border">
                {todaysMeetings.map((m) => (
                  <div key={m._id} className="flex items-center gap-3 py-2.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-ryze-600 dark:text-ryze-400 tabular-nums shrink-0 w-20">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {new Date(m.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">{m.title}</p>
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

      {/* ══ 7. CUSTOMER / TEAM ACTIVITY ═══════════════════════════════════ */}
      {(canCustomers || canManagement || canLeads || canTickets) && (
        <EntranceCard delayMs={210} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
          <h2 className="text-[17px] font-semibold text-text-primary mb-4">Customer &amp; Team Activity</h2>
          <div className="flex flex-wrap gap-6">
            {canCustomers && (
              <div>
                <p className="text-[13px] font-medium text-text-muted">New customers</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{customersStats.data?.newToday ?? 0}</p>
              </div>
            )}
            {canLeads && (
              <div>
                <p className="text-[13px] font-medium text-text-muted">Meetings today</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{s.appointmentsToday}</p>
              </div>
            )}
            {canTickets && (
              <div>
                <p className="text-[13px] font-medium text-text-muted">Tickets ({range})</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{ticketsStats.data?.total ?? 0}</p>
              </div>
            )}
            {canManagement && (
              <>
                <div>
                  <p className="text-[13px] font-medium text-text-muted">Team activities</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums">{managementStats.data?.total ?? 0}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-text-muted">In progress</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums">{managementStats.data?.inProgress ?? 0}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-text-muted">Completed</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums">{managementStats.data?.completed ?? 0}</p>
                </div>
              </>
            )}
          </div>
        </EntranceCard>
      )}

      {/* ══ 8. NATIVE LEADS ANALYTICS ═════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EntranceCard delayMs={270} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-semibold text-text-primary">Leads by Channel</h2>
            <span className="text-xs text-text-muted font-medium tabular-nums">{s.totalLeads} total</span>
          </div>
          {Object.keys(s.bySource).length === 0 ? (
            <EmptyState icon={ChartBarIcon} title="No data yet" />
          ) : (
            <div className="space-y-4">
              {Object.entries(s.bySource).sort(([, a], [, b]) => b - a).map(([src, count]) => {
                const t = LEAD_SOURCE_THEME[src];
                const pct = Math.round((count / maxSource) * 100);
                return (
                  <div key={src}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${t?.dot || 'bg-gray-400'}`} />
                        <span className="text-sm font-medium text-text-primary">{t?.label || src}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary tabular-nums">{count}</span>
                        <span className="text-xs text-text-muted tabular-nums">{Math.round((count / (s.totalLeads || 1)) * 100)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${t?.bar || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </EntranceCard>

        <EntranceCard delayMs={300} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-semibold text-text-primary">Leads by Status</h2>
            <span className="text-xs text-text-muted font-medium tabular-nums">{totalStatus} total</span>
          </div>
          {Object.keys(s.byStatus).length === 0 ? (
            <EmptyState icon={ChartPieIcon} title="No data yet" />
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-5 gap-0.5">
                {Object.entries(s.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status.toLowerCase()];
                  const pct = (count / totalStatus) * 100;
                  return (
                    <div key={status} className={`h-full transition-all duration-700 ${cfg?.bar || 'bg-gray-300'} first:rounded-l-full last:rounded-r-full`} style={{ width: `${pct}%` }} title={`${status}: ${count}`} />
                  );
                })}
              </div>
              <div className="space-y-3">
                {Object.entries(s.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status.toLowerCase()];
                  const pct = Math.round((count / maxStatus) * 100);
                  const share = Math.round((count / totalStatus) * 100);
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dot || 'bg-gray-300'}`} />
                      <span className="text-sm text-text-muted capitalize flex-1">{status}</span>
                      <div className="flex items-center gap-2 w-40">
                        <div className="flex-1 h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cfg?.bar || 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-bold text-text-primary tabular-nums w-6 text-right">{count}</span>
                        <span className="text-xs text-text-muted tabular-nums w-8 text-right">{share}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </EntranceCard>
      </div>

      {/* ══ CONNECTED DATA ═════════════════════════════════════════════
         Data synchronized from this tenant's connected platforms (Zoho,
         Salesforce, etc.) — a completely separate data domain from Native
         CRM above. Never merged into a Native CRM number (e.g. a connector
         "Deals" count is not added to the native Deals count anywhere on
         this page). Omitted entirely — not shown empty — when the tenant
         has no active connectors. ══════════════════════════════════════ */}
      {hasConnectors && (
        <div className="space-y-8 pt-4 border-t border-border">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-ryze-600 dark:text-ryze-400">Connected Data</h2>
            <p className="text-xs text-text-muted mt-0.5">Data synchronized from your connected platforms</p>
          </div>

          {canConnectors && (
            <EntranceCard delayMs={60} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
              <h3 className="text-[17px] font-semibold text-text-primary mb-2">Connector Health</h3>
              <div className="divide-y divide-border">
                {(connectors.data ?? []).map((c) => (
                  <ConnectorStatusPill key={c._id} name={c.name} syncStatus={c.syncStatus} lastSyncAt={c.lastSyncAt} syncError={c.syncError} />
                ))}
              </div>
            </EntranceCard>
          )}

          {visibleModules.length > 0 && (
            <EntranceCard delayMs={120} className="bg-surface rounded-2xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[17px] font-semibold text-text-primary">Synced Modules</h3>
                  {activeTheme && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${activeTheme.pill}`}>{activeTheme.label}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-text-muted">
                  <span className="font-semibold text-text-primary tabular-nums">{totalCRM.toLocaleString()}</span>
                  <span>total records</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {visibleModules.map(({ module, count }) => {
                  const ModIcon = getModuleIcon(module);
                  const pct = totalCRM > 0 ? Math.round((count / totalCRM) * 100) : 0;
                  return (
                    <div key={module} className={`bg-surface rounded-xl border ${MODULE_STYLE.border} p-4 flex flex-col gap-3 hover:shadow-md transition-all duration-200 cursor-default`}>
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${MODULE_STYLE.bg}`}>
                          <ModIcon className={`h-4 w-4 ${MODULE_STYLE.icon}`} />
                        </div>
                        <span className={`text-xs font-medium ${MODULE_STYLE.icon}`}>{pct}%</span>
                      </div>
                      <div>
                        <p className={`text-2xl font-bold tabular-nums ${MODULE_STYLE.num}`}>{count.toLocaleString()}</p>
                        <p className="text-xs text-text-muted mt-0.5 truncate font-medium">{module}</p>
                      </div>
                      <div className="h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
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
