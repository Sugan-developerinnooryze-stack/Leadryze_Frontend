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
  ShieldCheckIcon,
  XMarkIcon,
  EllipsisHorizontalIcon,
  // BellAlertIcon,
  // ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useSourceFilterStore } from '../../stores/sourceFilter.store';
import { useFeatureFlagsStore, type FeatureFlags } from '../../stores/featureFlags.store';
import { NATIVE_MODULES } from '../../config/native-crm.config';
import { UserCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useSidebarLayout } from '../../hooks/useSidebarLayout';
import SidebarMorePanel from './SidebarMorePanel';
import SidebarCustomizeModal from './SidebarCustomizeModal';

export interface CustomizableItem { id: string; label: string; icon: HeroIcon; color?: string; to?: string }
export interface CustomizableCategory { key: string; label: string; items: CustomizableItem[] }

const FIELD_SERVICE_MODULES = [
  { key: 'leads',      label: 'Leads',      icon: UserPlusIcon,          color: '#7c3aed' },
  { key: 'deals',      label: 'Deals',      icon: BriefcaseIcon,         color: '#2563eb' },
  { key: 'categories', label: 'Categories', icon: TagIcon,               color: '#8b5cf6' },
  { key: 'services',   label: 'Services',   icon: WrenchScrewdriverIcon, color: '#0ea5e9' },
  { key: 'teams',      label: 'Teams',      icon: UserGroupIcon,         color: '#10b981' },
  { key: 'supervisors', label: 'Supervisors', icon: ShieldCheckIcon,     color: '#4f46e5' },
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
 // { key: 'message-history',   label: 'Message History',  icon: EnvelopeIcon,              color: '#10b981' },
   { key: 'native-logs',       label: 'Native Logs',      icon: ClipboardDocumentListIcon, color: '#64748b' },
  { key: 'template-designer', label: 'PDF Designer',     icon: DocumentTextIcon,          color: '#db2777' },
] as const;

// Everything a tenant admin configures, grouped under one "Configuration"
// sidebar section instead of scattered links — the overview entry links to
// ConfigurationHubPage, the rest deep-link straight to each area.
const CONFIGURATION_ITEMS = [
  { key: 'configuration',              label: 'Configuration Hub', icon: Cog6ToothIcon,             color: '#475569' },
  //{ key: 'settings/pipelines',         label: 'Pipeline & Stages', icon: Squares2X2Icon,             color: '#8b5cf6' },
  { key: 'custom-fields',              label: 'Custom Fields',     icon: AdjustmentsHorizontalIcon,  color: '#7c3aed' },
  { key: 'custom-modules',             label: 'Custom Modules',    icon: TableCellsIcon,             color: '#0d9488' },
  { key: 'settings',                   label: 'FS Settings',       icon: WrenchScrewdriverIcon,      color: '#64748b' },
  //{ key: 'settings/notifications',     label: 'Notifications',     icon: BellAlertIcon,              color: '#0ea5e9' },
  //{ key: 'settings/automations',       label: 'Automations',       icon: BoltIcon,                   color: '#f59e0b' },
  //{ key: 'settings/import-export',     label: 'Import & Export',   icon: ArrowsRightLeftIcon,        color: '#16a34a' },
] as const;

// Maps each Native CRM / Field Service sidebar entry to the exact
// requirePermission() key already enforced on that module's own routes
// (see rbac.seed.ts) — so a role without view access neither sees the nav
// item nor its record count, instead of showing a link that would just 403.
// Entries with no dedicated permission key today (supervisors, calendar)
// are intentionally left out of these maps — canNav() treats a missing/empty
// key as always-visible, same as before.
const NATIVE_MODULE_PERM: Record<string, string> = {
  contacts: 'native_crm.contacts.view', companies: 'native_crm.companies.view',
  tasks:    'native_crm.tasks.view',    tickets:   'native_crm.tickets.view',
  calls:    'native_crm.calls.view',    meetings:  'native_crm.meetings.view',
  conversations: 'native_crm.conversations.view',
};

