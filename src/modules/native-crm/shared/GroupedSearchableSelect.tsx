import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export interface GroupedOption { key: string; label: string; }
export interface OptionGroup { label: string; options: GroupedOption[]; }

/** Same button-trigger + filter input + click-outside-close interaction as
 * CrmField.tsx's SearchableSelect, extended with category group headers —
 * for module pickers with 40+ entries (CRM / Field Service / Custom
 * Modules), where a flat <select> or even a flat search list stops being
 * scannable. Options are plain {key,label} rather than SearchableSelect's
 * field-option strings, so this isn't a drop-in replacement for it, just the
 * same proven pattern reused for a different data shape. */
export default function GroupedSearchableSelect({ groups, value, onChange, placeholder = 'Select…', error }: {
  groups: OptionGroup[];
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const q = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.label.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);

  const selectedLabel = groups.flatMap((g) => g.options).find((o) => o.key === value)?.label;

  const base =
    'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ryze-500 transition-colors text-left flex items-center justify-between gap-2 ' +
    (error ? 'border-red-400 bg-red-50' : 'border-border bg-background hover:border-ryze-300 dark:hover:border-ryze-700');

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={base}>
        <span className={`truncate ${selectedLabel ? 'text-text-primary' : 'text-text-muted'}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-surface-elevated border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ryze-500 bg-background text-text-primary"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredGroups.length === 0 ? (
              <p className="px-4 py-3 text-sm text-text-muted text-center">No matches</p>
            ) : (
              filteredGroups.map((g) => (
                <div key={g.label}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-wide">{g.label}</p>
                  {g.options.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { onChange(o.key); setOpen(false); setQuery(''); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        value === o.key
                          ? 'bg-ryze-600/10 text-ryze-700 dark:text-ryze-400 font-medium'
                          : 'text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
