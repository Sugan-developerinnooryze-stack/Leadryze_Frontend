import { useState, useRef, useEffect } from 'react';
import { useFieldCatalogQuery, AutomationModule } from '../../../modules/native-crm/queries/automation-rules.queries';

/** Keep in sync with buildVariables()'s base keys (automation-rule.service.ts). */
const SYSTEM_TOKENS: { key: string; label: string }[] = [
  { key: 'name',    label: 'Recipient name' },
  { key: 'status',  label: 'Trigger status/stage' },
  { key: 'title',   label: 'Record title' },
  { key: 'id',      label: 'Record ID' },
  { key: 'company', label: 'Company' },
  { key: 'today',   label: "Today's date" },
];

interface VariablePickerProps {
  module: AutomationModule | '';
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
}

/** Advanced-Mode variable/token inserter — click-to-insert `{{token}}` at the
 * current cursor position of a target text field, rather than replacing the
 * whole value (unlike AutocompleteInput, which is a single-select filter).
 * `record.<catalogKey>` entries are sourced live from the same
 * getFieldCatalog/useFieldCatalogQuery every other field picker in this app
 * already uses — no separate catalog to maintain. */
export default function VariablePicker({ module, targetRef, value, onChange, className }: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: fieldCatalog = [] } = useFieldCatalogQuery(module);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFilter('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    ...SYSTEM_TOKENS,
    ...fieldCatalog.map((f) => ({ key: `record.${f.key}`, label: f.label })),
  ].filter((o) => {
    const q = filter.toLowerCase();
    return !q || o.key.toLowerCase().includes(q) || o.label.toLowerCase().includes(q);
  });

  function insertToken(key: string) {
    const token = `{{${key}}}`;
    const el = targetRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + token + value.slice(end);
      onChange(next);
      // Restore focus + caret after the inserted token, next tick (after the
      // controlled value has actually re-rendered into the field).
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      onChange(value + token);
    }
    setIsOpen(false);
    setFilter('');
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={className ?? 'text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 border border-brand-200 rounded-md bg-brand-50 hover:bg-brand-100 transition-colors'}
      >
        {'{{ }}'} Insert variable
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)]">
          <input
            type="text"
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter variables…"
            className="w-full px-3 py-2 text-xs border-b border-gray-100 rounded-t-md focus:outline-none"
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">No matching variables</li>
            )}
            {options.map((o) => (
              <li
                key={o.key}
                onMouseDown={(e) => { e.preventDefault(); insertToken(o.key); }}
                className="px-3 py-1.5 text-xs cursor-pointer hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="font-mono text-[11px] text-gray-700">{`{{${o.key}}}`}</span>
                <span className="block text-gray-400">{o.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
