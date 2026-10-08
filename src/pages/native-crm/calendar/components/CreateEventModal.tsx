import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { MODULE_COLORS } from '../calendar-status';

interface Props {
  selectedDate: Date | null;
  onClose: () => void;
}

// Colors pulled from the single shared MODULE_COLORS map (calendar-status.ts)
// instead of being hardcoded a second time here — this is exactly the kind
// of drift (this modal was still on the old indigo/rose palette after the
// rest of the calendar moved to purple/red) that having one shared source
// is meant to prevent.
const MODULES = [
  {
    id: 'workorder',
    title: 'Work Order',
    desc: 'Schedule a new technician visit',
    icon: WrenchScrewdriverIcon,
    color: MODULE_COLORS.workorder.text,
    bg: MODULE_COLORS.workorder.bg,
    dateField: 'scheduledDate'
  },
  {
    id: 'invoice',
    title: 'Invoice',
    desc: 'Create an invoice due on this date',
    icon: DocumentTextIcon,
    color: MODULE_COLORS.invoice.text,
    bg: MODULE_COLORS.invoice.bg,
    dateField: 'dueDate'
  },
  {
    id: 'contract',
    title: 'Contract',
    desc: 'Start a new maintenance contract',
    icon: DocumentCheckIcon,
    color: MODULE_COLORS.contract.text,
    bg: MODULE_COLORS.contract.bg,
    dateField: 'startDate'
  },
  {
    id: 'quotation',
    title: 'Quotation',
    desc: 'Draft a new quote valid until this date',
    icon: ClipboardDocumentListIcon,
    color: MODULE_COLORS.quotation.text,
    bg: MODULE_COLORS.quotation.bg,
    dateField: 'validUntil'
  },
];

export default function CreateEventModal({ selectedDate, onClose }: Props) {
  const navigate = useNavigate();

  if (!selectedDate) return null;

  const handleSelect = (moduleId: string, dateField: string) => {
    // Navigate to the module's list page and trigger the creation drawer via state
    navigate(`/native-crm/${moduleId}s`, {
      state: {
        openDrawer: true,
        prefill: {
          [dateField]: selectedDate.toISOString()
        }
      }
    });
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transform transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">Create Record</h2>
              <p className="text-sm text-text-muted font-medium">
                For {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {MODULES.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id, m.dateField)}
                  className="flex flex-col items-center text-center p-4 rounded-xl border border-border bg-surface hover:bg-background hover:border-border hover:shadow-md transition-all group"
                >
                  <div className={`p-3 rounded-xl mb-3 ${m.bg} ${m.color} group-hover:scale-110 transition-transform duration-300`}>
                    <m.icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-text-primary mb-1">{m.title}</h3>
                  <p className="text-xs text-text-muted leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
