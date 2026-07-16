import { useEffect, useState, FormEvent, useCallback } from 'react';
import { PlusIcon, ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

interface Template {
  _id: string;
  name: string;
  type: string;      // channel: email | whatsapp | sms
  category: string;  // purpose: meeting | appointment | booking | followup | etc.
  subject?: string;
  body: string;
  variables: string[];
  language: string;
}

// type = channel (email/whatsapp/sms), category = purpose (meeting/appointment/etc.)
const EMPTY = { name: '', type: 'whatsapp', category: 'appointment', subject: '', body: '', language: 'en' };

const CATEGORY_LABELS: Record<string, string> = {
  meeting:     'Meeting',
  appointment: 'Appointment',
  booking:     'Booking',
  followup:    'Follow-up',
  reminder:    'Reminder',
  marketing:   'Marketing',
  onboarding:  'Onboarding',
  feedback:    'Feedback',
  task:        'Task',
  custom:      'Custom',
};

const VAR_HINTS: Record<string, string> = {
  meeting:     'Hi {{name}},\n\nYour meeting with {{company}} is confirmed for {{time}}.\n\nSee you then!',
  appointment: 'Dear {{name}},\n\nYour appointment with {{company}} is confirmed for {{date}} at {{time}}.\n\nSee you then!',
  booking:     'Hi {{name}}! Your booking with {{company}} is confirmed.\nDate & Time: {{time}}\nThank you for choosing us!',
  followup:    'Hi {{name}}, just checking in! Did you get a chance to review the information I sent? 😊',
  reminder:    'Hi {{name}}, this is a friendly reminder about your {{meeting}} on {{date}}. See you soon!',
  marketing:   '🎉 Special offer for you, {{name}}! Reply YES to claim your offer from {{company}}.',
  onboarding:  'Hi {{name}}! Welcome to {{company}} 👋 I\'m here to help you get started.',
  feedback:    'Hi {{name}}! Thank you for choosing {{company}} 🙏 How was your experience? Rate 1-5 ⭐',
  task:        'Hi {{name}}, a task has been assigned to you: {{meeting}}. Due: {{date}}.',
  custom:      'Hi {{name}},\n\n{{meeting}}\n\nBest regards,\n{{company}}',
};

export default function TemplatesPage() {
  const user = useAuthStore((s) => s.user);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  const fetchTemplates = useCallback(() => {
    if (!user?.tenantId) return;
    api
      .get(`/api/v1/templates?tenantId=${user.tenantId}`)
      .then(async (r) => {
        const list = r.data.data ?? [];
        if (list.length === 0) {
          // Auto-seed default templates on first visit
          try {
            await api.post(`/api/v1/templates/seed`);
          } catch {
            // seed failure is non-fatal
          }
          const r2 = await api.get(`/api/v1/templates?tenantId=${user.tenantId}`);
          setTemplates(r2.data.data ?? []);
        } else {
          setTemplates(list);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.tenantId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    const matches = form.body.match(/\{\{(\w+)\}\}/g) || [];
    setDetectedVars([...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]);
  }, [form.body]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.body.trim()) { toast.error('Body is required'); return; }
    setSaving(true);
    try {
      // type = channel (email/whatsapp/sms), category = purpose (meeting/appointment/etc.)
      await api.post('/api/v1/templates', {
        name:     form.name,
        type:     form.type,      // channel: email/whatsapp/sms
        category: form.category,  // purpose: meeting/appointment/etc.
        subject:  form.subject || undefined,
        body:     form.body,
        language: form.language,
      });
      toast.success('Template created!');
      setShowModal(false);
      setForm(EMPTY);
      fetchTemplates();
    } catch {
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/v1/templates/${id}`);
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const copyBody = (body: string) => {
    navigator.clipboard.writeText(body);
    toast.success('Copied to clipboard');
  };

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const applyHint = () => {
    const hint = VAR_HINTS[form.category];
    if (hint) setForm((p) => ({ ...p, body: hint }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Available variables: <code className="text-xs bg-gray-100 px-1 rounded">{'{{name}}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{company}}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{date}}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{time}}'}</code>{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">{'{{meeting}}'}</code>
          </p>
        </div>
        <button className="btn-primary gap-2" onClick={() => setShowModal(true)}>
          <PlusIcon className="h-4 w-4" /> New Template
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-32 bg-gray-100" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4">No templates yet.</p>
          <button className="btn-primary gap-2" onClick={() => setShowModal(true)}>
            <PlusIcon className="h-4 w-4" /> Create your first template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <div key={t._id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="badge badge-blue capitalize">{t.category ? CATEGORY_LABELS[t.category] ?? t.category : '—'}</span>
                    <span className="badge badge-gray capitalize">{t.type}</span>
                    <span className="badge badge-gray">{t.language}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyBody(t.body)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Copy">
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteTemplate(t._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {t.subject && <p className="text-sm font-medium text-gray-700 mb-1">Subject: {t.subject}</p>}
              <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{t.body}</p>
              {t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {t.variables.map((v) => (
                    <span key={v} className="badge badge-yellow">{`{{${v}}}`}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} title="New Template" size="lg" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Template Name *</label>
            <input className="input" placeholder="e.g. Meeting Confirmation Email" value={form.name} onChange={f('name')} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Purpose</label>
              <select className="input" value={form.category} onChange={f('category')}>
                <option value="meeting">Meeting</option>
                <option value="appointment">Appointment</option>
                <option value="booking">Booking</option>
                <option value="followup">Follow-up</option>
                <option value="reminder">Reminder</option>
                <option value="task">Task</option>
                <option value="marketing">Marketing</option>
                <option value="onboarding">Onboarding</option>
                <option value="feedback">Feedback</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input" value={form.type} onChange={f('type')}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
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

          {form.type === 'email' && (
            <div>
              <label className="label">Email Subject</label>
              <input className="input" placeholder="Your meeting is confirmed — {{time}}" value={form.subject} onChange={f('subject')} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Message Body *</label>
              <button type="button" onClick={applyHint} className="text-xs text-brand-600 hover:underline">
                Use sample for "{CATEGORY_LABELS[form.category] ?? form.category}"
              </button>
            </div>
            <textarea
              className="input font-mono text-sm"
              rows={6}
              placeholder="Write your message. Use {{name}}, {{date}}, {{time}}, {{company}}, {{meeting}} for dynamic fields."
              value={form.body}
              onChange={f('body')}
              required
            />
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs text-gray-500 mr-1">Variables detected:</span>
                {detectedVars.map((v) => (
                  <span key={v} className="badge badge-yellow text-xs">{`{{${v}}}`}</span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Template'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
