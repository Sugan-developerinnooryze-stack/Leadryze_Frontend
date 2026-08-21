import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PencilSquareIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useTicketQuery, useTicketAssign, useTicketAddNote, useTicketTimelineQuery } from '../../../modules/native-crm/queries/tickets.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useCategoriesListQuery } from '../../../modules/native-crm/queries/categories.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { usePermission } from '../../../hooks/usePermission';
import TicketAttachmentsPanel from '../../../modules/native-crm/shared/TicketAttachmentsPanel';
import { renderFieldValue } from '../../../modules/native-crm/shared/fieldValueRenderer';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-green-50 text-green-700', medium: 'bg-amber-50 text-amber-700',
  high: 'bg-red-50 text-red-700', critical: 'bg-red-100 text-red-800',
};

// A real record type per relatedModule — each has its own list-query hook
// and its own way to resolve a human-friendly link; kept intentionally
// simple (fetch a small page, find by id client-side) rather than adding a
// generic "resolve one record by module+id" backend endpoint for what's
// really just a detail-page convenience.
const RELATED_MODULE_PATHS: Record<string, string> = {
  contact: '/native-crm/contacts', company: '/native-crm/companies', quotation: '/native-crm/quotations',
  workorder: '/native-crm/workorders', contract: '/native-crm/contracts', product: '/native-crm/products',
  asset: '/native-crm/assets', customer: '/native-crm/customers', deal: '/native-crm/deals',
};

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}

/** Resolution's `statusOverride` comes straight from the backend's
 * deriveSlaStatus() (ticket-sla-policy.service.ts) — the same value the
 * list table's badge and the slaStatus filter use, so this card can't
 * silently disagree with either. First Response has no backend-computed
 * equivalent (deriveSlaStatus() is resolution-specific), so it derives the
 * same three-tier rule client-side from its own due/warning pair instead —
 * same thresholds, just not routed through the shared helper. */
function SlaCountdown({
  label, dueAt, doneAt, warningAt, statusOverride,
}: { label: string; dueAt?: string; doneAt?: string; warningAt?: string; statusOverride?: string }) {
  if (doneAt) {
    return <InfoRow label={label} value={<span className="text-green-600">Met — {new Date(doneAt).toLocaleString()}</span>} />;
  }
  if (!dueAt) return <InfoRow label={label} value="—" />;
  const now = Date.now();
  const dueMs = new Date(dueAt).getTime();
  const overdue = now >= dueMs;
  const status = statusOverride ?? (overdue ? 'breached' : warningAt && now >= new Date(warningAt).getTime() ? 'warning' : 'on_track');
  const diffMs = dueMs - now;
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const text = `${hours}h ${mins}m`;
  const colorClass = status === 'breached' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-gray-800';
  return (
    <InfoRow
      label={label}
      value={
        <span className={colorClass}>
          {overdue ? `Overdue by ${text}` : `Due in ${text}`}
        </span>
      }
    />
  );
}

