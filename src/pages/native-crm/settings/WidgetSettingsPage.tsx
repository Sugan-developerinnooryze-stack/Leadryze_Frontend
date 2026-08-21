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
  MicrophoneIcon, CircleStackIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import { useTeamsListQuery, useTeamUpdate } from '../../../modules/native-crm/queries/teams.queries';
import {
  useTenantQuery, useUpdateTenantWidget, useRegenerateWidgetKey,
  useTriggerWebsiteCrawl, useCrawlStatus, useUploadWidgetLogo, useRemoveWidgetLogo,
  useUpdateTenantAIConfig, useUpdateTenantBranding,
  type TenantWidgetConfig, type ToolModelPreset, type VoiceProvider, type TenantVoicePreset,
} from '../../../modules/native-crm/queries/tenant.queries';
import { useCatalogSources, useImportCatalog } from '../../../modules/native-crm/queries/catalog.queries';
import CatalogImportPreview from '../../../modules/native-crm/shared/CatalogImportPreview';
import { useServicesListQuery } from '../../../modules/native-crm/queries/services.queries';
import {
  useDatasetsList, useImportDataset, useToggleDatasetAvailable, useDeleteDataset, useDatasetImportStatus,
  type DatasetColumn,
} from '../../../modules/native-crm/queries/datasets.queries';
import DatasetImportPreview from '../../../modules/native-crm/shared/DatasetImportPreview';

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
  { id: 'section-voice',       label: 'Voice',             icon: MicrophoneIcon },
  { id: 'section-appearance',  label: 'Appearance',        icon: SwatchIcon },
  { id: 'section-website',     label: 'Website Content',   icon: GlobeAltIcon },
  { id: 'section-catalog',     label: 'Product Catalog',   icon: Square3Stack3DIcon },
  { id: 'section-datasets',    label: 'Business Knowledge', icon: CircleStackIcon },
  { id: 'section-embed',       label: 'Widget Key & Embed', icon: KeyIcon },
];

/** A tiny, purely illustrative mockup of each template's actual structure —
 * not a live render of the real widget, but distinct enough (status bar for
 * Modern, no avatar for Minimal, horizontal pills for Chips, a vertical
 * stacked action menu for Dark) that the four are tellable apart at a
 * glance, matching how the real templates now differ structurally too. */
