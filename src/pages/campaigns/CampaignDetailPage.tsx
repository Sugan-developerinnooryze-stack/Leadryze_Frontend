import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  useCampaignQuery, useCampaignUpdate, useCampaignActivate, usePauseCampaign, useResumeCampaign,
  useCancelCampaign, useDuplicateCampaign, useTestSendCampaign, useCampaignAudiencePreview,
  useCampaignRecipientsQuery, useCustomersForAudienceQuery,
} from '../../modules/campaigns/queries/campaigns.queries';
import TemplatePickerList from '../../components/campaigns/TemplatePickerList';
import { ConfirmDangerousAction } from '../admin/shared/ConfirmDangerousAction';
import { AudiencePreview, CampaignAudience } from '../../modules/campaigns/campaign.types';

const CHANNEL_INFO: Record<string, { label: string; badge: string; note: string }> = {
  email: { label: 'Email', badge: 'badge-green', note: 'Fully supported.' },
  sms: { label: 'SMS', badge: 'badge-blue', note: 'Supported if Twilio is configured for this tenant.' },
  whatsapp: {
    label: 'WhatsApp', badge: 'badge-yellow',
    note: '⚠ Development / limited-window only — reliable delivery requires an approved Meta message template, which is not yet supported. Messages may only reach customers within an active 24-hour conversation window.',
  },
  instagram: { label: 'Instagram', badge: 'badge-gray', note: 'Not yet supported.' },
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', scheduled: 'badge-blue', running: 'badge-green',
  paused: 'badge-yellow', completed: 'badge-blue', failed: 'badge-red', cancelled: 'badge-gray',
};

