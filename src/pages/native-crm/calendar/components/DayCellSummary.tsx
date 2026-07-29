import { EventContentArg } from '@fullcalendar/core';

export const DayCellSummary = (arg: EventContentArg) => {
  const { event } = arg;
  const isSummary = event.extendedProps?.type === 'summary';

  if (isSummary) {
    const Icon = event.extendedProps?.icon;
    return (
      <div 
        className="flex items-center gap-1.5 px-2 py-1 rounded w-full overflow-hidden whitespace-nowrap text-xs font-semibold shadow-sm border"
        style={{
          backgroundColor: event.backgroundColor,
          color: event.textColor,
          borderColor: event.borderColor,
        }}
      >
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  // Detailed Event View (Week/Day)
  const Icon = event.extendedProps?.icon;
  return (
    <div 
      className="flex items-start gap-1.5 p-1 rounded w-full h-full overflow-hidden text-xs border"
      style={{
        backgroundColor: event.backgroundColor,
        color: event.textColor,
        borderColor: event.borderColor,
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
      <div className="flex flex-col overflow-hidden min-w-0">
        <span className="font-semibold truncate">{event.title}</span>
        {event.extendedProps?.customerName && (
          <span className="truncate opacity-80">{event.extendedProps.customerName}</span>
        )}
      </div>
    </div>
  );
};
