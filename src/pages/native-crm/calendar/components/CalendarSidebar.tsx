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
  { key: 'workorder', label: 'Work Orders', icon: WrenchScrewdriverIcon, color: 'text-success-700 dark:text-success-500', bg: 'bg-success-500/15' },
  { key: 'invoice', label: 'Invoices', icon: DocumentTextIcon, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/15' },
  { key: 'contract', label: 'Contracts', icon: DocumentCheckIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/15' },
  { key: 'quotation', label: 'Quotations', icon: ClipboardDocumentListIcon, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15' },
];

export default function CalendarSidebar({ filters, setFilters }: Props) {
  const toggle = (key: string) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-72 flex-shrink-0 bg-surface/60 backdrop-blur-xl border-r border-border h-full flex flex-col p-6 shadow-xl shadow-black/5 dark:shadow-black/20 z-20">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Modules</h3>
      </div>
      
      <div className="space-y-3 mb-10 flex-1">
        {FILTER_CONFIG.map(({ key, label, icon: Icon, color, bg }) => {
          const active = filters[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl text-sm font-bold transition-all duration-300 border ${
                active ? 'bg-surface shadow-md border-border text-text-primary scale-[1.02]' : 'bg-transparent border-transparent text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:border-border'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${active ? bg : 'bg-black/[0.04] dark:bg-white/[0.06]'} ${active ? color : 'text-text-muted'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="flex-1 text-left">{label}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                active ? 'border-ryze-500 bg-ryze-600' : 'border-border'
              }`}>
                {active && <div className="w-2 h-2 bg-surface rounded-full" />}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-4">Staff Directory</h3>
        <div className="text-sm font-medium text-text-muted text-center p-6 bg-black/[0.02] dark:bg-white/[0.03] backdrop-blur rounded-2xl border border-dashed border-border">
          Connect Team Module<br/><span className="text-xs font-normal opacity-80">to unlock staff scheduling</span>
        </div>
      </div>
    </div>
  );
}
