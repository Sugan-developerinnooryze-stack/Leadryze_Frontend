import { XMarkIcon, EyeIcon, PrinterIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { BusinessEvent } from '../calendar.types';

interface Props {
  dateStr: string | null;
  module: string | null;
  events: BusinessEvent[];
  onClose: () => void;
}

export default function SummaryDrawer({ dateStr, module, events, onClose }: Props) {
  const navigate = useNavigate();

  if (!dateStr || !module || events.length === 0) return null;

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

  const MainIcon = events[0].icon;

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
            <div className="p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] shadow-sm" style={{ color: events[0].color }}>
              {MainIcon && <MainIcon className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight capitalize text-text-primary">{module}s</h2>
              <p className="text-sm font-medium flex items-center gap-1.5 text-text-muted">
                <CalendarDaysIcon className="w-4 h-4" /> {displayDate}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors">
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
            return (
              <div key={ev.id} className="bg-surface rounded-xl border-y border-r border-l-4 border-border p-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftColor: ev.color }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3">
                    <div className="mt-1" style={{ color: ev.color }}>
                      {Icon && <Icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary leading-tight">{ev.title}</h3>
                      {ev.customerName && (
                        <p className="text-sm hover:underline cursor-pointer mt-0.5" style={{ color: ev.color }}>
                          {ev.customerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                    style={{ backgroundColor: ev.bgColor, color: ev.textColor, borderColor: ev.color }}
                  >
                    {ev.status}
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
