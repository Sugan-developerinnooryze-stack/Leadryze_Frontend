import { XMarkIcon } from '@heroicons/react/24/outline';
import { 
  WrenchScrewdriverIcon, 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  ClipboardDocumentListIcon 
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface Props {
  selectedDate: Date | null;
  onClose: () => void;
}

const MODULES = [
  { 
    id: 'workorder', 
    title: 'Work Order', 
    desc: 'Schedule a new technician visit', 
    icon: WrenchScrewdriverIcon, 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-100',
    dateField: 'scheduledDate' 
  },
  { 
    id: 'invoice', 
    title: 'Invoice', 
    desc: 'Create an invoice due on this date', 
    icon: DocumentTextIcon, 
    color: 'text-rose-600', 
    bg: 'bg-rose-100',
    dateField: 'dueDate'
  },
  { 
    id: 'contract', 
    title: 'Contract', 
    desc: 'Start a new maintenance contract', 
    icon: DocumentCheckIcon, 
    color: 'text-indigo-600', 
    bg: 'bg-indigo-100',
    dateField: 'startDate'
  },
  { 
    id: 'quotation', 
    title: 'Quotation', 
    desc: 'Draft a new quote valid until this date', 
    icon: ClipboardDocumentListIcon, 
    color: 'text-amber-600', 
    bg: 'bg-amber-100',
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
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transform transition-all">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Create Record</h2>
              <p className="text-sm text-gray-500 font-medium">
                For {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
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
                  className="flex flex-col items-center text-center p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all group"
                >
                  <div className={`p-3 rounded-xl mb-3 ${m.bg} ${m.color} group-hover:scale-110 transition-transform duration-300`}>
                    <m.icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{m.title}</h3>
                  <p className="text-xs text-gray-500 leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
