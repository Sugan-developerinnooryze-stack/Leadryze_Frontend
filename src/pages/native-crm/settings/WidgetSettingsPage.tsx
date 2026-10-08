import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import api from '../../../services/api';
import { SUPPORTED_LANGUAGES } from '../../../modules/native-crm/shared/languages';
import {
  ChatBubbleLeftRightIcon, ArrowPathIcon, ClipboardDocumentIcon, CheckIcon,
  LockClosedIcon, XMarkIcon, PlusIcon, GlobeAltIcon, DocumentArrowUpIcon,
  PhotoIcon, TrashIcon, Cog6ToothIcon, CalendarDaysIcon, UserGroupIcon,
  CpuChipIcon, SwatchIcon, Square3Stack3DIcon, KeyIcon, InformationCircleIcon,
  MicrophoneIcon, CircleStackIcon, ChartBarIcon, UserIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import { useTeamsListQuery, useTeamUpdate } from '../../../modules/native-crm/queries/teams.queries';
import {
  useTenantQuery, useUpdateTenantWidget, useRegenerateWidgetKey,
  useTriggerWebsiteCrawl, useCrawlStatus, useUploadWidgetLogo, useRemoveWidgetLogo,
  useUploadWidgetBackgroundImage, useRemoveWidgetBackgroundImage,
  useUpdateTenantAIConfig, useUpdateTenantBranding, useTenantAiUsageQuery,
  type TenantWidgetConfig, type ToolModelPreset, type VoiceProvider, type TenantVoicePreset, type TenantWidgetTheme,
} from '../../../modules/native-crm/queries/tenant.queries';
import { useCatalogSources, useImportCatalog } from '../../../modules/native-crm/queries/catalog.queries';
import CatalogImportPreview from '../../../modules/native-crm/shared/CatalogImportPreview';
import { useServicesListQuery } from '../../../modules/native-crm/queries/services.queries';
import {
  useDatasetsList, useImportDataset, useToggleDatasetAvailable, useDeleteDataset, useDatasetImportStatus,
  type DatasetColumn,
} from '../../../modules/native-crm/queries/datasets.queries';
import DatasetImportPreview from '../../../modules/native-crm/shared/DatasetImportPreview';
import ImageCropModal from '../../../components/ui/ImageCropModal';

type Template = NonNullable<TenantWidgetConfig['template']>;

/** Mirrors ai/src/config/index.ts's CARTESIA_VOICE_PRESETS exactly (same
 * real, Cartesia-API-verified voice IDs) — kept as a separate copy since the
 * frontend and ai/ projects don't share a build step, matching how the
 * language registry is duplicated the same way. */
const CARTESIA_VOICE_PRESETS: Record<'female' | 'male', TenantVoicePreset> = {
  female: { provider: 'cartesia', voiceId: '8a1b8af0-c4f6-423f-a268-5507fd4aefdf', displayName: 'Denise (Professional Woman)', gender: 'female', language: 'en' },
  male:   { provider: 'cartesia', voiceId: '5cf0e4d9-ca2b-4fd5-81fa-89db3b645539', displayName: 'Derrick (Professional Man)',  gender: 'male',   language: 'en' },
};

const WEEKDAYS: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

interface DayHours { open: boolean; start: string; end: string; }
type WeekHours = Record<number, DayHours>;

const DEFAULT_DAY: DayHours = { open: false, start: '09:00', end: '17:00' };

// requireTeam/requireService are tri-state (true/false/undefined="auto") on
// the AI side, but a plain checkbox can't represent "auto" distinctly from
// "off" — both rendered as unchecked, so admins could never reliably turn a
// question off (it already looked off). An explicit 3-way select removes
// that ambiguity entirely.
function tristateToSelect(value: boolean | undefined): 'auto' | 'always' | 'never' {
  return value === undefined ? 'auto' : value ? 'always' : 'never';
}
function selectToTristate(value: string): boolean | undefined {
  return value === 'auto' ? undefined : value === 'always';
}

function defaultWeekHours(): WeekHours {
  const week: WeekHours = {};
  for (const { day } of WEEKDAYS) week[day] = { ...DEFAULT_DAY };
  // Mirrors the backend schema's own default (Mon-Fri 9-5) for a tenant
  // that's never configured this yet.
  [1, 2, 3, 4, 5].forEach((d) => { week[d] = { open: true, start: '09:00', end: '17:00' }; });
  return week;
}

const TOOL_MODEL_OPTIONS: Array<{ id: ToolModelPreset | ''; name: string; description: string }> = [
  { id: '',           name: 'Default (recommended)', description: "Uses this account's global model — fast and cost-efficient for most tenants." },
  { id: 'groq',        name: 'Groq',       description: 'Fastest, lowest cost — good default for high-volume conversations.' },
  { id: 'anthropic',   name: 'Claude',     description: 'Slower and more expensive, generally more reliable at multi-step tool use.' },
  { id: 'openai',      name: 'GPT-4o mini', description: 'A middle ground between Groq and Claude on speed, cost, and reliability.' },
  { id: 'google',      name: 'Gemini',     description: "Google's model — a real alternative if you'd rather not depend on Groq or OpenAI." },
];

const TEMPLATES: Array<{ id: Template; name: string; description: string }> = [
  { id: 'modern',  name: 'Modern',           description: 'Gradient header, avatar, soft rounded bubbles — friendly, general-purpose.' },
  { id: 'minimal', name: 'Minimal Flat',     description: 'Flat header, sharp corners, thin borders — understated and professional.' },
  { id: 'chips',   name: 'Compact Chips',    description: 'Icon avatar with quick-reply suggestion buttons — guided, less typing upfront.' },
  { id: 'dark',    name: 'Dark Professional', description: 'Dark chrome header, light readable message area — premium, enterprise feel.' },
];

// Purely a jump-nav for the sections below — mirrors the card order 1:1, no
// data of its own. Kept as a flat list (not derived from the cards) so the
// icon/label pairing is explicit and doesn't depend on Tailwind's JIT
// scanner picking up dynamically-interpolated class names (it won't).
const NAV_SECTIONS: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'section-config',      label: 'Configuration',     icon: Cog6ToothIcon },
  { id: 'section-booking',     label: 'Booking Hours',     icon: CalendarDaysIcon },
  { id: 'section-departments', label: 'Departments',       icon: UserGroupIcon },
  { id: 'section-tool-model',  label: 'Tool Model',        icon: CpuChipIcon },
  { id: 'section-ai-usage',    label: 'AI Usage & Limits', icon: ChartBarIcon },
  { id: 'section-voice',       label: 'Voice',             icon: MicrophoneIcon },
  // { id: 'section-human-handoff', label: 'Human Handoff',  icon: UserIcon },
  { id: 'section-appearance',  label: 'Appearance',        icon: SwatchIcon },
  { id: 'section-website',     label: 'Website Content',   icon: GlobeAltIcon },
  { id: 'section-catalog',     label: 'Product Catalog',   icon: Square3Stack3DIcon },
  { id: 'section-datasets',    label: 'Business Knowledge', icon: CircleStackIcon },
  { id: 'section-embed',       label: 'Widget Key & Embed', icon: KeyIcon },
];

const WIDGET_FONT_STACK_DEFAULT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: WIDGET_FONT_STACK_DEFAULT, label: 'System Default' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
];

const SIZE_OPTIONS: { value: NonNullable<TenantWidgetTheme['size']>; label: string; description: string }[] = [
  { value: 'compact',  label: 'Compact',  description: '336 × 470 — today\'s original footprint' },
  { value: 'standard', label: 'Standard', description: '392 × 600 — bigger, easier to read at a glance' },
  { value: 'large',    label: 'Large',    description: '420 × 680 — the most screen real estate' },
];

// backgroundImageUrl is excluded from the Required<> — unlike every color
// field, there's no sensible "default" image to resolve to; it's genuinely
// optional (undefined = plain color background, exactly as before this
// field existed).
type ResolvedTheme = Required<Omit<TenantWidgetTheme, 'backgroundImageUrl'>> & Pick<TenantWidgetTheme, 'backgroundImageUrl'>;

/** Mirrors the backend's own resolveWidgetTheme() (public-widget.service.ts)
 * exactly — an unset field resolves from the selected template's own
 * default palette, never to a hardcoded value independent of template, so
 * this preview and the real embedded widget always agree. */
function resolveTheme(theme: TenantWidgetTheme | undefined, template: Template, accentFallback: string): ResolvedTheme {
  const isDark = template === 'dark';
  const accentColor = theme?.accentColor || accentFallback || '#2563eb';
  return {
    accentColor,
    headerColor:     theme?.headerColor     || (isDark ? '#1a1f2e' : accentColor),
    headerTextColor: theme?.headerTextColor || '#ffffff',
    backgroundColor: theme?.backgroundColor || (isDark ? '#f4f5f7' : '#f8f9fb'),
    botBubbleColor:  theme?.botBubbleColor  || '#ffffff',
    botTextColor:    theme?.botTextColor    || '#1e2430',
    userBubbleColor: theme?.userBubbleColor || (isDark ? '#1a1f2e' : accentColor),
    userTextColor:   theme?.userTextColor   || '#ffffff',
    fontFamily:      theme?.fontFamily      || WIDGET_FONT_STACK_DEFAULT,
    size:            theme?.size            || 'standard',
  };
}

/** One labeled color swatch — native color input (real picker) + a hex text
 * field kept in sync, so an admin can either click-and-pick or paste an
 * exact brand hex. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-muted mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 rounded-md border border-border cursor-pointer shrink-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-full min-w-0 px-2.5 py-1.5 text-xs font-mono bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        />
      </div>
    </div>
  );
}

/** A tiny, purely illustrative mockup of each template's actual structure —
 * not a live render of the real widget, but distinct enough (status bar for
 * Modern, no avatar for Minimal, horizontal pills for Chips, a vertical
 * stacked action menu for Dark) that the four are tellable apart at a
 * glance, matching how the real templates now differ structurally too. */
