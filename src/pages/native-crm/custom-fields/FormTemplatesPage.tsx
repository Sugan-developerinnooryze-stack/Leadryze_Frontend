import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon, PlusIcon, TrashIcon, DocumentDuplicateIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  useCustomFormTemplatesQuery,
  useCustomFormTemplateCreate,
  useCustomFormTemplateUpdate,
  useCustomFormTemplateDelete,
  type CustomFormTemplate,
  type IFormField,
} from '../../../modules/native-crm/queries/custom-form-templates.queries';
import { COUNTRIES, CURRENCIES } from '../../../modules/native-crm/shared/phone-currency-data';
import { previewFormula } from '../../../modules/native-crm/shared/formulaEval';

// ── Field type registry ───────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text',         label: 'Short Answer',       icon: 'T',  group: 'text'    },
  { value: 'textarea',     label: 'Paragraph',          icon: '¶',  group: 'text'    },
  { value: 'number',       label: 'Number',             icon: '#',  group: 'number'  },
  { value: 'currency',     label: 'Currency',           icon: '₹',  group: 'number'  },
  { value: 'radio',        label: 'Multiple Choice',    icon: '○',  group: 'choice'  },
  { value: 'multi_select', label: 'Checkboxes',         icon: '☑',  group: 'choice'  },
  { value: 'dropdown',     label: 'Dropdown',           icon: '▼',  group: 'choice'  },
  { value: 'boolean',      label: 'Yes / No',           icon: '⊙',  group: 'choice'  },
  { value: 'rating',       label: 'Rating (Stars)',     icon: '★',  group: 'rating'  },
  { value: 'date',         label: 'Date',               icon: '▦',  group: 'time'    },
  { value: 'time',         label: 'Time',               icon: '⏱',  group: 'time'    },
  { value: 'datetime',     label: 'Date & Time',        icon: '▩',  group: 'time'    },
  { value: 'email',        label: 'Email',              icon: '@',  group: 'contact' },
  { value: 'phone',        label: 'Phone',              icon: '☎',  group: 'contact' },
  { value: 'url',          label: 'Website URL',        icon: '⊕',  group: 'contact' },
  { value: 'image',        label: 'File / Image',       icon: '◈',  group: 'media'   },
  { value: 'images',       label: 'Files / Images',     icon: '▣',  group: 'media'   },
  { value: 'formula',          label: 'Formula (Computed)', icon: 'fx', group: 'formula' },
  { value: 'cascade_dropdown', label: 'Linked Dropdown',    icon: '⊞', group: 'choice'  },
  { value: 'table',            label: 'Table / Grid',       icon: '⊟', group: 'table'   },
] as const;

type FieldTypeValue = typeof FIELD_TYPES[number]['value'];

const TYPE_BORDER: Record<string, string> = {
  text:    'border-l-blue-400',
  number:  'border-l-green-400',
  choice:  'border-l-violet-400',
  rating:  'border-l-amber-400',
  time:    'border-l-orange-400',
  contact: 'border-l-sky-400',
  media:   'border-l-pink-400',
  formula: 'border-l-emerald-400',
  table:   'border-l-indigo-400',
};

const TYPE_BADGE: Record<string, string> = {
  text:    'bg-blue-50 text-blue-600',
  number:  'bg-green-50 text-green-600',
  choice:  'bg-violet-50 text-violet-600',
  rating:  'bg-amber-50 text-amber-600',
  time:    'bg-orange-50 text-orange-600',
  contact: 'bg-sky-50 text-sky-600',
  media:   'bg-pink-50 text-pink-600',
  formula: 'bg-emerald-50 text-emerald-600',
  table:   'bg-indigo-50 text-indigo-600',
};

const PALETTE_GROUPS = [
  { label: 'Text',        types: ['text', 'textarea'] },
  { label: 'Numbers',     types: ['number', 'currency', 'formula'] },
  { label: 'Choice',      types: ['radio', 'multi_select', 'dropdown', 'boolean', 'cascade_dropdown'] },
  { label: 'Rating',      types: ['rating'] },
  { label: 'Date & Time', types: ['date', 'time', 'datetime'] },
  { label: 'Contact',     types: ['email', 'phone', 'url'] },
  { label: 'Media',       types: ['image', 'images'] },
  { label: 'Table',       types: ['table'] },
];

function getTypeInfo(value: string) {
  return FIELD_TYPES.find((t) => t.value === value) ?? FIELD_TYPES[0];
}
function typeBorder(ft: string)  { return TYPE_BORDER[(getTypeInfo(ft).group)] ?? 'border-l-gray-300'; }
function typeBadge(ft: string)   { return TYPE_BADGE[(getTypeInfo(ft).group)] ?? 'bg-gray-50 text-gray-500'; }