const CHANNEL_STAT_FIELDS: Record<string, { key: string; label: string }[]> = {
  email: [
    { key: 'sent', label: 'Sent' }, { key: 'delivered', label: 'Delivered' },
    { key: 'opened', label: 'Opened' }, { key: 'clicked', label: 'Clicked' },
    { key: 'replied', label: 'Replied' }, { key: 'failed', label: 'Failed' },
  ],
  sms: [
    { key: 'sent', label: 'Sent' }, { key: 'delivered', label: 'Delivered' }, { key: 'failed', label: 'Failed' },
  ],
  whatsapp: [
    { key: 'sent', label: 'Sent' }, { key: 'delivered', label: 'Delivered' },
    { key: 'opened', label: 'Read' }, { key: 'failed', label: 'Failed' },
  ],
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

const TABS: { id: 'audience' | 'message' | 'schedule' | 'review'; label: string }[] = [
  { id: 'audience', label: 'Audience' },
  { id: 'message', label: 'Message' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'review', label: 'Review' },
];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaignQuery(id ?? '');
  const updateMutation = useCampaignUpdate();
  const activateMutation = useCampaignActivate();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const cancelMutation = useCancelCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const testSendMutation = useTestSendCampaign();
  const previewMutation = useCampaignAudiencePreview();
  const { data: recipientsData } = useCampaignRecipientsQuery(id ?? '', { limit: 50 });

  const [activeTab, setActiveTab] = useState<'audience' | 'message' | 'schedule' | 'review'>('audience');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [testTo, setTestTo] = useState('');

  // Audience local form state
  const [audienceType, setAudienceType] = useState<'all_customers' | 'filtered' | 'manual'>('all_customers');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const { data: customerOptions = [] } = useCustomersForAudienceQuery({ search: manualSearch });

  // Schedule local form state
  const [sendNow, setSendNow] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [timezone, setTimezone] = useState('Asia/Singapore');

  useEffect(() => {
    if (!campaign) return;
    setAudienceType(campaign.audience?.type ?? 'all_customers');
    setFilterStatus((campaign.audience?.filter?.status as string) ?? '');
    setFilterChannel((campaign.audience?.filter?.channel as string) ?? '');
    setManualIds(campaign.audience?.customerIds ?? []);
    setSendNow(!campaign.schedule?.startAt);
    setStartAt(campaign.schedule?.startAt ? campaign.schedule.startAt.slice(0, 16) : '');
    setTimezone(campaign.schedule?.timezone ?? 'Asia/Singapore');
  }, [campaign?._id]);

  if (isLoading || !campaign) {
    return <div className="animate-pulse h-64 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />;
  }

  const isDraft = campaign.status === 'draft';
  const channelInfo = CHANNEL_INFO[campaign.channel] ?? CHANNEL_INFO.email;
  const statFields = CHANNEL_STAT_FIELDS[campaign.channel] ?? CHANNEL_STAT_FIELDS.email;

  function buildAudience(): CampaignAudience {
    const audience: CampaignAudience = { type: audienceType };
    if (audienceType === 'filtered') {
      audience.filter = {
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterChannel ? { channel: filterChannel } : {}),
      };
    } else if (audienceType === 'manual') {
      audience.customerIds = manualIds;
    }
    return audience;
  }

  const saveAudience = () => {
    if (!id) return;
    updateMutation.mutate({ id, data: { audience: buildAudience() } }, {
      onSuccess: () => toast.success('Audience saved'),
      onError: () => toast.error('Could not save audience'),
    });
  };

  const runPreview = () => {
    if (!id) return;
    previewMutation.mutate({ id }, {
      onSuccess: (data) => setPreview(data),
      onError: () => toast.error('Could not preview audience'),
    });
  };

  const selectTemplate = (template: { _id: string }) => {
    if (!id) return;
    updateMutation.mutate({ id, data: { templateId: template._id } }, {
      onSuccess: () => toast.success('Template selected'),
      onError: () => toast.error('Could not save template'),
    });
  };

  const saveSchedule = () => {
    if (!id) return;
    updateMutation.mutate({
      id,
      data: { schedule: sendNow ? { timezone } : { startAt: new Date(startAt).toISOString(), timezone } },
    }, {
      onSuccess: () => toast.success('Schedule saved'),
      onError: () => toast.error('Could not save schedule'),
    });
  };

  const doActivate = () => {
    if (!id) return;
    activateMutation.mutate(id, {
      onSuccess: () => { toast.success('Campaign activated'); setShowActivateConfirm(false); },
      onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Could not activate campaign'),
    });
  };

  const doPause = () => id && pauseMutation.mutate(id, { onSuccess: () => toast.success('Campaign paused'), onError: () => toast.error('Could not pause') });
  const doResume = () => id && resumeMutation.mutate(id, { onSuccess: () => toast.success('Campaign resumed'), onError: () => toast.error('Could not resume') });
  const doCancel = () => id && cancelMutation.mutate(id, { onSuccess: () => toast.success('Campaign cancelled'), onError: () => toast.error('Could not cancel') });
  const doDuplicate = () => id && duplicateMutation.mutate(id, {
    onSuccess: (dup: any) => { toast.success('Campaign duplicated'); navigate(`/campaigns/${dup._id}`); },
    onError: () => toast.error('Could not duplicate'),
  });

  const doTestSend = () => {
    if (!id || !testTo.trim()) return;
    testSendMutation.mutate({ id, to: testTo.trim() }, {
      onSuccess: (r) => (r.sent ? toast.success('Test message sent') : toast.error('Test message could not be sent — check channel configuration')),
      onError: () => toast.error('Test send failed'),
    });
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/campaigns')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeftIcon className="h-4 w-4" /> Campaigns
      </button>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">{campaign.name}</h1>
              <span className={`badge ${STATUS_BADGE[campaign.status] ?? 'badge-gray'} capitalize`}>{campaign.status}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`badge ${channelInfo.badge}`}>{channelInfo.label}</span>
              <span className="badge badge-gray capitalize">{campaign.type}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <button className="btn-primary" onClick={() => setShowActivateConfirm(true)} disabled={activateMutation.isPending}>
                Activate Campaign
              </button>
            )}
            {['running', 'scheduled'].includes(campaign.status) && (
              <>
                <button className="btn-secondary" onClick={doPause} disabled={pauseMutation.isPending}>Pause</button>
                <button className="btn-secondary text-danger-600" onClick={doCancel} disabled={cancelMutation.isPending}>Cancel</button>
              </>
            )}
            {campaign.status === 'paused' && (
              <>
                <button className="btn-primary" onClick={doResume} disabled={resumeMutation.isPending}>Resume</button>
                <button className="btn-secondary text-danger-600" onClick={doCancel} disabled={cancelMutation.isPending}>Cancel</button>
              </>
            )}
            {['completed', 'cancelled', 'failed'].includes(campaign.status) && (
              <button className="btn-secondary" onClick={doDuplicate} disabled={duplicateMutation.isPending}>Duplicate</button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted mt-3">{channelInfo.note}</p>
        {campaign.lastError && <p className="text-xs text-danger-600 mt-2">Last error: {campaign.lastError}</p>}
      </div>

      {!isDraft && (
        <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-xl p-3 text-sm">
          This campaign has been activated and can no longer be edited here. Use Duplicate to make changes in a new draft.
        </div>
      )}

      <div className="flex gap-1 border-b border-border flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.id
                ? 'text-ryze-600 dark:text-ryze-400 border-b-2 border-ryze-600 bg-ryze-600/[0.06]'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'audience' && (
        <Card title="Audience">
          <fieldset disabled={!isDraft} className="space-y-4">
            <div className="flex gap-4">
              {(['all_customers', 'filtered', 'manual'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="audienceType" checked={audienceType === opt} onChange={() => setAudienceType(opt)} />
                  {opt === 'all_customers' ? 'All Customers' : opt === 'filtered' ? 'Filtered' : 'Manual Select'}
                </label>
              ))}
            </div>

            {audienceType === 'filtered' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Any</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="booked">Booked</option>
                  </select>
                </div>
                <div>
                  <label className="label">Channel</label>
                  <select className="input" value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
                    <option value="">Any</option>
                    <option value="web">Web</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>
            )}

            {audienceType === 'manual' && (
              <div>
                <input
                  className="input mb-2" placeholder="Search customers…"
                  value={manualSearch} onChange={(e) => setManualSearch(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {customerOptions.map((c: any) => (
                    <label key={c._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={manualIds.includes(c._id)}
                        onChange={(e) =>
                          setManualIds((prev) => (e.target.checked ? [...prev, c._id] : prev.filter((x) => x !== c._id)))
                        }
                      />
                      <span className="text-text-primary">{c.name}</span>
                      <span className="text-text-muted text-xs">{c.email || c.phone}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1">{manualIds.length} selected</p>
              </div>
            )}

            {isDraft && (
              <div className="flex gap-3">
                <button type="button" className="btn-secondary" onClick={saveAudience} disabled={updateMutation.isPending}>Save Audience</button>
                <button type="button" className="btn-secondary" onClick={runPreview} disabled={previewMutation.isPending}>Preview</button>
              </div>
            )}

            {preview && (
              <div className="text-sm bg-black/[0.02] dark:bg-white/[0.03] rounded-lg p-3">
                <p className="font-semibold text-text-primary">{preview.count} recipients</p>
                <p className="text-text-muted">✓ {preview.withContact} have {campaign.channel === 'email' ? 'email' : 'phone'}</p>
                {preview.missingContact > 0 && <p className="text-yellow-600">⚠ {preview.missingContact} missing {campaign.channel === 'email' ? 'email' : 'phone'}</p>}
              </div>
            )}
          </fieldset>
        </Card>
      )}

      {activeTab === 'message' && (
        <Card title="Message">
          {campaign.channel === 'whatsapp' && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 rounded-lg p-3 text-sm mb-4">
              {CHANNEL_INFO.whatsapp.note}
            </div>
          )}
          {isDraft ? (
            <TemplatePickerList channel={campaign.channel} selectedId={campaign.templateId} onSelect={selectTemplate} />
          ) : (
            <p className="text-sm text-text-muted">Template is locked after activation.</p>
          )}
        </Card>
      )}

      {activeTab === 'schedule' && (
        <Card title="Schedule">
          <fieldset disabled={!isDraft} className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scheduleMode" checked={sendNow} onChange={() => setSendNow(true)} /> Send immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scheduleMode" checked={!sendNow} onChange={() => setSendNow(false)} /> Schedule for later
              </label>
            </div>
            {!sendNow && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date & time</label>
                  <input type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div>
                  <label className="label">Timezone</label>
                  <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>
            )}
            {isDraft && <button type="button" className="btn-secondary" onClick={saveSchedule} disabled={updateMutation.isPending}>Save Schedule</button>}
          </fieldset>
        </Card>
      )}

      {activeTab === 'review' && (
        <div className="space-y-4">
          {isDraft ? (
            <Card title="Review">
              <p className="text-sm text-text-muted mb-4">
                Confirm the audience, message and schedule tabs are set, then activate when ready.
              </p>
              <button className="btn-primary" onClick={() => setShowActivateConfirm(true)} disabled={activateMutation.isPending}>
                Activate Campaign
              </button>
            </Card>
          ) : (
            <>
              <Card title="Stats">
                <div className={`grid grid-cols-${statFields.length} gap-3 text-center`}>
                  {statFields.map((f) => (
                    <div key={f.key}>
                      <p className="text-lg font-bold text-text-primary">{(campaign.stats as any)[f.key] ?? 0}</p>
                      <p className="text-xs text-text-muted">{f.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-3">
                  Total {campaign.stats.total} · Skipped {recipientsData?.items.filter((r) => r.status === 'skipped').length ?? 0}
                </p>
              </Card>

              <Card title="Recipients">
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {(recipientsData?.items ?? []).map((r) => (
                    <div key={r._id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-text-primary">{r.name || r.email || r.phone}</span>
                      <span className="badge badge-gray capitalize">{r.status}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Send Test">
                <div className="flex gap-3">
                  <input className="input flex-1" placeholder={campaign.channel === 'email' ? 'test@example.com' : '+1234567890'} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <button className="btn-secondary" onClick={doTestSend} disabled={testSendMutation.isPending}>Send Test</button>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      <ConfirmDangerousAction
        open={showActivateConfirm}
        title={`Activate "${campaign.name}"?`}
        consequences={[
          `Send via ${channelInfo.label}`,
          `Reach ${preview?.count ?? campaign.stats.total ?? 'the resolved audience of'} recipients`,
          sendNow ? 'Send immediately once confirmed' : `Send at ${startAt || 'the scheduled time'}`,
          ...(campaign.channel === 'whatsapp' ? [channelInfo.note] : []),
        ]}
        confirmWord={campaign.name}
        confirmLabel="Activate Campaign"
        loading={activateMutation.isPending}
        onCancel={() => setShowActivateConfirm(false)}
        onConfirm={doActivate}
      />
    </div>
  );
}