function TemplatePreview({ id, theme }: { id: Template; theme: ResolvedTheme }) {
  const { headerColor, headerTextColor, backgroundColor, botBubbleColor, userBubbleColor, accentColor } = theme;
  const headerDark = shadeColor(headerColor, -0.18);
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ width: '100%', height: 72, background: backgroundColor }}>
      <div
        className="flex items-center gap-1.5 px-2"
        style={{ height: 22, background: id === 'modern' ? `linear-gradient(135deg, ${headerColor}, ${headerDark})` : headerColor }}
      >
        {id !== 'minimal' && (
          <span
            className="rounded-full shrink-0 flex items-center justify-center text-[6px] font-bold"
            style={{ width: 11, height: 11, background: id === 'chips' ? headerTextColor : 'rgba(255,255,255,0.35)', color: headerColor }}
          >
            {id === 'chips' ? 'L' : ''}
          </span>
        )}
        <span className="h-1 rounded-full" style={{ width: 30, background: headerTextColor, opacity: 0.7 }} />
      </div>
      {id === 'modern' && (
        <div className="flex items-center gap-1 px-2" style={{ height: 10, background: `linear-gradient(135deg, ${headerColor}, ${headerDark})` }}>
          <span className="rounded-full shrink-0" style={{ width: 4, height: 4, background: '#4ade80' }} />
          <span className="h-[3px] rounded-full" style={{ width: 20, background: headerTextColor, opacity: 0.6 }} />
        </div>
      )}
      <div className="p-1.5 flex flex-col gap-1">
        <span
          className="h-2 self-start"
          style={{ width: 42, background: botBubbleColor, border: '1px solid rgba(0,0,0,0.08)', borderRadius: id === 'minimal' ? 3 : '2px 7px 7px 7px' }}
        />
        {id === 'chips' && (
          <div className="flex gap-1">
            <span className="h-2 rounded-full border" style={{ width: 20, borderColor: accentColor }} />
            <span className="h-2 rounded-full border" style={{ width: 16, borderColor: accentColor }} />
          </div>
        )}
        {id === 'dark' && (
          <div className="flex flex-col gap-[3px]">
            <span className="h-[7px] rounded" style={{ background: botBubbleColor, border: '1px solid rgba(0,0,0,0.08)' }} />
            <span className="h-[7px] rounded" style={{ background: botBubbleColor, border: '1px solid rgba(0,0,0,0.08)' }} />
          </div>
        )}
        {(id === 'modern' || id === 'minimal') && (
          <span
            className="h-2 self-end"
            style={{ width: 26, background: userBubbleColor, borderRadius: id === 'minimal' ? 3 : '7px 2px 7px 7px' }}
          />
        )}
      </div>
    </div>
  );
}

function shadeColor(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '#2563eb').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  const r = clamp(((n >> 16) & 0xff) + 255 * amount);
  const g = clamp(((n >> 8) & 0xff) + 255 * amount);
  const b = clamp((n & 0xff) + 255 * amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const API_ORIGIN: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
// Defaults to the backend's own static-serve path (today's exact local-dev
// behavior — app.ts serves the bundle at /widget/loader.js). For production,
// set this to the widget's own separately-deployed static site's full script
// URL instead (e.g. https://leadryze-widget.onrender.com/loader.js) — a
// Render Static Site serves its build output at its root, no /widget prefix,
// which is why this is one full URL rather than an origin + a shared suffix.
const WIDGET_SCRIPT_URL: string = (import.meta as any).env?.VITE_WIDGET_SCRIPT_URL || `${API_ORIGIN}/widget/loader.js`;

// Real bug this closes: entering "127.0.0.1:5501" (a common local-dev/test
// origin, port included) stored the port verbatim, but the backend's
// isOriginAllowed() (public-widget.service.ts) only ever compares against
// new URL(origin).hostname — which never includes a port — so a domain
// entered with a port could never match and silently 403'd forever. The
// model's own doc comment (Tenant.widget.allowedDomains) already documents
// "bare hostnames only (no scheme/port/path)" as the intended contract;
// this was the one step that didn't actually enforce it.
function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shrink-0"
      title="Copy"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
    </button>
  );
}

/** Quick-glance chip in the page header — purely presentational, reflects
 * state already held elsewhere on the page (no data of its own). */
