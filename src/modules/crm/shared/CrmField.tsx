import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { FieldConfig } from './types/crm.types';

interface Props {
  field:    FieldConfig;
  value:    string;
  onChange: (v: string) => void;
  error?:   string;
}

/* ── Searchable select dropdown ─────────────────────────────────── */
function SearchableSelect({ field, value, onChange, error }: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = (field.options ?? []).filter((o) =>
    o.replace(/_/g, ' ').toLowerCase().includes(query.toLowerCase())
  );

  const displayVal = value ? value.replace(/_/g, ' ') : '';

  const base =
    'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-left flex items-center justify-between gap-2 ' +
    (error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400');

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={base}>
        <span className={displayVal ? 'text-gray-900' : 'text-gray-400'}>
          {displayVal || `Select ${field.label}`}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
            >
              Select a stage
            </button>
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors capitalize ${
                  value === o
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.replace(/_/g, ' ')}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No options match</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CrmField ────────────────────────────────────────────────────── */
export default function CrmField({ field, value, onChange, error }: Props) {
  const base =
    'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ' +
    (error ? 'border-red-400 bg-red-50' : 'border-gray-300');

  let input: React.ReactNode;

  if (field.type === 'select' && field.options) {
    if (field.searchable) {
      input = <SearchableSelect field={field} value={value} onChange={onChange} error={error} />;
    } else {
      input = (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Select {field.label}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
  } else if (field.type === 'textarea') {
    input = (
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${base} resize-none`}
      />
    );
  } else {
    const typeMap: Record<string, string> = {
      text: 'text', email: 'email', phone: 'tel', number: 'number',
      date: 'date', datetime: 'datetime-local', currency: 'number',
    };
    input = (
      <input
        type={typeMap[field.type] ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={base}
      />
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {input}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
