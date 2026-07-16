import { useEffect, useState } from 'react';
import type { FC, SVGProps } from 'react';
import {
  UsersIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon, ArrowTrendingUpIcon,
  BuildingOffice2Icon, BriefcaseIcon, ClipboardDocumentListIcon,
  PhoneIcon, UserGroupIcon, UserPlusIcon, CubeIcon, TruckIcon,
  TagIcon, ReceiptPercentIcon, DocumentIcon, ShoppingCartIcon,
  LifebuoyIcon, LightBulbIcon, BoltIcon, CreditCardIcon,
  ArrowPathIcon, PaperClipIcon, TableCellsIcon, GlobeAltIcon,
  EnvelopeIcon, CurrencyDollarIcon, ChartPieIcon, FolderIcon,
  StarIcon, WrenchScrewdriverIcon, ChartBarIcon, MegaphoneIcon,
  DocumentTextIcon, CalendarIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

/* ── Module icons ─────────────────────────────────────────────── */
const MODULE_ICON_MAP: Record<string, HeroIcon> = {
  Accounts: BuildingOffice2Icon, Companies: BuildingOffice2Icon,
  Contacts: UserGroupIcon, Leads: UserPlusIcon,
  Deals: BriefcaseIcon, Potentials: BriefcaseIcon, Opportunities: BriefcaseIcon,
  Tasks: ClipboardDocumentListIcon, Meetings: CalendarDaysIcon, Events: CalendarDaysIcon,
  Calls: PhoneIcon, Activities: BoltIcon, Campaigns: MegaphoneIcon,
  Notes: DocumentTextIcon, Attachments: PaperClipIcon, Documents: FolderIcon,
  Products: CubeIcon, Vendors: TruckIcon, PriceBooks: TagIcon, Quotes: ReceiptPercentIcon,
  Invoices: DocumentIcon, SalesOrders: ShoppingCartIcon, PurchaseOrders: ShoppingCartIcon,
  Cases: LifebuoyIcon, Tickets: LifebuoyIcon, Solutions: LightBulbIcon,
  Reports: ChartBarIcon, Analytics: ChartPieIcon,
  Payments: CreditCardIcon, Revenue: CurrencyDollarIcon, Subscriptions: ArrowPathIcon,
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

/* ── Module card color palette (cycles) ───────────────────────── */
const MODULE_PALETTE = [
  { icon: 'text-blue-600',    bg: 'bg-blue-100',    border: 'border-blue-200',   num: 'text-blue-700'   },
  { icon: 'text-violet-600',  bg: 'bg-violet-100',  border: 'border-violet-200', num: 'text-violet-700' },
  { icon: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200',num: 'text-emerald-700'},
  { icon: 'text-orange-600',  bg: 'bg-orange-100',  border: 'border-orange-200', num: 'text-orange-700' },
  { icon: 'text-sky-600',     bg: 'bg-sky-100',     border: 'border-sky-200',    num: 'text-sky-700'    },
  { icon: 'text-rose-600',    bg: 'bg-rose-100',    border: 'border-rose-200',   num: 'text-rose-700'   },
  { icon: 'text-teal-600',    bg: 'bg-teal-100',    border: 'border-teal-200',   num: 'text-teal-700'   },
  { icon: 'text-amber-600',   bg: 'bg-amber-100',   border: 'border-amber-200',  num: 'text-amber-700'  },
  { icon: 'text-indigo-600',  bg: 'bg-indigo-100',  border: 'border-indigo-200', num: 'text-indigo-700' },
  { icon: 'text-pink-600',    bg: 'bg-pink-100',    border: 'border-pink-200',   num: 'text-pink-700'   },
];

/* ── Connector branding ───────────────────────────────────────── */
const CONNECTOR_THEME: Record<string, { dot: string; label: string; bar: string; pill: string }> = {
  zoho:       { dot: 'bg-blue-500',   label: 'Zoho CRM',   bar: 'bg-blue-500',   pill: 'bg-blue-100 text-blue-700'   },
  hubspot:    { dot: 'bg-orange-500', label: 'HubSpot',    bar: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700'},
  salesforce: { dot: 'bg-sky-500',    label: 'Salesforce', bar: 'bg-sky-500',    pill: 'bg-sky-100 text-sky-700'     },
  mysql:      { dot: 'bg-teal-500',   label: 'MySQL',      bar: 'bg-teal-500',   pill: 'bg-teal-100 text-teal-700'   },
  postgresql: { dot: 'bg-indigo-500', label: 'PostgreSQL', bar: 'bg-indigo-500', pill: 'bg-indigo-100 text-indigo-700'},
  mongodb:    { dot: 'bg-green-500',  label: 'MongoDB',    bar: 'bg-green-500',  pill: 'bg-green-100 text-green-700' },
  rest:       { dot: 'bg-purple-500', label: 'REST API',   bar: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700'},
};

const STATUS_CONFIG: Record<string, { bar: string; dot: string }> = {
  new:       { bar: 'bg-blue-500',    dot: 'bg-blue-500'    },
  contacted: { bar: 'bg-violet-500',  dot: 'bg-violet-500'  },
  qualified: { bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  lost:      { bar: 'bg-rose-500',    dot: 'bg-rose-500'    },
  converted: { bar: 'bg-teal-500',    dot: 'bg-teal-500'    },
};

/* ── Types ────────────────────────────────────────────────────── */
interface Stats {
  totalCustomers: number; newToday: number; booked: number;
  conversionRate: number; byChannel: Record<string, number>; byStatus: Record<string, number>;
}
interface ModuleInfo { module: string; count: number; }
type CRMModules = Record<string, ModuleInfo[]>;

/* ── Animated counter ─────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, gradient, sub }: {
  label: string; value: string | number; icon: HeroIcon; gradient: string; sub?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/75">{label}</p>
          <p className="text-3xl font-extrabold mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      {/* Decorative circle */}
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
    </div>
  );
}

export default function DashboardPage() {
  const user           = useAuthStore((s) => s.user);
  const activeChannels = useSourceFilterStore((s) => s.activeChannels);

  const [stats, setStats]           = useState<Stats | null>(null);
  const [crmModules, setCrmModules] = useState<CRMModules>({});
  const [isLoading, setIsLoading]   = useState(true);

  const activeChannel = activeChannels.length === 1 ? activeChannels[0] : null;
  const activeTheme   = activeChannel ? CONNECTOR_THEME[activeChannel] : null;

  useEffect(() => {
    if (!user?.tenantId) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (activeChannels.length > 0) params.set('channels', activeChannels.join(','));
    Promise.all([
      api.get(`/api/v1/customers/stats?${params}`),
      api.get(`/api/v1/crm/modules?${params}`),
    ])
      .then(([sr, mr]) => { setStats(sr.data.data); setCrmModules(mr.data.data || {}); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.tenantId, activeChannels]);

  const s = stats ?? { totalCustomers: 0, newToday: 0, booked: 0, conversionRate: 0, byChannel: {}, byStatus: {} };

  const visibleModules: ModuleInfo[] = activeChannel
    ? (crmModules[activeChannel] || [])
    : Object.values(crmModules).flat();

  const totalCRM    = visibleModules.reduce((a, m) => a + m.count, 0);
  const maxStatus   = Math.max(1, ...Object.values(s.byStatus));
  const maxChannel  = Math.max(1, ...Object.values(s.byChannel));
  const totalStatus = Object.values(s.byStatus).reduce((a, b) => a + b, 0) || 1;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded-xl w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-gray-200" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, <span className="font-medium text-gray-700">{user?.firstName} {user?.lastName}</span>
          </p>
        </div>
        {activeTheme && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${activeTheme.pill}`}>
            <span className={`h-2 w-2 rounded-full ${activeTheme.dot} animate-pulse`} />
            {activeTheme.label} · Live
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads" value={s.totalCustomers}
          icon={UsersIcon}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          sub="All time"
        />
        <StatCard
          label="New Today" value={s.newToday}
          icon={ArrowTrendingUpIcon}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          sub={s.newToday > 0 ? '↑ Active today' : 'No new leads yet'}
        />
        <StatCard
          label="Appointments" value={s.booked}
          icon={CalendarIcon}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700"
          sub="Booked"
        />
        <StatCard
          label="Conversion Rate" value={`${s.conversionRate.toFixed(1)}%`}
          icon={ChatBubbleLeftRightIcon}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
          sub="Qualified / Total"
        />
      </div>

      {/* ── CRM Modules grid ── */}
      {visibleModules.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">CRM Modules</h2>
              {activeTheme && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${activeTheme.pill}`}>
                  {activeTheme.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{totalCRM.toLocaleString()}</span>
              <span>total records</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visibleModules.map(({ module, count }, idx) => {
              const palette  = MODULE_PALETTE[idx % MODULE_PALETTE.length];
              const ModIcon  = getModuleIcon(module);
              const pct      = totalCRM > 0 ? Math.round((count / totalCRM) * 100) : 0;
              return (
                <div
                  key={module}
                  className={`bg-white rounded-xl border ${palette.border} p-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${palette.bg}`}>
                      <ModIcon className={`h-4 w-4 ${palette.icon}`} />
                    </div>
                    <span className={`text-xs font-medium ${palette.icon}`}>{pct}%</span>
                  </div>
                  <div>
                    <p className={`text-2xl font-extrabold ${palette.num}`}>{count.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate font-medium">{module}</p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${palette.bg.replace('100','500')} rounded-full`} style={{ width: `${Math.max(4, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom analytics row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Leads by Channel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Leads by Channel</h2>
            <span className="text-xs text-gray-400 font-medium">{s.totalCustomers} total</span>
          </div>
          {Object.keys(s.byChannel).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <ChartBarIcon className="h-10 w-10 mb-2" />
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(s.byChannel)
                .sort(([, a], [, b]) => b - a)
                .map(([ch, count]) => {
                  const t   = CONNECTOR_THEME[ch];
                  const pct = Math.round((count / maxChannel) * 100);
                  return (
                    <div key={ch}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${t?.dot || 'bg-gray-400'}`} />
                          <span className="text-sm font-medium text-gray-700">{t?.label || ch}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                          <span className="text-xs text-gray-400">{Math.round((count / (s.totalCustomers || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
        </div>

        {/* Leads by Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Leads by Status</h2>
            <span className="text-xs text-gray-400 font-medium">{totalStatus} total</span>
          </div>
          {Object.keys(s.byStatus).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <ChartPieIcon className="h-10 w-10 mb-2" />
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden mb-5 gap-0.5">
                {Object.entries(s.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
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
              <div className="space-y-3">
                {Object.entries(s.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const cfg = STATUS_CONFIG[status.toLowerCase()];
                    const pct = Math.round((count / maxStatus) * 100);
                    const share = Math.round((count / totalStatus) * 100);
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dot || 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-600 capitalize flex-1">{status}</span>
                        <div className="flex items-center gap-2 w-40">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${cfg?.bar || 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-gray-900 w-6 text-right">{count}</span>
                          <span className="text-xs text-gray-400 w-8 text-right">{share}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