const hasOptions     = (ft: string) => ['radio', 'multi_select', 'dropdown'].includes(ft);
const hasConfig      = (ft: string) => ft === 'phone' || ft === 'currency';
const hasCascadeTree = (ft: string) => ft === 'cascade_dropdown';
const hasTableCols   = (ft: string) => ft === 'table';
const needsFormulaPreserved = (ft: string) =>
  ['formula', 'phone', 'currency', 'cascade_dropdown', 'table'].includes(ft);

// ── TypePickerPopup ───────────────────────────────────────────────────────────

function TypePickerPopup({ current, onSelect, onClose, fullWidth = false }: {
  current: string;
  onSelect: (v: FieldTypeValue) => void;
  onClose: () => void;
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const groups = [
    { label: 'Text',        types: ['text', 'textarea'] },
    { label: 'Numbers',     types: ['number', 'currency', 'formula'] },
    { label: 'Choice',      types: ['radio', 'multi_select', 'dropdown', 'boolean', 'rating', 'cascade_dropdown'] },
    { label: 'Date & Time', types: ['date', 'time', 'datetime'] },
    { label: 'Contact',     types: ['email', 'phone', 'url'] },
    { label: 'Media',       types: ['image', 'images'] },
    { label: 'Table',       types: ['table'] },
  ];

  const cols = fullWidth ? 'grid-cols-4' : 'grid-cols-2';
  const posClass = fullWidth
    ? 'absolute left-0 right-0 top-full mt-2 z-[200]'
    : 'absolute right-0 top-full mt-2 z-[200] w-64';

  return (
    <div ref={ref} className={`${posClass} bg-white rounded-2xl shadow-2xl border border-gray-100 p-4`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Choose question type</p>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5 px-1">{g.label}</p>
            <div className={`grid ${cols} gap-1`}>
              {g.types.map((tv) => {
                const t = getTypeInfo(tv);
                return (
                  <button
                    key={tv}
                    type="button"
                    onClick={() => { onSelect(tv as FieldTypeValue); onClose(); }}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors w-full ${
                      current === tv
                        ? 'ring-1 ring-brand-400 ' + typeBadge(tv)
                        : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <span className="text-sm font-bold shrink-0 w-5 text-center leading-none">{t.icon}</span>
                    <span className="leading-snug truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── InlineOptionsEditor ───────────────────────────────────────────────────────

function InlineOptionsEditor({ options, onChange, fieldType }: {
  options: string[];
  onChange: (v: string[]) => void;
  fieldType: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rowIcon = fieldType === 'radio' ? '○' : fieldType === 'multi_select' ? '☐' : '≡';

  const updateAt = (i: number, val: string) => {
    const next = [...options]; next[i] = val; onChange(next);
  };
  const removeAt = (i: number) => onChange(options.filter((_, j) => j !== i));
  const addOption = () => {
    const next = [...options, ''];
    onChange(next);
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 0);
  };
  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i === options.length - 1) addOption();
      else inputRefs.current[i + 1]?.focus();
    }
    if (e.key === 'Backspace' && !options[i] && options.length > 1) {
      e.preventDefault();
      removeAt(i);
      setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 0);
    }
  };

  return (
    <div className="space-y-1">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2 group/opt py-0.5">
          <span className="text-sm text-gray-300 w-4 shrink-0 text-center select-none">{rowIcon}</span>
          <input
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text" value={o}
            onChange={(e) => updateAt(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            placeholder={`Option ${i + 1}`}
            className="flex-1 min-w-0 border-b border-gray-200 bg-transparent px-0.5 py-0.5 text-sm text-gray-700 focus:outline-none focus:border-brand-500 dark:border-gray-600 dark:text-gray-200"
          />
          <button type="button" onClick={() => removeAt(i)}
            className="opacity-0 group-hover/opt:opacity-100 h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 transition-opacity shrink-0 text-sm">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addOption}
        className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 mt-1.5 pl-6 transition-colors">
        <PlusIcon className="h-3.5 w-3.5" /> Add option
      </button>
    </div>
  );
}

// ── CascadeSection ────────────────────────────────────────────────────────────

function CascadeSection({ field, allFields, onChangeParentKey, onChangeParentValues }: {
  field: IFormField;
  allFields: IFormField[];
  onChangeParentKey: (k: string) => void;
  onChangeParentValues: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(!!field.parentKey);
  const eligibleParents = allFields.filter((f) => f.key !== field.key && f.key.trim());
  const parent = allFields.find((f) => f.key === field.parentKey);
  const parentOptions = parent?.options ?? [];
  const current = field.parentValues ?? [];
  const toggle = (v: string) =>
    onChangeParentValues(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);

  return (
    <div className="rounded-xl border border-dashed border-gray-200 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Conditional Logic</span>
          {field.parentKey && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">Active</span>
          )}
        </div>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-dashed border-gray-100">
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <span className="text-xs text-gray-500 shrink-0">Show when</span>
            <select
              value={field.parentKey ?? ''}
              onChange={(e) => onChangeParentKey(e.target.value)}
              className="flex-1 min-w-[160px] rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">— Always visible —</option>
              {eligibleParents.map((f) => (
                <option key={f.key} value={f.key}>{f.label || f.key}</option>
              ))}
            </select>
            {field.parentKey && <span className="text-xs text-gray-500 shrink-0">equals</span>}
          </div>

          {field.parentKey && parentOptions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                {parentOptions.map((o) => (
                  <label key={o} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2.5 py-1 rounded-full border transition-colors ${
                    current.includes(o) ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                    <input type="checkbox" checked={current.includes(o)} onChange={() => toggle(o)} className="sr-only" />
                    {current.includes(o) && <span className="text-brand-500">✓</span>}
                    {o}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">Uncheck all = show for any parent value</p>
            </div>
          )}

          {field.parentKey && parentOptions.length === 0 && (
            <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded px-2 py-1.5">
              Parent field has no options yet — will show whenever parent has any value.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── CascadeTreeEditor ─────────────────────────────────────────────────────────

type CascadeTree = Record<string, Record<string, object>>;

function CascadeTreeEditor({ formula, onChange }: { formula: string; onChange: (v: string) => void }) {
  const tree: CascadeTree = useMemo(() => {
    try { return JSON.parse(formula || '{}') as CascadeTree; } catch { return {}; }
  }, [formula]);

  const commit = (t: CascadeTree) => onChange(JSON.stringify(t));
  const addL1  = () => commit({ ...tree, [`Category ${Object.keys(tree).length + 1}`]: {} });
  const addL2  = (l1: string) => {
    const sub = tree[l1] ?? {};
    commit({ ...tree, [l1]: { ...sub, [`Sub ${Object.keys(sub).length + 1}`]: {} } });
  };
  const renameL1 = (old: string, nw: string) => {
    const t2: CascadeTree = {};
    for (const k of Object.keys(tree)) t2[k === old ? nw : k] = tree[k];
    commit(t2);
  };
  const renameL2 = (l1: string, old: string, nw: string) => {
    const sub: Record<string, object> = {};
    for (const k of Object.keys(tree[l1] ?? {})) sub[k === old ? nw : k] = {};
    commit({ ...tree, [l1]: sub });
  };
  const deleteL1 = (l1: string) => { const t2 = { ...tree }; delete t2[l1]; commit(t2); };
  const deleteL2 = (l1: string, l2: string) => {
    const sub = { ...tree[l1] }; delete sub[l2]; commit({ ...tree, [l1]: sub });
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-3">
      {Object.keys(tree).map((l1) => (
        <div key={l1} className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-violet-400 text-xs select-none">▼</span>
            <input
              value={l1}
              onChange={(e) => renameL1(l1, e.target.value)}
              placeholder="Category name"
              className="flex-1 border-b border-violet-200 text-sm px-1 py-0.5 bg-transparent focus:outline-none focus:border-violet-500 font-medium text-gray-700"
            />
            <button type="button" onClick={() => deleteL1(l1)} className="text-gray-300 hover:text-red-400 text-sm shrink-0">✕</button>
          </div>
          {Object.keys(tree[l1] ?? {}).map((l2) => (
            <div key={l2} className="flex items-center gap-1.5 ml-5">
              <span className="text-violet-300 text-xs select-none">↳</span>
              <input
                value={l2}
                onChange={(e) => renameL2(l1, l2, e.target.value)}
                placeholder="Sub-option name"
                className="flex-1 border-b border-violet-100 text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:border-violet-400 text-gray-600"
              />
              <button type="button" onClick={() => deleteL2(l1, l2)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => addL2(l1)}
            className="ml-5 text-xs text-violet-500 hover:text-violet-700 flex items-center gap-1 mt-0.5">
            <span className="text-base leading-none">+</span> Add sub-option
          </button>
        </div>
      ))}
      <button type="button" onClick={addL1}
        className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1.5 mt-1 font-medium">
        <span className="text-base leading-none">+</span> Add category
      </button>
      {Object.keys(tree).length === 0 && (
        <p className="text-[11px] text-gray-400 italic">Click "Add category" to start building the option tree.</p>
      )}
    </div>
  );
}

// ── TableColumnEditor ─────────────────────────────────────────────────────────

export interface TableColDef {
  key:      string;
  label:    string;
  type:     'text' | 'number' | 'dropdown' | 'formula';
  options?: string[];
  formula?: string;
}

function TableColumnEditor({ formula, onChange }: { formula: string; onChange: (v: string) => void }) {
  const cols: TableColDef[] = useMemo(() => {
    try { return JSON.parse(formula || '[]') as TableColDef[]; } catch { return []; }
  }, [formula]);

  const commit   = (c: TableColDef[]) => onChange(JSON.stringify(c));
  const addCol   = () => commit([...cols, { key: '', label: '', type: 'text' }]);
  const deleteCol = (i: number) => commit(cols.filter((_, j) => j !== i));
  const patchCol  = (i: number, patch: Partial<TableColDef>) =>
    commit(cols.map((c, j) => j === i ? { ...c, ...patch } : c));

  const allKeys = cols.filter((c) => c.key).map((c) => `{${c.key}}`).join(', ');

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Columns</span>
        {allKeys && <span className="text-[10px] text-gray-400">Keys: {allKeys}</span>}
      </div>
      {cols.map((col, i) => (
        <div key={i} className="flex items-start gap-2 bg-white rounded-lg border border-indigo-100 p-2">
          <div className="flex-1 space-y-1.5 min-w-0">
            <input
              value={col.label}
              onChange={(e) => {
                const label = e.target.value;
                const autoKey = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                patchCol(i, { label, key: col.key || autoKey });
              }}
              placeholder="Column label (e.g. Price)"
              className="w-full border-b border-gray-200 text-sm px-1 py-0.5 bg-transparent focus:outline-none focus:border-indigo-400 text-gray-700"
            />
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={col.type}
                onChange={(e) => patchCol(i, { type: e.target.value as TableColDef['type'], options: [], formula: '' })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
                <option value="formula">Formula (fx)</option>
              </select>
              {col.type === 'dropdown' && (
                <input
                  value={(col.options ?? []).join(', ')}
                  onChange={(e) => patchCol(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Option A, Option B, Option C"
                  className="flex-1 min-w-0 border-b border-gray-200 text-xs px-1 py-0.5 bg-transparent focus:outline-none"
                />
              )}
              {col.type === 'formula' && (
                <input
                  value={col.formula ?? ''}
                  onChange={(e) => patchCol(i, { formula: e.target.value })}
                  placeholder="{price} * {qty}"
                  className="flex-1 min-w-0 font-mono border-b border-emerald-200 text-xs px-1 py-0.5 bg-transparent focus:outline-none text-emerald-700"
                />
              )}
            </div>
          </div>
          <button type="button" onClick={() => deleteCol(i)} className="text-gray-300 hover:text-red-400 text-sm mt-1 shrink-0">✕</button>
        </div>
      ))}
      <button type="button" onClick={addCol}
        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 font-medium">
        <span className="text-base leading-none">+</span> Add column
      </button>
      {cols.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">Click "Add column" to define your table structure.</p>
      )}
    </div>
  );
}

// ── FormulaBuilder ───────────────────────────────────────────────────────────

function FormulaBuilder({ formula, availableKeys, onChange }: {
  formula: string;
  availableKeys: string[];
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ valid: boolean; result: string }>({ valid: true, result: '' });

  useEffect(() => {
    // CSP-safe parser — the app's Content-Security-Policy blocks new Function/eval
    setPreview(previewFormula(formula));
  }, [formula]);

  const insertAtCursor = (text: string) => {
    const el = inputRef.current;
    if (!el) { onChange((formula ?? '') + text); return; }
    const s = el.selectionStart ?? (formula ?? '').length;
    const e = el.selectionEnd   ?? (formula ?? '').length;
    const next = (formula ?? '').slice(0, s) + text + (formula ?? '').slice(e);
    onChange(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); }, 0);
  };

  const OPERATORS: [string, string][] = [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['(', '('], [')', ')'], ['%', '%']];

  return (
    <div className="space-y-2.5">
      {/* Field token chips */}
      <div className="flex flex-wrap gap-1.5 items-center p-2.5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Fields</span>
        {availableKeys.length === 0
          ? <span className="text-[11px] text-gray-400 italic">Add number fields to use in formula</span>
          : availableKeys.map((k) => (
              <button key={k} type="button" onClick={() => insertAtCursor(`{${k}}`)}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors">
                {k}
              </button>
            ))
        }
      </div>

      {/* Operator quick-bar */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Operators</span>
        {OPERATORS.map(([label, char]) => (
          <button key={label} type="button" onClick={() => insertAtCursor(char)}
            className="w-8 h-8 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors">
            {label}
          </button>
        ))}
        {formula && (
          <button type="button" onClick={() => onChange('')}
            className="ml-auto px-2.5 h-8 rounded-lg border border-red-100 text-xs text-red-400 hover:bg-red-50 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Formula input + live preview */}
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
        formula && !preview.valid ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/40'
      }`}>
        <span className="text-base font-bold text-emerald-600 shrink-0 select-none">fx</span>
        <input
          ref={inputRef}
          type="text" value={formula ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Click fields & operators above, or type: {qty} * {price}"
          className="flex-1 min-w-0 bg-transparent font-mono text-sm focus:outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
        />
        {formula && (
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
            preview.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}>
            {preview.valid ? `= ${preview.result}` : '⚠ error'}
          </span>
        )}
      </div>
      {formula && !preview.valid && (
        <p className="text-[11px] text-red-400">Check your formula — it contains a syntax error.</p>
      )}
    </div>
  );
}

// ── FieldCard ─────────────────────────────────────────────────────────────────

interface FieldCardProps {
  field: IFormField;
  idx: number;
  totalCount: number;
  isActive: boolean;
  allFields: IFormField[];
  allFieldKeys: string[];
  hasChildren: boolean;
  childCount: number;
  isDragOver: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onChange: (patch: Partial<IFormField>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function FieldCard({
  field, idx, isActive, allFields, allFieldKeys,
  hasChildren, childCount, isDragOver, isDragging, onDragStart,
  onActivate, onDeactivate, onChange, onDelete, onDuplicate,
}: FieldCardProps) {
  const typeInfo = getTypeInfo(field.fieldType);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const prevLabelRef = useRef(field.label);

  const handleLabelChange = (label: string) => {
    const autoKey = prevLabelRef.current.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newAuto = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const shouldAutoKey = !field.key || field.key === autoKey;
    prevLabelRef.current = label;
    onChange({ label, ...(shouldAutoKey ? { key: newAuto } : {}) });
  };

  const SEL ='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  if (!isActive) {
    return (
      <div
        onClick={onActivate}
        className={`bg-white rounded-xl border border-gray-200 border-l-[5px] ${typeBorder(field.fieldType)} shadow-sm cursor-pointer hover:shadow-md transition-all duration-150 group ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
      >
        <div className="px-3 py-3.5 flex items-center gap-2.5">
          {/* Drag handle */}
          <div
            draggable
            onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none text-lg leading-none px-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to reorder"
          >⠿</div>
          <span className="text-xs text-gray-300 font-mono shrink-0 w-5 text-right">{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {field.label || <span className="italic text-gray-400 font-normal">Untitled question</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasChildren && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-500 font-medium border border-violet-100">
                ⤵ {childCount}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeBadge(field.fieldType)}`}>
              {typeInfo.icon} {typeInfo.label}
            </span>
            {field.required && <span className="text-red-400 text-xs font-bold">*</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── Active card ──
  return (
    <div className={`bg-white rounded-xl border border-l-[5px] ${typeBorder(field.fieldType)} border-gray-200 shadow-xl ring-2 ring-brand-400/30`}>
      <div className="px-5 py-5 space-y-4">

        {/* Row 1: Label + Type picker */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <input
              type="text" value={field.label} onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Question label" autoFocus
              className="w-full text-base font-semibold border-0 border-b-2 border-gray-200 focus:border-brand-500 focus:outline-none bg-transparent pb-1 text-gray-900 dark:text-gray-100 placeholder-gray-300"
            />
          </div>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setShowTypePicker((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${typeBadge(field.fieldType)} border-current/20 hover:opacity-80`}
            >
              <span className="font-bold">{typeInfo.icon}</span>
              {typeInfo.label}
              <ChevronDownIcon className="h-3 w-3 opacity-60" />
            </button>
            {showTypePicker && (
              <TypePickerPopup
                current={field.fieldType}
                onSelect={(v) => {
                  onChange({ fieldType: v, options: hasOptions(v) ? (field.options?.filter(Boolean).length ? field.options : ['']) : [], formula: hasConfig(v) ? (v === 'phone' ? 'IN' : 'USD') : hasCascadeTree(v) ? '{}' : hasTableCols(v) ? '[]' : '' });
                  setShowTypePicker(false);
                }}
                onClose={() => setShowTypePicker(false)}
              />
            )}
          </div>
        </div>

        {/* Row 2: Key */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">key</span>
          <input type="text" value={field.key}
            onChange={(e) => onChange({ key: e.target.value.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="field_key"
            className="flex-1 min-w-0 font-mono text-xs bg-transparent focus:outline-none text-gray-600 dark:text-gray-300 placeholder-gray-400"
          />
        </div>

        {/* Options editor */}
        {hasOptions(field.fieldType) && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Options</p>
            <InlineOptionsEditor
              options={field.options?.length ? field.options : ['']}
              onChange={(v) => onChange({ options: v })}
              fieldType={field.fieldType}
            />
          </div>
        )}

        {/* Phone config */}
        {field.fieldType === 'phone' && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Default Country Code</p>
            <select value={field.formula || 'IN'} onChange={(e) => onChange({ formula: e.target.value })} className={SEL}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>
              ))}
            </select>
          </div>
        )}

        {/* Currency config */}
        {field.fieldType === 'currency' && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Currency</p>
            <select value={field.formula || 'USD'} onChange={(e) => onChange({ formula: e.target.value })} className={SEL}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol}  {c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Cascade dropdown tree editor */}
        {hasCascadeTree(field.fieldType) && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Option Tree</p>
            <CascadeTreeEditor formula={field.formula ?? '{}'} onChange={(v) => onChange({ formula: v })} />
          </div>
        )}

        {/* Table column editor */}
        {hasTableCols(field.fieldType) && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Table Columns</p>
            <TableColumnEditor formula={field.formula ?? '[]'} onChange={(v) => onChange({ formula: v })} />
          </div>
        )}

        {/* Formula builder */}
        {field.fieldType === 'formula' && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Formula</p>
            <FormulaBuilder
              formula={field.formula ?? ''}
              availableKeys={allFieldKeys.filter((k) => k !== field.key)}
              onChange={(v) => onChange({ formula: v })}
            />
          </div>
        )}

        {/* Cascade section */}
        <CascadeSection
          field={field} allFields={allFields}
          onChangeParentKey={(k) => onChange({ parentKey: k, parentValues: [] })}
          onChangeParentValues={(v) => onChange({ parentValues: v })}
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onDuplicate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-white transition-colors">
            <DocumentDuplicateIcon className="h-3.5 w-3.5" /> Duplicate
          </button>
          <span className="w-px h-4 bg-gray-200 mx-0.5" />
          <button type="button" onClick={onDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-gray-500">Required</span>
            <button type="button" onClick={() => onChange({ required: !field.required })}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${field.required ? 'bg-brand-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${field.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <button type="button" onClick={onDeactivate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors">
            <CheckIcon className="h-3.5 w-3.5" /> Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditorState ───────────────────────────────────────────────────────────────

interface EditorState { name: string; description: string; fields: IFormField[]; }

// ── TemplateEditor ────────────────────────────────────────────────────────────

function TemplateEditor({ initial, templateId, onSaved }: {
  initial: EditorState; templateId: string | null; onSaved: () => void;
}) {
  const [name,        setName]        = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [fields,      setFields]      = useState<IFormField[]>(initial.fields);
  const [activeIdx,   setActiveIdx]   = useState<number | null>(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [dragOver,    setDragOver]    = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const createMutation = useCustomFormTemplateCreate();
  const updateMutation = useCustomFormTemplateUpdate();

  const setField = (idx: number, patch: Partial<IFormField>) =>
    setFields((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

  const addField = (type: FieldTypeValue) => {
    const newIdx = fields.length;
    setFields((prev) => [
      ...prev,
      {
        key: '', label: '', fieldType: type, options: hasOptions(type) ? [''] : [],
        parentKey: '', parentValues: [],
        formula: hasConfig(type) ? (type === 'phone' ? 'IN' : 'USD')
               : hasCascadeTree(type) ? '{}'
               : hasTableCols(type)   ? '[]'
               : '',
        required: false, order: prev.length,
      } as IFormField,
    ]);
    setActiveIdx(newIdx);
    setShowPicker(false);
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })));
    setActiveIdx(null);
  };

  const duplicateField = (idx: number) => {
    setFields((prev) => {
      const src = prev[idx];
      const copy: IFormField = { ...src, key: src.key ? `${src.key}_copy` : '', label: src.label ? `${src.label} (copy)` : '', order: idx + 1 };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)].map((f, i) => ({ ...f, order: i }));
    });
    setActiveIdx(idx + 1);
  };

  useEffect(() => {
    if (!showPicker) return;
    const h = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPicker]);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Template name is required'); return; }
    const keySet = new Set<string>();
    for (const f of fields) {
      const k = f.key.trim();
      if (!k) { setError('All fields must have a key'); return; }
      if (!f.label.trim()) { setError('All fields must have a label'); return; }
      if (keySet.has(k)) { setError(`Duplicate key: "${k}"`); return; }
      keySet.add(k);
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), description: description.trim(),
        fields: fields.map((f, i) => ({
          ...f,
          key:         f.key.trim(),
          label:       f.label.trim(),
          order:       i,
          options:     hasOptions(f.fieldType) ? (f.options ?? []).filter((o) => o.trim()) : [],
          parentKey:   f.parentKey?.trim() || undefined,
          parentValues: f.parentKey?.trim() ? (f.parentValues ?? []) : [],
          formula:     needsFormulaPreserved(f.fieldType) ? (f.formula?.trim() || undefined) : undefined,
        })),
      };
      if (templateId) await updateMutation.mutateAsync({ id: templateId, data: payload });
      else await createMutation.mutateAsync(payload as any);
      onSaved();
    } catch {
      setError('Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const allFieldKeys = fields.map((f) => f.key).filter(Boolean);

  return (
    <div className="flex flex-col h-full" onClick={() => { setActiveIdx(null); setShowPicker(false); }}>

      {/* ── Form title card ── */}
      <div className="mx-6 mt-6 mb-2" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-2xl border border-gray-200 border-t-[6px] border-t-brand-500 shadow-sm px-6 py-5 space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Form template name"
            className="w-full text-xl font-bold border-0 border-b-2 border-gray-100 focus:border-brand-400 focus:outline-none bg-transparent pb-1.5 text-gray-900 dark:text-gray-100 placeholder-gray-300"
          />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Form description (optional)"
            className="w-full text-sm border-0 border-b border-gray-100 focus:border-brand-300 focus:outline-none bg-transparent pb-1 text-gray-500 placeholder-gray-300"
          />
          {fields.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-gray-400">{fields.length} question{fields.length !== 1 ? 's' : ''}</span>
              <span className="text-gray-200">·</span>
              {fields.filter((f) => f.parentKey).length > 0 && (
                <span className="text-[11px] text-amber-500">{fields.filter((f) => f.parentKey).length} conditional</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas + Palette ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Drop zone canvas */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2.5 pt-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const ft = e.dataTransfer.getData('fieldType') as FieldTypeValue | '';
            if (ft) { e.preventDefault(); addField(ft); }
          }}
        >

        {fields.length === 0 && !showPicker && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-3xl mb-4 shadow-inner">✦</div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No questions yet</p>
            <p className="text-xs text-gray-400">Drag a field from the right panel, or click "Add Question" below</p>
          </div>
        )}

        {fields.map((field, idx) => {
          const isChild     = !!field.parentKey;
          const hasChildren = fields.some((f) => f.parentKey === field.key);
          const childCount  = fields.filter((f) => f.parentKey === field.key).length;
          const parentLabel = isChild
            ? fields.find((f) => f.key === field.parentKey)?.label || field.parentKey
            : null;
          const pv = field.parentValues ?? [];

          return (
            <div
              key={idx}
              className={isChild ? 'ml-7 relative' : ''}
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
              onDragEnter={() => {
                const from = dragSrc.current;
                if (from === null || from === idx) return;
                dragSrc.current = idx;
                setActiveIdx(null);
                setFields((prev) => {
                  const next = [...prev];
                  const [item] = next.splice(from, 1);
                  next.splice(idx, 0, item);
                  return next.map((f, i) => ({ ...f, order: i }));
                });
              }}
              onDragEnd={() => { dragSrc.current = null; setDragOver(null); }}
            >
              {/* Visual cascade tree connector */}
              {isChild && (
                <>
                  <div className="absolute -left-4 top-0 h-[calc(50%-4px)] border-l-2 border-dashed border-violet-200" />
                  <div className="absolute -left-4 top-[calc(50%-4px)] w-4 border-t-2 border-dashed border-violet-200" />
                  <div className="flex items-center gap-1.5 mb-1.5 pl-0.5">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path d="M0 0 Q0 4 5 4 L12 4" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="2.5 2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[11px] text-violet-500 select-none">
                      Show when{' '}
                      <span className="font-semibold text-violet-700">{parentLabel}</span>
                      {pv.length > 0
                        ? <> ={pv.map((v) => (
                            <span key={v} className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-medium border border-violet-100">{v}</span>
                          ))}</>
                        : <span className="text-gray-400 italic"> = any value</span>
                      }
                    </span>
                  </div>
                </>
              )}

              <FieldCard
                field={field} idx={idx} totalCount={fields.length}
                isActive={activeIdx === idx}
                allFields={fields} allFieldKeys={allFieldKeys}
                hasChildren={hasChildren} childCount={childCount}
                isDragOver={dragOver === idx}
                isDragging={dragSrc.current === idx}
                onDragStart={() => { dragSrc.current = idx; }}
                onActivate={() => setActiveIdx(idx)}
                onDeactivate={() => setActiveIdx(null)}
                onChange={(patch) => setField(idx, patch)}
                onDelete={() => removeField(idx)}
                onDuplicate={() => duplicateField(idx)}
              />
            </div>
          );
        })}

        {/* ── Add Question (secondary) ── */}
        <div className="relative pt-1" ref={pickerRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setShowPicker((v) => !v)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-xs font-medium transition-colors ${
              showPicker ? 'border-brand-400 text-brand-500 bg-brand-50' : 'border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/30'
            }`}>
            <PlusIcon className="h-3.5 w-3.5" />
            Add Question
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPicker && (
            <TypePickerPopup
              current=""
              fullWidth
              onSelect={(v) => addField(v)}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        </div>

        {/* ── Right type palette ── */}
        <div className="w-44 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Drag to add</p>
          </div>
          {PALETTE_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-3 py-1">{group.label}</p>
              {group.types.map((tv) => {
                const t = getTypeInfo(tv);
                return (
                  <div
                    key={tv}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('fieldType', tv)}
                    className="flex items-center gap-2 mx-2 mb-0.5 px-2.5 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 cursor-grab active:cursor-grabbing text-xs text-gray-600 hover:text-brand-700 transition-colors select-none"
                  >
                    <span className="font-bold text-sm w-5 text-center shrink-0 leading-none">{t.icon}</span>
                    <span className="leading-tight text-[11px]">{t.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-3 shrink-0"
        onClick={(e) => e.stopPropagation()}>
        <div>
          {error
            ? <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠</span>{error}</p>
            : <p className="text-xs text-gray-400">{fields.length} question{fields.length !== 1 ? 's' : ''}</p>
          }
        </div>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-60 transition-colors shadow-sm">
          <CheckIcon className="h-4 w-4" />
          {saving ? 'Saving…' : templateId ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    </div>
  );
}

// ── FormTemplatesPage ─────────────────────────────────────────────────────────

export default function FormTemplatesPage() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useCustomFormTemplatesQuery();
  const deleteMutation = useCustomFormTemplateDelete();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating,   setCreating]   = useState(false);

  const selectedTemplate = templates.find((t) => t._id === selectedId) ?? null;
  const showEditor = creating || !!selectedTemplate;

  const editorInitial: { initial: EditorState; templateId: string | null } = selectedTemplate
    ? { initial: { name: selectedTemplate.name, description: selectedTemplate.description ?? '', fields: selectedTemplate.fields }, templateId: selectedTemplate._id }
    : { initial: { name: '', description: '', fields: [] }, templateId: null };

  const handleSaved = () => setCreating(false);

  const handleDelete = async (t: CustomFormTemplate) => {
    if (!confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(t._id);
    if (selectedId === t._id) setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate('/native-crm/custom-fields')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mr-2">
          <ArrowLeftIcon className="h-4 w-4" /> Custom Fields
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Form Templates</h1>
          <p className="text-xs text-gray-500">Build reusable mini-forms with cascades, logic &amp; computed fields</p>
        </div>
        <button onClick={() => { setSelectedId(null); setCreating(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm">
          <PlusIcon className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Templates ({templates.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex gap-1.5">{[0,1,2].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}</div>
              </div>
            )}
            {!isLoading && templates.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-10 px-4 leading-relaxed">No templates yet.<br />Create one with the button above →</p>
            )}
            {templates.map((t) => {
              const isSelected = selectedId === t._id && !creating;
              return (
                <div key={t._id}
                  onClick={() => { setCreating(false); setSelectedId(t._id); }}
                  className={`group flex items-start justify-between gap-2 px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                    isSelected ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-brand-700 dark:text-brand-400' : 'text-gray-800 dark:text-gray-200'}`}>{t.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{t.fields.length} question{t.fields.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                    className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
          {showEditor ? (
            <TemplateEditor
              key={selectedTemplate?._id ?? 'new'}
              initial={editorInitial.initial}
              templateId={editorInitial.templateId}
              onSaved={handleSaved}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-4xl opacity-50">✦</div>
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Select a template to edit</p>
                <p className="text-xs text-gray-400 mt-1">or create a new one to get started</p>
              </div>
              <button onClick={() => { setSelectedId(null); setCreating(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 border border-brand-300 rounded-xl hover:bg-brand-50 transition-colors">
                <PlusIcon className="h-4 w-4" /> New Template
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