const FIELD_SERVICE_MODULE_PERM: Record<string, string> = {
  leads: 'native_crm.leads.view', deals: 'native_crm.deals.view',
  categories: 'fs.categories.view', services:   'fs.services.view',
  teams:      'fs.teams.view',      staffs:     'fs.staffs.view',
  customers:  'fs.customers.view',  sites:      'fs.sites.view',
  parts:      'fs.parts.view',      quotations: 'fs.quotations.view',
  workorders: 'fs.workorders.view', contracts:  'fs.contracts.view',
  invoices:   'fs.invoices.view',   receipts:   'fs.receipts.view',
  expenses:   'fs.expenses.view',   activities: 'fs.activities.view',
  products:   'fs.products.view',   assets:     'fs.assets.view',
  vehicles:   'fs.vehicles.view',
  // Added so these two agree with the backend, which already enforces
  // logs.view / doc_templates.view on their routes — previously missing
  // here, so canNav() fell through to its always-visible default and the
  // nav link showed regardless of role, only 403ing once clicked.
  'native-logs': 'logs.view', 'template-designer': 'doc_templates.view',
};

// Tenant-level counterpart to the two maps above — "is this module enabled
// for this COMPANY at all" (Super Admin → Controls), independent of "can
// this ROLE see it" (RBAC, the _PERM maps). A sub-item needs both to show.
// Keys with no tenant flag yet (supervisors, calendar) fall through
// canNavFlag()'s missing-key default (shown).
const NATIVE_MODULE_FLAG: Record<string, keyof FeatureFlags> = {
  contacts: 'native_contacts', companies: 'native_companies',
  tasks:    'native_tasks',    tickets:   'native_tickets',
  calls:    'native_calls',    meetings:  'native_meetings',
  conversations: 'native_conversations',
};

const FIELD_SERVICE_MODULE_FLAG: Record<string, keyof FeatureFlags> = {
  // 'deals' reuses native_deals — same backend /deals route Native CRM's
  // own (now-removed) Deals link used to point at; one flag, one route.
  leads: 'fs_leads', deals: 'native_deals',
  categories: 'fs_categories', services:   'fs_services',
  teams:      'fs_teams',      supervisors: 'fs_supervisors',
  staffs:     'fs_staffs',
  customers:  'fs_customers',  sites:      'fs_sites',
  parts:      'fs_parts',      quotations: 'fs_quotations',
  workorders: 'fs_workorders', contracts:  'fs_contracts',
  invoices:   'fs_invoices',   receipts:   'fs_receipts',
  expenses:   'fs_expenses',   activities: 'fs_activities',
  products:   'fs_products',   assets:     'fs_assets',
  vehicles:   'fs_vehicles',
};

const CONFIGURATION_ITEM_FLAG: Record<string, keyof FeatureFlags> = {
  configuration:  'config_hub',
  'custom-fields': 'config_customFields',
  'custom-modules': 'config_customModules',
  settings:       'config_fsSettings',
};

// RBAC counterpart to the flag map above — was missing entirely, so this
// whole section previously showed to every role regardless of permission
// (the backend routes were always correctly enforced; only the sidebar
// link itself didn't agree, showing a link that would then 403 on click).
// 'configuration' (the Hub) has no key by design — it's a pure links page
// with no backend API of its own, same as canNav('') treats a missing key.
const CONFIGURATION_ITEM_PERM: Record<string, string> = {
  'custom-fields':   'fs.custom_fields.view',
  'custom-modules':  'custom_modules.definitions.view',
  settings:          'fs.settings.view',
};

