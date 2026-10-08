import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon, ChevronDownIcon, WrenchScrewdriverIcon,
  DocumentTextIcon, DocumentCheckIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useModuleAccess } from '../calendar-access';
import type { CalendarEventTypeKey } from '../calendar.types';

const MODULES: { key: CalendarEventTypeKey; label: string; icon: any }[] = [
  { key: 'workorder', label: 'New Work Order', icon: WrenchScrewdriverIcon },
  { key: 'invoice',   label: 'New Invoice',    icon: DocumentTextIcon },
  { key: 'contract',  label: 'New Contract',   icon: DocumentCheckIcon },
  { key: 'quotation', label: 'New Quotation',  icon: ClipboardDocumentListIcon },
];

/** Top-right "+ Create" dropdown — reuses the exact navigate(...)+state
 * prefill convention CreateEventModal.tsx already uses for the empty-day-
 * click flow, just without a pre-picked date (triggered from the header,
 * not a specific day cell). Each entry opens that module's own real create
 * flow; no duplicate form is built here. */
export default function CreateMenu() {
  const navigate = useNavigate();
  const { canCreate } = useModuleAccess();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const visible = MODULES.filter((m) => canCreate(m.key));
  if (visible.length === 0) return null;

  const handleSelect = (moduleId: string) => {
    navigate(`/native-crm/${moduleId}s`, { state: { openDrawer: true } });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 bg-ryze-600 text-white text-sm font-bold rounded-xl hover:bg-ryze-700 shadow-sm transition-colors"
      >
        <PlusIcon className="h-4 w-4" />
        Create
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-30 py-1">
          {visible.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-text-muted" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
