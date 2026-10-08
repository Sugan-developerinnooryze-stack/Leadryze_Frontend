import { XMarkIcon, EyeIcon, PrinterIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { BusinessEvent } from '../calendar.types';
import { getEventStatusClasses, MODULE_COLORS } from '../calendar-status';

interface Props {
  dateStr: string | null;
  /** Shown when every event in the list shares one module (opened from a
   * single-module context); omitted/mixed → generic "Day Events" header,
   * used by the "+N more" overflow click which can mix modules. */
  module?: string | null;
  events: BusinessEvent[];
  onClose: () => void;
}

export default function SummaryDrawer({ dateStr, module, events, onClose }: Props) {
  const navigate = useNavigate();

  if (!dateStr || events.length === 0) return null;

  // Format date nicely
  const displayDate = new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const handleOpen = (ev: BusinessEvent) => {
    navigate(`/native-crm/${ev.module}s/${ev.moduleId}`);
  };

  const handlePrint = (ev: BusinessEvent) => {
    navigate(`/native-crm/${ev.module}s/${ev.moduleId}/print`);
  };

  const allSameModule = events.every((e) => e.module === events[0].module);
  const headerTitle = module ? `${module}s` : allSameModule ? `${events[0].module}s` : 'Day Events';
  const MainIcon = events[0].icon;
  // Module identity color (not status) for the header icon chip — when the
  // list mixes modules (a day's full "+N more" list), the header just shows
  // the first event's module color as the chip accent, same as its icon.
  const headerClasses = MODULE_COLORS[events[0].module as keyof typeof MODULE_COLORS];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 w-[450px] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 bg-surface"
      >

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shadow-sm bg-surface">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl shadow-sm ${headerClasses.bg} ${headerClasses.text}`}>
              {MainIcon && <MainIcon className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight capitalize text-text-primary">{headerTitle}</h2>
              <p className="text-sm font-medium flex items-center gap-1.5 text-text-muted">
                <CalendarDaysIcon className="w-4 h-4" /> {displayDate}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* List of Events */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider mb-2 px-1 text-text-muted">
            {events.length} Records Found
          </div>

          {events.map(ev => {
            const Icon = ev.icon;
            // Module identity drives the card's own color (border/icon/code/
            // link); status drives only the small badge pill on the right.
            const moduleClasses = MODULE_COLORS[ev.module as keyof typeof MODULE_COLORS];
            const statusClasses = getEventStatusClasses(ev.status);
            return (
              <div key={ev.id} className={`bg-surface rounded-xl border-y border-r border-l-4 p-4 shadow-sm hover:shadow-md transition-shadow border-border ${moduleClasses.borderL4}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className={`mt-1 ${moduleClasses.text}`}>
                      {Icon && <Icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary leading-tight">
                        {ev.recordCode && <span className={moduleClasses.text}>{ev.recordCode} — </span>}
                        {ev.title}
                      </h3>
                      {ev.customerName && (
                        <p className={`text-sm hover:underline cursor-pointer mt-0.5 ${moduleClasses.text}`}>
                          {ev.customerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClasses.bg} ${statusClasses.text}`}
                  >
                    {ev.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => handleOpen(ev)}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all"
                  >
                    <EyeIcon className="w-4 h-4" /> View / Edit
                  </button>
                  <button
                    onClick={() => handlePrint(ev)}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-surface border border-border text-xs font-semibold rounded-lg text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all"
                  >
                    <PrinterIcon className="w-4 h-4" /> Print
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
