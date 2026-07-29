import { useState } from 'react';
import { ClockIcon, EnvelopeIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useEmailLogsQuery, EmailLogItem } from '../../modules/native-crm/queries/email-logs.queries';

const STATUS_COLOR: Record<string, string> = {
  sent:    'bg-emerald-100 text-emerald-700',
  failed:  'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
};

const KIND_LABEL: Record<string, string> = {
  on_create_confirmation: 'Confirmation',
  reminder: 'Reminder',
};

const SOURCE_LABEL: Record<string, string> = {
  call: 'Call', meeting: 'Meeting', task: 'Task', ticket: 'Ticket',
};

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function recipientOf(item: EmailLogItem): string {
  return item.recipientEmail || item.recipientPhone || '—';
}

export default function MessageHistoryPage() {
  const [channel, setChannel] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useEmailLogsQuery({
    channel: channel || undefined, kind: kind || undefined, status: status || undefined, page, limit: 25,
  });
  const items = data?.items ?? [];
  const meta  = data?.meta ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <ClockIcon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Message History</h1>
            <p className="text-xs text-gray-500">Every automated email/SMS sent for Calls, Meetings, Tasks, and Tickets</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 shrink-0">
        <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600">
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600">
          <option value="">All types</option>
          <option value="on_create_confirmation">Confirmation</option>
          <option value="reminder">Reminder</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{meta.total} total</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="px-6 py-10 text-sm text-gray-400 text-center">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="px-6 py-10 text-sm text-gray-400 text-center">No messages sent yet.</div>
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-2.5 font-medium">Channel</th>
                <th className="text-left px-3 py-2.5 font-medium">Type</th>
                <th className="text-left px-3 py-2.5 font-medium">For</th>
                <th className="text-left px-3 py-2.5 font-medium">Recipient</th>
                <th className="text-left px-3 py-2.5 font-medium">Subject</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-6 py-2.5 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/60">
                  <td className="px-6 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      {item.channel === 'sms' ? <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" /> : <EnvelopeIcon className="h-3.5 w-3.5" />}
                      {item.channel === 'sms' ? 'SMS' : 'Email'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{KIND_LABEL[item.kind] ?? item.kind}</td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {SOURCE_LABEL[item.sourceModule] ?? item.sourceModule}
                    {item.relatedLabel && <span className="text-gray-400"> · {item.relatedLabel}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 truncate max-w-[180px]">{recipientOf(item)}</td>
                  <td className="px-3 py-2.5 text-gray-600 truncate max-w-[220px]">{item.subject ?? item.bodyPreview ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_COLOR[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.status}
                    </span>
                    {item.status !== 'sent' && item.errorMessage && (
                      <span className="block text-[10px] text-gray-400 mt-0.5 truncate max-w-[160px]">{item.errorMessage}</span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-gray-500 whitespace-nowrap">{fmtDateTime(item.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs text-gray-500 shrink-0">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">← Prev</button>
          <span>Page {meta.page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