// The Automation (My CRM) section's 3 links, previously individually
// hardcoded JSX — pulled into a catalog so it can be pinned/reordered/shown
// in "More" the same way the other four customizable sections are.
const AUTOMATION_ITEMS = [
  { key: 'calendar',   label: 'Calendar',   icon: CalendarDaysIcon,          to: '/my-crm' },
  { key: 'management', label: 'Management', icon: ClipboardDocumentListIcon, to: '/my-crm/management' },
  { key: 'automation', label: 'Automation', icon: BoltIcon,                  to: '/my-crm/automation' },
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

// Visual regrouping only — every {to, icon, label, flagKey, permKey} below is
// copied verbatim from the single flat list this used to be; no flagKey or
// permKey value changed, so gating behavior is byte-for-byte identical to
// before. See DESIGN-SYSTEM.md's "Sidebar Navigation" section for the group
// rationale. `staticNav` (the concatenation of all four) only supplies the
// shared item type for NAV_GROUPS below now — the collapsed rail renders
// pinned items straight from categorySplits instead, same as the expanded
// sidebar, so this list itself no longer feeds any render path directly.
const OVERVIEW_NAV = [
  { to: '/dashboard',  icon: HomeIcon,                   label: 'Dashboard',      flagKey: 'nav_dashboard',  permKey: ''               },
];
const ENGAGE_NAV = [
  { to: '/customers',  icon: UsersIcon,                  label: 'Customers',      flagKey: 'nav_customers',  permKey: 'customers.view' },
  { to: '/bot-hub',    icon: CpuChipIcon,                label: 'Bot Hub',        flagKey: 'nav_botHub',     permKey: 'bot.view'       },
  { to: '/campaigns',  icon: MegaphoneIcon,              label: 'Campaigns',      flagKey: 'nav_campaigns',  permKey: 'campaigns.view' },
  { to: '/templates',  icon: DocumentTextIcon,           label: 'Templates',      flagKey: 'nav_templates',  permKey: 'templates.view' },
];
const INTELLIGENCE_NAV = [
  { to: '/analytics',  icon: ChartBarIcon,               label: 'Analytics',      flagKey: 'nav_analytics',  permKey: 'analytics.view' },
  { to: '/knowledge',  icon: BookOpenIcon,               label: 'Knowledge Base', flagKey: 'nav_knowledge',  permKey: 'knowledge.view' },
];
const PLATFORM_NAV = [
  { to: '/logs',       icon: ClipboardDocumentCheckIcon, label: 'Logs',           flagKey: 'nav_logs',       permKey: 'logs.view'      },
  { to: '/connectors', icon: LinkIcon,                   label: 'Connectors',     flagKey: 'nav_connectors', permKey: 'connector.view' },
  { to: '/settings',   icon: Cog6ToothIcon,              label: 'Settings',       flagKey: 'nav_settings',   permKey: ''               },
];
const staticNav = [...OVERVIEW_NAV, ...ENGAGE_NAV, ...INTELLIGENCE_NAV, ...PLATFORM_NAV];
const NAV_GROUPS: { label: string; items: typeof staticNav }[] = [
  { label: 'Overview',     items: OVERVIEW_NAV },
  { label: 'Engage',       items: ENGAGE_NAV },
  { label: 'Intelligence', items: INTELLIGENCE_NAV },
  { label: 'Platform',     items: PLATFORM_NAV },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile slide-over drawer — a separate concern from desktop
   * collapsed/expanded. Owned by Layout.tsx (same pattern as
   * collapsed/onToggle) since Header.tsx's hamburger button needs to
   * control the same state. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const SECTION_STATE_KEY = 'leadryze-sidebar-sections';
type SectionState = { crm: boolean; myCrm: boolean; nativeCrm: boolean; fieldService: boolean; config: boolean; customModules: boolean };
const DEFAULT_SECTION_STATE: SectionState = { crm: true, myCrm: true, nativeCrm: true, fieldService: true, config: true, customModules: true };

function loadSectionState(): SectionState {
  try {
    const saved = localStorage.getItem(SECTION_STATE_KEY);
    if (saved) return { ...DEFAULT_SECTION_STATE, ...JSON.parse(saved) };
  } catch { /* ignore — malformed/unavailable storage falls back to defaults */ }
  return DEFAULT_SECTION_STATE;
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

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
  const { token, user, permissions } = useAuthStore();
  const location                     = useLocation();
  const { activeChannels }           = useSourceFilterStore();
  const { flags, loadFlags }         = useFeatureFlagsStore();

  // SUPER_ADMIN / TENANT_ADMIN / null permissions → full access
  const isFullAccess = !user || user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || permissions === null;
  const canNav = (permKey: string) => !permKey || isFullAccess || _hasWildcard(permissions ?? [], permKey);
  // Tenant-level module gate — deliberately NOT bypassed by isFullAccess:
  // a Super-Admin-disabled module stays hidden even from that tenant's own
  // TENANT_ADMIN. Missing map entry (no flag defined for this key yet)
  // defaults to visible, same "undefined means enabled" convention as flags
  // themselves.
  const canNavFlag = (flagKey?: keyof FeatureFlags) => !flagKey || flags[flagKey] !== false;

  // Sidebar drag/pin/hide customization — a UI-ordering layer applied only
  // to items that already passed canNav()/canNavFlag() above; see
  // useSidebarLayout.ts's doc-comment for the full invariant. Browsing +
  // pin/unpin lives in the separate More flyout; drag-reorder lives in the
  // separate Customize modal — the two are deliberately never the same
  // surface, so a reorder drag can never accidentally unpin something.
  const sidebarLayout = useSidebarLayout();
  const [morePanelOpen, setMorePanelOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    if (token) loadFlags();
  }, [token, location.pathname]);

  const [crmModules,    setCrmModules]    = useState<CRMModules>({});
  const [sectionState, setSectionState]   = useState<SectionState>(loadSectionState);
  const crmOpen = sectionState.crm, myCrmOpen = sectionState.myCrm, nativeCrmOpen = sectionState.nativeCrm,
        fieldServiceOpen = sectionState.fieldService, configOpen = sectionState.config, customModulesOpen = sectionState.customModules;
  const toggleSection = (key: keyof SectionState) =>
    setSectionState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  const [nativeCounts,     setNativeCounts]     = useState<Record<string, number>>({});
  const [fsCounts,         setFsCounts]         = useState<Record<string, number>>({});
  const [customModules,    setCustomModules]    = useState<{ _id: string; slug: string; name: string; icon: string; color: string; showInSidebar: boolean }[]>([]);

  useEffect(() => {
    if (!token) return;
    const loadCounts = () => {
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
    };
    loadCounts();
    // Real, confirmed bug this fixes: these counts previously only refetched
    // on navigation (route change) — creating/converting/deleting a record
    // while STAYING on the same page (e.g. the Leads list, or a quick-add
    // panel) left every sidebar badge frozen at its pre-action value for the
    // rest of the session, silently diverging from the page's own live
    // React-Query-backed stats. A short poll is a low-risk fix that doesn't
    // require wiring sidebar-count invalidation into every mutation hook in
    // the app — badges self-correct within a few seconds instead of staying
    // stale indefinitely.
    const interval = setInterval(loadCounts, 15000);
    return () => clearInterval(interval);
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

  // ── Customizable categories — the five *stable* item catalogs the
  // Customize Sidebar modal and the pinned/"More" split below operate on.
  // Every item here has already passed canNav()/canNavFlag(); this array
  // exists only to decide WHERE (pinned vs More) and in WHAT ORDER an
  // already-permitted item renders, never whether it's permitted at all.
  // CRM Data and Custom Modules are deliberately excluded — their contents
  // are dynamic (connector-driven / tenant-created), not a fixed catalog, so
  // they get a group-level show/hide toggle instead (see their own render
  // blocks below), left entirely out of this per-item list. */
  const customizableCategories: CustomizableCategory[] = [];

  for (const group of NAV_GROUPS) {
    const visible = group.items.filter(({ flagKey, permKey }) => flags[flagKey as keyof typeof flags] !== false && canNav(permKey));
    if (visible.length > 0) {
      customizableCategories.push({
        key: group.label.toLowerCase(),
        label: group.label,
        items: visible.map(({ to, icon, label }) => ({ id: `nav:${to}`, label, icon, to })),
      });
    }
  }

  if (flags.nav_nativeCrm !== false) {
    const visible = NATIVE_MODULES.filter(({ key }) => canNav(NATIVE_MODULE_PERM[key]) && canNavFlag(NATIVE_MODULE_FLAG[key]));
    if (visible.length > 0) {
      customizableCategories.push({
        key: 'nativeCrm',
        label: 'Native CRM',
        items: visible.map(({ key, label, icon, color }) => ({ id: `native:${key}`, label, icon, color, to: `/crm/${key}` })),
      });
    }
  }

  if (flags.nav_fieldService !== false) {
    const visible = FIELD_SERVICE_MODULES.filter(({ key }) => canNav(FIELD_SERVICE_MODULE_PERM[key]) && canNavFlag(FIELD_SERVICE_MODULE_FLAG[key]));
    if (visible.length > 0) {
      customizableCategories.push({
        key: 'fieldService',
        label: 'Field Service',
        items: visible.map(({ key, label, icon, color }) => ({ id: `fs:${key}`, label, icon, color, to: `/native-crm/${key}` })),
      });
    }
  }

  if (flags.nav_configuration !== false) {
    const visible = CONFIGURATION_ITEMS.filter(({ key }) => canNav(CONFIGURATION_ITEM_PERM[key]) && canNavFlag(CONFIGURATION_ITEM_FLAG[key]));
    if (visible.length > 0) {
      customizableCategories.push({
        key: 'configuration',
        label: 'Configuration',
        items: visible.map(({ key, label, icon, color }) => ({ id: `config:${key}`, label, icon, color, to: `/native-crm/${key}` })),
      });
    }
  }

  if (flags.nav_myCrm !== false) {
    customizableCategories.push({
      key: 'automation',
      label: 'Automation',
      items: AUTOMATION_ITEMS.map(({ key, label, icon, to }) => ({ id: `automation:${key}`, label, icon, to })),
    });
  }

  // Per-category pinned/unpinned split — pinned feeds the main sidebar's
  // rendering below, unpinned feeds SidebarMorePanel (passed the full
  // customizableCategories + this hook, and does its own two-column
  // category→items browsing rather than a flat list here).
  const categorySplits = customizableCategories.map((cat) => {
    const ids = cat.items.map((i) => i.id);
    const { pinned, unpinned } = sidebarLayout.split(ids);
    const byId = new Map(cat.items.map((i) => [i.id, i]));
    return {
      ...cat,
      pinnedItems:   pinned.map((id) => byId.get(id)!),
      unpinnedItems: unpinned.map((id) => byId.get(id)!),
    };
  });
  const crmDataVisible     = sidebarLayout.isGroupVisible('crmData');
  const customModulesVisible = sidebarLayout.isGroupVisible('customModules');

  // Shared active/inactive classes for a collapsed-rail icon button — one
  // definition so every icon (existing four plus the three newly added
  // below) looks identical.
  const railIconClass = (active: boolean) =>
    `w-10 h-10 flex items-center justify-center rounded-xl transition-colors mt-1 first:mt-0 ${
      active ? 'bg-sidebar-accent/[0.14] text-sidebar-accent' : 'text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text'
    }`;

  /* ── Collapsed rail — icon only, desktop (≥lg) ────────────────────────────── */
  const collapsedRail = (
    <aside className="hidden lg:flex w-14 bg-sidebar-bg border-r border-sidebar-border flex-col transition-all duration-200 shrink-0 print:hidden">
      {/* Logo mark */}
      <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-[0_0_10px_rgba(0,158,181,0.4)]">
          <img src="/logo.png" alt="iR" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Expand button */}
      <button
        onClick={onToggle}
        title="Expand sidebar"
        className="mx-auto mt-2 mb-1 p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-sidebar-muted hover:text-sidebar-text transition-colors"
      >
        <ChevronDoubleRightIcon className="h-4 w-4" />
      </button>

      {/* Static nav — icons only, one row per PINNED item (mirrors the
         expanded sidebar exactly — previously this showed one icon per
         whole category regardless of pin state, so collapsing could show
         MORE icons than the expanded view's pinned set did). */}
      <nav className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto">
        {NAV_GROUPS.flatMap((group) => categorySplits.find((c) => c.key === group.label.toLowerCase())?.pinnedItems ?? [])
          .map((item) => (
            <NavLink key={item.id} to={item.to!} title={item.label} className={({ isActive }) => railIconClass(isActive)}>
              <item.icon className="h-5 w-5" />
            </NavLink>
          ))}

        {/* CRM DATA icon — group-level toggle, not an individually pinnable
           item, so gated the same way the expanded sidebar's CRM Data
           section is: permission + tenant flag + the group's own
           pinned/visible toggle (previously missing here, so this icon
           showed even when unpinned from the expanded view). */}
        {hasCRM && flags.nav_crmData !== false && canNav('connector.view') && crmDataVisible && (
          <NavLink
            to={`/crm/${Object.keys(visibleModules)[0]}/${visibleModules[Object.keys(visibleModules)[0]]?.[0]?.module || ''}`}
            title="CRM Data"
            className={() => railIconClass(location.pathname.startsWith('/crm/'))}
          >
            <CircleStackIcon className="h-5 w-5" />
          </NavLink>
        )}

        {/* Native CRM — only pinned items */}
        {(categorySplits.find((c) => c.key === 'nativeCrm')?.pinnedItems ?? []).map((item) => (
          <NavLink key={item.id} to={item.to!} title={item.label} className={({ isActive }) => railIconClass(isActive)}>
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}

        {/* Field Service — only pinned items */}
        {(categorySplits.find((c) => c.key === 'fieldService')?.pinnedItems ?? []).map((item) => (
          <NavLink key={item.id} to={item.to!} title={item.label} className={({ isActive }) => railIconClass(isActive)}>
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}

        {/* Configuration — only pinned items */}
        {(categorySplits.find((c) => c.key === 'configuration')?.pinnedItems ?? []).map((item) => (
          <NavLink key={item.id} to={item.to!} title={item.label} className={({ isActive }) => railIconClass(isActive)}>
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}

        {/* Custom Modules icon — group-level toggle, same gating as
           expanded (permission via customModules list + visible toggle). */}
        {(customModules.filter((m) => m.showInSidebar).length > 0 || isFullAccess) && customModulesVisible && (
          <NavLink to="/native-crm/custom-modules" title="Custom Modules" className={() => railIconClass(location.pathname.startsWith('/native-crm/custom'))}>
            <TableCellsIcon className="h-5 w-5" />
          </NavLink>
        )}

        {/* Automation (My CRM) — only pinned items */}
        {(categorySplits.find((c) => c.key === 'automation')?.pinnedItems ?? []).map((item) => (
          <NavLink key={item.id} to={item.to!} title={item.label} className={({ isActive }) => railIconClass(isActive)}>
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}

        {/* More flyout trigger — same panel the expanded sidebar opens,
           anchored to this narrower rail's width instead. */}
        <button onClick={() => setMorePanelOpen(true)} title="More" className={railIconClass(false)}>
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </button>
      </nav>

      <div className="pb-4 flex justify-center">
        <span className="text-[9px] text-sidebar-muted font-medium">v1.0</span>
      </div>
    </aside>
  );

  // Shared row classes for a nav-header button (the small uppercase
  // section labels — both the plain static-nav group labels below and the
  // collapsible section headers further down use the same look).
  const groupLabelClass = 'px-3 pt-3 pb-1 text-[11px] font-semibold text-sidebar-muted uppercase tracking-wider';
  const sectionHeaderClass = 'w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-sidebar-muted uppercase tracking-wider hover:text-sidebar-text transition-colors';
  const navItemClass = (active: boolean, indent = false) =>
    `group flex items-center gap-2.5 border-l-2 ${indent ? 'pl-5 pr-3' : 'px-3'} py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-sidebar-accent/[0.14] border-sidebar-accent text-sidebar-text font-medium' : 'border-transparent text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text'
    }`;

  /** One pinned item — exactly the plain NavLink it always was. Pinning is
   * decided in the More flyout, ordering in the Customize modal; the main
   * sidebar itself has no edit affordances at all, so this stays as simple
   * as the original static rendering. `topLevel` picks the bigger
   * un-indented style the 4 static nav groups use vs. the indented style
   * every other customizable section uses. */
  const renderPinnedItem = (
    item: CustomizableItem,
    opts: { topLevel?: boolean; count?: number; endMatch?: boolean; alwaysColor?: boolean } = {}
  ) => {
    const isActive = location.pathname === item.to;
    return opts.topLevel ? (
      <NavLink key={item.id} to={item.to!} className={({ isActive: a }) => `flex items-center gap-3 border-l-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        a ? 'bg-sidebar-accent/[0.14] border-sidebar-accent text-sidebar-text' : 'border-transparent text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text'
      }`}>
        <item.icon className="h-5 w-5 shrink-0" />
        {item.label}
      </NavLink>
    ) : (
      <NavLink key={item.id} to={item.to!} end={opts.endMatch} className={navItemClass(isActive, true)}>
        <item.icon className="h-4 w-4 shrink-0 transition-colors" style={{ color: opts.alwaysColor ? item.color : (isActive ? item.color : undefined) }} />
        <span className="flex-1 truncate">{item.label}</span>
        {!!opts.count && <span className="text-xs text-sidebar-muted tabular-nums">{opts.count}</span>}
      </NavLink>
    );
  };

  /* ── Expanded nav content — shared verbatim between the desktop expanded
     aside and the mobile drawer below, since "collapsed" is a desktop-only
     concept and the drawer always shows the full nav. Kept as one JSX
     expression (not a separate component) so it closes over this
     component's existing hooks/state directly, with no prop-drilling. ── */
  const expandedNav = (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {NAV_GROUPS.map((group) => {
        const split = categorySplits.find((c) => c.key === group.label.toLowerCase());
        if (!split || split.pinnedItems.length === 0) return null;
        return (
          <div key={group.label}>
            <p className={groupLabelClass}>{group.label}</p>
            {split.pinnedItems.map((item) => renderPinnedItem(item, { topLevel: true }))}
          </div>
        );
      })}

        {/* ── CRM super-label — wraps CRM Data + Native CRM, each keeping
           its own independent collapse state exactly as before. Only shown
           when at least one of the two will actually render something
           (crmDataVisible / a pinned Native CRM item), so it can't become an
           orphaned header once everything underneath is unpinned/hidden. ── */}
        {((hasCRM && flags.nav_crmData !== false && canNav('connector.view') && crmDataVisible)
          || (categorySplits.find((c) => c.key === 'nativeCrm')?.pinnedItems.length ?? 0) > 0) && (
          <p className={groupLabelClass}>CRM</p>
        )}

        {/* ── CRM DATA section — group-level show/hide only (dynamic,
           connector-driven contents, no fixed item catalog to pin/reorder
           per-item; see the customizableCategories comment above). ────── */}
        {hasCRM && flags.nav_crmData !== false && canNav('connector.view') && crmDataVisible && (
          <div>
            <button onClick={() => toggleSection('crm')} className={sectionHeaderClass}>
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
                      <NavLink key={`${channel}-${module}`} to={path} className={navItemClass(isActive, true)}>
                        <ModIcon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-sidebar-accent' : 'text-sidebar-muted group-hover:text-sidebar-text'}`} />
                        <span className="flex-1 truncate">{module}</span>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                        <span className="text-xs text-sidebar-muted tabular-nums">{count}</span>
                      </NavLink>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Native CRM section — fixed catalog, full per-item pin/reorder. ── */}
        {(() => {
          const split = categorySplits.find((c) => c.key === 'nativeCrm');
          if (!split || split.pinnedItems.length === 0) return null;
          return (
          <div>
            <button onClick={() => toggleSection('nativeCrm')} className={sectionHeaderClass}>
              <BuildingOffice2Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Native CRM</span>
              {nativeCrmOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {nativeCrmOpen && (
              <div className="mt-1 space-y-0.5">
                {split.pinnedItems.map((item) =>
                  renderPinnedItem(item, { count: nativeCounts[item.id.replace('native:', '')] ?? 0 })
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* ── Field Service — fixed catalog, full per-item pin/reorder;
           its own top-level group, the existing section header doubles as
           the group label, so no extra wrapper. ────── */}
        {(() => {
          const split = categorySplits.find((c) => c.key === 'fieldService');
          if (!split || split.pinnedItems.length === 0) return null;
          return (
        <div>
          <p className={groupLabelClass}>Field Service</p>
          <button onClick={() => toggleSection('fieldService')} className={sectionHeaderClass}>
            <WrenchScrewdriverIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">All Modules</span>
            {fieldServiceOpen
              ? <ChevronDownIcon  className="h-3 w-3" />
              : <ChevronRightIcon className="h-3 w-3" />}
          </button>

          {fieldServiceOpen && (
            <div className="mt-1 space-y-0.5">
              {split.pinnedItems.map((item) =>
                renderPinnedItem(item, { count: fsCounts[item.id.replace('fs:', '')] ?? 0 })
              )}
            </div>
          )}
        </div>
          );
        })()}

        {/* ── CONFIGURATION super-label — wraps Configuration + Custom
           Modules, each keeping its own independent collapse state. Only
           shown when at least one will actually render, same orphaned-
           header guard as the CRM label above. ── */}
        {((categorySplits.find((c) => c.key === 'configuration')?.pinnedItems.length ?? 0) > 0
          || ((customModules.filter((m) => m.showInSidebar).length > 0 || isFullAccess) && customModulesVisible)) && (
          <p className={groupLabelClass}>Configuration</p>
        )}

        {/* ── Configuration section — fixed catalog, full per-item pin/reorder. ── */}
        {(() => {
          const split = categorySplits.find((c) => c.key === 'configuration');
          if (!split || split.pinnedItems.length === 0) return null;
          return (
        <div>
          <button onClick={() => toggleSection('config')} className={sectionHeaderClass}>
            <Cog6ToothIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Configuration</span>
            {configOpen
              ? <ChevronDownIcon  className="h-3 w-3" />
              : <ChevronRightIcon className="h-3 w-3" />}
          </button>

          {configOpen && (
            <div className="mt-1 space-y-0.5">
              {split.pinnedItems.map((item) => renderPinnedItem(item))}
            </div>
          )}
        </div>
          );
        })()}

        {/* ── Custom Modules section — group-level show/hide only (dynamic,
           tenant-created contents, no fixed item catalog). ────────────── */}
        {(customModules.filter((m) => m.showInSidebar).length > 0 || isFullAccess) && customModulesVisible && (
          <div>
            <button onClick={() => toggleSection('customModules')} className={sectionHeaderClass}>
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
                          ? 'bg-sidebar-accent/[0.14] text-sidebar-text font-medium'
                          : 'text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text'
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
                          ? 'bg-sidebar-accent/[0.14] text-sidebar-text font-medium'
                          : 'text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text'
                      }`
                    }
                  >
                    <Cog6ToothIcon className="h-4 w-4 shrink-0 text-sidebar-muted" />
                    <span className="flex-1 truncate text-sidebar-muted">Manage Modules</span>
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Automation section (was "My CRM" — routes/paths unchanged,
           relabeled per the plan's regrouping). Fixed catalog, full
           per-item pin/reorder. ─────────────────────── */}
        {(() => {
          const split = categorySplits.find((c) => c.key === 'automation');
          if (!split || split.pinnedItems.length === 0) return null;
          return (
          <div>
            <p className={groupLabelClass}>Automation</p>
            <button onClick={() => toggleSection('myCrm')} className={sectionHeaderClass}>
              <CalendarDaysIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">My CRM</span>
              {myCrmOpen
                ? <ChevronDownIcon  className="h-3 w-3" />
                : <ChevronRightIcon className="h-3 w-3" />}
            </button>

            {myCrmOpen && (
              <div className="mt-1 space-y-0.5">
                {split.pinnedItems.map((item) =>
                  renderPinnedItem({ ...item, color: '#00A9BE' }, { endMatch: item.to === '/my-crm', alwaysColor: true })
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* ── More / Customize triggers — compact, always exactly two rows,
           never inline content. Both open a separate overlay (SidebarMorePanel
           / SidebarCustomizeModal below) instead of growing this list. ── */}
        <div className="pt-2 mt-1 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={() => setMorePanelOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text transition-colors"
          >
            <EllipsisHorizontalIcon className="h-4 w-4 shrink-0" />
            More
          </button>
         {/* <button
            onClick={() => setCustomizeOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sidebar-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-sidebar-text transition-colors"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 shrink-0" />
            Customize Sidebar
          </button>*/}
        </div>
    </nav>
  );

  /* ── Desktop expanded aside (≥lg) ──────────────────────────────────────── */
  const expandedAside = (
    <aside className="hidden lg:flex w-60 bg-sidebar-bg border-r border-sidebar-border flex-col transition-all duration-200 shrink-0 print:hidden">
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 shadow-[0_0_10px_rgba(0,158,181,0.35)]">
            <img src="/logo.png" alt="iR" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-ryze-600 to-ryze-400 bg-clip-text text-transparent">
            LeadRyze AI
          </span>
        </div>
        <button
          onClick={onToggle}
          title="Collapse sidebar"
          className="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-sidebar-muted hover:text-sidebar-text transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      </div>
      {expandedNav}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-muted text-center">LeadRyze AI v1.0</div>
      </div>
    </aside>
  );

  /* ── Mobile slide-over drawer (<lg) — reuses expandedNav verbatim, since
     "collapsed" is a desktop-only concept and the drawer always shows the
     full nav. Own header (logo + close button, no collapse toggle). Stays
     mounted at all times (visibility/pointer-events toggled, not
     mount/unmount) so the transform actually transitions instead of
     snapping open with no animation. Escape closes it; backdrop click
     closes it; Layout.tsx's own route-change effect also closes it. ──── */
  const mobileDrawer = (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!mobileOpen}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
      <aside
        className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar-bg flex flex-col shadow-xl transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 shadow-[0_0_10px_rgba(0,158,181,0.35)]">
              <img src="/logo.png" alt="iR" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-ryze-600 to-ryze-400 bg-clip-text text-transparent">
              LeadRyze AI
            </span>
          </div>
          <button
            onClick={onCloseMobile}
            title="Close menu"
            className="p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-sidebar-muted hover:text-sidebar-text transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {expandedNav}
      </aside>
    </div>
  );

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseMobile(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {collapsed ? collapsedRail : expandedAside}
      {mobileDrawer}
      {morePanelOpen && (
        <SidebarMorePanel
          categories={categorySplits.map((c) => ({ key: c.key, label: c.label, items: [...c.pinnedItems, ...c.unpinnedItems] }))}
          isPinned={sidebarLayout.isPinned}
          togglePin={sidebarLayout.togglePin}
          reorder={sidebarLayout.reorder}
          isGroupVisible={sidebarLayout.isGroupVisible}
          toggleGroup={sidebarLayout.toggleGroup}
          hasCrmDataGroup={hasCRM && flags.nav_crmData !== false && canNav('connector.view')}
          hasCustomModulesGroup={customModules.filter((m) => m.showInSidebar).length > 0 || isFullAccess}
          pinAll={sidebarLayout.pinAll}
          resetToDefault={sidebarLayout.resetToDefault}
          anchorLeft={collapsed ? 56 : 240}
          onClose={() => setMorePanelOpen(false)}
        />
      )}
      {customizeOpen && (
        <SidebarCustomizeModal
          categories={categorySplits.map((c) => ({ key: c.key, label: c.label, items: c.pinnedItems }))}
          reorder={sidebarLayout.reorder}
          resetToDefault={sidebarLayout.resetToDefault}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </>
  );
}
