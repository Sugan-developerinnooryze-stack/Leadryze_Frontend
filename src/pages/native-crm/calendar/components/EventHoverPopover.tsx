import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BusinessEvent } from '../calendar.types';
import { getEventStatusClasses } from '../calendar-status';
import { useStaffNameMap } from '../../../../modules/native-crm/shared/useStaffNameMap';
import { useSitesListQuery } from '../../../../modules/native-crm/queries/sites.queries';
import Avatar from './Avatar';

const CLOSE_DELAY_MS = 180;

/** Hover-intent controller shared by every event chip on the calendar grid —
 * one popover instance, repositioned/retargeted on hover instead of one
 * popover per event. Deliberately NOT headlessui Popover's click/focus-
 * driven open state: that flickers the instant the pointer crosses the gap
 * between the event chip and the panel. Opens immediately on entering a
 * chip; closes only after the pointer has left BOTH the chip and the panel,
 * with a short delay so moving from one to the other never flickers. */
export function useEventHoverIntent() {
  const [event, setEvent] = useState<BusinessEvent | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  const open = (ev: BusinessEvent, el: HTMLElement) => {
    cancelClose();
    setAnchor(el.getBoundingClientRect());
    setEvent(ev);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => { setEvent(null); setAnchor(null); }, CLOSE_DELAY_MS);
  };

  useEffect(() => () => cancelClose(), []);

  return { event, anchor, open, scheduleClose, cancelClose };
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text-primary text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

export default function EventHoverPopover({
  event, anchor, onCancelClose, onScheduleClose, onOpen, onReassign,
}: {
  event: BusinessEvent;
  anchor: DOMRect;
  onCancelClose: () => void;
  onScheduleClose: () => void;
  onOpen: () => void;
  onReassign?: () => void;
}) {
  const staffNames = useStaffNameMap();
  const { data: sitesData } = useSitesListQuery({ page: 1, limit: 500 });
  const siteName = useMemo(() => {
    const site = sitesData?.items?.find((s: any) => s.siteId === event.siteId);
    return site?.name;
  }, [sitesData, event.siteId]);

  const staffId = event.staffIds?.[0];
  const staffName = staffId ? (staffNames.get(staffId) ?? staffId) : undefined;
  const classes = getEventStatusClasses(event.status);

  // Clamp inside the viewport — flip above the anchor if there isn't room
  // below, clamp horizontally so it never runs off either edge.
  const WIDTH = 288;
  const MARGIN = 8;
  const left = Math.min(Math.max(anchor.left, MARGIN), window.innerWidth - WIDTH - MARGIN);
  const spaceBelow = window.innerHeight - anchor.bottom;
  const openUpward = spaceBelow < 260 && anchor.top > 260;
  const top = openUpward ? undefined : anchor.bottom + 6;
  const bottom = openUpward ? window.innerHeight - anchor.top + 6 : undefined;

  const startStr = event.start ? new Date(event.start).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined;
  const endStr = event.end ? new Date(event.end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : undefined;

  return createPortal(
    <div
      onMouseEnter={onCancelClose}
      onMouseLeave={onScheduleClose}
      style={{ position: 'fixed', left, top, bottom, width: WIDTH, zIndex: 60 }}
      className="bg-surface border border-border rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 p-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        {event.icon && <event.icon className="h-4 w-4 text-text-muted shrink-0" />}
        <span className="text-sm font-semibold text-text-primary truncate">{event.title}</span>
      </div>
      <div className="divide-y divide-border/60">
        <InfoRow label="Status" value={
          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${classes.bg} ${classes.text}`}>
            {event.status.replace(/_/g, ' ')}
          </span>
        } />
        <InfoRow label="Customer" value={event.customerName} />
        <InfoRow label="Site" value={siteName ?? event.siteId} />
        <InfoRow label="Assigned to" value={staffName ? <span className="inline-flex items-center gap-1.5"><Avatar name={staffName} size="xs" />{staffName}</span> : 'Unassigned'} />
        <InfoRow label="Scheduled" value={endStr ? `${startStr} – ${endStr}` : startStr} />
        <InfoRow label="Priority" value={event.priority ? <span className="capitalize">{event.priority}</span> : undefined} />
      </div>
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={onOpen}
          className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 transition-colors"
        >
          Open
        </button>
        {onReassign && (
          <button
            onClick={onReassign}
            className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Reassign
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
