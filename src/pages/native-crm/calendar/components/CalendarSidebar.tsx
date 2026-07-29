import { Dispatch, SetStateAction } from 'react';
import { 
  WrenchScrewdriverIcon, 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  ClipboardDocumentListIcon 
} from '@heroicons/react/24/outline';

interface Props {
  filters: Record<string, boolean>;
  setFilters: Dispatch<SetStateAction<Record<string, boolean>>>;
}

const FILTER_CONFIG = [
  { key: 'workorder', label: 'Work Orders', icon: WrenchScrewdriverIcon, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { key: 'invoice', label: 'Invoices', icon: DocumentTextIcon, color: 'text-rose-600', bg: 'bg-rose-100' },
  { key: 'contract', label: 'Contracts', icon: DocumentCheckIcon, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { key: 'quotation', label: 'Quotations', icon: ClipboardDocumentListIcon, color: 'text-amber-600', bg: 'bg-amber-100' },
];

export default function CalendarSidebar({ filters, setFilters }: Props) {
  const toggle = (key: string) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-72 flex-shrink-0 bg-white/60 backdrop-blur-xl border-r border-white/80 h-full flex flex-col p-6 shadow-xl shadow-gray-200/50 z-20">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Modules</h3>
      </div>
      
      <div className="space-y-3 mb-10 flex-1">
        {FILTER_CONFIG.map(({ key, label, icon: Icon, color, bg }) => {
          const active = filters[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl text-sm font-bold transition-all duration-300 border ${
                active ? 'bg-white shadow-md border-white text-gray-900 scale-[1.02]' : 'bg-transparent border-transparent text-gray-500 hover:bg-white/50 hover:border-white/40'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${active ? bg : 'bg-gray-100/50'} ${active ? color : 'text-gray-400'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="flex-1 text-left">{label}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                active ? 'border-brand-500 bg-brand-500' : 'border-gray-200'
              }`}>
                {active && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Staff Directory</h3>
        <div className="text-sm font-medium text-gray-500 text-center p-6 bg-white/40 backdrop-blur rounded-2xl border border-dashed border-gray-300">
          Connect Team Module<br/><span className="text-xs font-normal opacity-80">to unlock staff scheduling</span>
        </div>
      </div>
    </div>
  );
}