function StatusPill({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-background text-text-muted border-border'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-success-500' : 'bg-text-muted/40'}`} />
      {ok ? onLabel : offLabel}
    </span>
  );
}

/** Every card below shares this exact header shape (icon chip + title +
 * optional description + optional right-side slot for a toggle) — a single
 * component so the visual language stays identical across all 8 sections
 * instead of hand-repeating the markup 8 times with room to drift. */
function SectionHeader({
  id, icon: Icon, iconClassName, title, description, right,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div id={id} className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]/70 flex items-center justify-between gap-3 scroll-mt-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && <p className="text-xs text-text-muted mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export default function WidgetSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');
  const tenantId = user?.tenantId ?? '';

  const { data: tenant, isLoading, error } = useTenantQuery(isAdmin ? tenantId : '');
  const { data: teamsData } = useTeamsListQuery({ limit: 100 });
  const teamUpdateMutation = useTeamUpdate();
  const { data: servicesData } = useServicesListQuery({ limit: 200 });
  const updateMutation = useUpdateTenantWidget(tenantId);
  const brandingMutation = useUpdateTenantBranding(tenantId);
  const aiConfigMutation = useUpdateTenantAIConfig(tenantId);
  const { data: aiUsage } = useTenantAiUsageQuery(tenantId);
  const regenMutation  = useRegenerateWidgetKey(tenantId);
  const crawlMutation  = useTriggerWebsiteCrawl();
  const qc = useQueryClient();
  const uploadLogoMutation = useUploadWidgetLogo(tenantId);
  const removeLogoMutation = useRemoveWidgetLogo(tenantId);
  const uploadBgImageMutation = useUploadWidgetBackgroundImage(tenantId);
  const removeBgImageMutation = useRemoveWidgetBackgroundImage(tenantId);
  const { data: catalogSources } = useCatalogSources(tenantId);
  const importMutation = useImportCatalog(tenantId);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const bgImageFileInputRef = useRef<HTMLInputElement>(null);
  const [bgImageMessage, setBgImageMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const { data: datasets } = useDatasetsList(tenantId);
  const importDatasetMutation = useImportDataset(tenantId);
  const toggleDatasetMutation = useToggleDatasetAvailable(tenantId);
  const deleteDatasetMutation = useDeleteDataset(tenantId);
  const datasetFileInputRef = useRef<HTMLInputElement>(null);

  const [enabled, setEnabled]           = useState(false);
  const [domains, setDomains]           = useState<string[]>([]);
  const [domainInput, setDomainInput]   = useState('');
  const [greeting, setGreeting]         = useState('');
  const [quickQuestions, setQuickQuestions] = useState<{ text: string; enabled: boolean }[]>([]);
  const [quickQuestionInput, setQuickQuestionInput] = useState('');
  const [showBookingQuickReply, setShowBookingQuickReply] = useState(true);
  const [autoSendLeadEmails, setAutoSendLeadEmails] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactMessage, setContactMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [widgetName, setWidgetName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [identityMessage, setIdentityMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [teamId, setTeamId]             = useState('');
  const [websiteUrl, setWebsiteUrl]     = useState('');
  const [template, setTemplate]         = useState<Template>('modern');
  // Sparse — only the fields this tenant has explicitly overridden. Unset
  // fields are resolved live via resolveTheme() (template default), never
  // baked into this state, so switching templates below instantly previews
  // that template's own palette without needing to copy values in/out.
  const [theme, setTheme]               = useState<TenantWidgetTheme>({});
  const [toolModelPreset, setToolModelPreset] = useState<ToolModelPreset | ''>('');
  const [toolModelMessage, setToolModelMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [autoConvertLeadOnMeetingCompleted, setAutoConvertLeadOnMeetingCompleted] = useState(false);
  const [bookingEnabled, setBookingEnabled]   = useState(false);
  const [bookingTimezone, setBookingTimezone] = useState('UTC');
  const [bookingSlotMinutes, setBookingSlotMinutes]     = useState(30);
  const [bookingLeadTimeHours, setBookingLeadTimeHours] = useState(2);
  const [bookingHorizonDays, setBookingHorizonDays]     = useState(14);
  const [bookingHours, setBookingHours] = useState<WeekHours>(defaultWeekHours());
  // undefined = "never explicitly configured" — resolved on the AI side as
  // requireTeam ?? hasWidgetDepartments, so an untouched tenant with
  // showInWidget departments keeps asking about them, unchanged. The
  // checkbox itself only ever writes an explicit true/false once touched.
  const [bookingRequireTeam, setBookingRequireTeam] = useState<boolean | undefined>(undefined);
  const [bookingRequireService, setBookingRequireService] = useState<boolean | undefined>(undefined);
  const [bookingRequireName, setBookingRequireName] = useState(true);
  const [bookingContactRequirement, setBookingContactRequirement] = useState<'email_only' | 'phone_only' | 'email_or_phone' | 'email_and_phone'>('email_or_phone');
  const [bookingStaffLabel, setBookingStaffLabel] = useState('team member');
  const [bookingMessage, setBookingMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [voiceEnabled, setVoiceEnabled]   = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('groq');
  const [voiceName, setVoiceName]         = useState('');
  const [sttLanguage, setSttLanguage]     = useState('');
  const [voiceAutoPlay, setVoiceAutoPlay] = useState(true);
  const [continuousModeEnabled, setContinuousModeEnabled] = useState(false);
  const [maxSessionMinutes, setMaxSessionMinutes] = useState<string>('');
  const [allowTextDuringVoice, setAllowTextDuringVoice] = useState(true);
  const [voicePresetGender, setVoicePresetGender] = useState<'female' | 'male'>('female');
  const [testVoiceState, setTestVoiceState] = useState<'idle' | 'loading' | 'error'>('idle');
  const testVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceMessage, setVoiceMessage]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [appearanceMessage, setAppearanceMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // "Connect with an expert" — OFF by default for every tenant (see ground
  // rule #1 on the Human Handoff feature); this useState default is only
  // the pre-hydration value, immediately overwritten once `tenant` loads.
  const [humanHandoffEnabled, setHumanHandoffEnabled] = useState(false);
  const [humanHandoffButtonText, setHumanHandoffButtonText] = useState('Connect with an expert');
  const [humanHandoffWaitingMessage, setHumanHandoffWaitingMessage] = useState('');
  const [humanHandoffOfflineMessage, setHumanHandoffOfflineMessage] = useState('');
  const [humanHandoffMessage, setHumanHandoffMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [departmentsMessage, setDepartmentsMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [togglingTeamId, setTogglingTeamId] = useState<string | null>(null);
  const [message, setMessage]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [keyMessage, setKeyMessage]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<{ fileName: string; fileType: 'excel' | 'csv'; aoa: unknown[][] } | null>(null);
  const [datasetMessage, setDatasetMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<
    { fileName: string; fileType: 'excel' | 'csv' | 'json'; aoa?: unknown[][]; jsonRows?: Record<string, unknown>[] } | null
  >(null);
  const [datasetDeleteConfirm, setDatasetDeleteConfirm] = useState<string | null>(null);
  // Hardening Gap 8 — the import mutation now resolves near-instantly
  // (the backend responds before the pipeline finishes), so this tracks
  // which dataset to actually poll for real progress.
  const [importingDatasetId, setImportingDatasetId] = useState<string | null>(null);
  const importStatus = useDatasetImportStatus(tenantId, importingDatasetId, { enabled: !!importingDatasetId });

  // Watches the polled import status to terminal completion, then shows
  // the real result and refreshes the dataset list (which the mutation's
  // own onSuccess already did once, too early to have final counts). Must
  // stay above this component's early `if (isLoading)`/`if (!tenant)`
  // returns below — every hook in this component does, since React
  // requires the exact same hooks in the exact same order on every render;
  // placing this next to the handler functions (as originally written) put
  // it AFTER those guards, so it was skipped entirely on the loading
  // render and only started firing once `tenant` loaded — a real,
  // confirmed "Rendered more hooks than during the previous render" crash.
  useEffect(() => {
    const latest = importStatus.data?.[0];
    if (!latest || !['ready', 'ready_with_warnings', 'failed'].includes(latest.status)) return;
    setDatasetMessage(
      latest.status === 'failed'
        ? { type: 'err', text: latest.lastError ?? 'Import failed — no rows could be imported.' }
        : {
            type: 'ok',
            text: `Imported ${latest.recordsInserted} record(s)` +
              (latest.status === 'ready_with_warnings' ? ' (some rows or records had issues)' : '') +
              (latest.diffUpdated + latest.diffRemoved + latest.diffUnchanged > 0
                ? ` — ${latest.diffAdded} new, ${latest.diffUpdated} updated, ${latest.diffRemoved} removed, ${latest.diffUnchanged} unchanged`
                : '') +
              (latest.cellsTruncated ? ` — ${latest.cellsTruncated} cell value(s) were truncated during processing` : '') + '.',
          },
    );
    setImportingDatasetId(null);
    qc.invalidateQueries({ queryKey: ['native-crm', 'datasets', tenantId] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importStatus.data]);
  const [logoMessage, setLogoMessage]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // Holds the just-picked file while the crop modal is open — null means
  // the modal is closed. Nothing is uploaded until the admin confirms the
  // crop (see handleLogoCropConfirm), so cancelling never touches the server.
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [isCrawlPolling, setIsCrawlPolling] = useState(false);

  const { data: crawlStatus } = useCrawlStatus(tenantId, { enabled: isCrawlPolling });

  useEffect(() => {
    if (tenant?.widget) {
      setEnabled(tenant.widget.enabled);
      setDomains(tenant.widget.allowedDomains ?? []);
      setGreeting(tenant.widget.greeting ?? '');
      setQuickQuestions(tenant.widget.quickQuestions ?? []);
      setShowBookingQuickReply(tenant.widget.showBookingQuickReply !== false);
      setAutoSendLeadEmails(tenant.widget.autoSendLeadEmails !== false);
      setTeamId(tenant.widget.defaultTeamId ?? '');
      setWebsiteUrl(tenant.widget.websiteUrl ?? '');
      setTemplate(tenant.widget.template ?? 'modern');
      setTheme(tenant.widget.theme ?? {});
      // A crawl started elsewhere (another tab, or before this page was
      // last reloaded) can leave the tenant doc mid-crawl even though this
      // tab's own local isCrawlPolling never got set — resume live polling
      // so the status pill doesn't sit stuck on stale local state.
      if (tenant.widget.crawlStatus === 'crawling') setIsCrawlPolling(true);

      const booking = tenant.widget.booking;
      setBookingEnabled(booking?.enabled ?? false);
      setBookingTimezone(booking?.timezone ?? 'UTC');
      setBookingSlotMinutes(booking?.slotMinutes ?? 30);
      setBookingLeadTimeHours(booking?.leadTimeHours ?? 2);
      setBookingHorizonDays(booking?.horizonDays ?? 14);
      if (booking?.hours) {
        const week = defaultWeekHours();
        for (const { day } of WEEKDAYS) week[day] = { ...DEFAULT_DAY, open: false };
        for (const h of booking.hours) week[h.day] = { open: true, start: h.start, end: h.end };
        setBookingHours(week);
      } else {
        setBookingHours(defaultWeekHours());
      }
      setBookingRequireTeam(booking?.requireTeam);
      setBookingRequireService(booking?.requireService);
      setBookingRequireName(booking?.requireName ?? true);
      setBookingContactRequirement(booking?.contactRequirement ?? 'email_or_phone');
      setBookingStaffLabel(booking?.staffLabel ?? 'team member');

      const voice = tenant.widget.voice;
      setVoiceEnabled(voice?.enabled ?? false);
      setVoiceProvider(voice?.sttProvider ?? 'groq');
      setVoiceName(voice?.voiceName ?? '');
      setSttLanguage(voice?.sttLanguage ?? '');
      setVoiceAutoPlay(voice?.autoPlay ?? true);
      setContinuousModeEnabled(voice?.continuousModeEnabled ?? false);
      setMaxSessionMinutes(voice?.maxSessionMinutes ? String(voice.maxSessionMinutes) : '');
      setAllowTextDuringVoice(voice?.allowTextDuringVoice ?? true);
      setVoicePresetGender(voice?.voicePreset?.gender ?? 'female');

      const humanHandoff = tenant.widget.humanHandoff;
      setHumanHandoffEnabled(humanHandoff?.enabled ?? false);
      setHumanHandoffButtonText(humanHandoff?.buttonText ?? 'Connect with an expert');
      setHumanHandoffWaitingMessage(humanHandoff?.waitingMessage ?? '');
      setHumanHandoffOfflineMessage(humanHandoff?.offlineMessage ?? '');
    }
    setToolModelPreset(tenant?.aiConfig?.toolModelPreset ?? '');
    setAutoConvertLeadOnMeetingCompleted(tenant?.aiConfig?.autoConvertLeadOnMeetingCompleted ?? false);
    setContactEmail(tenant?.branding?.contactEmail ?? '');
    setContactPhone(tenant?.branding?.contactPhone ?? '');
    setContactAddress(tenant?.branding?.address ?? '');
    setWidgetName(tenant?.aiConfig?.agentName ?? '');
    setCompanyName(tenant?.branding?.companyName ?? '');
  }, [tenant]);

  useEffect(() => {
    if (isCrawlPolling && crawlStatus && crawlStatus.status !== 'running') {
      setIsCrawlPolling(false);
      if (crawlStatus.status === 'completed') {
        const failedCount = crawlStatus.failures?.length ?? 0;
        setCrawlMessage({
          // Still 'ok' even with some failures — a mostly-successful crawl
          // isn't an error state, matching crawlStatus.status distinguishing
          // 'ready_with_warnings' from 'failed' on the persisted side too.
          type: 'ok',
          text: failedCount > 0
            ? `Crawled ${crawlStatus.pagesCrawled ?? 0} page(s), ingested ${crawlStatus.chunksIngested ?? 0} chunk(s) — ${failedCount} page(s) failed and were skipped.`
            : `Crawled ${crawlStatus.pagesCrawled ?? 0} page(s), ingested ${crawlStatus.chunksIngested ?? 0} chunk(s) into the widget's knowledge base.`,
        });
      } else {
        setCrawlMessage({ type: 'err', text: crawlStatus.error || 'Crawl failed.' });
      }
      // The tenant doc was already updated by the AI service's own
      // recordWebsiteCrawlResult call by the time polling stops — refetch
      // so the status pill/counts above reflect the real persisted values
      // instead of waiting for some other unrelated refetch to happen.
      qc.invalidateQueries({ queryKey: ['tenants', tenantId] });
    }
  }, [crawlStatus, isCrawlPolling]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-text-muted">
        <LockClosedIcon className="h-10 w-10 mb-2 text-text-muted" />
        <p className="text-sm">Only admins can configure the AI chatbot widget.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-2">{[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted text-sm">
        Could not load widget settings.
      </div>
    );
  }

  const widgetKey = tenant.widget?.widgetKey;
  const embedSnippet = widgetKey
    ? `<script src="${WIDGET_SCRIPT_URL}" data-widget-key="${widgetKey}" async></script>`
    : '';

  const addDomain = () => {
    const d = normalizeDomain(domainInput);
    if (d && !domains.includes(d)) setDomains([...domains, d]);
    setDomainInput('');
  };
  const removeDomain = (d: string) => setDomains(domains.filter((x) => x !== d));

  const addQuickQuestion = () => {
    const q = quickQuestionInput.trim();
    if (q && !quickQuestions.some((x) => x.text === q)) setQuickQuestions([...quickQuestions, { text: q, enabled: true }]);
    setQuickQuestionInput('');
  };
  const removeQuickQuestion = (text: string) => setQuickQuestions(quickQuestions.filter((x) => x.text !== text));
  const toggleQuickQuestion = (text: string) =>
    setQuickQuestions(quickQuestions.map((x) => (x.text === text ? { ...x, enabled: !x.enabled } : x)));

  const handleSave = async () => {
    setMessage(null);
    try {
      await updateMutation.mutateAsync({
        enabled, allowedDomains: domains, greeting, quickQuestions, showBookingQuickReply, autoSendLeadEmails, defaultTeamId: teamId || null, template, theme,
      });
      setMessage({ type: 'ok', text: 'Widget settings saved.' });
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  // Previously there was no dedicated save here at all — this section's own
  // "Applies immediately once you click Save Settings above" text pointed at
  // the Configuration section's save button, far above and off-screen once
  // scrolled down to Appearance, which made color changes look like they
  // silently did nothing. Every other section (Voice, Human Handoff,
  // Booking) already has its own save button — this brings Appearance in
  // line with that same pattern, scoped only to template/theme so it can't
  // accidentally overwrite unrelated Configuration fields.
  const handleAppearanceSave = async () => {
    setAppearanceMessage(null);
    try {
      // `theme` (local color-picker state) never tracks backgroundImageUrl
      // — that field is server-upload-only, written directly by the
      // dedicated upload/remove mutations below, same write-protection
      // posture as widget.logoUrl. The backend replaces the WHOLE
      // widget.theme sub-document on save (not a per-field merge — same as
      // every other theme field already), so without re-attaching the
      // live value here, saving a color change would silently wipe out
      // whatever background image was uploaded.
      await updateMutation.mutateAsync({
        template,
        theme: { ...theme, backgroundImageUrl: tenant.widget?.theme?.backgroundImageUrl },
      });
      setAppearanceMessage({ type: 'ok', text: 'Appearance saved.' });
    } catch (err: any) {
      setAppearanceMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  const handleContactInfoSave = async () => {
    setContactMessage(null);
    try {
      await brandingMutation.mutateAsync({
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: contactAddress.trim(),
      });
      setContactMessage({ type: 'ok', text: 'Contact info saved.' });
    } catch (err: any) {
      setContactMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  const handleWidgetIdentitySave = async () => {
    setIdentityMessage(null);
    try {
      await Promise.all([
        brandingMutation.mutateAsync({ companyName: companyName.trim() }),
        aiConfigMutation.mutateAsync({ agentName: widgetName.trim() }),
      ]);
      setIdentityMessage({ type: 'ok', text: 'Widget identity saved.' });
    } catch (err: any) {
      setIdentityMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  const handleToolModelSave = async () => {
    setToolModelMessage(null);
    try {
      await aiConfigMutation.mutateAsync({ toolModelPreset: toolModelPreset || null, autoConvertLeadOnMeetingCompleted });
      setToolModelMessage({ type: 'ok', text: 'Settings saved.' });
    } catch (err: any) {
      setToolModelMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };


  const handleBookingSave = async () => {
    setBookingMessage(null);
    try {
      const hours = WEEKDAYS
        .filter(({ day }) => bookingHours[day]?.open)
        .map(({ day }) => ({ day, start: bookingHours[day].start, end: bookingHours[day].end }));
      await updateMutation.mutateAsync({
        booking: {
          enabled: bookingEnabled,
          timezone: bookingTimezone.trim() || 'UTC',
          slotMinutes: bookingSlotMinutes,
          leadTimeHours: bookingLeadTimeHours,
          horizonDays: bookingHorizonDays,
          hours,
          requireTeam: bookingRequireTeam,
          requireService: bookingRequireService,
          requireName: bookingRequireName,
          contactRequirement: bookingContactRequirement,
          staffLabel: bookingStaffLabel.trim() || 'team member',
        },
      });
      setBookingMessage({ type: 'ok', text: 'Booking hours saved.' });
    } catch (err: any) {
      setBookingMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  // Reuses updateMutation (useUpdateTenantWidget) directly — voice is just
  // one more field on the same widget object, exactly like booking already
  // is, so no separate mutation hook was needed for this.
  const handleVoiceSave = async () => {
    setVoiceMessage(null);
    try {
      await updateMutation.mutateAsync({
        voice: {
          enabled: voiceEnabled,
          sttProvider: voiceProvider,
          ttsProvider: voiceProvider,
          voiceName: voiceName.trim() || undefined,
          sttLanguage: sttLanguage.trim() || undefined,
          autoPlay: voiceAutoPlay,
          continuousModeEnabled,
          maxSessionMinutes: maxSessionMinutes.trim() ? Number(maxSessionMinutes) : undefined,
          allowTextDuringVoice,
          voicePreset: continuousModeEnabled ? CARTESIA_VOICE_PRESETS[voicePresetGender] : undefined,
        },
      });
      setVoiceMessage({ type: 'ok', text: 'Voice settings saved.' });
    } catch (err: any) {
      setVoiceMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  // Same reuse-updateMutation pattern as Voice/Booking above — humanHandoff
  // is just one more field on the same widget object.
  const handleHumanHandoffSave = async () => {
    setHumanHandoffMessage(null);
    try {
      await updateMutation.mutateAsync({
        humanHandoff: {
          enabled: humanHandoffEnabled,
          buttonText: humanHandoffButtonText.trim() || 'Connect with an expert',
          waitingMessage: humanHandoffWaitingMessage.trim()
            || "We're connecting you with a team member — someone will be with you shortly.",
          offlineMessage: humanHandoffOfflineMessage.trim() || undefined,
        },
      });
      setHumanHandoffMessage({ type: 'ok', text: 'Human Handoff settings saved.' });
    } catch (err: any) {
      setHumanHandoffMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
    }
  };

  // Synthesizes a short sample sentence with the currently-selected preset
  // voice so a tenant admin can hear it before it's ever used on a real
  // continuous-voice call — calls the AI service's preview endpoint through
  // the same authenticated staff-JWT proxy the Voice Playground already
  // uses, not the public widgetKey path.
  const handleTestVoice = async () => {
    setTestVoiceState('loading');
    try {
      const res = await api.post('/api/v1/ai/voice/preview', { voiceId: voicePresetGender });
      const data = res.data.data as { audio: string; audioFormat: string };
      if (testVoiceAudioRef.current) {
        testVoiceAudioRef.current.src = `data:audio/${data.audioFormat};base64,${data.audio}`;
        void testVoiceAudioRef.current.play().catch(() => {});
      }
      setTestVoiceState('idle');
    } catch {
      setTestVoiceState('error');
    }
  };

  const handleToggleDepartment = async (teamId: string, showInWidget: boolean) => {
    setDepartmentsMessage(null);
    setTogglingTeamId(teamId);
    try {
      await teamUpdateMutation.mutateAsync({ id: teamId, data: { showInWidget } });
    } catch {
      setDepartmentsMessage({ type: 'err', text: 'Could not update that department — try again.' });
    } finally {
      setTogglingTeamId(null);
    }
  };

  // Which real catalog Services this department handles — routes a
  // chatbot-captured free-text service mention to this team's own
  // round-robin roster instead of always falling back to the tenant's one
  // fixed default team. Same team-level Save-immediately UX as the
  // showInWidget toggle above; editable per-team in full on the Teams page
  // too (this is a convenience surface, not a second source of truth).
  const handleToggleTeamService = async (team: any, serviceId: string, checked: boolean) => {
    setDepartmentsMessage(null);
    setTogglingTeamId(team._id);
    const current: string[] = (team.serviceIds ?? []).map((s: any) => (typeof s === 'object' ? s._id : s));
    const next = checked ? [...current, serviceId] : current.filter((id) => id !== serviceId);
    try {
      await teamUpdateMutation.mutateAsync({ id: team._id, data: { serviceIds: next } });
    } catch {
      setDepartmentsMessage({ type: 'err', text: 'Could not update that department’s services — try again.' });
    } finally {
      setTogglingTeamId(null);
    }
  };

  const handleRegenerate = async () => {
    setConfirmingRegen(false);
    setKeyMessage(null);
    try {
      await regenMutation.mutateAsync();
      setKeyMessage({ type: 'ok', text: 'New widget key generated — update your embed snippet on your website.' });
    } catch {
      setKeyMessage({ type: 'err', text: 'Could not regenerate the widget key.' });
    }
  };

  // Opens the crop modal instead of uploading immediately — the logo
  // renders inside a circular avatar (see WidgetUI's #lr-avatar), and an
  // arbitrary-aspect-ratio source image forced into that via plain
  // object-fit:cover crops at whatever point the browser picks, which
  // often cuts off the actual mark. Nothing reaches the server until the
  // admin confirms a crop in ImageCropModal.
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setLogoCropFile(file);
  };

  const handleLogoCropConfirm = async (croppedFile: File) => {
    setLogoCropFile(null);
    setLogoMessage(null);
    try {
      await uploadLogoMutation.mutateAsync(croppedFile);
      setLogoMessage({ type: 'ok', text: 'Logo uploaded.' });
    } catch (err: any) {
      setLogoMessage({ type: 'err', text: err?.response?.data?.message ?? 'Upload failed — try a smaller image (max 5 MB).' });
    }
  };

  const handleRemoveLogo = async () => {
    setLogoMessage(null);
    try {
      await removeLogoMutation.mutateAsync();
      setLogoMessage({ type: 'ok', text: 'Logo removed.' });
    } catch {
      setLogoMessage({ type: 'err', text: 'Could not remove the logo.' });
    }
  };

  const handleBgImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setBgImageMessage(null);
    try {
      await uploadBgImageMutation.mutateAsync(file);
      setBgImageMessage({ type: 'ok', text: 'Background image uploaded.' });
    } catch (err: any) {
      setBgImageMessage({ type: 'err', text: err?.response?.data?.message ?? 'Upload failed — try a smaller image (max 5 MB).' });
    }
  };

  const handleRemoveBgImage = async () => {
    setBgImageMessage(null);
    try {
      await removeBgImageMutation.mutateAsync();
      setBgImageMessage({ type: 'ok', text: 'Background image removed.' });
    } catch {
      setBgImageMessage({ type: 'err', text: 'Could not remove the background image.' });
    }
  };

  const handleCrawl = async () => {
    setCrawlMessage(null);
    const url = websiteUrl.trim();
    if (!url) { setCrawlMessage({ type: 'err', text: 'Enter your website URL first.' }); return; }
    try {
      await updateMutation.mutateAsync({ websiteUrl: url });
      await crawlMutation.mutateAsync({ tenantId, startUrl: url });
      setIsCrawlPolling(true);
      setCrawlMessage({ type: 'ok', text: 'Crawling your website — this can take a minute for larger sites.' });
    } catch (err: any) {
      setCrawlMessage({ type: 'err', text: err?.response?.data?.message ?? 'Could not start the crawl.' });
    }
  };

  // Parsing happens entirely client-side (same convention already used for
  // Lead/Deal bulk import elsewhere in this app) — the backend never
  // receives a file, only plain JSON rows. Excel/CSV go through a preview
  // step first (header-row detection can be wrong on a genuinely
  // ambiguous sheet, so nothing imports until the tenant confirms what
  // was detected) — JSON has no header-row concept at all, so it keeps
  // today's exact immediate-import behavior, unaffected by this change.
  const handleCatalogFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setCatalogMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const fileType: 'excel' | 'csv' | 'json' = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'excel';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (fileType === 'json') {
          const rows = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(rows) || !rows.length) {
            setCatalogMessage({ type: 'err', text: 'No rows found in that file.' });
            return;
          }
          const summary = await importMutation.mutateAsync({ fileType, fileLabel: file.name, rows });
          setCatalogMessage({
            type: 'ok',
            text: `Imported: ${summary.created} new, ${summary.updated} updated, ${summary.unchanged} unchanged` +
              (summary.rejected.length ? `, ${summary.rejected.length} rejected.` : '.'),
          });
          return;
        }

        const wb = XLSX.read(ev.target?.result, { type: fileType === 'csv' ? 'string' : 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        if (!Array.isArray(aoa) || !aoa.length) {
          setCatalogMessage({ type: 'err', text: 'No rows found in that file.' });
          return;
        }
        setCatalogPreview({ fileName: file.name, fileType, aoa });
      } catch {
        setCatalogMessage({ type: 'err', text: 'Could not read or import that file — check the format and try again.' });
      }
    };
    if (fileType === 'excel') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const confirmCatalogImport = async (rows: Record<string, unknown>[]) => {
    if (!catalogPreview) return;
    try {
      const summary = await importMutation.mutateAsync({ fileType: catalogPreview.fileType, fileLabel: catalogPreview.fileName, rows });
      setCatalogMessage({
        type: 'ok',
        text: `Imported: ${summary.created} new, ${summary.updated} updated, ${summary.unchanged} unchanged` +
          (summary.rejected.length ? `, ${summary.rejected.length} rejected.` : '.'),
      });
      setCatalogPreview(null);
    } catch {
      setCatalogMessage({ type: 'err', text: 'Could not import that file — check the format and try again.' });
    }
  };

  // Generic Dataset system's own upload path — unlike the Product Catalog
  // above, EVERY file type (including JSON) goes through the preview step,
  // since the per-column semantic-role mapping is exactly what this system
  // needs confirmed before anything imports, not just the header row.
  const handleDatasetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDatasetMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const fileType: 'excel' | 'csv' | 'json' = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'excel';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (fileType === 'json') {
          const rows = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(rows) || !rows.length) {
            setDatasetMessage({ type: 'err', text: 'No rows found in that file.' });
            return;
          }
          setDatasetPreview({ fileName: file.name, fileType, jsonRows: rows });
          return;
        }
        const wb = XLSX.read(ev.target?.result, { type: fileType === 'csv' ? 'string' : 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        if (!Array.isArray(aoa) || !aoa.length) {
          setDatasetMessage({ type: 'err', text: 'No rows found in that file.' });
          return;
        }
        setDatasetPreview({ fileName: file.name, fileType, aoa });
      } catch {
        setDatasetMessage({ type: 'err', text: 'Could not read that file — check the format and try again.' });
      }
    };
    if (fileType === 'excel') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const confirmDatasetImport = async (params: {
    datasetId?: string; name: string; sourceFileName: string; sourceType: 'excel' | 'csv' | 'json';
    columns: DatasetColumn[]; headerRowIndex: number; rows: Record<string, unknown>[]; imageZipRef?: string;
  }) => {
    // The ZIP (if any) is already uploaded by this point — DatasetImportPreview
    // uploads it immediately on selection so its own live match-preview has
    // a real ref to check against, rather than deferring the upload to here.
    try {
      const result = await importDatasetMutation.mutateAsync(params);
      setDatasetPreview(null);
      // Hardening Gap 8 — the mutation now resolves as soon as the backend
      // has created the version and kicked off the background pipeline,
      // not once it's actually done; start polling for the real outcome.
      setDatasetMessage({ type: 'ok', text: 'Import started — processing in the background…' });
      setImportingDatasetId(result.datasetId);
    } catch (err: any) {
      setDatasetMessage({ type: 'err', text: err?.response?.data?.message ?? 'Could not import that file — check the format and try again.' });
    }
  };

  const input = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400 focus:border-transparent';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-ryze-500 to-ryze-700 flex items-center justify-center shrink-0 shadow-sm">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">AI Chatbot Widget</h1>
            <p className="text-xs text-text-muted truncate">Let visitors on your own website chat with your AI sales agent 24/7</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <StatusPill ok={enabled} onLabel="Widget live" offLabel="Widget off" />
          <StatusPill ok={bookingEnabled} onLabel="Booking on" offLabel="Booking off" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-start gap-8">
          <nav className="hidden lg:block w-52 shrink-0 sticky top-8 space-y-0.5">
            <p className="px-3 pb-2 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Jump to section</p>
            {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            ))}
          </nav>

          <div className="flex-1 min-w-0 max-w-2xl space-y-6">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-config"
              icon={Cog6ToothIcon}
              iconClassName="bg-black/[0.06] dark:bg-white/[0.08] text-text-muted"
              title="Configuration"
              description="Core on/off switch, allowed domains, and greeting."
              right={
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-text-muted">{enabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                </label>
              }
            />

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Allowed Domains</label>
                <div className="flex items-center gap-2">
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
                    className={input}
                    placeholder="example.com"
                  />
                  <button
                    type="button"
                    onClick={addDomain}
                    className="px-3 py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-1 shrink-0"
                  >
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                </div>
                {domains.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {domains.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] text-text-primary text-xs px-2.5 py-1 rounded-full">
                        {d}
                        <button type="button" onClick={() => removeDomain(d)} className="text-text-muted hover:text-text-primary">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-text-muted">Only these websites may embed the widget — e.g. "example.com", "www.example.com".</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Greeting</label>
                <input value={greeting} onChange={(e) => setGreeting(e.target.value)} className={input} placeholder="Hi! How can I help you today?" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Quick Questions</label>
                <div className="flex items-center gap-2">
                  <input
                    value={quickQuestionInput}
                    onChange={(e) => setQuickQuestionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuickQuestion(); } }}
                    className={input}
                    placeholder="e.g. Show me butterfly valves"
                  />
                  <button
                    type="button"
                    onClick={addQuickQuestion}
                    className="px-3 py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-1 shrink-0"
                  >
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                </div>
                {quickQuestions.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {quickQuestions.map((q) => (
                      <div key={q.text} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={q.enabled}
                          onChange={() => toggleQuickQuestion(q.text)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={`flex-1 text-sm ${q.enabled ? 'text-text-primary' : 'text-text-muted line-through'}`}>{q.text}</span>
                        <button type="button" onClick={() => removeQuickQuestion(q.text)} className="text-text-muted hover:text-text-primary">
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-text-muted">
                  Suggestion chips shown when the widget opens. Uncheck to hide one without deleting it.
                  Clicking a chip just sends its text as a normal message — the answer always comes live from your
                  Business Knowledge, Product Catalog, or website content, never from something set here.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                  <input type="checkbox" checked={showBookingQuickReply} onChange={(e) => setShowBookingQuickReply(e.target.checked)} className="h-3.5 w-3.5" />
                  Always show a "Book an appointment" chip alongside the questions above (when booking is enabled)
                </label>
                <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                  <input type="checkbox" checked={autoSendLeadEmails} onChange={(e) => setAutoSendLeadEmails(e.target.checked)} className="h-3.5 w-3.5" />
                  Automatically email a visitor + your assigned team member when the chatbot captures a new lead
                </label>
              </div>

              <div className="border-t border-border pt-4">
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Widget Identity</label>
                <p className="mb-2 text-[11px] text-text-muted">
                  What visitors see in the chat panel's header on your website — the bold assistant name on top, and your company name underneath it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Widget Name</label>
                    <input value={widgetName} onChange={(e) => setWidgetName(e.target.value)} className={input} placeholder="LeadBot" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Company Name</label>
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} placeholder="Your Company Inc." />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWidgetIdentitySave}
                    disabled={brandingMutation.isPending || aiConfigMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 disabled:opacity-50"
                  >
                    {(brandingMutation.isPending || aiConfigMutation.isPending) ? 'Saving...' : 'Save Widget Identity'}
                  </button>
                  {identityMessage && (
                    <span className={`text-xs ${identityMessage.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{identityMessage.text}</span>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Contact Info (used in lead-confirmation emails)</label>
                <p className="mb-2 text-[11px] text-text-muted">
                  Shown to a visitor in the automatic "thank you for visiting" email above — your real, public contact details, not shown anywhere else.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={input} placeholder="sales@yourcompany.com" />
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={input} placeholder="+1 555 000 1234" />
                </div>
                <input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} className={`${input} mt-2`} placeholder="Company address" />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleContactInfoSave}
                    disabled={brandingMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 disabled:opacity-50"
                  >
                    {brandingMutation.isPending ? 'Saving...' : 'Save Contact Info'}
                  </button>
                  {contactMessage && (
                    <span className={`text-xs ${contactMessage.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{contactMessage.text}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Default Team (round-robin assignment)</label>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={input}>
                  <option value="">No default — rotate across all active staff</option>
                  {(teamsData?.items ?? []).map((t: any) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {message && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  message.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-booking"
              icon={CalendarDaysIcon}
              iconClassName="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
              title="Booking Hours"
              description="When visitors can actually book a real appointment through the widget."
              right={
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-text-muted">{bookingEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={bookingEnabled}
                    onChange={(e) => setBookingEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                </label>
              }
            />
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Timezone</label>
                  <input value={bookingTimezone} onChange={(e) => setBookingTimezone(e.target.value)} className={input} placeholder="e.g. Asia/Kolkata" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Slot Length (min)</label>
                  <input
                    type="number" min={5} step={5}
                    value={bookingSlotMinutes}
                    onChange={(e) => setBookingSlotMinutes(Math.max(5, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Lead Time (hrs)</label>
                  <input
                    type="number" min={0}
                    value={bookingLeadTimeHours}
                    onChange={(e) => setBookingLeadTimeHours(Math.max(0, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Book Ahead (days)</label>
                  <input
                    type="number" min={1}
                    value={bookingHorizonDays}
                    onChange={(e) => setBookingHorizonDays(Math.max(1, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Business Hours</label>
                <div className="space-y-1.5">
                  {WEEKDAYS.map(({ day, label }) => {
                    const d = bookingHours[day] ?? DEFAULT_DAY;
                    return (
                      <div key={day} className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={d.open}
                            onChange={(e) => setBookingHours({ ...bookingHours, [day]: { ...d, open: e.target.checked } })}
                            className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                          />
                          <span className={d.open ? 'text-text-primary' : 'text-text-muted'}>{label}</span>
                        </label>
                        <input
                          type="time"
                          value={d.start}
                          disabled={!d.open}
                          onChange={(e) => setBookingHours({ ...bookingHours, [day]: { ...d, start: e.target.value } })}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-primary disabled:bg-background disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-ryze-400"
                        />
                        <span className="text-text-muted text-xs">to</span>
                        <input
                          type="time"
                          value={d.end}
                          disabled={!d.open}
                          onChange={(e) => setBookingHours({ ...bookingHours, [day]: { ...d, end: e.target.value } })}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-primary disabled:bg-background disabled:text-text-muted focus:outline-none focus:ring-2 focus:ring-ryze-400"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-text-muted">Uncheck a day to keep it closed. Times are in the timezone set above.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Required Before Booking</label>
                <p className="mb-2 text-[11px] text-text-muted">
                  Only ask visitors for what your business actually needs — not every business needs a department/service question.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Ask which department/team</label>
                    <select
                      value={tristateToSelect(bookingRequireTeam)}
                      onChange={(e) => setBookingRequireTeam(selectToTristate(e.target.value))}
                      className={input}
                    >
                      <option value="auto">Auto (recommended) — ask only if departments are configured</option>
                      <option value="always">Always ask</option>
                      <option value="never">Never ask</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Ask what service/reason the visit is for</label>
                    <select
                      value={tristateToSelect(bookingRequireService)}
                      onChange={(e) => setBookingRequireService(selectToTristate(e.target.value))}
                      className={input}
                    >
                      <option value="auto">Auto (recommended) — off unless you turn it on</option>
                      <option value="always">Always ask</option>
                      <option value="never">Never ask</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={bookingRequireName}
                    onChange={(e) => setBookingRequireName(e.target.checked)}
                    className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                  Require the visitor's name
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Contact Info Required</label>
                  <select
                    value={bookingContactRequirement}
                    onChange={(e) => setBookingContactRequirement(e.target.value as typeof bookingContactRequirement)}
                    className={input}
                  >
                    <option value="email_or_phone">Email OR phone</option>
                    <option value="email_only">Email only</option>
                    <option value="phone_only">Phone only</option>
                    <option value="email_and_phone">Email AND phone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Staff Title</label>
                  <input
                    value={bookingStaffLabel}
                    onChange={(e) => setBookingStaffLabel(e.target.value)}
                    className={input}
                    placeholder="e.g. Doctor, Stylist, Consultant, team member"
                  />
                  <p className="mt-1 text-[11px] text-text-muted">What the AI calls a staff member when talking to visitors.</p>
                </div>
              </div>

              {bookingMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  bookingMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {bookingMessage.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleBookingSave}
                disabled={updateMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Booking Hours'}
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-departments"
              icon={UserGroupIcon}
              iconClassName="bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400"
              title="Departments"
              description="Show a team as a bookable department so visitors can pick a specific doctor/staff member — leave everything off for a simple, single booking flow. Picking which Services a department handles also routes a chatbot lead mentioning that service straight to this team, instead of your one default team."
            />
            <div className="px-6 py-5 space-y-3">
              {(teamsData?.items ?? []).length === 0 ? (
                <p className="text-xs text-text-muted">No teams exist yet — create one under Team &amp; Staff to use this.</p>
              ) : (
                (teamsData?.items ?? []).map((t: any) => {
                  const teamServiceIds: string[] = (t.serviceIds ?? []).map((s: any) => (typeof s === 'object' ? s._id : s));
                  return (
                    <div key={t._id} className="py-1">
                      <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                        <span className="text-text-primary">{t.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {togglingTeamId === t._id && <ArrowPathIcon className="h-3.5 w-3.5 text-text-muted animate-spin" />}
                          <input
                            type="checkbox"
                            checked={!!t.showInWidget}
                            disabled={togglingTeamId === t._id}
                            onChange={(e) => handleToggleDepartment(t._id, e.target.checked)}
                            className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                          />
                        </span>
                      </label>
                      {t.showInWidget && (servicesData?.items ?? []).length > 0 && (
                        <div className="mt-1.5 ml-2 pl-3 border-l border-border flex flex-wrap gap-x-4 gap-y-1">
                          {(servicesData?.items ?? []).map((svc: any) => (
                            <label key={svc._id} className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={teamServiceIds.includes(svc._id)}
                                disabled={togglingTeamId === t._id}
                                onChange={(e) => handleToggleTeamService(t, svc._id, e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                              />
                              {svc.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {departmentsMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  departmentsMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {departmentsMessage.text}
                </div>
              )}
              <p className="mt-1 text-[11px] text-text-muted">Changes save immediately — no separate Save button needed.</p>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-tool-model"
              icon={CpuChipIcon}
              iconClassName="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title="Tool Model"
              description="Which AI model looks up product/website info and handles bookings for this widget — doesn't affect your account's default assistant elsewhere."
            />
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Model</label>
                <select value={toolModelPreset} onChange={(e) => setToolModelPreset(e.target.value as ToolModelPreset | '')} className={input}>
                  {TOOL_MODEL_OPTIONS.map((o) => (
                    <option key={o.id || 'default'} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-text-muted">
                  {TOOL_MODEL_OPTIONS.find((o) => o.id === toolModelPreset)?.description}
                </p>
              </div>

              <div className="pt-3 border-t border-border">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConvertLeadOnMeetingCompleted}
                    onChange={(e) => setAutoConvertLeadOnMeetingCompleted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                  <span>
                    <span className="block text-sm font-medium text-text-primary">
                      Auto-convert Lead to Customer when their appointment is marked completed
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      Off by default — conversion stays a manual action from the Lead's own Convert tab unless this is turned on.
                    </span>
                  </span>
                </label>
              </div>

              {toolModelMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  toolModelMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {toolModelMessage.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleToolModelSave}
                disabled={aiConfigMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
              >
                {aiConfigMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-ai-usage"
              icon={ChartBarIcon}
              iconClassName="bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400"
              title="AI Usage & Limits"
              description="How much of this widget's prepaid AI credit balance has been used, and where the limit is set — the fallback message visitors see once it's reached. This is a credit balance, not a monthly subscription — it doesn't refill on its own."
              right={aiUsage && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  aiUsage.status === 'exceeded' ? 'bg-red-100 text-red-700'
                  : aiUsage.status === 'critical' ? 'bg-orange-100 text-orange-700'
                  : aiUsage.status === 'warning' ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {aiUsage.status === 'exceeded' ? 'Limit reached'
                    : aiUsage.status === 'critical' ? 'Critical'
                    : aiUsage.status === 'warning' ? 'Warning'
                    : 'Normal'}
                </span>
              )}
            />
            <div className="px-6 py-5 space-y-5">
              {aiUsage && (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-text-primary">
                      {aiUsage.tokensUsedThisMonth.toLocaleString()} / {aiUsage.monthlyTokenLimit.toLocaleString()} tokens
                    </span>
                    <span className="text-xs text-text-muted">{aiUsage.percentUsed}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        aiUsage.status === 'exceeded' ? 'bg-red-500'
                        : aiUsage.status === 'critical' ? 'bg-orange-500'
                        : aiUsage.status === 'warning' ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, aiUsage.percentUsed)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    {aiUsage.tokensRemaining.toLocaleString()} tokens remaining · plan default is {aiUsage.planDefaultTokenLimit.toLocaleString()} ({aiUsage.plan}) · credits granted {new Date(aiUsage.creditsLastResetAt).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Token Credit Limit</p>
                  <p className="text-sm font-medium text-text-primary">
                    {aiUsage ? aiUsage.monthlyTokenLimit.toLocaleString() : '—'}
                    {aiUsage && aiUsage.customTokenLimit == null && <span className="text-text-muted font-normal"> (plan default)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Warning Threshold %</p>
                  <p className="text-sm font-medium text-text-primary">{aiUsage ? `${aiUsage.warningThresholdPercent}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Critical Threshold %</p>
                  <p className="text-sm font-medium text-text-primary">{aiUsage ? `${aiUsage.criticalThresholdPercent}%` : '—'}</p>
                </div>
              </div>

              <p className="text-[11px] text-text-muted pt-1 border-t border-border">
                These limits are set by your platform administrator, based on your plan. This balance doesn't refill automatically — once it runs out, contact them to grant more credits.
              </p>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-voice"
              icon={MicrophoneIcon}
              iconClassName="bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
              title="Voice"
              description="Let visitors talk to the widget with their microphone instead of typing — push-to-talk, powered by the same AI."
              right={
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-text-muted">{voiceEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                </label>
              }
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Conversation Mode</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="voiceConversationMode"
                      checked={!continuousModeEnabled}
                      onChange={() => setContinuousModeEnabled(false)}
                      className="h-4 w-4 text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                    />
                    <span className="text-sm text-text-primary">Push-to-talk</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="voiceConversationMode"
                      checked={continuousModeEnabled}
                      onChange={() => setContinuousModeEnabled(true)}
                      className="h-4 w-4 text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                    />
                    <span className="text-sm text-text-primary">Continuous (hands-free)</span>
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  Continuous mode holds an open, natural back-and-forth conversation — visitors don't tap to record each turn, and the AI can be
                  interrupted mid-reply. Real per-minute cost is materially higher than push-to-talk (a dedicated real-time voice platform plus
                  streaming speech-to-text/text-to-speech, on top of the LLM cost already tracked).
                </p>
              </div>
              {continuousModeEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Max Call Length (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={maxSessionMinutes}
                      onChange={(e) => setMaxSessionMinutes(e.target.value)}
                      className={input}
                      placeholder="No limit"
                    />
                    <p className="mt-1 text-[11px] text-text-muted">
                      Hard per-call duration cap — the AI speaks a wrap-up and ends the call once reached. Separate from the monthly voice-minutes
                      quota above, this protects against one runaway call using up the whole month's budget alone.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Typing During a Call</label>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={allowTextDuringVoice}
                        onChange={(e) => setAllowTextDuringVoice(e.target.checked)}
                        className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                      />
                      <span className="text-sm text-text-primary">Allow visitors to type while a voice call is active</span>
                    </label>
                    <p className="mt-1 text-[11px] text-text-muted">
                      On by default (hybrid mode). Turn off to require one active conversational channel at a time.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Voice</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={voicePresetGender}
                        onChange={(e) => setVoicePresetGender(e.target.value as 'female' | 'male')}
                        className={input}
                      >
                        <option value="female">Female — {CARTESIA_VOICE_PRESETS.female.displayName}</option>
                        <option value="male">Male — {CARTESIA_VOICE_PRESETS.male.displayName}</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleTestVoice}
                        disabled={testVoiceState === 'loading'}
                        className="shrink-0 px-3 py-2.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {testVoiceState === 'loading' ? 'Loading…' : '🔊 Test Voice'}
                      </button>
                    </div>
                    <audio ref={testVoiceAudioRef} className="hidden" />
                    {testVoiceState === 'error' && (
                      <p className="mt-1 text-[11px] text-red-500">Could not play a preview — try again.</p>
                    )}
                    <p className="mt-1 text-[11px] text-text-muted">
                      Continuous calls always listen with Deepgram and speak with Cartesia — that's fixed, not configurable here.
                      Confirm this voice sounds right, then Save Voice Settings below. (The Speech Provider field further down is
                      for Push-to-talk only. The Voice Name field is also used for Push-to-talk, but doubles as a fallback voice
                      for Continuous calls whenever no Male/Female preset is selected above.)
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Push-to-talk Speech Provider</label>
                  <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value as VoiceProvider)} className={input}>
                    <option value="groq">Groq (recommended)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-text-muted">
                    Handles both listening (speech-to-text) and speaking (text-to-speech) for Push-to-talk only — no separate account
                    needed. Continuous (hands-free) calls always use Deepgram + Cartesia instead, regardless of this setting.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Push-to-talk Voice Name (advanced)</label>
                  <input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} className={input} placeholder="e.g. Fritz-PlayAI (leave blank for default)" />
                  <p className="mt-1 text-[11px] text-text-muted">Used for Push-to-talk. Also used as a fallback voice for Continuous calls if no Male/Female preset is selected above — pick a preset above for direct control over the Continuous voice instead.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Speech Language</label>
                  <select value={sttLanguage} onChange={(e) => setSttLanguage(e.target.value)} className={input}>
                    <option value="">Auto-detect</option>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-text-muted">
                    Used by both Push-to-talk and Continuous calls. Reply language uses the AI Agent's own Language setting elsewhere in Settings.
                  </p>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceAutoPlay}
                      onChange={(e) => setVoiceAutoPlay(e.target.checked)}
                      className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                    />
                    <span className="text-sm text-text-primary">Auto-play spoken replies</span>
                  </label>
                </div>
              </div>

              {voiceMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  voiceMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {voiceMessage.text}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleVoiceSave}
                  disabled={updateMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Voice Settings'}
                </button>
                <a href="/native-crm/settings/voice-playground" className="text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">
                  Test in Voice Playground →
                </a>
              </div>
            </div>
          </div>

          {/* <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-human-handoff"
              icon={UserIcon}
              iconClassName="bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400"
              title="Human Handoff"
              description='Lets a visitor click "Connect with an expert" to leave the AI and chat with your team in real time, via the Conversations inbox.'
              right={
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-text-muted">{humanHandoffEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={humanHandoffEnabled}
                    onChange={(e) => setHumanHandoffEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                  />
                </label>
              }
            />
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Button Text</label>
                  <input
                    value={humanHandoffButtonText}
                    onChange={(e) => setHumanHandoffButtonText(e.target.value)}
                    className={input}
                    placeholder="Connect with an expert"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Waiting Message</label>
                  <input
                    value={humanHandoffWaitingMessage}
                    onChange={(e) => setHumanHandoffWaitingMessage(e.target.value)}
                    className={input}
                    placeholder="We're connecting you with a team member — someone will be with you shortly."
                  />
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                While a conversation is handed off, the AI assistant pauses completely for that visitor (text and voice both) until a team member
                hands it back — your staff see and reply to these conversations from the Conversations inbox under Native CRM. This is OFF by
                default; turning it on only adds the button, it never changes how the AI chats for any visitor who hasn't clicked it.
              </p>

              {humanHandoffMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  humanHandoffMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {humanHandoffMessage.text}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleHumanHandoffSave}
                  disabled={updateMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Human Handoff Settings'}
                </button>
                <a href="/crm/conversations" className="text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">
                  Open Conversations Inbox →
                </a>
              </div>
            </div>
          </div> */}

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-appearance"
              icon={SwatchIcon}
              iconClassName="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
              title="Appearance"
              description="Every client's own website looks different — pick a logo and layout that fit theirs."
            />
            <div className="px-6 py-5 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Logo / Icon</label>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                    {tenant.widget?.logoUrl ? (
                      <img src={tenant.widget.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <PhotoIcon className="h-6 w-6 text-text-muted" />
                    )}
                  </div>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                  >
                    <PhotoIcon className="h-4 w-4" />
                    {uploadLogoMutation.isPending ? 'Uploading…' : tenant.widget?.logoUrl ? 'Replace' : 'Upload'}
                  </button>
                  {tenant.widget?.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={removeLogoMutation.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" /> Remove
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-text-muted">Shown as the chat avatar. Falls back to your account logo, then to a plain initial, if none is set here.</p>
                {logoMessage && (
                  <div className={`mt-2 text-sm px-4 py-2.5 rounded-lg border ${
                    logoMessage.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : 'bg-red-50 border-red-100 text-red-600'
                  }`}>
                    {logoMessage.text}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Template</label>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((t) => {
                    const cardTheme = resolveTheme(theme, t.id, tenant.branding?.primaryColor || '#2563eb');
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplate(t.id)}
                        className={`text-left rounded-xl border-2 p-2.5 transition-colors ${
                          template === t.id ? 'border-ryze-500 bg-ryze-600/10/40' : 'border-border hover:border-border'
                        }`}
                      >
                        <TemplatePreview id={t.id} theme={cardTheme} />
                        <p className="mt-2 text-xs font-semibold text-text-primary">{t.name}</p>
                        <p className="text-[11px] text-text-muted leading-snug mt-0.5">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-text-muted">Controls structure (header style, avatar, bubble shapes) — colors below apply to every template the same way.</p>
              </div>

              {(() => {
                const resolved = resolveTheme(theme, template, tenant.branding?.primaryColor || '#2563eb');
                const set = (key: keyof TenantWidgetTheme) => (value: string) => setTheme((prev) => ({ ...prev, [key]: value }));
                return (
                  <div className="pt-5 border-t border-border space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Colors</label>
                      <p className="text-[11px] text-text-muted mb-3">
                        Every client's brand is different — set these to match theirs exactly. Picking a template above fills in sensible
                        defaults; anything you change here overrides that default and stays, even if you switch templates later.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ColorField label="Accent (buttons, links)" value={resolved.accentColor} onChange={set('accentColor')} />
                        <ColorField label="Header Background" value={resolved.headerColor} onChange={set('headerColor')} />
                        <ColorField label="Header Text" value={resolved.headerTextColor} onChange={set('headerTextColor')} />
                        <ColorField label="Chat Background" value={resolved.backgroundColor} onChange={set('backgroundColor')} />
                        <ColorField label="Bot Bubble" value={resolved.botBubbleColor} onChange={set('botBubbleColor')} />
                        <ColorField label="Bot Text" value={resolved.botTextColor} onChange={set('botTextColor')} />
                        <ColorField label="Your Message Bubble" value={resolved.userBubbleColor} onChange={set('userBubbleColor')} />
                        <ColorField label="Your Message Text" value={resolved.userTextColor} onChange={set('userTextColor')} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setTheme({})}
                        className="mt-2.5 text-[11px] font-medium text-ryze-600 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300"
                      >
                        Reset all colors to this template's defaults
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Background Image (optional)</label>
                      <p className="text-[11px] text-text-muted mb-2">
                        A tiled pattern behind the chat bubbles, like WhatsApp's chat wallpaper — layered over the Chat Background color above, not a
                        replacement for it. Leave unset for a plain color background.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 rounded-lg border border-border overflow-hidden shrink-0" style={{ backgroundColor: resolved.backgroundColor }}>
                          {tenant.widget?.theme?.backgroundImageUrl && (
                            <div
                              className="h-full w-full"
                              style={{ backgroundImage: `url(${tenant.widget.theme.backgroundImageUrl})`, backgroundRepeat: 'repeat', backgroundSize: '36px' }}
                            />
                          )}
                        </div>
                        <input
                          ref={bgImageFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBgImageFile}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => bgImageFileInputRef.current?.click()}
                          disabled={uploadBgImageMutation.isPending}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                        >
                          <PhotoIcon className="h-4 w-4" />
                          {uploadBgImageMutation.isPending ? 'Uploading…' : tenant.widget?.theme?.backgroundImageUrl ? 'Replace' : 'Upload'}
                        </button>
                        {tenant.widget?.theme?.backgroundImageUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveBgImage}
                            disabled={removeBgImageMutation.isPending}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" /> Remove
                          </button>
                        )}
                      </div>
                      {bgImageMessage && (
                        <div className={`mt-2 text-sm px-4 py-2.5 rounded-lg border ${
                          bgImageMessage.type === 'ok'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : 'bg-red-50 border-red-100 text-red-600'
                        }`}>
                          {bgImageMessage.text}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Font</label>
                        <select
                          value={resolved.fontFamily}
                          onChange={(e) => set('fontFamily')(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
                        >
                          {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Size</label>
                        <select
                          value={resolved.size}
                          onChange={(e) => set('size')(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
                        >
                          {SIZE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.description}</option>)}
                        </select>
                      </div>
                    </div>

                    {appearanceMessage && (
                      <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                        appearanceMessage.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-red-50 border-red-100 text-red-600'
                      }`}>
                        {appearanceMessage.text}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAppearanceSave}
                      disabled={updateMutation.isPending}
                      className="px-5 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save Appearance'}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-website"
              icon={GlobeAltIcon}
              iconClassName="bg-success-500/15 text-success-700 dark:text-success-500"
              title="Website Content"
              description="Crawl your own site so the widget can answer from your real pages."
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Your Website URL</label>
                <div className="flex items-center gap-2">
                  <input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className={input}
                    placeholder="https://example.com"
                  />
                  <button
                    type="button"
                    onClick={handleCrawl}
                    disabled={isCrawlPolling || updateMutation.isPending || crawlMutation.isPending}
                    className="px-4 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <GlobeAltIcon className={`h-4 w-4 ${isCrawlPolling ? 'animate-pulse' : ''}`} />
                    {isCrawlPolling ? 'Crawling…' : 'Crawl Now'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  Lets the widget answer questions using your own site's content (products, services, FAQs) — crawls up to 20 pages, 2 links deep. Re-crawl any time to pick up changes.
                </p>
              </div>

              {(tenant.widget?.crawlStatus || tenant.widget?.lastCrawledAt) && (
                <div className="flex items-start gap-2 text-xs">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    isCrawlPolling || tenant.widget?.crawlStatus === 'crawling' ? 'bg-blue-50 text-blue-600'
                    : tenant.widget?.crawlStatus === 'ready' ? 'bg-emerald-50 text-emerald-600'
                    : tenant.widget?.crawlStatus === 'ready_with_warnings' ? 'bg-amber-50 text-amber-600'
                    : tenant.widget?.crawlStatus === 'failed' ? 'bg-red-50 text-red-600'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'
                  }`}>
                    {isCrawlPolling || tenant.widget?.crawlStatus === 'crawling' ? 'Crawling…'
                      : tenant.widget?.crawlStatus === 'ready' ? 'Ready'
                      : tenant.widget?.crawlStatus === 'ready_with_warnings' ? 'Ready — some pages failed'
                      : tenant.widget?.crawlStatus === 'failed' ? 'Failed'
                      : 'Not configured'}
                  </span>
                  <p className="text-text-muted">
                    {typeof tenant.widget?.crawlPagesIndexed === 'number' ? (
                      <>
                        Pages: {tenant.widget.crawlPagesIndexed}
                        {typeof tenant.widget.crawlChunksIndexed === 'number' ? ` · Chunks: ${tenant.widget.crawlChunksIndexed}` : ''}
                        {tenant.widget.crawlPagesFailed ? ` · Failed: ${tenant.widget.crawlPagesFailed}` : ''}
                      </>
                    ) : tenant.widget?.crawlPageCount != null ? (
                      `${tenant.widget.crawlPageCount} page(s) indexed`
                    ) : null}
                    {tenant.widget?.lastCrawledAt && ` · Last crawled ${new Date(tenant.widget.lastCrawledAt).toLocaleString()}`}
                    {tenant.widget?.crawlStatus === 'failed' && tenant.widget?.lastSuccessfulCrawlAt && (
                      <><br />Last successful crawl: {new Date(tenant.widget.lastSuccessfulCrawlAt).toLocaleString()} ({tenant.widget.lastSuccessfulCrawlPagesIndexed ?? 0} pages)</>
                    )}
                  </p>
                </div>
              )}

              {crawlMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  crawlMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {crawlMessage.text}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-catalog"
              icon={Square3Stack3DIcon}
              iconClassName="bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400"
              title="Product Catalog"
              description="Give the widget exact product specs to answer from, not just page text."
            />
            <div className="px-6 py-5 space-y-4">
              <div>
                <input
                  ref={catalogFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={handleCatalogFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => catalogFileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                >
                  <DocumentArrowUpIcon className={`h-4 w-4 ${importMutation.isPending ? 'animate-pulse' : ''}`} />
                  {importMutation.isPending ? 'Importing…' : 'Import Catalog (Excel / CSV / JSON)'}
                </button>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Give the widget exact product specs to answer from — not just website text. Recognized columns: title/name, sku, category, description; everything else is kept as a specification.
                </p>
              </div>

              {catalogMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  catalogMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {catalogMessage.text}
                </div>
              )}

              {catalogSources && catalogSources.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide">Sources</label>
                  {catalogSources.map((s) => (
                    <div key={s._id} className="flex items-start justify-between text-xs bg-background border border-border rounded-lg px-3 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-text-primary truncate">{s.label}</p>
                        <p className="text-text-muted">
                          {s.itemsImported} new · {s.itemsUpdated} updated{s.itemsFailed ? ` · ${s.itemsFailed} failed` : ''}
                          {s.itemsAmbiguous ? ` · ${s.itemsAmbiguous} ambiguous (review)` : ''}
                          {s.lastSyncAt ? ` · ${new Date(s.lastSyncAt).toLocaleString()}` : ''}
                        </p>
                        {/* Real failure reason — a red "Failed" pill used to
                            give no way to know why (the field existed on
                            the type but was never rendered). */}
                        {s.status === 'failed' && s.lastError && (
                          <p className="text-red-500 mt-0.5">{s.lastError}</p>
                        )}
                      </div>
                      <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        s.status === 'completed' ? 'bg-emerald-50 text-emerald-600'
                        : s.status === 'failed' ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-datasets"
              icon={CircleStackIcon}
              iconClassName="bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
              title="Business Knowledge"
              description="Upload any business data — machines, services, courses, price lists — and the widget can answer questions about it."
            />
            <div className="px-6 py-5 space-y-4">
              <div>
                <input
                  ref={datasetFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={handleDatasetFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => datasetFileInputRef.current?.click()}
                  disabled={importDatasetMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-50 transition-colors"
                >
                  <DocumentArrowUpIcon className={`h-4 w-4 ${importDatasetMutation.isPending ? 'animate-pulse' : ''}`} />
                  {importDatasetMutation.isPending ? 'Importing…' : 'Upload Data (Excel / CSV / JSON)'}
                </button>
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Separate from the Product Catalog above — for any other business-specific data. You'll review and confirm the column mapping before anything imports.
                </p>
              </div>

              {datasetMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  datasetMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {datasetMessage.text}
                </div>
              )}

              {datasets && datasets.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide">Datasets</label>
                  {datasets.map((d) => (
                    <div key={d._id} className="flex items-start justify-between text-xs bg-background border border-border rounded-lg px-3 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-text-primary truncate font-medium">{d.name}</p>
                        <p className="text-text-muted">
                          {d.activeVersionDetail
                            ? `${d.activeVersionDetail.recordsInserted} record(s)${d.activeVersionDetail.recordsFailed ? ` · ${d.activeVersionDetail.recordsFailed} failed` : ''}`
                            : 'Importing…'}
                          {d.activeVersion ? ` · v${d.activeVersion}` : ''}
                        </p>
                        {d.activeVersionDetail?.status === 'failed' && (
                          <p className="text-red-500 mt-0.5">Import failed — upload again to retry.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={d.availableToChatbot}
                            onChange={(e) => toggleDatasetMutation.mutate({ datasetId: d._id, availableToChatbot: e.target.checked })}
                            className="h-3.5 w-3.5 rounded border-border text-ryze-600 dark:text-ryze-400 focus:ring-ryze-400"
                          />
                          <span className={d.availableToChatbot ? 'text-emerald-600 font-medium' : 'text-text-muted'}>
                            {d.availableToChatbot ? 'Live on widget' : 'Not visible'}
                          </span>
                        </label>
                        {datasetDeleteConfirm === d._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => { deleteDatasetMutation.mutate(d._id); setDatasetDeleteConfirm(null); }}
                              className="px-2 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDatasetDeleteConfirm(null)}
                              className="px-2 py-1 rounded border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDatasetDeleteConfirm(d._id)}
                            className="p-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted hover:text-red-500"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <SectionHeader
              id="section-embed"
              icon={KeyIcon}
              iconClassName="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              title="Widget Key & Embed Snippet"
              description="The one script tag that goes on your website."
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Widget Key</label>
                <div className="flex items-center gap-2">
                  <input
                    value={widgetKey ?? 'Not generated yet'}
                    readOnly
                    disabled
                    className={`${input} bg-background text-text-muted font-mono cursor-not-allowed`}
                  />
                  {widgetKey && <CopyButton value={widgetKey} />}
                </div>
              </div>

              {confirmingRegen ? (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
                  <p className="mb-2">
                    {widgetKey
                      ? 'Regenerating will immediately break the embed snippet already live on your website. Continue?'
                      : 'Generate a widget key for this tenant?'}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleRegenerate} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">
                      {widgetKey ? 'Yes, regenerate' : 'Yes, generate'}
                    </button>
                    <button type="button" onClick={() => setConfirmingRegen(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRegen(true)}
                  disabled={regenMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${regenMutation.isPending ? 'animate-spin' : ''}`} />
                  {widgetKey ? 'Regenerate Widget Key' : 'Generate Widget Key'}
                </button>
              )}

              {keyMessage && (
                <div className={`text-sm px-4 py-2.5 rounded-lg border ${
                  keyMessage.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {keyMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Embed Snippet</label>
                {widgetKey ? (
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 bg-gray-900 text-emerald-300 text-xs rounded-lg p-3 overflow-x-auto"><code>{embedSnippet}</code></pre>
                    <CopyButton value={embedSnippet} />
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Generate a widget key above to get your embed snippet.</p>
                )}
                <p className="mt-1 text-[11px] text-text-muted">Paste this one line into your website's HTML — the widget loads itself.</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex gap-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 leading-relaxed">
              <p className="font-semibold mb-1">How the widget works</p>
              <p>Once enabled with at least one allowed domain, a visitor on your website can chat with your AI sales agent 24/7. It qualifies the visitor, and once it has a name and a way to reach them, creates a real Lead here in your CRM — automatically assigned to a sales rep and picked up by any automations you've already set up.</p>
            </div>
          </div>
          </div>
        </div>
      </div>

      {catalogPreview && (
        <CatalogImportPreview
          fileName={catalogPreview.fileName}
          aoa={catalogPreview.aoa}
          importing={importMutation.isPending}
          onCancel={() => setCatalogPreview(null)}
          onConfirm={confirmCatalogImport}
        />
      )}

      {datasetPreview && (
        <DatasetImportPreview
          fileName={datasetPreview.fileName}
          fileType={datasetPreview.fileType}
          aoa={datasetPreview.aoa}
          jsonRows={datasetPreview.jsonRows}
          existingDatasets={datasets ?? []}
          importing={importDatasetMutation.isPending}
          onCancel={() => setDatasetPreview(null)}
          onConfirm={confirmDatasetImport}
        />
      )}

      {logoCropFile && (
        <ImageCropModal
          file={logoCropFile}
          aspect={1}
          cropShape="round"
          title="Crop Logo"
          onCancel={() => setLogoCropFile(null)}
          onConfirm={handleLogoCropConfirm}
        />
      )}
    </div>
  );
}
