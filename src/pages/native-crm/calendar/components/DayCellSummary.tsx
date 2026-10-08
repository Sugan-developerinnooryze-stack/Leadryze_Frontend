import { EventContentArg } from '@fullcalendar/core';
import { ExclamationCircleIcon, UserIcon } from '@heroicons/react/24/solid';
import Avatar from './Avatar';

/** Every event — Month/Week/Day/Agenda alike — renders as a real business
 * record card (icon + record code, title, time, staff), never a grouped
 * "Work Orders (1)" count chip. bgColor/textColor are Tailwind token
 * classes already resolved by calendar-event.mapper.ts via
 * getEventStatusClasses(), carried through on extendedProps (the full
 * BusinessEvent is spread there by useCalendarData.ts's detailedEvents). */
export const DayCellSummary = (arg: EventContentArg) => {
  const { event } = arg;
  const props = event.extendedProps ?? {};
  const Icon = props.icon;
  const bgClass = props.bgColor ?? '';
  const textClass = props.textColor ?? '';
  const isWorkOrder = props.module === 'workorder';
  const staffId: string | undefined = props.staffIds?.[0];
  const staffName: string | undefined = props.staffName;
  const isUnassigned = isWorkOrder && !staffId;
  const isOverdue = props.status === 'overdue';
  const timeLabel = props.allDay
    ? null
    : event.start?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className={`group flex flex-col gap-0.5 w-full h-full overflow-hidden rounded-lg px-1.5 py-1 text-[11px] leading-tight border ${
        isUnassigned ? 'border-dashed border-current/40' : 'border-transparent'
      } ${bgClass} ${textClass}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        {Icon && <Icon className="w-3 h-3 shrink-0" />}
        <span className="font-bold truncate">{props.recordCode || event.title}</span>
        {isOverdue && <ExclamationCircleIcon className="w-3 h-3 shrink-0 ml-auto" />}
      </div>
      <span className="truncate font-medium opacity-90">{event.title}</span>
      <div className="flex items-center justify-between gap-1 mt-auto">
        <span className="truncate opacity-75">{timeLabel ?? 'All day'}</span>
        {isWorkOrder && (
          staffId
            ? <Avatar name={staffName ?? staffId} size="xs" title={staffName ?? staffId} />
            : <UserIcon className="w-3 h-3 shrink-0 opacity-60" />
        )}
      </div>
    </div>
  );
};
