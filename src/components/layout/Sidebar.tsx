import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { FC, SVGProps } from 'react';
import {
  HomeIcon,
  UsersIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LinkIcon,
  BookOpenIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDoubleRightIcon,
  // Module-specific icons
  BuildingOffice2Icon,
  BriefcaseIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  PhoneIcon,
  UserGroupIcon,
  UserPlusIcon,
  CubeIcon,
  TruckIcon,
  TagIcon,
  ReceiptPercentIcon,
  DocumentIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  LifebuoyIcon,
  LightBulbIcon,
  ClockIcon,
  BoltIcon,
  CreditCardIcon,
  ArrowPathIcon,
  PaperClipIcon,
  TableCellsIcon,
  Squares2X2Icon,
  BuildingStorefrontIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  FolderIcon,
  StarIcon,
  WrenchScrewdriverIcon,
  AdjustmentsHorizontalIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import { NATIVE_MODULES } from '../../config/native-crm.config';
import { UserCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';

const FIELD_SERVICE_MODULES = [
  { key: 'leads',      label: 'Leads',      icon: UserPlusIcon,          color: '#7c3aed' },
  { key: 'deals',      label: 'Deals',      icon: BriefcaseIcon,         color: '#2563eb' },
  { key: 'categories', label: 'Categories', icon: TagIcon,               color: '#8b5cf6' },
  { key: 'services',   label: 'Services',   icon: WrenchScrewdriverIcon, color: '#0ea5e9' },
  { key: 'teams',      label: 'Teams',      icon: UserGroupIcon,         color: '#10b981' },
  { key: 'staffs',     label: 'Staffs',     icon: UserCircleIcon,        color: '#f97316' },
  { key: 'customers',  label: 'Customers',  icon: UsersIcon,             color: '#6366f1' },
  { key: 'sites',      label: 'Sites',      icon: MapPinIcon,            color: '#ef4444' },
  { key: 'parts',      label: 'Parts',      icon: CubeIcon,              color: '#14b8a6' },
  { key: 'quotations', label: 'Quotations', icon: DocumentTextIcon,      color: '#3b82f6' },
  { key: 'workorders', label: 'Work Orders',icon: ClipboardDocumentListIcon, color: '#f59e0b' },
  { key: 'contracts',  label: 'Contracts',  icon: DocumentIcon,          color: '#7c3aed' },
  { key: 'invoices',   label: 'Invoices',   icon: CurrencyDollarIcon,    color: '#16a34a' },
  { key: 'receipts',   label: 'Receipts',   icon: ReceiptPercentIcon,    color: '#059669' },
  { key: 'expenses',   label: 'Expenses',   icon: CreditCardIcon,        color: '#f97316' },
  { key: 'activities', label: 'Activities', icon: BoltIcon,              color: '#8b5cf6' },
  { key: 'calendar',   label: 'Calendar',   icon: CalendarDaysIcon,      color: '#0ea5e9' },
  { key: 'products',   label: 'Products',   icon: CubeIcon,              color: '#0d9488' },
  { key: 'assets',     label: 'Assets',     icon: WrenchScrewdriverIcon, color: '#6366f1' },
  { key: 'vehicles',   label: 'Vehicles',   icon: TruckIcon,             color: '#0284c7' },
  // { key: 'branches',           label: 'Branches',         icon: BuildingOffice2Icon,       color: '#6366f1' },
  { key: 'settings',          label: 'FS Settings',      icon: Cog6ToothIcon,             color: '#64748b' },
 // { key: 'settings/notifications', label: 'Notification Settings', icon: BellAlertIcon,   color: '#0ea5e9' },
 // { key: 'message-history',   label: 'Message History',  icon: EnvelopeIcon,              color: '#10b981' },
   { key: 'native-logs',       label: 'Native Logs',      icon: ClipboardDocumentListIcon, color: '#64748b' },
  { key: 'custom-fields',     label: 'Custom Fields',    icon: AdjustmentsHorizontalIcon, color: '#7c3aed' },
  { key: 'template-designer', label: 'PDF Designer',     icon: DocumentTextIcon,          color: '#db2777' },
] as const;

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

// ── Exact module-name → icon map ──────────────────────────────────────────────
const MODULE_ICON_MAP: Record<string, HeroIcon> = {
  Accounts:      BuildingOffice2Icon,
  Companies:     BuildingOffice2Icon,
  Contacts:      UserGroupIcon,
  Leads:         UserPlusIcon,
  Deals:         BriefcaseIcon,
  Potentials:    BriefcaseIcon,
  Opportunities: BriefcaseIcon,
  Tasks:         ClipboardDocumentListIcon,
  Meetings:      CalendarDaysIcon,
  Events:        CalendarDaysIcon,
  Calls:         PhoneIcon,
  Activities:    BoltIcon,
  Campaigns:     MegaphoneIcon,
  EmailCampaigns:MegaphoneIcon,
  Notes:         DocumentTextIcon,
  Attachments:   PaperClipIcon,
  Documents:     FolderIcon,
  Files:         FolderIcon,
  Products:      CubeIcon,
  Vendors:       TruckIcon,
  PriceBooks:    TagIcon,
  Quotes:        ReceiptPercentIcon,
  Invoices:      DocumentIcon,
  SalesOrders:   ShoppingCartIcon,
  PurchaseOrders:ShoppingBagIcon,
  Orders:        ShoppingCartIcon,
  Cases:         LifebuoyIcon,
  Tickets:       LifebuoyIcon,
  Solutions:     LightBulbIcon,
  DealHistory:   ClockIcon,
  History:       ClockIcon,
  Reports:       ChartBarIcon,
  Analytics:     ChartPieIcon,
  Dashboards:    Squares2X2Icon,
  Payments:      CreditCardIcon,
  Revenue:       CurrencyDollarIcon,
  Subscriptions: ArrowPathIcon,
  Users:         UsersIcon,
  Customers:     UsersIcon,
  Members:       UsersIcon,
  Partners:      BuildingStorefrontIcon,
  Competitors:   StarIcon,
  Integrations:  WrenchScrewdriverIcon,
  Webforms:      GlobeAltIcon,
  EmailTemplates:EnvelopeIcon,
};

function getModuleIcon(moduleName: string): HeroIcon {
  if (MODULE_ICON_MAP[moduleName]) return MODULE_ICON_MAP[moduleName];
  const n = moduleName.toLowerCase();
  if (/account|company|org|firm/i.test(n))          return BuildingOffice2Icon;
  if (/deal|opportunit|pipeline|prospect/i.test(n)) return BriefcaseIcon;
  if (/task|todo|action|checklist/i.test(n))        return ClipboardDocumentListIcon;
  if (/meet|event|calendar|schedule|appointment/i.test(n)) return CalendarDaysIcon;
  if (/call|phone|ring|dial/i.test(n))              return PhoneIcon;
  if (/note|comment|remark|memo/i.test(n))          return DocumentTextIcon;
  if (/campaign|market|blast|newsletter/i.test(n))  return MegaphoneIcon;
  if (/product|item|catalog|sku|inventory/i.test(n))return CubeIcon;
  if (/vendor|supplier|partner|distributor/i.test(n))return TruckIcon;
  if (/invoice|bill|receipt/i.test(n))              return DocumentIcon;
  if (/order|purchase|buy|sale/i.test(n))           return ShoppingCartIcon;
  if (/quote|proposal|estimate/i.test(n))           return ReceiptPercentIcon;
  if (/case|ticket|support|issue|complaint/i.test(n))return LifebuoyIcon;
  if (/user|member|person|contact|lead|people/i.test(n)) return UserGroupIcon;
  if (/history|log|audit|trail|activity/i.test(n)) return ClockIcon;
  if (/report|analytic|stat|chart|metric/i.test(n)) return ChartBarIcon;
  if (/payment|transact|money|financ|billing/i.test(n)) return CreditCardIcon;
  if (/subscript|renew|recurring/i.test(n))        return ArrowPathIcon;
  if (/document|file|attach|folder/i.test(n))      return FolderIcon;
  if (/price|book|rate|tier/i.test(n))             return TagIcon;
  if (/web|site|form|online/i.test(n))             return GlobeAltIcon;
  if (/email|mail|message/i.test(n))               return EnvelopeIcon;
  if (/solution|knowledge|answer|help/i.test(n))   return LightBulbIcon;
  if (/revenue|currenc|earning|income/i.test(n))   return CurrencyDollarIcon;
  if (/competitor|rival/i.test(n))                 return StarIcon;
  if (/integration|connect|plugin/i.test(n))       return WrenchScrewdriverIcon;
  return TableCellsIcon;
}

const CONNECTOR_COLOR: Record<string, string> = {
  zoho:       'bg-blue-500',
  hubspot:    'bg-orange-500',
  salesforce: 'bg-sky-500',
  rest:       'bg-purple-500',
  mysql:      'bg-teal-500',
  postgresql: 'bg-indigo-500',
  mongodb:    'bg-green-500',
};

interface ModuleInfo { module: string; count: number; }
type CRMModules = Record<string, ModuleInfo[]>;

const staticNav = [
  { to: '/dashboard',  icon: HomeIcon,                   label: 'Dashboard',      flagKey: 'nav_dashboard',  permKey: ''               },
  { to: '/customers',  icon: UsersIcon,                  label: 'Customers',      flagKey: 'nav_customers',  permKey: 'customers.view' },
  { to: '/bot-hub',    icon: CpuChipIcon,                label: 'Bot Hub',        flagKey: 'nav_botHub',     permKey: 'bot.view'       },
  { to: '/campaigns',  icon: MegaphoneIcon,              label: 'Campaigns',      flagKey: 'nav_campaigns',  permKey: 'campaigns.view' },
  { to: '/templates',  icon: DocumentTextIcon,           label: 'Templates',      flagKey: 'nav_templates',  permKey: 'templates.view' },
  { to: '/analytics',  icon: ChartBarIcon,               label: 'Analytics',      flagKey: 'nav_analytics',  permKey: 'analytics.view' },
  { to: '/knowledge',  icon: BookOpenIcon,               label: 'Knowledge Base', flagKey: 'nav_knowledge',  permKey: 'knowledge.view' },
  { to: '/logs',       icon: ClipboardDocumentCheckIcon, label: 'Logs',           flagKey: 'nav_logs',       permKey: 'logs.view'      },
  { to: '/connectors', icon: LinkIcon,                   label: 'Connectors',     flagKey: 'nav_connectors', permKey: 'connector.view' },
  { to: '/settings',   icon: Cog6ToothIcon,              label: 'Settings',       flagKey: 'nav_settings',   permKey: ''               },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function _hasWildcard(perms: string[], key: string): boolean {
  if (!key) return true;
  if (perms.includes(key)) return true;
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    if (perms.includes(parts.slice(0, i).join('.') + '.*')) return true;
  }
  return false;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { token, user, permissions } = useAuthStore();
  const location                     = useLocation();
  const { activeChannels }           = useSourceFilterStore();
  const { flags, loadFlags }         = useFeatureFlagsStore();

  // SUPER_ADMIN / TENANT_ADMIN / null permissions → full access
  const isFullAccess = !user || user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || permissions === null;
  const canNav = (permKey: string) => !permKey || isFullAccess || _hasWildcard(permissions ?? [], permKey);

  useEffect(() => {
    if (token) loadFlags();
  }, [token, location.pathname]);

  const [crmModules,    setCrmModules]    = useState<CRMModules>({});
  const [crmOpen,          setCrmOpen]          = useState(true);
  const [myCrmOpen,        setMyCrmOpen]        = useState(true);
  const [nativeCrmOpen,    setNativeCrmOpen]    = useState(true);
  const [fieldServiceOpen, setFieldServiceOpen] = useState(true);
  const [nativeCounts,     setNativeCounts]     = useState<Record<string, number>>({});
  const [fsCounts,         setFsCounts]         = useState<Record<string, number>>({});
  const [customModules,    setCustomModules]    = useState<{ _id: string; slug: string; name: string; icon: string; color: string; showInSidebar: boolean }[]>([]);
  const [customModulesOpen, setCustomModulesOpen] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.get('/api/v1/crm/modules')
      .then((r: { data: { data: CRMModules } }) => setCrmModules(r.data.data || {}))
      .catch(() => {});
    api.get('/api/v1/native-crm/stats')
      .then((r: { data: { data: Record<string, number> } }) => setNativeCounts(r.data.data || {}))
      .catch(() => {});
    api.get('/api/v1/native-crm/fs-counts')
      .then((r: { data: { data: Record<string, number> } }) => setFsCounts(r.data.data || {}))
      .catch(() => {});
    api.get('/api/v1/custom-modules')
      .then((r: { data: { data: any[] } }) => setCustomModules(r.data.data || []))
      .catch(() => {});
  }, [token, location.pathname]);

  const allVisibleModules: CRMModules = Object.fromEntries(
    Object.entries(
      activeChannels.length === 0
        ? crmModules
        : Object.fromEntries(Object.entries(crmModules).filter(([ch]) => activeChannels.includes(ch)))
    ).filter(([ch]) => flags[`connector_${ch}` as keyof typeof flags] !== false)
  );

  // Filter connector modules by view permission — only show what the user can access.
  // Native CRM modules are NEVER filtered here; they always show in the sidebar.
  const visibleModules: CRMModules = {};
  for (const [channel, modules] of Object.entries(allVisibleModules)) {
    const allowed = modules.filter(({ module }) =>
      isFullAccess || _hasWildcard(permissions ?? [], `connector.${channel}.${module.toLowerCase()}.view`)
    );
    if (allowed.length > 0) visibleModules[channel] = allowed;
  }

  const hasCRM = Object.keys(visibleModules).length > 0;

  /* ── Collapsed rail — icon only ───────────────────────────────────────────── */
  if (collapsed) {
    return (
      <aside className="w-14 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0 print:hidden">
        {/* Logo mark */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-[0_0_10px_rgba(30,111,255,0.4)]">
            <img src="/logo.png" alt="iR" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={onToggle}
          title="Expand sidebar"
          className="mx-auto mt-2 mb-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronDoubleRightIcon className="h-4 w-4" />
        </button>

        {/* Static nav — icons only */}
        <nav className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto">
          {staticNav
            .filter(({ flagKey, permKey }) => flags[flagKey as keyof typeof flags] !== false && canNav(permKey))
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
              </NavLink>
            ))}

          {/* CRM DATA icon */}
          {hasCRM && flags.nav_crmData !== false && canNav('connector.view') && (
            <NavLink
              to={`/crm/${Object.keys(visibleModules)[0]}/${visibleModules[Object.keys(visibleModules)[0]]?.[0]?.module || ''}`}
              title="CRM Data"
              className={() =>
                `w-10 h-10 flex items-center justify-center rounded-xl transition-colors mt-1 ${
                  location.pathname.startsWith('/crm/') ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`
              }
            >
              <CircleStackIcon className="h-5 w-5" />
            </NavLink>
          )}

          {/* My CRM icon */}
          {flags.nav_myCrm !== false && (
            <NavLink
              to="/my-crm"
              title="My CRM"
              className={() =>
                `w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                  location.pathname.startsWith('/my-crm') ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`
              }
            >
              <CalendarDaysIcon className="h-5 w-5" />
            </NavLink>
          )}

          {/* Native CRM icon */}
          {flags.nav_nativeCrm !== false && (
            <NavLink
              to="/crm/contacts"
              title="Native CRM"
              className={() =>
                `w-10 h-10 flex items-center justify-center rounded-xl transition-colors mt-1 ${
                  location.pathname.startsWith('/crm/contacts') || location.pathname.startsWith('/crm/companies') || location.pathname.startsWith('/crm/deals') || location.pathname.startsWith('/crm/tasks') || location.pathname.startsWith('/crm/tickets') || location.pathname.startsWith('/crm/calls') || location.pathname.startsWith('/crm/meetings') ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`
              }
            >
              <BuildingOffice2Icon className="h-5 w-5" />
            </NavLink>
          )}
        </nav>

        <div className="pb-4 flex justify-center">
          <span className="text-[9px] text-gray-300 font-medium">v1.0</span>
        </div>
      </aside>
    );
  }

  /* ── Expanded sidebar ─────────────────────────────────────────────────────── */
  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 shrink-0 print:hidden">
      {/* Brand + collapse button */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 shadow-[0_0_10px_rgba(30,111,255,0.35)]">
            <img src="/logo.png" alt="iR" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#4F46E5] to-[#818CF8] bg-clip-text text-transparent">
            LeadRyze AI
          </span>
        </div>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {staticNav
          .filter(({ flagKey, permKey }) => flags[flagKey as keyof typeof flags] !== false && canNav(permKey))
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}

        {/* ── CRM DATA section ─────────────────────────────────────────── */}
        {hasCRM && flags.nav_crmData !== false && canNav('connector.view') && (
          <div className="pt-3">
            <button
              onClick={() => setCrmOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <CircleStackIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">CRM Data</span>
              {crmOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {crmOpen && (
              <div className="mt-1 space-y-0.5">
                {Object.entries(visibleModules).map(([channel, modules]) =>
                  modules.map(({ module, count }) => {
                    const path     = `/crm/${channel}/${module}`;
                    const isActive = location.pathname === path;
                    const ModIcon  = getModuleIcon(module);
                    const dotColor = CONNECTOR_COLOR[channel] || 'bg-gray-400';
                    return (
                      <NavLink
                        key={`${channel}-${module}`}
                        to={path}
                        className={`group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <ModIcon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        <span className="flex-1 truncate">{module}</span>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                        <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                      </NavLink>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Native CRM section ───────────────────────────────────────── */}
        {flags.nav_nativeCrm !== false && (
          <div className="pt-3">
            <button
              onClick={() => setNativeCrmOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <BuildingOffice2Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Native CRM</span>
              {nativeCrmOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {nativeCrmOpen && (
              <div className="mt-1 space-y-0.5">
                {NATIVE_MODULES.map(({ key, label, icon: ModIcon, color }) => {
                  const path     = `/crm/${key}`;
                  const isActive = location.pathname === path;
                  const count    = nativeCounts[key] ?? 0;
                  return (
                    <NavLink
                      key={key}
                      to={path}
                      className={`group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <ModIcon
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{ color: isActive ? color : undefined }}
                      />
                      <span className="flex-1 truncate">{label}</span>
                      {count > 0 && (
                        <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Field Service CRM section ────────────────────────────────── */}
        <div className="pt-3">
          <button
            onClick={() => setFieldServiceOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
          >
            <WrenchScrewdriverIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Field Service</span>
            {fieldServiceOpen
              ? <ChevronDownIcon  className="h-3 w-3" />
              : <ChevronRightIcon className="h-3 w-3" />}
          </button>

          {fieldServiceOpen && (
            <div className="mt-1 space-y-0.5">
              {FIELD_SERVICE_MODULES.map(({ key, label, icon: ModIcon, color }) => {
                const path     = `/native-crm/${key}`;
                const isActive = location.pathname === path;
                const count    = fsCounts[key] ?? 0;
                return (
                  <NavLink
                    key={key}
                    to={path}
                    className={`group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <ModIcon
                      className="h-4 w-4 shrink-0 transition-colors"
                      style={{ color: isActive ? color : undefined }}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {count > 0 && (
                      <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Custom Modules section ───────────────────────────────────── */}
        {(customModules.filter((m) => m.showInSidebar).length > 0 || isFullAccess) && (
          <div className="pt-3">
            <button
              onClick={() => setCustomModulesOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <TableCellsIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Custom Modules</span>
              {customModulesOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {customModulesOpen && (
              <div className="mt-1 space-y-0.5">
                {customModules.filter((m) => m.showInSidebar).map((mod) => {
                  const path     = `/native-crm/custom/${mod.slug}`;
                  const isActive = location.pathname === path;
                  return (
                    <NavLink
                      key={mod.slug}
                      to={path}
                      className={`group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0 select-none">{mod.icon}</span>
                      <span className="flex-1 truncate">{mod.name}</span>
                    </NavLink>
                  );
                })}
                {isFullAccess && (
                  <NavLink
                    to="/native-crm/custom-modules"
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <Cog6ToothIcon className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="flex-1 truncate text-gray-500">Manage Modules</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── My CRM section ───────────────────────────────────────────── */}
        {flags.nav_myCrm !== false && (
          <div className="pt-3">
            <button
              onClick={() => setMyCrmOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <CalendarDaysIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">My CRM</span>
              {myCrmOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {myCrmOpen && (
              <div className="mt-1 space-y-0.5">
                <NavLink
                  to="/my-crm"
                  end
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <CalendarDaysIcon className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="flex-1 truncate">Calendar</span>
                </NavLink>

                <NavLink
                  to="/my-crm/management"
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <ClipboardDocumentListIcon className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="flex-1 truncate">Management</span>
                </NavLink>

                <NavLink
                  to="/my-crm/automation"
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <BoltIcon className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="flex-1 truncate">Automation</span>
                </NavLink>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        {/* {user?.clientId && (
          <div
            className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 cursor-pointer group"
            title="Click to copy Client ID"
            onClick={() => navigator.clipboard.writeText(user.clientId!)}
          >
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Client ID</p>
              <p className="text-sm font-mono font-bold text-gray-800 tracking-wider truncate">{user.clientId}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 group-hover:text-brand-500 shrink-0 ml-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )} */}
        <div className="text-xs text-gray-400 text-center">LeadRyze AI v1.0</div>
      </div>
    </aside>
  );
}
