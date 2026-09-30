import { useState } from 'react';
import { BellAlertIcon, CheckIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, ClockIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import {
  useNotificationSettingsQuery, useNotificationSettingsUpdate, NotificationSettings,
} from '../../../modules/native-crm/queries/notification-settings.queries';

function ToggleRow({
  icon: Icon, label, description, checked, onChange,
}: {
  icon: typeof BellAlertIcon;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-1 ${
          checked ? 'bg-ryze-600' : 'bg-black/[0.06] dark:bg-white/[0.08]'
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-surface shadow transform transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { data: settings, isLoading } = useNotificationSettingsQuery();
  const updateMutation = useNotificationSettingsUpdate();
  const [form, setForm] = useState<Partial<NotificationSettings>>({});
  const [saved, setSaved] = useState(false);

  const merged = { ...settings, ...form } as Partial<NotificationSettings>;
  const set = <K extends keyof NotificationSettings>(key: K) => (value: NotificationSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await updateMutation.mutateAsync(form);
    setForm({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-ryze-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
            <BellAlertIcon className="h-5 w-5 text-text-muted" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">Notification Settings</h1>
            <p className="text-xs text-text-muted">Controls how Call/Meeting/Task/Ticket reminders and confirmations are sent</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || Object.keys(form).length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 disabled:opacity-50 transition-colors"
        >
          {saved ? <><CheckIcon className="h-4 w-4" /> Saved</> : updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Timing</h2>
            <p className="text-xs text-text-muted mb-4">
              How far ahead of a scheduled Call, Meeting, or Task due date the reminder goes out.
            </p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center shrink-0">
                <ClockIcon className="h-4 w-4 text-text-muted" />
              </div>
              <label className="text-sm text-text-primary">Send reminder</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={merged.reminderWindowMinutes ?? 15}
                onChange={(e) => set('reminderWindowMinutes')(Number(e.target.value))}
                className="w-20 px-2.5 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ryze-500 bg-background text-text-primary"
              />
              <span className="text-sm text-text-muted">minutes before it starts</span>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm p-5 divide-y divide-border">
            <h2 className="text-sm font-semibold text-text-primary pb-3">Triggers</h2>
            <ToggleRow
              icon={PaperAirplaneIcon}
              label="On-create confirmation"
              description='Immediately send "you have a new Call/Meeting/Task/Ticket scheduled" when it is created and linked to a Customer/Contact.'
              checked={merged.sendOnCreateConfirmation ?? true}
              onChange={set('sendOnCreateConfirmation')}
            />
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm p-5 divide-y divide-border">
            <h2 className="text-sm font-semibold text-text-primary pb-3">Channels</h2>
            <ToggleRow
              icon={EnvelopeIcon}
              label="Email"
              description="Send via the connected Brevo account."
              checked={merged.emailEnabled ?? true}
              onChange={set('emailEnabled')}
            />
            <ToggleRow
              icon={ChatBubbleLeftRightIcon}
              label="SMS"
              description="Send via the connected Twilio account."
              checked={merged.smsEnabled ?? true}
              onChange={set('smsEnabled')}
            />
            <p className="text-[11px] text-text-muted pt-3">
              WhatsApp isn't available yet — it activates automatically here once Meta WhatsApp Business credentials are configured.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
