import { useMemo, useState } from 'react';
import { BusinessEvent } from '../calendar.types';
import { getEventStatusClasses, MODULE_COLORS } from '../calendar-status';
import { XMarkIcon, EyeIcon, PrinterIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStaffNameMap } from '../../../../modules/native-crm/shared/useStaffNameMap';
import { useStaffsListQuery } from '../../../../modules/native-crm/queries/staffs.queries';
import { useSitesListQuery } from '../../../../modules/native-crm/queries/sites.queries';
import { useTeamsListQuery } from '../../../../modules/native-crm/queries/teams.queries';
import { useWorkorderUpdate } from '../../../../modules/native-crm/queries/workorders.queries';
import Avatar from './Avatar';

interface Props {
  event: BusinessEvent | null;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-text-muted">{label}</p>
      <p className="text-sm font-bold text-text-primary">{value}</p>
    </div>
  );
}

/** Reassign — reuses the EXISTING Work Order update path (PUT /workorders/:id
 * via useWorkorderUpdate) with just {staffId} in the body. Verified directly
 * against updateWorkorder()/normalizeStaffAssignment(): a partial body with
 * only staffId is safe — staffIds is derived from it automatically, the same
 * semantics a normal full Work Order edit already goes through (timeline
 * logging, automation hooks). No new endpoint, no Calendar-specific payload. */
function ReassignPanel({ event, onDone }: { event: BusinessEvent; onDone: () => void }) {
  const { data: staffsData } = useStaffsListQuery({ page: 1, limit: 500, status: 'active' });
  const updateMut = useWorkorderUpdate();
  const [staffId, setStaffId] = useState(event.staffIds?.[0] ?? '');
  const staffs = staffsData?.items ?? [];

  const handleAssign = async () => {
    try {
      await updateMut.mutateAsync({ id: event.moduleId, data: { staffId: staffId || null } });
      toast.success(staffId ? 'Work order reassigned' : 'Work order unassigned');
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reassign');
    }
  };

  return (
    <div className="bg-black/[0.02] dark:bg-white/[0.03] p-4 rounded-xl border border-border space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Reassign to</p>
      <select
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
      >
        <option value="">Unassigned</option>
        {staffs.map((s: any) => <option key={s._id} value={s.staffId}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</option>)}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAssign}
          disabled={updateMut.isPending}
          className="flex-1 py-2 text-xs font-bold rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 disabled:opacity-60 transition-colors"
        >
          {updateMut.isPending ? 'Saving…' : 'Assign'}
        </button>
        <button onClick={onDone} className="flex-1 py-2 text-xs font-bold rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function CalendarDrawer({ event, onClose }: Props) {
  const navigate = useNavigate();
  const [reassigning, setReassigning] = useState(false);
  const staffNames = useStaffNameMap();
  const { data: sitesData } = useSitesListQuery({ page: 1, limit: 500 });
  const { data: teamsData } = useTeamsListQuery({ page: 1, limit: 200 });

  const siteName = useMemo(() => sitesData?.items?.find((s: any) => s.siteId === event?.siteId)?.name, [sitesData, event?.siteId]);
  const teamName = useMemo(() => teamsData?.items?.find((t: any) => t.teamId === event?.teamId)?.name, [teamsData, event?.teamId]);

  if (!event) return null;

  const Icon = event.icon;
  const classes = getEventStatusClasses(event.status); // drives the Status badge pill only
  const moduleClasses = MODULE_COLORS[event.module as keyof typeof MODULE_COLORS]; // drives the header icon chip — module identity, not status
  const staffId = event.staffIds?.[0];
  const staffName = staffId ? (staffNames.get(staffId) ?? staffId) : undefined;

  const handleOpen = () => navigate(`/native-crm/${event.module}s/${event.moduleId}`);
  const handlePrint = () => navigate(`/native-crm/${event.module}s/${event.moduleId}/print`);
  const close = () => { setReassigning(false); onClose(); };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" onClick={close} />

      <div className="fixed inset-y-0 right-0 w-[400px] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border shadow-sm bg-surface">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg shadow-sm ${moduleClasses?.bg ?? classes.bg} ${moduleClasses?.text ?? classes.text}`}>
              {Icon && <Icon className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{event.title}</h2>
              <p className="text-xs uppercase tracking-wider text-text-muted">{event.module}</p>
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="p-2 rounded-full text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${classes.bg} ${classes.text}`}>
              {event.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="bg-black/[0.02] dark:bg-white/[0.03] p-4 rounded-xl space-y-4 border border-border shadow-sm">
            <InfoRow
              label="Date & Time"
              value={new Date(event.start).toLocaleString([], { dateStyle: 'medium', timeStyle: event.allDay ? undefined : 'short' })}
            />
            <InfoRow
              label="Customer"
              value={event.customerName && <span className="hover:underline cursor-pointer">{event.customerName}</span>}
            />
            <InfoRow label="Site" value={siteName ?? event.siteId} />
            <InfoRow
              label="Assigned to"
              value={staffName ? <span className="inline-flex items-center gap-2"><Avatar name={staffName} size="sm" />{staffName}</span> : (event.module === 'workorder' ? 'Unassigned' : undefined)}
            />
            <InfoRow label="Team" value={teamName ?? event.teamId} />
            <InfoRow label="Priority" value={event.priority && <span className="capitalize">{event.priority}</span>} />
          </div>

          {event.module === 'workorder' && reassigning && (
            <ReassignPanel event={event} onDone={() => setReassigning(false)} />
          )}

          <div>
            <h3 className="text-xs font-bold mb-3 uppercase tracking-wider text-text-muted">Quick Actions</h3>
            <div className="flex gap-3">
              <button
                onClick={handleOpen}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 transition-all shadow-sm"
              >
                <EyeIcon className="w-4 h-4" /> Open
              </button>
              {event.module === 'workorder' && !reassigning && (
                <button
                  onClick={() => setReassigning(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-surface border border-border text-sm font-medium rounded-lg text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all shadow-sm"
                >
                  <UserPlusIcon className="w-4 h-4" /> Reassign
                </button>
              )}
              {event.module !== 'workorder' && (
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-surface border border-border text-sm font-medium rounded-lg text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all shadow-sm"
                >
                  <PrinterIcon className="w-4 h-4" /> Print
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
