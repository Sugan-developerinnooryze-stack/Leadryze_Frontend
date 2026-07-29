import { BusinessEvent } from '../calendar.types';
import { XMarkIcon, EyeIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface Props {
  event: BusinessEvent | null;
  onClose: () => void;
}

export default function CalendarDrawer({ event, onClose }: Props) {
  const navigate = useNavigate();

  if (!event) return null;

  const Icon = event.icon;

  const handleOpen = () => {
    navigate(`/native-crm/${event.module}s/${event.moduleId}`);
  };

  const handlePrint = () => {
    navigate(`/native-crm/${event.module}s/${event.moduleId}/print`);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed inset-y-0 right-0 w-[400px] shadow-2xl z-50 flex flex-col transform transition-transform duration-300"
        style={{ backgroundColor: event.bgColor }}
      >
        <div 
          className="flex items-center justify-between p-4 border-b shadow-sm"
          style={{ backgroundColor: event.bgColor, borderColor: event.color }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white shadow-sm" style={{ color: event.color }}>
              {Icon && <Icon className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: event.textColor }}>{event.title}</h2>
              <p className="text-xs uppercase tracking-wider opacity-80" style={{ color: event.textColor }}>{event.module}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: event.textColor }}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Status Badge */}
          <div>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm border"
              style={{ backgroundColor: event.bgColor, color: event.textColor, borderColor: event.color }}>
              {event.status}
            </span>
          </div>

          {/* Core Info */}
          <div className="bg-white/60 p-4 rounded-xl space-y-4 border border-white/40 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: event.textColor, opacity: 0.7 }}>Date & Time</p>
              <p className="text-sm font-bold" style={{ color: event.textColor }}>
                {new Date(event.start).toLocaleString([], { dateStyle: 'medium', timeStyle: event.allDay ? undefined : 'short' })}
              </p>
            </div>
            
            {event.customerName && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: event.textColor, opacity: 0.7 }}>Customer</p>
                <p className="text-sm font-bold hover:underline cursor-pointer" style={{ color: event.textColor }}>
                  {event.customerName}
                </p>
              </div>
            )}

            {event.teamId && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: event.textColor, opacity: 0.7 }}>Assigned Team</p>
                <p className="text-sm font-bold" style={{ color: event.textColor }}>{event.teamId}</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: event.textColor }}>Quick Actions</h3>
            <div className="flex gap-3">
              <button 
                onClick={handleOpen} 
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg hover:brightness-95 transition-all shadow-sm"
                style={{ backgroundColor: event.color, color: '#fff' }}
              >
                <EyeIcon className="w-4 h-4" /> Open
              </button>
              <button 
                onClick={handlePrint} 
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border text-sm font-medium rounded-lg hover:bg-gray-50 transition-all shadow-sm"
                style={{ borderColor: event.color, color: event.textColor }}
              >
                <PrinterIcon className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
