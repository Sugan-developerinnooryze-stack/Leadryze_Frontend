import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ChatBubbleLeftRightIcon, ArrowPathIcon, ClipboardDocumentIcon, CheckIcon,
  LockClosedIcon, XMarkIcon, PlusIcon, GlobeAltIcon, DocumentArrowUpIcon,
  PhotoIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../../stores/auth.store';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import {
  useTenantQuery, useUpdateTenantWidget, useRegenerateWidgetKey,
  useTriggerWebsiteCrawl, useCrawlStatus, useUploadWidgetLogo, useRemoveWidgetLogo,
  type TenantWidgetConfig,
} from '../../../modules/native-crm/queries/tenant.queries';
import { useCatalogSources, useImportCatalog } from '../../../modules/native-crm/queries/catalog.queries';

type Template = NonNullable<TenantWidgetConfig['template']>;

const TEMPLATES: Array<{ id: Template; name: string; description: string }> = [
  { id: 'modern',  name: 'Modern',           description: 'Gradient header, avatar, soft rounded bubbles — friendly, general-purpose.' },
  { id: 'minimal', name: 'Minimal Flat',     description: 'Flat header, sharp corners, thin borders — understated and professional.' },
  { id: 'chips',   name: 'Compact Chips',    description: 'Icon avatar with quick-reply suggestion buttons — guided, less typing upfront.' },
  { id: 'dark',    name: 'Dark Professional', description: 'Dark chrome header, light readable message area — premium, enterprise feel.' },
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

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
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

export default function WidgetSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');
  const tenantId = user?.tenantId ?? '';

  const { data: tenant, isLoading, error } = useTenantQuery(isAdmin ? tenantId : '');
  const { data: teamsData } = useTeamsListQuery({ limit: 100 });
  const updateMutation = useUpdateTenantWidget(tenantId);
  const regenMutation  = useRegenerateWidgetKey(tenantId);
  const crawlMutation  = useTriggerWebsiteCrawl();
  const uploadLogoMutation = useUploadWidgetLogo(tenantId);
  const removeLogoMutation = useRemoveWidgetLogo(tenantId);
  const { data: catalogSources } = useCatalogSources(tenantId);
  const importMutation = useImportCatalog(tenantId);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [enabled, setEnabled]           = useState(false);
  const [domains, setDomains]           = useState<string[]>([]);
  const [domainInput, setDomainInput]   = useState('');
  const [greeting, setGreeting]         = useState('');
  const [teamId, setTeamId]             = useState('');
  const [websiteUrl, setWebsiteUrl]     = useState('');
  const [template, setTemplate]         = useState<Template>('modern');
  const [message, setMessage]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [keyMessage, setKeyMessage]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [logoMessage, setLogoMessage]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [isCrawlPolling, setIsCrawlPolling] = useState(false);

  const { data: crawlStatus } = useCrawlStatus(tenantId, { enabled: isCrawlPolling });

  useEffect(() => {
    if (tenant?.widget) {
      setEnabled(tenant.widget.enabled);
      setDomains(tenant.widget.allowedDomains ?? []);
      setGreeting(tenant.widget.greeting ?? '');
      setTeamId(tenant.widget.defaultTeamId ?? '');
      setWebsiteUrl(tenant.widget.websiteUrl ?? '');
      setTemplate(tenant.widget.template ?? 'modern');
    }
  }, [tenant]);

  useEffect(() => {
    if (isCrawlPolling && crawlStatus && crawlStatus.status !== 'running') {
      setIsCrawlPolling(false);
      if (crawlStatus.status === 'completed') {
        setCrawlMessage({
          type: 'ok',
          text: `Crawled ${crawlStatus.pagesCrawled ?? 0} page(s), ingested ${crawlStatus.chunksIngested ?? 0} chunk(s) into the widget's knowledge base.`,
        });
      } else {
        setCrawlMessage({ type: 'err', text: crawlStatus.error || 'Crawl failed.' });
      }
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

  const handleSave = async () => {
    setMessage(null);
    try {
      await updateMutation.mutateAsync({
        enabled, allowedDomains: domains, greeting, defaultTeamId: teamId || null, template,
      });
      setMessage({ type: 'ok', text: 'Widget settings saved.' });
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.response?.data?.message ?? 'Save failed.' });
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
  // receives a file, only plain JSON rows.
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
        let rows: Record<string, unknown>[];
        if (fileType === 'json') {
          rows = JSON.parse(ev.target?.result as string);
        } else {
          const wb = XLSX.read(ev.target?.result, { type: fileType === 'csv' ? 'string' : 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        }
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
      } catch {
        setCatalogMessage({ type: 'err', text: 'Could not read or import that file — check the format and try again.' });
      }
    };
    if (fileType === 'excel') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">AI Chatbot Widget</h1>
          <p className="text-xs text-gray-500">Let visitors on your own website chat with your AI sales agent 24/7</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Configuration</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{enabled ? 'Enabled' : 'Disabled'}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded text-brand-600 focus:ring-brand-400"
                />
              </label>
            </div>

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
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Appearance</h3>
              <p className="text-xs text-gray-500 mt-0.5">Every client's own website looks different — pick a logo and layout that fit theirs.</p>
            </div>
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
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Website Content</h3>
            </div>
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

              {tenant.widget?.lastCrawledAt && (
                <p className="text-xs text-gray-500">
                  Last crawled {new Date(tenant.widget.lastCrawledAt).toLocaleString()} — {tenant.widget.crawlPageCount ?? 0} page(s) indexed.
                </p>
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
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Product Catalog</h3>
            </div>
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
                    <div key={s._id} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-gray-700 truncate">{s.label}</p>
                        <p className="text-gray-400">
                          {s.itemsImported} new · {s.itemsUpdated} updated{s.itemsFailed ? ` · ${s.itemsFailed} failed` : ''}
                          {s.lastSyncAt ? ` · ${new Date(s.lastSyncAt).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full font-medium ${
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
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Widget Key &amp; Embed Snippet</h3>
            </div>
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

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">How the widget works</p>
            <p>Once enabled with at least one allowed domain, a visitor on your website can chat with your AI sales agent 24/7. It qualifies the visitor, and once it has a name and a way to reach them, creates a real Lead here in your CRM — automatically assigned to a sales rep and picked up by any automations you've already set up.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
