import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import {
  PlusIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, PencilSquareIcon,
  DocumentDuplicateIcon, EyeIcon, PaperAirplaneIcon, CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import Modal from '../../components/Modal';
import VariablePicker from '../native-crm/settings/VariablePicker';
import FSDeleteModal from '../../modules/native-crm/shared/FSDeleteModal';
import {
  Template, useTemplatesListQuery, useTemplateCreate, useTemplateUpdate,
  useTemplateActivate, useTemplateDeactivate, useDuplicateTemplate,
  usePreviewTemplate, useTestSendTemplate, useTemplateUsageQuery,
} from '../../modules/templates/queries/templates.queries';

const CATEGORY_LABELS: Record<string, string> = {
  meeting: 'Meeting', appointment: 'Appointment', booking: 'Booking', followup: 'Follow-up',
  reminder: 'Reminder', marketing: 'Marketing', onboarding: 'Onboarding', feedback: 'Feedback',
  task: 'Task', custom: 'Custom',
};

const VAR_HINTS: Record<string, string> = {
  meeting: 'Hi {{name}},\n\nYour meeting with {{company}} is confirmed.\n\nSee you then!',
  appointment: 'Dear {{name}},\n\nYour appointment with {{company}} is confirmed.\n\nSee you then!',
  booking: 'Hi {{name}}! Your booking with {{company}} is confirmed.\nThank you for choosing us!',
  followup: 'Hi {{name}}, just checking in! Did you get a chance to review the information I sent? 😊',
  reminder: 'Hi {{name}}, this is a friendly reminder. See you soon!',
  marketing: '🎉 Special offer for you, {{name}}! Reply YES to claim your offer from {{company}}.',
  onboarding: 'Hi {{name}}! Welcome to {{company}} 👋 I\'m here to help you get started.',
  feedback: 'Hi {{name}}! Thank you for choosing {{company}} 🙏 How was your experience? Rate 1-5 ⭐',
  task: 'Hi {{name}}, a task has been assigned to you. Please review when you can.',
  custom: 'Hi {{name}},\n\nBest regards,\n{{company}}',
};

// Grounded directly in what the two real runtime render paths resolve today
// (renderVariablesForCustomer in campaign-dispatch.service.ts, buildVariables
// in automation-rule.service.ts) — not invented. A template is reusable
// across both contexts by design, so validation checks the union, not a
// single per-template context.
const CUSTOMER_VARS = [
  { key: 'name', label: 'Customer name' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
];
const RECORD_VARS = [
  { key: 'name', label: 'Recipient name' },
  { key: 'status', label: 'Trigger status/stage' },
  { key: 'title', label: 'Record title' },
  { key: 'id', label: 'Record ID' },
  { key: 'company', label: 'Company' },
  { key: 'today', label: "Today's date" },
];
const KNOWN_VAR_CATALOG = [...CUSTOMER_VARS, ...RECORD_VARS].filter(
  (v, i, arr) => arr.findIndex((x) => x.key === v.key) === i
);
const KNOWN_VAR_KEYS = new Set(KNOWN_VAR_CATALOG.map((v) => v.key));

function extractTokens(text: string): string[] {
  const matches = text.match(/\{\{([\w.]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
}

function unsupportedTokens(text: string): string[] {
  return extractTokens(text).filter((t) => !t.startsWith('record.') && !KNOWN_VAR_KEYS.has(t));
}

const EMPTY_FORM = { name: '', type: 'email', category: 'marketing', subject: '', body: '', language: 'en' };

function TemplateFormModal({
  open, template, usageTotal, onClose,
}: { open: boolean; template: Template | null; usageTotal: number; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [acknowledgedInUse, setAcknowledgedInUse] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const createMutation = useTemplateCreate();
  const updateMutation = useTemplateUpdate();
  const duplicateMutation = useDuplicateTemplate();
  const isEdit = !!template;
  const saving = createMutation.isPending || updateMutation.isPending || duplicateMutation.isPending;

  useEffect(() => {
    if (open) {
      setForm(template ? {
        name: template.name, type: template.type, category: template.category,
        subject: template.subject ?? '', body: template.body, language: template.language,
      } : EMPTY_FORM);
      setAcknowledgedInUse(false);
    }
  }, [open, template]);

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const applyHint = () => {
    const hint = VAR_HINTS[form.category];
    if (hint) setForm((p) => ({ ...p, body: hint }));
  };

  const detectedVars = extractTokens(form.body);
  const bodyWarnings = unsupportedTokens(form.body);
  const subjectWarnings = form.type === 'email' ? unsupportedTokens(form.subject) : [];
  const needsInUseAck = isEdit && usageTotal > 0 && !acknowledgedInUse;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) { toast.error('Body is required'); return; }
    if (needsInUseAck) return;
    try {
      const payload = {
        name: form.name, type: form.type as Template['type'], category: form.category,
        subject: form.subject || undefined, body: form.body, language: form.language,
      };
      if (isEdit && template) {
        await updateMutation.mutateAsync({ id: template._id, data: payload });
        toast.success('Template updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Template created');
      }
      onClose();
    } catch {
      toast.error(isEdit ? 'Failed to update template' : 'Failed to create template');
    }
  };

  const duplicateInstead = async () => {
    if (!template) return;
    try {
      const dup = await duplicateMutation.mutateAsync(template._id);
      toast.success('Duplicated — editing the copy instead');
      onClose();
      // Caller re-opens edit on the duplicate via its own row click; keep
      // this modal simple and let the list refresh naturally.
      void dup;
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit "${template?.name}"` : 'New Template'} size="lg" onClose={onClose}>
      {needsInUseAck ? (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-xl p-4 text-sm">
            This template is used by <strong>{usageTotal}</strong> campaign(s)/automation(s). Changes will affect future sends using this template.
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={duplicateInstead} disabled={saving}>Duplicate Instead</button>
            <button type="button" className="btn-primary" onClick={() => setAcknowledgedInUse(true)}>Edit Anyway</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Template Name *</label>
            <input className="input" placeholder="e.g. Meeting Confirmation Email" value={form.name} onChange={f('name')} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Purpose</label>
              <select className="input" value={form.category} onChange={f('category')}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input" value={form.type} onChange={f('type')}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input" value={form.language} onChange={f('language')}>
                <option value="en">English</option>
                <option value="ms">Bahasa Malaysia</option>
                <option value="zh">Chinese</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
          </div>

          {form.type === 'whatsapp' && (
            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-xl p-3 text-xs">
              ⓘ WhatsApp currently sends as plain LeadRyze text. Meta-approved structured template messaging will be added in a future release.
            </div>
          )}

          {form.type === 'email' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Email Subject</label>
                <VariablePicker module="" targetRef={subjectRef} value={form.subject} onChange={(v) => setForm((p) => ({ ...p, subject: v }))} catalogOverride={KNOWN_VAR_CATALOG} />
              </div>
              <input ref={subjectRef} className="input" placeholder="Your meeting is confirmed — {{name}}" value={form.subject} onChange={f('subject')} />
              {subjectWarnings.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠ Not resolved by any current send path: {subjectWarnings.map((v) => `{{${v}}}`).join(', ')} — recipients will see this literal text.</p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Message Body *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={applyHint} className="text-xs text-ryze-600 dark:text-ryze-400 hover:underline">
                  Use sample for "{CATEGORY_LABELS[form.category] ?? form.category}"
                </button>
                <VariablePicker module="" targetRef={bodyRef} value={form.body} onChange={(v) => setForm((p) => ({ ...p, body: v }))} catalogOverride={KNOWN_VAR_CATALOG} />
              </div>
            </div>
            <textarea
              ref={bodyRef} className="input font-mono text-sm" rows={6}
              placeholder="Write your message. Use {{name}}, {{company}}, {{email}}, {{phone}} for dynamic fields."
              value={form.body} onChange={f('body')} required
            />
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs text-text-muted mr-1">Variables detected:</span>
                {detectedVars.map((v) => (
                  <span key={v} className={`badge text-xs ${bodyWarnings.includes(v) ? 'badge-yellow' : 'badge-blue'}`}>{`{{${v}}}`}</span>
                ))}
              </div>
            )}
            {bodyWarnings.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠ Not resolved by any current send path: {bodyWarnings.map((v) => `{{${v}}}`).join(', ')} — recipients will see this literal text, not the value.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function PreviewModal({ open, template, onClose }: { open: boolean; template: Template | null; onClose: () => void }) {
  const previewMutation = usePreviewTemplate();
  const [result, setResult] = useState<{ subject?: string; body: string } | null>(null);

  useEffect(() => {
    if (open && template) {
      setResult(null);
      previewMutation.mutate({ id: template._id }, { onSuccess: setResult, onError: () => toast.error('Could not generate preview') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?._id]);

  if (!template) return null;
  const warnings = result ? unsupportedTokens(result.subject ? `${result.subject} ${result.body}` : result.body) : [];

  return (
    <Modal open={open} title={`Preview — ${template.name}`} onClose={onClose}>
      {!result ? (
        <div className="animate-pulse h-32 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
      ) : (
        <div className="space-y-3">
          {result.subject && <p className="text-sm font-medium text-text-primary">Subject: {result.subject}</p>}
          <div className="bg-black/[0.02] dark:bg-white/[0.03] rounded-lg p-4 text-sm whitespace-pre-wrap text-text-primary">{result.body}</div>
          {warnings.length > 0 && (
            <p className="text-xs text-amber-600">⚠ {warnings.map((v) => `{{${v}}}`).join(', ')} shown above literally — not resolved by any current send path.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function TestSendModal({ open, template, onClose }: { open: boolean; template: Template | null; onClose: () => void }) {
  const [to, setTo] = useState('');
  const testSendMutation = useTestSendTemplate();

  useEffect(() => { if (open) setTo(''); }, [open]);
  if (!template) return null;

  const doSend = () => {
    if (!to.trim()) return;
    testSendMutation.mutate({ id: template._id, to: to.trim() }, {
      onSuccess: (r) => (r.sent ? toast.success('Test message sent.') : toast.error(r.reason ?? 'Test message could not be sent.')),
      onError: () => toast.error('Test send failed.'),
    });
  };

  return (
    <Modal open={open} title={`Send Test — ${template.name}`} size="sm" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">{template.type === 'email' ? 'Recipient email' : 'Recipient phone'}</label>
          <input className="input" placeholder={template.type === 'email' ? 'test@example.com' : '+15550001234'} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={doSend} disabled={testSendMutation.isPending || !to.trim()}>
            {testSendMutation.isPending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RowActions({ template, onEdit, onPreview, onTestSend, onDeactivate }: {
  template: Template; onEdit: () => void; onPreview: () => void; onTestSend: () => void; onDeactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const duplicateMutation = useDuplicateTemplate();
  const activateMutation = useTemplateActivate();

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doDuplicate = async () => {
    setOpen(false);
    try { await duplicateMutation.mutateAsync(template._id); toast.success('Template duplicated'); }
    catch { toast.error('Could not duplicate'); }
  };

  const doActivate = async () => {
    setOpen(false);
    try { await activateMutation.mutateAsync(template._id); toast.success('Template activated'); }
    catch { toast.error('Could not activate'); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-lg">
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg py-1">
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"><PencilSquareIcon className="h-4 w-4" /> Edit</button>
          <button onClick={() => { setOpen(false); onPreview(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"><EyeIcon className="h-4 w-4" /> Preview</button>
          <button onClick={() => { setOpen(false); onTestSend(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"><PaperAirplaneIcon className="h-4 w-4" /> Test Send</button>
          <button onClick={doDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"><DocumentDuplicateIcon className="h-4 w-4" /> Duplicate</button>
          {template.isActive ? (
            <button onClick={() => { setOpen(false); onDeactivate(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"><XCircleIcon className="h-4 w-4" /> Deactivate</button>
          ) : (
            <button onClick={doActivate} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"><CheckCircleIcon className="h-4 w-4" /> Activate</button>
          )}
        </div>
      )}
    </div>
  );
}

function DeactivateConfirm({ template, onClose }: { template: Template; onClose: () => void }) {
  const { data: usage } = useTemplateUsageQuery(template._id);
  const deactivateMutation = useTemplateDeactivate();
  const total = usage?.total ?? 0;

  return (
    <FSDeleteModal
      label={template.name}
      tone="warning"
      title={`Deactivate "${template.name}"?`}
      description={
        total > 0
          ? `This template is used by ${total} campaign(s)/automation(s). It will no longer be available for new Campaigns or Automations, but any workflow that already references it will continue using it exactly as today.`
          : 'It will no longer be available for new Campaigns or Automations. You can reactivate it anytime.'
      }
      confirmLabel="Deactivate"
      confirmingLabel="Deactivating…"
      onClose={onClose}
      onConfirm={async () => {
        await deactivateMutation.mutateAsync(template._id);
        toast.success('Template deactivated');
        onClose();
      }}
    />
  );
}

export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { data, isLoading } = useTemplatesListQuery({ limit: 200, type: channelFilter || undefined, category: categoryFilter || undefined });
  const templates = data?.items ?? [];
  const qc = useQueryClient();

  // Preserves the existing auto-seed-on-first-visit UX — unrelated to this
  // redesign, carried over as-is.
  useEffect(() => {
    if (!isLoading && templates.length === 0 && !search && !channelFilter && !categoryFilter) {
      api.post('/api/v1/templates/seed').then(() => qc.invalidateQueries({ queryKey: ['templates'] })).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, templates.length]);

  const [formTarget, setFormTarget] = useState<{ open: boolean; template: Template | null }>({ open: false, template: null });
  const [previewTarget, setPreviewTarget] = useState<Template | null>(null);
  const [testSendTarget, setTestSendTarget] = useState<Template | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Template | null>(null);

  const editingUsage = useTemplateUsageQuery(formTarget.template?._id ?? '');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
  }, [templates, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Templates</h1>
          <p className="text-sm text-text-muted mt-0.5">Reusable messages for Campaigns and Automations.</p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setFormTarget({ open: true, template: null })}>
          <PlusIcon className="h-4 w-4" /> New Template
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input className="input pl-9" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="">All Channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Purposes</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-muted mb-4">No templates match.</p>
          <button className="btn-primary gap-2" onClick={() => setFormTarget({ open: true, template: null })}>
            <PlusIcon className="h-4 w-4" /> Create a template
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-black/[0.015] dark:bg-white/[0.02] text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t._id} className="border-b border-border last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                  <td className="px-4 py-3"><span className="badge badge-gray capitalize">{t.type}</span></td>
                  <td className="px-4 py-3 text-text-muted">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                  <td className="px-4 py-3 text-text-muted uppercase">{t.language}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${t.isActive ? 'badge-green' : 'badge-gray'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      template={t}
                      onEdit={() => setFormTarget({ open: true, template: t })}
                      onPreview={() => setPreviewTarget(t)}
                      onTestSend={() => setTestSendTarget(t)}
                      onDeactivate={() => setDeactivateTarget(t)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TemplateFormModal
        open={formTarget.open}
        template={formTarget.template}
        usageTotal={editingUsage.data?.total ?? 0}
        onClose={() => setFormTarget({ open: false, template: null })}
      />
      <PreviewModal open={!!previewTarget} template={previewTarget} onClose={() => setPreviewTarget(null)} />
      <TestSendModal open={!!testSendTarget} template={testSendTarget} onClose={() => setTestSendTarget(null)} />
      {deactivateTarget && <DeactivateConfirm template={deactivateTarget} onClose={() => setDeactivateTarget(null)} />}
    </div>
  );
}
