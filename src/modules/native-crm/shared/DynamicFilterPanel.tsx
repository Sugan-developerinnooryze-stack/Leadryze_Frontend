import { useEffect, useRef, useState } from 'react';
import { FunnelIcon, PlusIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

/** Mirrors backend/src/modules/native-crm/shared/dynamic-filter.ts exactly —
 * the catalog and condition shapes travel as-is between client and server. */
export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'multi';

export interface FilterFieldDef {
  key:      string;
  label:    string;
  type:     FilterFieldType;
  /** value = what's actually filtered on (a Team's real teamId, a plain
   * enum like 'high'); label = what the picker shows — for lookup-backed
   * fields (Team/Site/Staff) these differ, so both travel together. */
  options?: { value: string; label: string }[];
  source:   'fixed' | 'custom';
}

export interface FilterCondition {
  id:        string; // client-only, stripped before sending to the server
  field:     string;
  operator:  string;
  value?:    any;
  value2?:   any;
}

const OPERATORS: Record<FilterFieldType, { key: string; label: string }[]> = {
  text:    [{ key: 'contains', label: 'contains' }, { key: 'equals', label: 'is exactly' }, { key: 'is_empty', label: 'is empty' }, { key: 'is_not_empty', label: 'is not empty' }],
  number:  [{ key: 'eq', label: '=' }, { key: 'gt', label: '>' }, { key: 'gte', label: '≥' }, { key: 'lt', label: '<' }, { key: 'lte', label: '≤' }, { key: 'between', label: 'between' }],
  date:    [{ key: 'before', label: 'before' }, { key: 'after', label: 'after' }, { key: 'between', label: 'between' }],
  select:  [{ key: 'eq', label: 'is' }, { key: 'in', label: 'is any of' }],
  boolean: [{ key: 'eq', label: 'is' }],
  multi:   [{ key: 'contains_any', label: 'includes any of' }],
};

function newConditionId(): string {
  return Math.random().toString(36).slice(2);
}

/** Serializes conditions for the `?filters=` query param — strips the
 * client-only `id`, and drops rows that don't yet have a usable value (a
 * half-filled row shouldn't silently narrow the query to nothing). */
export function serializeConditions(conditions: FilterCondition[], catalog: FilterFieldDef[]): string | undefined {
  const byKey = new Map(catalog.map((d) => [d.key, d]));
  const valid = conditions.filter((c) => {
    const def = byKey.get(c.field);
    if (!def) return false;
    if (def.type === 'boolean') return true;
    if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return true;
    if (c.operator === 'between') return c.value !== undefined && c.value !== '' && c.value2 !== undefined && c.value2 !== '';
    if (Array.isArray(c.value)) return c.value.length > 0;
    return c.value !== undefined && c.value !== '';
  });
  if (!valid.length) return undefined;
  return JSON.stringify(valid.map(({ id, ...rest }) => rest));
}

interface DynamicFilterPanelProps {
  catalog: FilterFieldDef[];
  value:   FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}

/** "Any field, any condition" filter — backed entirely by the server-side
 * catalog (fixed fields + this tenant's active custom fields for the
 * module), so a custom field a Tenant Admin adds later shows up here on the
 * next open with zero frontend changes. Every Apply re-queries the list
 * API; nothing here filters an already-fetched page client-side. */
export default function DynamicFilterPanel({ catalog, value, onChange }: DynamicFilterPanelProps) {
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState<FilterCondition[]>(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setDraft(value); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const byKey       = new Map(catalog.map((d) => [d.key, d]));
  const fixedFields  = catalog.filter((f) => f.source === 'fixed');
  const customFields = catalog.filter((f) => f.source === 'custom');

  const addCondition = () => {
    const first = catalog[0];
    if (!first) return;
    setDraft((d) => [...d, { id: newConditionId(), field: first.key, operator: OPERATORS[first.type][0].key, value: first.type === 'boolean' ? true : undefined }]);
  };
  const updateCondition = (id: string, patch: Partial<FilterCondition>) => {
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeCondition = (id: string) => setDraft((d) => d.filter((c) => c.id !== id));

  const apply = () => { onChange(draft); setOpen(false); };
  const clearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDraft([]);
    onChange([]);
    setOpen(false);
  };

  const activeCount = value.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
          activeCount > 0
            ? 'border-ryze-400 bg-ryze-50 dark:bg-ryze-500/10 text-ryze-700 dark:text-ryze-400'
            : 'border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
        }`}
      >
        <FunnelIcon className={`h-3.5 w-3.5 ${activeCount > 0 ? 'text-ryze-500' : 'text-text-muted'}`} />
        Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-ryze-600 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        {activeCount > 0 ? (
          <XMarkIcon
            className="h-3.5 w-3.5 text-ryze-500 hover:text-ryze-700 dark:hover:text-ryze-300"
            onClick={clearAll}
          />
        ) : (
          <ChevronDownIcon className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[26rem] max-h-[32rem] overflow-y-auto rounded-2xl bg-surface border border-border shadow-lg z-30">
          <div className="p-3 space-y-2.5">
            {!catalog.length && (
              <p className="text-xs text-text-muted py-2 text-center">Loading filterable fields…</p>
            )}
            {catalog.length > 0 && draft.length === 0 && (
              <p className="text-xs text-text-muted py-2 text-center">No filters yet — add one below.</p>
            )}
            {draft.map((cond) => {
              const def = byKey.get(cond.field);
              if (!def) return null;
              const ops = OPERATORS[def.type];
              return (
                <div key={cond.id} className="rounded-xl border border-border p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={cond.field}
                      onChange={(e) => {
                        const newDef = byKey.get(e.target.value);
                        if (!newDef) return;
                        updateCondition(cond.id, {
                          field: e.target.value,
                          operator: OPERATORS[newDef.type][0].key,
                          value: newDef.type === 'boolean' ? true : undefined,
                          value2: undefined,
                        });
                      }}
                      className="flex-1 min-w-0 text-[12px] rounded-lg border border-border bg-background px-2 py-1.5 text-text-primary outline-none focus:border-ryze-500"
                    >
                      {fixedFields.length > 0 && (
                        <optgroup label="Fields">
                          {fixedFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </optgroup>
                      )}
                      {customFields.length > 0 && (
                        <optgroup label="Custom Fields">
                          {customFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCondition(cond.id)}
                      className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(cond.id, { operator: e.target.value })}
                      className="shrink-0 text-[12px] rounded-lg border border-border bg-background px-2 py-1.5 text-text-primary outline-none focus:border-ryze-500"
                    >
                      {ops.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <ValueInput def={def} cond={cond} onChange={(patch) => updateCondition(cond.id, patch)} />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addCondition}
              disabled={!catalog.length}
              className="inline-flex items-center gap-1 text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:hover:text-ryze-300 disabled:opacity-40"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Add filter
            </button>
          </div>

          <div className="border-t border-border p-3 flex items-center gap-2">
            {value.length > 0 && (
              <button type="button" onClick={clearAll} className="text-[12px] font-medium text-text-muted hover:text-text-primary transition-colors">
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={apply}
              className="ml-auto px-4 py-1.5 rounded-lg bg-ryze-600 text-white text-[12px] font-semibold hover:bg-ryze-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldInputCls = 'flex-1 min-w-0 text-[12px] rounded-lg border border-border bg-background px-2 py-1.5 text-text-primary outline-none focus:border-ryze-500';

function ValueInput({ def, cond, onChange }: { def: FilterFieldDef; cond: FilterCondition; onChange: (patch: Partial<FilterCondition>) => void }) {
  if (def.type === 'text') {
    if (cond.operator === 'is_empty' || cond.operator === 'is_not_empty') return null;
    return (
      <input type="text" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })}
        placeholder="Value…" className={fieldInputCls} />
    );
  }

  if (def.type === 'number') {
    if (cond.operator === 'between') {
      return (
        <div className="flex items-center gap-1 flex-1">
          <input type="number" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={fieldInputCls} />
          <span className="text-text-muted text-xs shrink-0">and</span>
          <input type="number" value={cond.value2 ?? ''} onChange={(e) => onChange({ value2: e.target.value })} className={fieldInputCls} />
        </div>
      );
    }
    return <input type="number" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={fieldInputCls} />;
  }

  if (def.type === 'date') {
    if (cond.operator === 'between') {
      return (
        <div className="flex items-center gap-1 flex-1">
          <input type="date" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={fieldInputCls} />
          <span className="text-text-muted text-xs shrink-0">and</span>
          <input type="date" value={cond.value2 ?? ''} onChange={(e) => onChange({ value2: e.target.value })} className={fieldInputCls} />
        </div>
      );
    }
    return <input type="date" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={fieldInputCls} />;
  }

  if (def.type === 'select') {
    if (cond.operator === 'in') {
      const selected: string[] = Array.isArray(cond.value) ? cond.value : [];
      return <OptionPills options={def.options ?? []} selected={selected} onToggle={(v) => onChange({ value: selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v] })} />;
    }
    return (
      <select value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={fieldInputCls}>
        <option value="">Select…</option>
        {(def.options ?? []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  }

  if (def.type === 'boolean') {
    return (
      <div className="flex items-center gap-1.5">
        {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange({ value: o.v })}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
              cond.value === o.v ? 'bg-ryze-600 border-ryze-600 text-white' : 'border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  if (def.type === 'multi') {
    const selected: string[] = Array.isArray(cond.value) ? cond.value : [];
    return <OptionPills options={def.options ?? []} selected={selected} onToggle={(v) => onChange({ value: selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v] })} />;
  }

  return null;
}

function OptionPills({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex-1 flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              active ? 'bg-ryze-600 border-ryze-600 text-white' : 'border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
