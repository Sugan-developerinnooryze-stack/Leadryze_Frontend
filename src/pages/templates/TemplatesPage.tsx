import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import {
  PlusIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, PencilSquareIcon,
  DocumentDuplicateIcon, EyeIcon, PaperAirplaneIcon, CheckCircleIcon, XCircleIcon,
  EnvelopeIcon, ChatBubbleLeftRightIcon, DevicePhoneMobileIcon,
  TableCellsIcon, Squares2X2Icon, ArrowPathIcon, SparklesIcon,
  XMarkIcon, ChevronLeftIcon, ChevronRightIcon,
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

const CATEGORY_COLORS: Record<string, string> = {
  meeting: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
  appointment: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60',
  booking: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60',
  followup: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60',
  reminder: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
  marketing: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
  onboarding: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60',
  feedback: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
  task: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60',
  custom: 'bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60',
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof EnvelopeIcon; badge: string; color: string; dot: string }> = {
  email: {
    label: 'Email',
    icon: EnvelopeIcon,
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60',
    color: '#6366f1',
    dot: 'bg-indigo-500',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: ChatBubbleLeftRightIcon,
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
    color: '#10b981',
    dot: 'bg-emerald-500',
  },
  sms: {
    label: 'SMS',
    icon: DevicePhoneMobileIcon,
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
    color: '#f59e0b',
    dot: 'bg-amber-500',
  },
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

const SAMPLE_DATA: Record<string, string> = {
  name: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1 555-0199',
  company: 'LeadRyze Corp',
  title: 'Quarterly Review',
  status: 'Confirmed',
  id: 'REC-1042',
  today: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
};

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

function renderWithSample(text: string): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`);
}

const EMPTY_FORM = { name: '', type: 'email', category: 'marketing', subject: '', body: '', language: 'en' };

/* ─── Template Form Modal ─────────────────────────────────────────────────────── */
function TemplateFormModal({
  open, template, usageTotal, onClose,
}: { open: boolean; template: Template | null; usageTotal: number; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [acknowledgedInUse, setAcknowledgedInUse] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
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
      setActiveTab('editor');
    }
  }, [open, template]);

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const applyHint = () => {
    const hint = VAR_HINTS[form.category];
    if (hint) setForm((p) => ({ ...p, body: hint }));
  };

  const insertVariableChip = (token: string, target: 'subject' | 'body') => {
    const textToInsert = `{{${token}}}`;
    if (target === 'subject') {
      const el = subjectRef.current;
      if (el) {
        const start = el.selectionStart ?? form.subject.length;
        const end = el.selectionEnd ?? form.subject.length;
        const next = form.subject.slice(0, start) + textToInsert + form.subject.slice(end);
        setForm((p) => ({ ...p, subject: next }));
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
        }, 0);
      } else {
        setForm((p) => ({ ...p, subject: p.subject + textToInsert }));
      }
    } else {
      const el = bodyRef.current;
      if (el) {
        const start = el.selectionStart ?? form.body.length;
        const end = el.selectionEnd ?? form.body.length;
        const next = form.body.slice(0, start) + textToInsert + form.body.slice(end);
        setForm((p) => ({ ...p, body: next }));
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
        }, 0);
      } else {
        setForm((p) => ({ ...p, body: p.body + textToInsert }));
      }
    }
  };

  const detectedVars = extractTokens(form.body);
  const bodyWarnings = unsupportedTokens(form.body);
  const subjectWarnings = form.type === 'email' ? unsupportedTokens(form.subject) : [];
  const needsInUseAck = isEdit && usageTotal > 0 && !acknowledgedInUse;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) { toast.error('Message body is required'); return; }
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
      await duplicateMutation.mutateAsync(template._id);
      toast.success('Duplicated — editing the copy instead');
      onClose();
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit Template — ${template?.name}` : 'Create New Template'} size="lg" onClose={onClose}>
      {needsInUseAck ? (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-xl p-4 text-sm border border-amber-200 dark:border-amber-800">
            This template is currently used by <strong>{usageTotal}</strong> active campaign(s) or automation(s). Changes will directly affect future sends using this template.
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={duplicateInstead} disabled={saving}>Duplicate Instead</button>
            <button type="button" className="btn-primary" onClick={() => setAcknowledgedInUse(true)}>Edit Anyway</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Channel selector segment buttons */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">Communication Channel</label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['email', 'whatsapp', 'sms'] as const).map((ch) => {
                const conf = CHANNEL_CONFIG[ch];
                const Icon = conf.icon;
                const isSelected = form.type === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, type: ch }))}
                    className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-ryze-500 bg-ryze-500/10 text-ryze-700 dark:text-ryze-300 ring-2 ring-ryze-500/20 shadow-xs'
                        : 'border-border bg-surface text-text-muted hover:text-text-primary hover:bg-background'
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: isSelected ? conf.color : undefined }} />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Name */}
          <div>
            <label className="label">Template Name *</label>
            <input
              className="input text-sm"
              placeholder="e.g. Booking Confirmation — Email"
              value={form.name}
              onChange={f('name')}
              required
            />
          </div>

          {/* Purpose & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Purpose / Category</label>
              <select className="input text-sm" value={form.category} onChange={f('category')}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input text-sm" value={form.language} onChange={f('language')}>
                <option value="en">English (EN)</option>
                <option value="ms">Bahasa Malaysia (MS)</option>
                <option value="zh">Chinese (ZH)</option>
                <option value="ta">Tamil (TA)</option>
              </select>
            </div>
          </div>

          {form.type === 'whatsapp' && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 text-xs border border-emerald-200/50 dark:border-emerald-800/40 flex items-start gap-2">
              <span className="text-emerald-600 font-bold shrink-0">ⓘ</span>
              <span>WhatsApp templates support dynamic variables. Messages will be dispatched through your connected WhatsApp provider account.</span>
            </div>
          )}

          {/* Email Subject (Email only) */}
          {form.type === 'email' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Email Subject Line</label>
                <VariablePicker
                  module=""
                  targetRef={subjectRef}
                  value={form.subject}
                  onChange={(v) => setForm((p) => ({ ...p, subject: v }))}
                  catalogOverride={KNOWN_VAR_CATALOG}
                />
              </div>
              <input
                ref={subjectRef}
                className="input text-sm"
                placeholder="Your appointment is confirmed — {{name}}"
                value={form.subject}
                onChange={f('subject')}
              />
              {subjectWarnings.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠ Unresolved variables: {subjectWarnings.map((v) => `{{${v}}}`).join(', ')}</p>
              )}
            </div>
          )}

          {/* Editor vs Live Preview Tab Switcher */}
          <div className="border border-border rounded-xl p-3 bg-background/50">
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'editor'
                      ? 'bg-surface text-ryze-700 dark:text-ryze-400 shadow-xs border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Message Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                    activeTab === 'preview'
                      ? 'bg-surface text-ryze-700 dark:text-ryze-400 shadow-xs border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Live Preview
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyHint}
                  className="inline-flex items-center gap-1 text-xs text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 font-medium"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Sample for "{CATEGORY_LABELS[form.category] ?? form.category}"
                </button>
              </div>
            </div>

            {activeTab === 'editor' ? (
              <div className="space-y-2.5">
                {/* Variable quick chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-text-muted">Insert:</span>
                  {['name', 'company', 'email', 'phone', 'today'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariableChip(v, 'body')}
                      className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-surface border border-border hover:border-ryze-400 hover:text-ryze-600 text-text-primary transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                  <div className="ml-auto">
                    <VariablePicker
                      module=""
                      targetRef={bodyRef}
                      value={form.body}
                      onChange={(v) => setForm((p) => ({ ...p, body: v }))}
                      catalogOverride={KNOWN_VAR_CATALOG}
                    />
                  </div>
                </div>

                <textarea
                  ref={bodyRef}
                  className="input font-mono text-xs leading-relaxed bg-surface"
                  rows={6}
                  placeholder="Type your message body. Use {{name}}, {{company}}, {{email}} for dynamic fields."
                  value={form.body}
                  onChange={f('body')}
                  required
                />

                <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                  <div>
                    {detectedVars.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px]">Detected variables:</span>
                        {detectedVars.map((v) => (
                          <span
                            key={v}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              bodyWarnings.includes(v)
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="tabular-nums font-mono text-[11px]">
                    {form.body.length} characters
                    {form.type === 'sms' && ` • ${Math.ceil(form.body.length / 160) || 1} SMS segment(s)`}
                  </div>
                </div>
              </div>
            ) : (
              /* Live Preview Mockup */
              <div className="bg-surface rounded-xl border border-border p-4 shadow-inner min-h-[160px] flex flex-col justify-center">
                {form.type === 'email' ? (
                  <div className="space-y-2">
                    <div className="border-b border-border pb-2 text-xs">
                      <p className="text-text-muted">Subject: <span className="font-semibold text-text-primary">{form.subject ? renderWithSample(form.subject) : '(No subject)'}</span></p>
                      <p className="text-text-muted mt-0.5">To: <span className="text-text-primary">john.doe@example.com</span></p>
                    </div>
                    <div className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed py-2">
                      {form.body ? renderWithSample(form.body) : <span className="text-text-muted italic">Type message body to see live preview.</span>}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto w-full">
                    <div className="flex items-center justify-between text-[11px] text-text-muted pb-2 border-b border-border mb-2">
                      <span>{form.type === 'whatsapp' ? '🟢 WhatsApp Preview' : '📱 SMS Message Preview'}</span>
                      <span>To: +1 555-0199</span>
                    </div>
                    <div className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[90%] shadow-xs whitespace-pre-wrap ${
                      form.type === 'whatsapp'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800 ml-auto'
                        : 'bg-ryze-50 dark:bg-ryze-950/40 text-text-primary border border-ryze-200 dark:border-ryze-800 ml-auto'
                    }`}>
                      {form.body ? renderWithSample(form.body) : <span className="text-text-muted italic">Type message body to see live preview.</span>}
                      <span className="block text-[9px] text-text-muted text-right mt-1">10:45 AM ✓✓</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ─── Preview Modal ───────────────────────────────────────────────────────────── */
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
  const channelConf = CHANNEL_CONFIG[template.type] ?? CHANNEL_CONFIG.email;
  const warnings = result ? unsupportedTokens(result.subject ? `${result.subject} ${result.body}` : result.body) : [];

  return (
    <Modal open={open} title={`Preview — ${template.name}`} onClose={onClose} size="md">
      {!result ? (
        <div className="animate-pulse space-y-3 p-4">
          <div className="h-4 bg-black/[0.04] dark:bg-white/[0.06] rounded w-1/3" />
          <div className="h-28 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
            <span className={`px-2.5 py-0.5 rounded-full font-medium ${channelConf.badge}`}>
              {channelConf.label}
            </span>
            <span className="text-text-muted uppercase">Lang: {template.language}</span>
          </div>

          {result.subject && (
            <div className="bg-surface rounded-lg border border-border p-3 text-xs">
              <span className="text-text-muted font-medium">Subject:</span>{' '}
              <span className="font-semibold text-text-primary">{result.subject}</span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Message Content</p>
            <div className="bg-surface rounded-lg border border-border p-4 text-xs text-text-primary whitespace-pre-wrap leading-relaxed shadow-xs">
              {result.body}
            </div>
          </div>

          {warnings.length > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200">
              ⚠ Unresolved variables: {warnings.map((v) => `{{${v}}}`).join(', ')}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Test Send Modal ─────────────────────────────────────────────────────────── */
function TestSendModal({ open, template, onClose }: { open: boolean; template: Template | null; onClose: () => void }) {
  const [to, setTo] = useState('');
  const testSendMutation = useTestSendTemplate();

  useEffect(() => { if (open) setTo(''); }, [open]);
  if (!template) return null;
  const isEmail = template.type === 'email';

  const doSend = () => {
    if (!to.trim()) return;
    testSendMutation.mutate({ id: template._id, to: to.trim() }, {
      onSuccess: (r) => (r.sent ? toast.success('Test message sent.') : toast.error(r.reason ?? 'Test message could not be sent.')),
      onError: () => toast.error('Test send failed.'),
    });
  };

  return (
    <Modal open={open} title={`Send Test Message — ${template.name}`} size="sm" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">{isEmail ? 'Recipient Email Address' : 'Recipient Phone Number'}</label>
          <input
            className="input text-sm"
            placeholder={isEmail ? 'you@company.com' : '+91 9876543210'}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <p className="text-[11px] text-text-muted mt-1">
            Sends a single test message with mock profile variables substituted.
          </p>
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={doSend} disabled={testSendMutation.isPending || !to.trim()}>
            {testSendMutation.isPending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Row Action Menu ─────────────────────────────────────────────────────────── */
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-background rounded-lg transition-colors"
        title="More options"
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 bg-surface border border-border rounded-xl shadow-lg py-1 animate-in fade-in duration-100">
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background">
            <PencilSquareIcon className="h-3.5 w-3.5 text-text-muted" /> Edit Template
          </button>
          <button onClick={() => { setOpen(false); onPreview(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background">
            <EyeIcon className="h-3.5 w-3.5 text-text-muted" /> Preview
          </button>
          <button onClick={() => { setOpen(false); onTestSend(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background">
            <PaperAirplaneIcon className="h-3.5 w-3.5 text-text-muted" /> Send Test
          </button>
          <button onClick={doDuplicate} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background">
            <DocumentDuplicateIcon className="h-3.5 w-3.5 text-text-muted" /> Duplicate
          </button>
          <div className="border-t border-border my-1" />
          {template.isActive ? (
            <button onClick={() => { setOpen(false); onDeactivate(); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30">
              <XCircleIcon className="h-3.5 w-3.5" /> Deactivate
            </button>
          ) : (
            <button onClick={doActivate} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
              <CheckCircleIcon className="h-3.5 w-3.5" /> Activate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Deactivate Confirmation Modal ───────────────────────────────────────────── */
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
          ? `This template is used by ${total} campaign(s)/automation(s). It will no longer be available for new Campaigns or Automations, but any workflow that already references it will continue using it.`
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

/* ─── Main Templates Page Component ──────────────────────────────────────────── */
export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, refetch, isRefetching } = useTemplatesListQuery({
    limit: 300,
    type: channelFilter || undefined,
    category: categoryFilter || undefined,
  });
  const templates = data?.items ?? [];
  const qc = useQueryClient();

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

  // Filtered dataset
  const filtered = useMemo(() => {
    let res = templates;
    if (statusFilter === 'active') res = res.filter((t) => t.isActive);
    if (statusFilter === 'inactive') res = res.filter((t) => !t.isActive);
    const q = search.trim().toLowerCase();
    if (q) {
      res = res.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q))
      );
    }
    return res;
  }, [templates, search, statusFilter]);

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  // Counts for top KPI strip
  const counts = useMemo(() => {
    const total = templates.length;
    const email = templates.filter((t) => t.type === 'email').length;
    const whatsapp = templates.filter((t) => t.type === 'whatsapp').length;
    const sms = templates.filter((t) => t.type === 'sms').length;
    const active = templates.filter((t) => t.isActive).length;
    return { total, email, whatsapp, sms, active };
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Templates</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Create, manage, and preview reusable messaging templates for Campaigns and Automations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 border border-border rounded-xl text-text-muted hover:text-text-primary bg-surface hover:bg-background transition-colors"
            title="Refresh templates"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin text-ryze-600' : ''}`} />
          </button>
          <button
            className="btn-primary gap-2 shadow-sm"
            onClick={() => setFormTarget({ open: true, template: null })}
          >
            <PlusIcon className="h-4 w-4" /> New Template
          </button>
        </div>
      </div>

      {/* ── Top Metrics Strip (KPI Cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Templates */}
        <div
          onClick={() => { setChannelFilter(''); setStatusFilter('all'); }}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            !channelFilter && statusFilter === 'all'
              ? 'border-ryze-500/80 ring-1 ring-ryze-500/20'
              : 'border-border hover:border-ryze-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Total Templates</span>
            <span className="h-2 w-2 rounded-full bg-ryze-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{counts.total}</span>
            <span className="text-[11px] text-text-muted">({counts.active} active)</span>
          </div>
        </div>

        {/* Email Templates */}
        <div
          onClick={() => setChannelFilter((p) => p === 'email' ? '' : 'email')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'email'
              ? 'border-indigo-500/80 ring-1 ring-indigo-500/20'
              : 'border-border hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Email</span>
            <EnvelopeIcon className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.email}</span>
          </div>
        </div>

        {/* WhatsApp Templates */}
        <div
          onClick={() => setChannelFilter((p) => p === 'whatsapp' ? '' : 'whatsapp')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'whatsapp'
              ? 'border-emerald-500/80 ring-1 ring-emerald-500/20'
              : 'border-border hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">WhatsApp</span>
            <ChatBubbleLeftRightIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.whatsapp}</span>
          </div>
        </div>

        {/* SMS Templates */}
        <div
          onClick={() => setChannelFilter((p) => p === 'sms' ? '' : 'sms')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'sms'
              ? 'border-amber-500/80 ring-1 ring-amber-500/20'
              : 'border-border hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">SMS</span>
            <DevicePhoneMobileIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.sms}</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search & Filters & View Switcher ─────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500 focus:border-transparent transition-all"
              placeholder="Search templates by name, subject, or message body…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Channel dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>

          {/* Purpose dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Purposes</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Status dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(search || channelFilter || categoryFilter || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setChannelFilter(''); setCategoryFilter(''); setStatusFilter('all'); }}
              className="text-xs text-ryze-600 dark:text-ryze-400 hover:underline px-2 py-1"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* View Switcher Toggle (Table vs Cards) */}
        <div className="flex items-center border border-border rounded-xl p-0.5 bg-background shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-surface text-ryze-700 dark:text-ryze-300 shadow-xs border border-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TableCellsIcon className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'cards'
                ? 'bg-surface text-ryze-700 dark:text-ryze-300 shadow-xs border border-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Squares2X2Icon className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-surface rounded-2xl border border-border p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-black/[0.04] dark:bg-white/[0.06] rounded w-1/4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl" />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border text-center py-16 px-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-ryze-500/10 text-ryze-600 flex items-center justify-center mx-auto mb-3">
            <EnvelopeIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No templates found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-5">
            {search || channelFilter || categoryFilter || statusFilter !== 'all'
              ? 'No templates match your active filters. Try resetting the filters or modifying your search terms.'
              : 'Create your first template to power your messaging campaigns and automated workflows.'}
          </p>
          <button
            className="btn-primary gap-2"
            onClick={() => setFormTarget({ open: true, template: null })}
          >
            <PlusIcon className="h-4 w-4" /> Create Template
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ─── Table View ────────────────────────────────────────────────────── */
        <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs font-semibold text-text-muted">
                  <th className="px-4 py-3.5 w-12 text-center">S.No.</th>
                  <th className="px-4 py-3.5">Template Name & Preview</th>
                  <th className="px-4 py-3.5">Channel</th>
                  <th className="px-4 py-3.5">Purpose</th>
                  <th className="px-4 py-3.5">Language</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((t, idx) => {
                  const chConf = CHANNEL_CONFIG[t.type] ?? CHANNEL_CONFIG.email;
                  const ChIcon = chConf.icon;
                  const catColor = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.custom;
                  const sNo = (page - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={t._id}
                      className="hover:bg-background/40 transition-colors group"
                    >
                      {/* S.No */}
                      <td className="px-4 py-3 text-center text-xs text-text-muted font-mono">
                        {sNo}
                      </td>

                      {/* Name & Snippet */}
                      <td className="px-4 py-3 max-w-md">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white mt-0.5"
                            style={{ backgroundColor: chConf.color }}
                          >
                            <ChIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => setFormTarget({ open: true, template: t })}
                              className="font-semibold text-text-primary group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors text-left truncate max-w-xs block"
                            >
                              {t.name}
                            </button>
                            <p className="text-xs text-text-muted truncate max-w-xs mt-0.5">
                              {t.subject ? `Subject: ${t.subject}` : t.body.slice(0, 60) + (t.body.length > 60 ? '…' : '')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${chConf.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${chConf.dot}`} />
                          {chConf.label}
                        </span>
                      </td>

                      {/* Purpose */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${catColor}`}>
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </span>
                      </td>

                      {/* Language */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider bg-background px-2 py-0.5 rounded-md border border-border/80">
                          {t.language}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.isActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                            : 'bg-black/[0.04] text-text-muted dark:bg-white/[0.06] border border-border'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${t.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {t.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewTarget(t)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                            title="Preview message"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setTestSendTarget(t)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                            title="Send test message"
                          >
                            <PaperAirplaneIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setFormTarget({ open: true, template: t })}
                            className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                            title="Edit template"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <RowActions
                            template={t}
                            onEdit={() => setFormTarget({ open: true, template: t })}
                            onPreview={() => setPreviewTarget(t)}
                            onTestSend={() => setTestSendTarget(t)}
                            onDeactivate={() => setDeactivateTarget(t)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table pagination */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface flex-wrap gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong>–<strong className="text-text-primary">{Math.min(page * pageSize, filtered.length)}</strong> of <strong className="text-text-primary">{filtered.length}</strong> templates
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ryze-500"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeftIcon className="h-3 w-3" /> Prev
              </button>
              <span className="px-2 font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next <ChevronRightIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Cards View ────────────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((t) => {
              const chConf = CHANNEL_CONFIG[t.type] ?? CHANNEL_CONFIG.email;
              const ChIcon = chConf.icon;
              const catColor = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.custom;

              return (
                <div
                  key={t._id}
                  className="bg-surface border border-border hover:border-ryze-400 dark:hover:border-ryze-600 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Top badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${chConf.badge}`}>
                          <ChIcon className="h-3.5 w-3.5" />
                          {chConf.label}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor}`}>
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'bg-black/[0.04] text-text-muted dark:bg-white/[0.06]'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Template Title */}
                    <h3
                      onClick={() => setFormTarget({ open: true, template: t })}
                      className="font-semibold text-sm text-text-primary group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors cursor-pointer truncate"
                      title={t.name}
                    >
                      {t.name}
                    </h3>

                    {/* Subject line if email */}
                    {t.subject && (
                      <p className="text-xs text-text-muted truncate mt-1">
                        <span className="font-medium text-text-primary/70">Subject:</span> {t.subject}
                      </p>
                    )}

                    {/* Message Preview Box */}
                    <div className="mt-3 p-3 rounded-xl bg-background border border-border/80 text-xs text-text-primary/80 leading-relaxed font-mono line-clamp-3 min-h-[64px]">
                      {t.body}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-border pt-3 mt-4 text-xs">
                    <span className="text-[11px] font-mono text-text-muted uppercase">
                      Lang: {t.language}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewTarget(t)}
                        className="p-1 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                        title="Preview"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTestSendTarget(t)}
                        className="p-1 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                        title="Test send"
                      >
                        <PaperAirplaneIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setFormTarget({ open: true, template: t })}
                        className="p-1 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <RowActions
                        template={t}
                        onEdit={() => setFormTarget({ open: true, template: t })}
                        onPreview={() => setPreviewTarget(t)}
                        onTestSend={() => setTestSendTarget(t)}
                        onDeactivate={() => setDeactivateTarget(t)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards pagination */}
          <div className="border border-border rounded-xl px-4 py-3 flex items-center justify-between bg-surface flex-wrap gap-2 text-xs text-text-muted">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} templates
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="px-2 font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
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
