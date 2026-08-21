import { useState } from 'react';
import {
  ClipboardDocumentListIcon, LifebuoyIcon, PhoneIcon, CalendarDaysIcon, PlusIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { useActivityFeedQuery, ActivityFeedItem, ActivityKind, RelatedModule } from '../queries/activity-feed.queries';
import RecordDrawer from '../../crm/shared/RecordDrawer';
import { config as taskConfig } from '../../crm/tasks/pages/TasksPage';
import { config as ticketConfig } from '../../crm/tickets/pages/TicketsPage';
import { config as callConfig } from '../../crm/calls/pages/CallsPage';
import { config as meetingConfig } from '../../crm/meetings/pages/MeetingsPage';
import type { ModulePageConfig } from '../../crm/shared/types/crm.types';

interface KindMeta { label: string; icon: typeof ClipboardDocumentListIcon; color: string; moduleName?: string; config?: ModulePageConfig; }

// 'email' is a read-only entry sourced from EmailLog (reminder/confirmation
// sends) — it has no moduleName/config since there's nothing to quick-add or
// edit, unlike the other four kinds which are real CRM records.
const KIND_META: Record<ActivityKind, KindMeta> = {
  task:    { label: 'Task',    icon: ClipboardDocumentListIcon, color: '#f97316', moduleName: 'tasks',    config: taskConfig },
  ticket:  { label: 'Ticket',  icon: LifebuoyIcon,               color: '#ef4444', moduleName: 'tickets',  config: ticketConfig },
  call:    { label: 'Call',    icon: PhoneIcon,                  color: '#8b5cf6', moduleName: 'calls',    config: callConfig },
  meeting: { label: 'Meeting', icon: CalendarDaysIcon,           color: '#0ea5e9', moduleName: 'meetings', config: meetingConfig },
  email:   { label: 'Message', icon: EnvelopeIcon,               color: '#10b981' },
};

const QUICK_ADD_KINDS = (Object.keys(KIND_META) as ActivityKind[]).filter((k) => KIND_META[k].config);

function summarize(item: ActivityFeedItem): string {
  if (item.kind === 'task')    return String(item.title ?? 'Untitled task');
  if (item.kind === 'ticket')  return String(item.subject ?? 'Untitled ticket');
  if (item.kind === 'call')    return `Call with ${item.contactName ?? 'unknown'}`;
  if (item.kind === 'email')   return String(item.subject ?? (item.channel === 'sms' ? 'SMS sent' : 'Email sent'));
  return String(item.title ?? 'Untitled meeting');
}

function statusOf(item: ActivityFeedItem): string | undefined {
  if (item.kind === 'email') return item.status as string | undefined;
  return (item.taskStatus ?? item.ticketStatus ?? item.callStatus ?? item.meetingStatus) as string | undefined;
}

function emailLabel(item: ActivityFeedItem): string {
  const channel = item.channel === 'sms' ? 'SMS' : 'Email';
  const sendKind = item.sendKind === 'reminder' ? 'reminder' : 'confirmation';
  return `${channel} · ${sendKind}`;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ActivityFeedPanel({
  relatedModule, relatedId, relatedLabel,
}: {
  // Narrower than FsRelationPicker's own FsRelatedModule (which also allows
  // 'product'/'asset' as something a Ticket/Task/etc. can LINK TO) — this
  // panel renders an activity feed FOR a record's own detail page, and the
  // backend's activity-feed.service.ts genuinely only supports this smaller
  // set (no Product/Asset detail page in this app renders one).
  relatedModule: RelatedModule;
  relatedId:     string;
  relatedLabel:  string;
}) {
  const [page, setPage] = useState(1);
  const [quickAddKind, setQuickAddKind] = useState<ActivityKind | null>(null);
  const { data, isLoading, refetch } = useActivityFeedQuery(relatedModule, relatedId, { page, limit: 10 });
  const items = data?.items ?? [];
  const meta  = data?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Activity</h3>
        <div className="flex gap-1.5">
          {QUICK_ADD_KINDS.map((kind) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <button
                key={kind}
                onClick={() => setQuickAddKind(kind)}
                title={`Log a ${meta.label.toLowerCase()}`}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                <PlusIcon className="h-3 w-3 text-gray-400" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {isLoading && <div className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="px-5 py-6 text-sm text-gray-400 text-center">No activity logged yet.</div>
        )}
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          const status = statusOf(item);
          return (
            <div key={`${item.kind}-${item._id}`} className="flex items-start gap-3 px-5 py-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1a` }}>
                <Icon className="h-4 w-4" style={{ color: meta.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{summarize(item)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.kind === 'email' ? emailLabel(item) : meta.label} · {fmtDate(item.at as string)}
                  {status && <span className="capitalize"> · {status.replace(/_/g, ' ')}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">← Prev</button>
          <span>Page {meta.page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next →</button>
        </div>
      )}

      {quickAddKind && (
        <RecordDrawer
          config={KIND_META[quickAddKind].config!}
          record={null}
          moduleName={KIND_META[quickAddKind].moduleName!}
          onClose={() => setQuickAddKind(null)}
          onSaved={() => { refetch(); setQuickAddKind(null); }}
          prefillRelation={{ relatedModule, relatedId, relatedLabel }}
        />
      )}
    </div>
  );
}