function TemplatePreview({ id, color }: { id: Template; color: string }) {
  const dark = shadeColor(color, -0.18);
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ width: '100%', height: 72 }}>
      <div
        className="flex items-center gap-1.5 px-2"
        style={{
          height: 22,
          background: id === 'dark' ? '#1a1f2e' : id === 'modern' ? `linear-gradient(135deg, ${color}, ${dark})` : color,
        }}
      >
        {id !== 'minimal' && (
          <span
            className="rounded-full shrink-0 flex items-center justify-center text-[6px] font-bold"
            style={{ width: 11, height: 11, background: id === 'chips' ? '#fff' : 'rgba(255,255,255,0.35)', color }}
          >
            {id === 'chips' ? 'L' : ''}
          </span>
        )}
        <span className="h-1 rounded-full bg-white/70" style={{ width: 30 }} />
      </div>
      {id === 'modern' && (
        <div className="flex items-center gap-1 px-2" style={{ height: 10, background: `linear-gradient(135deg, ${color}, ${dark})` }}>
          <span className="rounded-full shrink-0" style={{ width: 4, height: 4, background: '#4ade80' }} />
          <span className="h-[3px] rounded-full bg-white/60" style={{ width: 20 }} />
        </div>
      )}
      <div className="p-1.5 flex flex-col gap-1">
        <span
          className="h-2 bg-white border border-gray-200 self-start"
          style={{ width: 42, borderRadius: id === 'minimal' ? 3 : '2px 7px 7px 7px' }}
        />
        {id === 'chips' && (
          <div className="flex gap-1">
            <span className="h-2 rounded-full border" style={{ width: 20, borderColor: color }} />
            <span className="h-2 rounded-full border" style={{ width: 16, borderColor: color }} />
          </div>
        )}
        {id === 'dark' && (
          <div className="flex flex-col gap-[3px]">
            <span className="h-[7px] rounded border border-gray-200 bg-white" />
            <span className="h-[7px] rounded border border-gray-200 bg-white" />
          </div>
        )}
        {(id === 'modern' || id === 'minimal') && (
          <span
            className="h-2 self-end"
            style={{ width: 26, background: color, borderRadius: id === 'minimal' ? 3 : '7px 2px 7px 7px' }}
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
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
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
      ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-200'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
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
    <div id={id} className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 scroll-mt-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>}
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
  const regenMutation  = useRegenerateWidgetKey(tenantId);
  const crawlMutation  = useTriggerWebsiteCrawl();
  const qc = useQueryClient();
  const uploadLogoMutation = useUploadWidgetLogo(tenantId);
  const removeLogoMutation = useRemoveWidgetLogo(tenantId);
  const { data: catalogSources } = useCatalogSources(tenantId);
  const importMutation = useImportCatalog(tenantId);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
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
  const [teamId, setTeamId]             = useState('');
  const [websiteUrl, setWebsiteUrl]     = useState('');
  const [template, setTemplate]         = useState<Template>('modern');
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
    }
    setToolModelPreset(tenant?.aiConfig?.toolModelPreset ?? '');
    setAutoConvertLeadOnMeetingCompleted(tenant?.aiConfig?.autoConvertLeadOnMeetingCompleted ?? false);
    setContactEmail(tenant?.branding?.contactEmail ?? '');
    setContactPhone(tenant?.branding?.contactPhone ?? '');
    setContactAddress(tenant?.branding?.address ?? '');
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
      <div className="flex flex-col h-full items-center justify-center text-gray-400">
        <LockClosedIcon className="h-10 w-10 mb-2 text-gray-300" />
        <p className="text-sm">Only admins can configure the AI chatbot widget.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-2">{[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
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
        enabled, allowedDomains: domains, greeting, quickQuestions, showBookingQuickReply, autoSendLeadEmails, defaultTeamId: teamId || null, template,
      });
      setMessage({ type: 'ok', text: 'Widget settings saved.' });
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
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

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setLogoMessage(null);
    try {
      await uploadLogoMutation.mutateAsync(file);
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

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">AI Chatbot Widget</h1>
            <p className="text-xs text-gray-500 truncate">Let visitors on your own website chat with your AI sales agent 24/7</p>
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
            <p className="px-3 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Jump to section</p>
            {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            ))}
          </nav>

          <div className="flex-1 min-w-0 max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-config"
              icon={Cog6ToothIcon}
              iconClassName="bg-slate-100 text-slate-600"
              title="Configuration"
              description="Core on/off switch, allowed domains, and greeting."
              right={
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-gray-500">{enabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                  />
                </label>
              }
            />

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Allowed Domains</label>
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
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1 shrink-0"
                  >
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                </div>
                {domains.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {domains.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                        {d}
                        <button type="button" onClick={() => removeDomain(d)} className="text-gray-400 hover:text-gray-700">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-gray-400">Only these websites may embed the widget — e.g. "example.com", "www.example.com".</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Greeting</label>
                <input value={greeting} onChange={(e) => setGreeting(e.target.value)} className={input} placeholder="Hi! How can I help you today?" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Quick Questions</label>
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
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1 shrink-0"
                  >
                    <PlusIcon className="h-4 w-4" /> Add
                  </button>
                </div>
                {quickQuestions.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {quickQuestions.map((q) => (
                      <div key={q.text} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={q.enabled}
                          onChange={() => toggleQuickQuestion(q.text)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={`flex-1 text-sm ${q.enabled ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{q.text}</span>
                        <button type="button" onClick={() => removeQuickQuestion(q.text)} className="text-gray-400 hover:text-gray-700">
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-gray-400">
                  Suggestion chips shown when the widget opens. Uncheck to hide one without deleting it.
                  Clicking a chip just sends its text as a normal message — the answer always comes live from your
                  Business Knowledge, Product Catalog, or website content, never from something set here.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={showBookingQuickReply} onChange={(e) => setShowBookingQuickReply(e.target.checked)} className="h-3.5 w-3.5" />
                  Always show a "Book an appointment" chip alongside the questions above (when booking is enabled)
                </label>
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={autoSendLeadEmails} onChange={(e) => setAutoSendLeadEmails(e.target.checked)} className="h-3.5 w-3.5" />
                  Automatically email a visitor + your assigned team member when the chatbot captures a new lead
                </label>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Contact Info (used in lead-confirmation emails)</label>
                <p className="mb-2 text-[11px] text-gray-400">
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
                    className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {brandingMutation.isPending ? 'Saving...' : 'Save Contact Info'}
                  </button>
                  {contactMessage && (
                    <span className={`text-xs ${contactMessage.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{contactMessage.text}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Default Team (round-robin assignment)</label>
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
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-booking"
              icon={CalendarDaysIcon}
              iconClassName="bg-blue-50 text-blue-600"
              title="Booking Hours"
              description="When visitors can actually book a real appointment through the widget."
              right={
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-gray-500">{bookingEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={bookingEnabled}
                    onChange={(e) => setBookingEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                  />
                </label>
              }
            />
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Timezone</label>
                  <input value={bookingTimezone} onChange={(e) => setBookingTimezone(e.target.value)} className={input} placeholder="e.g. Asia/Kolkata" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Slot Length (min)</label>
                  <input
                    type="number" min={5} step={5}
                    value={bookingSlotMinutes}
                    onChange={(e) => setBookingSlotMinutes(Math.max(5, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Lead Time (hrs)</label>
                  <input
                    type="number" min={0}
                    value={bookingLeadTimeHours}
                    onChange={(e) => setBookingLeadTimeHours(Math.max(0, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Book Ahead (days)</label>
                  <input
                    type="number" min={1}
                    value={bookingHorizonDays}
                    onChange={(e) => setBookingHorizonDays(Math.max(1, Number(e.target.value) || 0))}
                    className={input}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Business Hours</label>
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
                            className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                          />
                          <span className={d.open ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                        </label>
                        <input
                          type="time"
                          value={d.start}
                          disabled={!d.open}
                          onChange={(e) => setBookingHours({ ...bookingHours, [day]: { ...d, start: e.target.value } })}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <span className="text-gray-300 text-xs">to</span>
                        <input
                          type="time"
                          value={d.end}
                          disabled={!d.open}
                          onChange={(e) => setBookingHours({ ...bookingHours, [day]: { ...d, end: e.target.value } })}
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-gray-400">Uncheck a day to keep it closed. Times are in the timezone set above.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Required Before Booking</label>
                <p className="mb-2 text-[11px] text-gray-400">
                  Only ask visitors for what your business actually needs — not every business needs a department/service question.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ask which department/team</label>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ask what service/reason the visit is for</label>
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
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={bookingRequireName}
                    onChange={(e) => setBookingRequireName(e.target.checked)}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                  />
                  Require the visitor's name
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Contact Info Required</label>
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Staff Title</label>
                  <input
                    value={bookingStaffLabel}
                    onChange={(e) => setBookingStaffLabel(e.target.value)}
                    className={input}
                    placeholder="e.g. Doctor, Stylist, Consultant, team member"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">What the AI calls a staff member when talking to visitors.</p>
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
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Booking Hours'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-departments"
              icon={UserGroupIcon}
              iconClassName="bg-violet-50 text-violet-600"
              title="Departments"
              description="Show a team as a bookable department so visitors can pick a specific doctor/staff member — leave everything off for a simple, single booking flow. Picking which Services a department handles also routes a chatbot lead mentioning that service straight to this team, instead of your one default team."
            />
            <div className="px-6 py-5 space-y-3">
              {(teamsData?.items ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No teams exist yet — create one under Team &amp; Staff to use this.</p>
              ) : (
                (teamsData?.items ?? []).map((t: any) => {
                  const teamServiceIds: string[] = (t.serviceIds ?? []).map((s: any) => (typeof s === 'object' ? s._id : s));
                  return (
                    <div key={t._id} className="py-1">
                      <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                        <span className="text-gray-700">{t.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {togglingTeamId === t._id && <ArrowPathIcon className="h-3.5 w-3.5 text-gray-300 animate-spin" />}
                          <input
                            type="checkbox"
                            checked={!!t.showInWidget}
                            disabled={togglingTeamId === t._id}
                            onChange={(e) => handleToggleDepartment(t._id, e.target.checked)}
                            className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                          />
                        </span>
                      </label>
                      {t.showInWidget && (servicesData?.items ?? []).length > 0 && (
                        <div className="mt-1.5 ml-2 pl-3 border-l border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
                          {(servicesData?.items ?? []).map((svc: any) => (
                            <label key={svc._id} className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={teamServiceIds.includes(svc._id)}
                                disabled={togglingTeamId === t._id}
                                onChange={(e) => handleToggleTeamService(t, svc._id, e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-brand-600 focus:ring-brand-400"
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
              <p className="mt-1 text-[11px] text-gray-400">Changes save immediately — no separate Save button needed.</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-tool-model"
              icon={CpuChipIcon}
              iconClassName="bg-amber-50 text-amber-600"
              title="Tool Model"
              description="Which AI model looks up product/website info and handles bookings for this widget — doesn't affect your account's default assistant elsewhere."
            />
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Model</label>
                <select value={toolModelPreset} onChange={(e) => setToolModelPreset(e.target.value as ToolModelPreset | '')} className={input}>
                  {TOOL_MODEL_OPTIONS.map((o) => (
                    <option key={o.id || 'default'} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-400">
                  {TOOL_MODEL_OPTIONS.find((o) => o.id === toolModelPreset)?.description}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConvertLeadOnMeetingCompleted}
                    onChange={(e) => setAutoConvertLeadOnMeetingCompleted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      Auto-convert Lead to Customer when their appointment is marked completed
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">
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
                className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {aiConfigMutation.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-voice"
              icon={MicrophoneIcon}
              iconClassName="bg-cyan-50 text-cyan-600"
              title="Voice"
              description="Let visitors talk to the widget with their microphone instead of typing — push-to-talk, powered by the same AI."
              right={
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <span className="text-xs text-gray-500">{voiceEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                  />
                </label>
              }
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Conversation Mode</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="voiceConversationMode"
                      checked={!continuousModeEnabled}
                      onChange={() => setContinuousModeEnabled(false)}
                      className="h-4 w-4 text-brand-600 focus:ring-brand-400"
                    />
                    <span className="text-sm text-gray-700">Push-to-talk</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="voiceConversationMode"
                      checked={continuousModeEnabled}
                      onChange={() => setContinuousModeEnabled(true)}
                      className="h-4 w-4 text-brand-600 focus:ring-brand-400"
                    />
                    <span className="text-sm text-gray-700">Continuous (hands-free)</span>
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Continuous mode holds an open, natural back-and-forth conversation — visitors don't tap to record each turn, and the AI can be
                  interrupted mid-reply. Real per-minute cost is materially higher than push-to-talk (a dedicated real-time voice platform plus
                  streaming speech-to-text/text-to-speech, on top of the LLM cost already tracked).
                </p>
              </div>
              {continuousModeEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Max Call Length (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={maxSessionMinutes}
                      onChange={(e) => setMaxSessionMinutes(e.target.value)}
                      className={input}
                      placeholder="No limit"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      Hard per-call duration cap — the AI speaks a wrap-up and ends the call once reached. Separate from the monthly voice-minutes
                      quota above, this protects against one runaway call using up the whole month's budget alone.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Typing During a Call</label>
                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={allowTextDuringVoice}
                        onChange={(e) => setAllowTextDuringVoice(e.target.checked)}
                        className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                      />
                      <span className="text-sm text-gray-700">Allow visitors to type while a voice call is active</span>
                    </label>
                    <p className="mt-1 text-[11px] text-gray-400">
                      On by default (hybrid mode). Turn off to require one active conversational channel at a time.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Voice</label>
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
                        className="shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {testVoiceState === 'loading' ? 'Loading…' : '🔊 Test Voice'}
                      </button>
                    </div>
                    <audio ref={testVoiceAudioRef} className="hidden" />
                    {testVoiceState === 'error' && (
                      <p className="mt-1 text-[11px] text-red-500">Could not play a preview — try again.</p>
                    )}
                    <p className="mt-1 text-[11px] text-gray-400">
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Push-to-talk Speech Provider</label>
                  <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value as VoiceProvider)} className={input}>
                    <option value="groq">Groq (recommended)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Handles both listening (speech-to-text) and speaking (text-to-speech) for Push-to-talk only — no separate account
                    needed. Continuous (hands-free) calls always use Deepgram + Cartesia instead, regardless of this setting.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Push-to-talk Voice Name (advanced)</label>
                  <input value={voiceName} onChange={(e) => setVoiceName(e.target.value)} className={input} placeholder="e.g. Fritz-PlayAI (leave blank for default)" />
                  <p className="mt-1 text-[11px] text-gray-400">Used for Push-to-talk. Also used as a fallback voice for Continuous calls if no Male/Female preset is selected above — pick a preset above for direct control over the Continuous voice instead.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Speech Language</label>
                  <select value={sttLanguage} onChange={(e) => setSttLanguage(e.target.value)} className={input}>
                    <option value="">Auto-detect</option>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Used by both Push-to-talk and Continuous calls. Reply language uses the AI Agent's own Language setting elsewhere in Settings.
                  </p>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceAutoPlay}
                      onChange={(e) => setVoiceAutoPlay(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                    />
                    <span className="text-sm text-gray-700">Auto-play spoken replies</span>
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
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Voice Settings'}
                </button>
                <a href="/native-crm/settings/voice-playground" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  Test in Voice Playground →
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-appearance"
              icon={SwatchIcon}
              iconClassName="bg-rose-50 text-rose-600"
              title="Appearance"
              description="Every client's own website looks different — pick a logo and layout that fit theirs."
            />
            <div className="px-6 py-5 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Logo / Icon</label>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {tenant.widget?.logoUrl ? (
                      <img src={tenant.widget.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <PhotoIcon className="h-6 w-6 text-gray-300" />
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
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <PhotoIcon className="h-4 w-4" />
                    {uploadLogoMutation.isPending ? 'Uploading…' : tenant.widget?.logoUrl ? 'Replace' : 'Upload'}
                  </button>
                  {tenant.widget?.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={removeLogoMutation.isPending}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" /> Remove
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">Shown as the chat avatar. Falls back to your account logo, then to a plain initial, if none is set here.</p>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Template</label>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`text-left rounded-xl border-2 p-2.5 transition-colors ${
                        template === t.id ? 'border-brand-500 bg-brand-50/40' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <TemplatePreview id={t.id} color={tenant.branding?.primaryColor || '#2563eb'} />
                      <p className="mt-2 text-xs font-semibold text-gray-700">{t.name}</p>
                      <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{t.description}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-gray-400">Applies immediately once you click Save Settings above.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-website"
              icon={GlobeAltIcon}
              iconClassName="bg-emerald-50 text-emerald-600"
              title="Website Content"
              description="Crawl your own site so the widget can answer from your real pages."
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Your Website URL</label>
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
                    className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <GlobeAltIcon className={`h-4 w-4 ${isCrawlPolling ? 'animate-pulse' : ''}`} />
                    {isCrawlPolling ? 'Crawling…' : 'Crawl Now'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
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
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isCrawlPolling || tenant.widget?.crawlStatus === 'crawling' ? 'Crawling…'
                      : tenant.widget?.crawlStatus === 'ready' ? 'Ready'
                      : tenant.widget?.crawlStatus === 'ready_with_warnings' ? 'Ready — some pages failed'
                      : tenant.widget?.crawlStatus === 'failed' ? 'Failed'
                      : 'Not configured'}
                  </span>
                  <p className="text-gray-500">
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-catalog"
              icon={Square3Stack3DIcon}
              iconClassName="bg-orange-50 text-orange-600"
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
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  <DocumentArrowUpIcon className={`h-4 w-4 ${importMutation.isPending ? 'animate-pulse' : ''}`} />
                  {importMutation.isPending ? 'Importing…' : 'Import Catalog (Excel / CSV / JSON)'}
                </button>
                <p className="mt-1.5 text-[11px] text-gray-400">
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
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Sources</label>
                  {catalogSources.map((s) => (
                    <div key={s._id} className="flex items-start justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-700 truncate">{s.label}</p>
                        <p className="text-gray-400">
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-datasets"
              icon={CircleStackIcon}
              iconClassName="bg-cyan-50 text-cyan-600"
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
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  <DocumentArrowUpIcon className={`h-4 w-4 ${importDatasetMutation.isPending ? 'animate-pulse' : ''}`} />
                  {importDatasetMutation.isPending ? 'Importing…' : 'Upload Data (Excel / CSV / JSON)'}
                </button>
                <p className="mt-1.5 text-[11px] text-gray-400">
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
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Datasets</label>
                  {datasets.map((d) => (
                    <div key={d._id} className="flex items-start justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-700 truncate font-medium">{d.name}</p>
                        <p className="text-gray-400">
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
                            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                          />
                          <span className={d.availableToChatbot ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
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
                              className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDatasetDeleteConfirm(d._id)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <SectionHeader
              id="section-embed"
              icon={KeyIcon}
              iconClassName="bg-indigo-50 text-indigo-600"
              title="Widget Key & Embed Snippet"
              description="The one script tag that goes on your website."
            />
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Widget Key</label>
                <div className="flex items-center gap-2">
                  <input
                    value={widgetKey ?? 'Not generated yet'}
                    readOnly
                    disabled
                    className={`${input} bg-gray-50 text-gray-500 font-mono cursor-not-allowed`}
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
                    <button type="button" onClick={() => setConfirmingRegen(false)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRegen(true)}
                  disabled={regenMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Embed Snippet</label>
                {widgetKey ? (
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 bg-gray-900 text-emerald-300 text-xs rounded-lg p-3 overflow-x-auto"><code>{embedSnippet}</code></pre>
                    <CopyButton value={embedSnippet} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Generate a widget key above to get your embed snippet.</p>
                )}
                <p className="mt-1 text-[11px] text-gray-400">Paste this one line into your website's HTML — the widget loads itself.</p>
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
    </div>
  );
}