export default function TicketViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading } = useTicketQuery(id ?? '');
  const { data: timeline = [] } = useTicketTimelineQuery(id ?? '');
  const { data: staffList } = useStaffsListQuery({ page: 1, limit: 1000 });
  const { data: teamList } = useTeamsListQuery({ page: 1, limit: 1000 });
  const { data: categoryList } = useCategoriesListQuery({ page: 1, limit: 1000 });
  const { stages } = usePipelineStages('ticket');
  const canAssign = usePermission('native_crm.tickets.assign');
  const canManageSla = usePermission('native_crm.tickets.manage_sla');
  const assign = useTicketAssign();
  const addNote = useTicketAddNote();

  const [reassigning, setReassigning] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Ticket not found.</div>;

  const staff = staffList?.items?.find((s: any) => s.staffId === item.staffId);
  const team = teamList?.items?.find((t: any) => t._id === item.teamId);
  const category = categoryList?.items?.find((c: any) => c._id === item.categoryId);
  const stage = stages.find((s) => s.key === item.ticketStatus);
  const relatedPath = item.relatedModule ? RELATED_MODULE_PATHS[item.relatedModule] : undefined;
  const customFields = Object.entries(item.customFields ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <button onClick={() => navigate('/native-crm/tickets')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-2">
          <ArrowLeftIcon className="h-4 w-4" /> Tickets
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-800">{item.ticketNumber ?? item._id}</span>
          <span className="text-sm text-gray-600 truncate">{item.subject}</span>
          {stage && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
              {stage.label}
            </span>
          )}
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-100 text-gray-500'}`}>
            {item.priority ?? 'medium'}
          </span>
        </div>
        <button onClick={() => navigate('/native-crm/tickets', { state: { openDrawer: true, prefill: item } })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">
          <PencilSquareIcon className="h-4 w-4" />Edit
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card
            title="SLA"
            action={canManageSla && (
              <button onClick={() => navigate('/native-crm/settings/ticket-sla')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Manage SLA Policy
              </button>
            )}
          >
            <SlaCountdown label="First Response" dueAt={item.firstResponseDueAt} doneAt={item.firstRespondedAt} warningAt={item.firstResponseWarningAt} />
            <SlaCountdown label="Resolution" dueAt={item.resolutionDueAt} doneAt={item.resolvedAt} warningAt={item.resolutionWarningAt} statusOverride={item.slaStatus} />
          </Card>

          <Card
            title="Assignment"
            action={canAssign && (
              <button onClick={() => setReassigning((v) => !v)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                {reassigning ? 'Cancel' : 'Reassign'}
              </button>
            )}
          >
            {reassigning ? (
              <div className="space-y-2">
                <select
                  defaultValue={item.staffId ?? ''}
                  onChange={(e) => assign.mutate({ id: item._id, staffId: e.target.value || undefined, teamId: item.teamId })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Unassigned staff</option>
                  {(staffList?.items ?? []).map((s: any) => (
                    <option key={s.staffId} value={s.staffId}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</option>
                  ))}
                </select>
                <select
                  defaultValue={item.teamId ?? ''}
                  onChange={(e) => assign.mutate({ id: item._id, staffId: item.staffId, teamId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">No team</option>
                  {(teamList?.items ?? []).map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <InfoRow label="Staff" value={staff ? `${staff.firstName} ${staff.lastName ?? ''}`.trim() : item.staffId ? item.staffId : 'Unassigned'} />
                <InfoRow label="Team" value={team?.name ?? (item.teamId ? item.teamId : '—')} />
                <InfoRow label="Category" value={category?.name ?? '—'} />
                <InfoRow label="Source" value={item.source ?? 'manual'} />
              </>
            )}
          </Card>
        </div>

        {item.relatedId && (
          <Card title="Linked Record">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-500 shrink-0" />
              {relatedPath ? (
                <button onClick={() => navigate(`${relatedPath}/${item.relatedId}`)} className="text-sm text-blue-700 hover:underline">
                  {item.relatedLabel ?? item.relatedId}
                </button>
              ) : (
                <span className="text-sm text-gray-700">{item.relatedLabel ?? item.relatedId}</span>
              )}
              <span className="text-xs text-gray-400 capitalize">({item.relatedModule})</span>
            </div>
          </Card>
        )}

        {item.description && (
          <Card title="Description">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
          </Card>
        )}

        <Card title="Attachments">
          <TicketAttachmentsPanel ticketId={item._id} />
        </Card>

        <Card title="Internal Notes">
          <div className="space-y-3">
            {(item.internalNotes ?? []).length === 0 && <p className="text-sm text-gray-400">No internal notes yet.</p>}
            {(item.internalNotes ?? []).map((n: any, i: number) => (
              <div key={n._id ?? i} className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.text}</p>
                <p className="text-[11px] text-gray-400 mt-1">{n.authorName ?? 'Staff'} — {new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an internal note (staff-only)…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={() => { if (noteText.trim()) { addNote.mutate({ id: item._id, text: noteText.trim() }); setNoteText(''); } }}
                disabled={!noteText.trim() || addNote.isPending}
                className="px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        </Card>

        <Card title="Timeline">
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.map((e: any) => (
                <li key={e._id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-32 shrink-0 pt-0.5">{new Date(e.createdAt).toLocaleString()}</span>
                  <span className="text-gray-700">
                    {e.eventType === 'created' && 'Ticket created'}
                    {e.eventType !== 'created' && e.field && (
                      <>{e.field} changed {e.fromValue ? `from "${e.fromValue}" ` : ''}to "{e.toValue}"</>
                    )}
                    {e.eventType === 'note_added' && !e.field && 'Internal note added'}
                    {e.eventType === 'attachment_added' && !e.field && `Attachment added: ${e.toValue}`}
                    {e.eventType === 'attachment_removed' && !e.field && `Attachment removed: ${e.fromValue}`}
                    {e.actorName && <span className="text-gray-400"> — {e.actorName}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {customFields.length > 0 && (
          <Card title="Custom Fields">
            {customFields.map(([k, v]) => <InfoRow key={k} label={k} value={renderFieldValue(v)} />)}
          </Card>
        )}
      </div>
    </div>
  );
}
