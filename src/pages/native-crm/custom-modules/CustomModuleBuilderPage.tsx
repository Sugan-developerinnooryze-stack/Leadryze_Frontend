import React, { useState, useEffect, useRef } from 'react';
import {
  PlusIcon, TrashIcon, Cog6ToothIcon, ChevronUpIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  useCustomModulesQuery,
  useCustomModuleCreate,
  useCustomModuleUpdate,
  useCustomModuleDelete,
} from '../../../modules/native-crm/queries/custom-modules.queries';
import type { CustomModuleDef, ICustomModuleField, CustomModuleFieldType, CascadeNode } from '../../../modules/native-crm/queries/custom-modules.queries';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';

/* ── Field type catalogue ─────────────────────────────────────────────────── */

interface FieldTypeDef { value: CustomModuleFieldType; label: string; group: string }

const FIELD_TYPE_GROUPS: { label: string; color: string; types: FieldTypeDef[] }[] = [
  {
    label: 'Text', color: 'blue',
    types: [
      { value: 'text',     label: 'Short Text',  group: 'text' },
      { value: 'textarea', label: 'Long Text',   group: 'text' },
      { value: 'email',    label: 'Email',       group: 'text' },
      { value: 'phone',    label: 'Phone',       group: 'text' },
      { value: 'url',      label: 'URL / Link',  group: 'text' },
    ],
  },
  {
    label: 'Numbers', color: 'purple',
    types: [
      { value: 'number',   label: 'Number',   group: 'number' },
      { value: 'currency', label: 'Currency', group: 'number' },
      { value: 'rating',   label: 'Rating',   group: 'number' },
    ],
  },
  {
    label: 'Choice', color: 'green',
    types: [
      { value: 'select',          label: 'Dropdown',        group: 'choice' },
      { value: 'multiselect',     label: 'Multi-select',    group: 'choice' },
      { value: 'boolean',         label: 'Yes / No',        group: 'choice' },
      { value: 'categoryselect',  label: 'Category Cascade', group: 'choice' },
    ],
  },
  {
    label: 'Date', color: 'amber',
    types: [
      { value: 'date',     label: 'Date',       group: 'date' },
      { value: 'datetime', label: 'Date & Time', group: 'date' },
    ],
  },
  {
    label: 'Media', color: 'pink',
    types: [
      { value: 'image',  label: 'Image (Single)',   group: 'media' },
      { value: 'images', label: 'Images (Multiple)', group: 'media' },
    ],
  },
  {
    label: 'Link', color: 'indigo',
    types: [
      { value: 'relationship', label: 'Relationship', group: 'link' },
    ],
  },
];

const ALL_TYPES: FieldTypeDef[] = FIELD_TYPE_GROUPS.flatMap((g) => g.types);

const GROUP_COLOR: Record<string, string> = {
  text:   'border-blue-400',
  number: 'border-purple-400',
  choice: 'border-green-400',
  date:   'border-amber-400',
  media:  'border-pink-400',
  link:   'border-indigo-400',
};
const GROUP_BADGE: Record<string, string> = {
  text:   'bg-blue-50 text-blue-700',
  number: 'bg-purple-50 text-purple-700',
  choice: 'bg-green-50 text-green-700',
  date:   'bg-amber-50 text-amber-700',
  media:  'bg-pink-50 text-pink-700',
  link:   'bg-indigo-50 text-indigo-700',
};

function typeGroup(t: CustomModuleFieldType): string {
  return ALL_TYPES.find((x) => x.value === t)?.group ?? 'text';
}
function typeLabel(t: CustomModuleFieldType): string {
  return ALL_TYPES.find((x) => x.value === t)?.label ?? t;
}

const RELATIONSHIP_TARGETS = [
  { value: 'customers',  label: 'Customers'  },
  { value: 'staffs',     label: 'Staff'      },
  { value: 'teams',      label: 'Teams'      },
  { value: 'sites',      label: 'Sites'      },
  { value: 'services',   label: 'Services'   },
  { value: 'categories', label: 'Categories' },
  { value: 'parts',      label: 'Parts'      },
  { value: 'expenses',   label: 'Expenses'   },
  { value: 'products',   label: 'Products'   },
  { value: 'assets',     label: 'Assets'     },
  { value: 'vehicles',   label: 'Vehicles'   },
  { value: 'leads',      label: 'Leads'      },
  { value: 'deals',      label: 'Deals'      },
  { value: 'branches',   label: 'Branches'   },
];

const RELATIONSHIP_AVAILABLE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  customers:  [{ key:'name',label:'Name' },{ key:'phone',label:'Phone' },{ key:'email',label:'Email' },{ key:'company',label:'Company' },{ key:'address',label:'Address' },{ key:'city',label:'City' },{ key:'status',label:'Status' }],
  staffs:     [{ key:'firstName',label:'First Name' },{ key:'lastName',label:'Last Name' },{ key:'email',label:'Email' },{ key:'phone',label:'Phone' },{ key:'role',label:'Role' },{ key:'status',label:'Status' }],
  teams:      [{ key:'name',label:'Name' },{ key:'description',label:'Description' },{ key:'status',label:'Status' }],
  sites:      [{ key:'name',label:'Name' },{ key:'address',label:'Address' },{ key:'city',label:'City' },{ key:'phone',label:'Phone' },{ key:'contactPerson',label:'Contact Person' }],
  services:   [{ key:'name',label:'Name' },{ key:'price',label:'Price' },{ key:'unit',label:'Unit' },{ key:'duration',label:'Duration (min)' }],
  categories: [{ key:'name',label:'Name' },{ key:'description',label:'Description' }],
  parts:      [{ key:'name',label:'Name' },{ key:'partNumber',label:'Part Number' },{ key:'price',label:'Price' },{ key:'unit',label:'Unit' },{ key:'quantity',label:'Quantity' }],
  expenses:   [{ key:'title',label:'Title' },{ key:'category',label:'Category' },{ key:'amount',label:'Amount' },{ key:'date',label:'Date' },{ key:'status',label:'Status' }],
  products:   [{ key:'name',label:'Name' },{ key:'sku',label:'SKU' },{ key:'sellingPrice',label:'Price' },{ key:'unit',label:'Unit' },{ key:'stock',label:'Stock' }],
  assets:     [{ key:'name',label:'Name' },{ key:'category',label:'Category' },{ key:'serialNumber',label:'Serial No.' },{ key:'condition',label:'Condition' },{ key:'status',label:'Status' }],
  vehicles:   [{ key:'name',label:'Name' },{ key:'registrationNumber',label:'Reg. Number' },{ key:'make',label:'Make' },{ key:'vehicleModel',label:'Model' },{ key:'fuelType',label:'Fuel Type' }],
  leads:      [{ key:'firstName',label:'First Name' },{ key:'lastName',label:'Last Name' },{ key:'company',label:'Company' },{ key:'email',label:'Email' },{ key:'phone',label:'Phone' },{ key:'status',label:'Status' },{ key:'rating',label:'Rating' }],
  deals:      [{ key:'title',label:'Title' },{ key:'amount',label:'Amount' },{ key:'stage',label:'Stage' },{ key:'closeDate',label:'Close Date' }],
  branches:   [{ key:'branchName',label:'Branch Name' },{ key:'branchType',label:'Type' },{ key:'city',label:'City' },{ key:'phone',label:'Phone' },{ key:'email',label:'Email' }],
};

const PRESET_ICONS = [
  // Office / Docs
  '📋','📊','📈','📉','📁','📂','📄','🗂️','📌','📎','🗒️','📝','🖊️','🗃️','📑',
  // Transport
  '🚗','🚙','🏎️','🚕','🚌','🛻','🚚','🚛','🚜','✈️','🚢','🚁','🏍️','🚲','🛵',
  // Buildings
  '🏢','🏗️','🏭','🏠','🏡','🏫','🏥','🏦','🏨','🏪','🏬','🏛️',
  // Tools
  '🔧','🔨','⚙️','🛠️','🔬','🔭','🔍','🔎','🔩','🪛','🪚',
  // People
  '👤','👥','👨‍💼','👩‍💼','🧑‍💻','👷','🧑‍🔧','🧑‍🏫',
  // Misc
  '📦','🎯','✅','❌','🔔','💡','🔑','🏆','🌐','🌿','⭐','🎪','🧩','🏷️','💎',
];

const BUILTIN_MODULE_ICONS: Record<string, string> = {
  customers: '👤', staffs: '🧑‍💼', teams: '👥', sites: '📍',
  workorders: '🔧', quotations: '📄', services: '⚙️', categories: '🏷️',
};

/* ── Builder field type ───────────────────────────────────────────────────── */

interface BuilderField extends Omit<ICustomModuleField, 'order'> {
  _id:         string;   // stable React key
  _keyManual?: boolean;
}

function mkId() { return Math.random().toString(36).slice(2); }

function blank(): BuilderField {
  return { _id: mkId(), key: '', label: '', fieldType: 'text', required: false, options: [], meta: {} };
}

function labelToKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
}

/* ── InlineOptionsEditor ──────────────────────────────────────────────────── */

function InlineOptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    onChange(next);
  };

  const add = () => {
    onChange([...options, '']);
    setTimeout(() => inputRefs.current[options.length]?.focus(), 0);
  };

  const remove = (i: number) => {
    onChange(options.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500 mb-1">Options</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
          <input
            ref={(el) => { inputRefs.current[i] = el; }}
            value={opt}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(); }
              if (e.key === 'Backspace' && opt === '' && options.length > 1) { e.preventDefault(); remove(i); inputRefs.current[Math.max(0, i - 1)]?.focus(); }
            }}
            placeholder={`Option ${i + 1}`}
            className="flex-1 text-sm border-0 border-b border-gray-200 focus:border-brand-400 focus:outline-none py-0.5 bg-transparent"
          />
          <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1">
        + Add option
      </button>
    </div>
  );
}

/* ── CascadeTreeEditor ────────────────────────────────────────────────────── */

function nodeSet(tree: CascadeNode[], path: number[], name: string): CascadeNode[] {
  if (path.length === 0) return tree;
  return tree.map((n, i) =>
    i !== path[0] ? n :
    path.length === 1 ? { ...n, name } :
    { ...n, children: nodeSet(n.children, path.slice(1), name) }
  );
}

function nodeAdd(tree: CascadeNode[], path: number[]): CascadeNode[] {
  if (path.length === 0) return [...tree, { name: '', children: [] }];
  return tree.map((n, i) =>
    i !== path[0] ? n : { ...n, children: nodeAdd(n.children, path.slice(1)) }
  );
}

function nodeDel(tree: CascadeNode[], path: number[]): CascadeNode[] {
  if (path.length === 1) return tree.filter((_, i) => i !== path[0]);
  return tree.map((n, i) =>
    i !== path[0] ? n : { ...n, children: nodeDel(n.children, path.slice(1)) }
  );
}

const CASCADE_DEPTH_STYLES = [
  { border: 'border-indigo-200', bg: 'bg-white',      labelCls: 'bg-indigo-100 text-indigo-700', label: 'Category',    btn: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50', addLabel: 'Add Category'    },
  { border: 'border-blue-200',   bg: 'bg-blue-50/50', labelCls: 'bg-blue-100 text-blue-700',    label: 'Subcategory', btn: 'border-blue-300 text-blue-700 hover:bg-blue-50',       addLabel: 'Add Subcategory' },
  { border: 'border-sky-200',    bg: 'bg-sky-50/50',  labelCls: 'bg-sky-100 text-sky-700',      label: 'Sub-level',   btn: 'border-sky-300 text-sky-700 hover:bg-sky-50',         addLabel: 'Add Sub-level'   },
  { border: 'border-gray-200',   bg: 'bg-gray-50',    labelCls: 'bg-gray-100 text-gray-600',    label: 'Level',       btn: 'border-gray-300 text-gray-600 hover:bg-gray-100',     addLabel: 'Add Item'        },
];

function CascadeTreeEditor({
  tree,
  onChange,
}: {
  tree: CascadeNode[];
  onChange: (t: CascadeNode[]) => void;
}) {
  function renderLevel(nodes: CascadeNode[], path: number[], depth: number): React.ReactNode {
    const s = CASCADE_DEPTH_STYLES[Math.min(depth, CASCADE_DEPTH_STYLES.length - 1)];
    return (
      <div className={depth === 0 ? 'space-y-2' : 'mt-1.5 ml-3 space-y-1.5 pl-2 border-l-2 border-gray-100'}>
        {nodes.map((node, i) => {
          const nPath = [...path, i];
          return (
            <div key={i} className={`border ${s.border} ${s.bg} rounded-lg overflow-hidden`}>
              {/* Node row */}
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${s.labelCls}`}>
                  {s.label}
                </span>
                <input
                  autoFocus={node.name === ''}
                  value={node.name}
                  onChange={(e) => onChange(nodeSet(tree, nPath, e.target.value))}
                  placeholder={`${s.label} name…`}
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none min-w-0 placeholder-gray-300"
                />
                <button
                  type="button"
                  title="Add child"
                  onClick={() => onChange(nodeAdd(tree, nPath))}
                  className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${s.btn}`}
                >
                  + Sub
                </button>
                <button
                  type="button"
                  onClick={() => onChange(nodeDel(tree, nPath))}
                  className="shrink-0 text-gray-300 hover:text-red-400"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Children */}
              {node.children.length > 0 && (
                <div className="px-2 pb-2">
                  {renderLevel(node.children, nPath, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
        {/* Add at this level */}
        <button
          type="button"
          onClick={() => onChange(nodeAdd(tree, path))}
          className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed ${s.btn}`}
        >
          <PlusIcon className="h-3 w-3" />
          {s.addLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">Category Tree</p>
      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 max-h-72 overflow-y-auto">
        {tree.length === 0 ? (
          <button
            type="button"
            onClick={() => onChange(nodeAdd(tree, []))}
            className="w-full text-sm text-indigo-600 border-2 border-dashed border-indigo-200 rounded-lg py-4 hover:bg-indigo-50 transition-colors font-medium"
          >
            + Add first category
          </button>
        ) : (
          renderLevel(tree, [], 0)
        )}
      </div>
    </div>
  );
}

/* ── TypePickerPopup ──────────────────────────────────────────────────────── */

function TypePickerPopup({ current, onSelect, onClose }: {
  current: CustomModuleFieldType;
  onSelect: (t: CustomModuleFieldType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
    >
      {FIELD_TYPE_GROUPS.map((g) => (
        <div key={g.label} className="px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{g.label}</p>
          <div className="grid grid-cols-2 gap-1">
            {g.types.map((t) => (
              <button
                key={t.value}
                onClick={() => { onSelect(t.value); onClose(); }}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                  current === t.value
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {current === t.value && <CheckIcon className="h-3 w-3 shrink-0" />}
                {current !== t.value && <span className="w-3" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── FieldCard ────────────────────────────────────────────────────────────── */

function FieldCard({
  field, active, onActivate, onDone, onChange, onRemove,
  onDragStart, onDragEnter, onDragEnd, customModules = [],
}: {
  field:         BuilderField;
  active:        boolean;
  onActivate:    () => void;
  onDone:        () => void;
  onChange:      (patch: Partial<BuilderField>) => void;
  onRemove:      () => void;
  onDragStart:   () => void;
  onDragEnter:   () => void;
  onDragEnd:     () => void;
  customModules: { slug: string; name: string }[];
}) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editKey,        setEditKey]        = useState(false);
  const group = typeGroup(field.fieldType);

  if (!active) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onClick={onActivate}
        className="group flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer"
      >
        <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-lg leading-none select-none" title="Drag to reorder">⠿</span>
        <span className="flex-1 text-sm text-gray-700 truncate">
          {field.label || <span className="text-gray-400 italic">Untitled field</span>}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GROUP_BADGE[group]}`}>
          {typeLabel(field.fieldType)}
        </span>
        <label
          className="flex items-center gap-1 text-xs text-gray-500 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
          />
          Req
        </label>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 border-brand-300 shadow-md border-l-[5px] ${GROUP_COLOR[group]} transition-all`}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="p-4 space-y-3">
        {/* Label */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Field Label</label>
          <input
            autoFocus
            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              const patch: Partial<BuilderField> = { label };
              if (!field._keyManual) patch.key = labelToKey(label);
              onChange(patch);
            }}
            placeholder="Enter field label…"
          />
        </div>

        {/* Key pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Key:</span>
          {editKey ? (
            <input
              autoFocus
              className="text-xs font-mono border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value, _keyManual: true } as any)}
              onBlur={() => setEditKey(false)}
              placeholder="field_key"
            />
          ) : (
            <button
              onClick={() => setEditKey(true)}
              className="text-xs font-mono bg-gray-100 text-gray-600 rounded px-2 py-0.5 hover:bg-gray-200 transition-colors"
            >
              {field.key || 'auto'}
            </button>
          )}
        </div>

        {/* Type picker */}
        <div className="relative">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Field Type</label>
          <button
            onClick={() => setShowTypePicker((p) => !p)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors w-full text-left ${GROUP_BADGE[group]} border-transparent`}
          >
            <span className="flex-1">{typeLabel(field.fieldType)}</span>
            <ChevronUpIcon className={`h-3.5 w-3.5 transition-transform ${showTypePicker ? '' : 'rotate-180'}`} />
          </button>
          {showTypePicker && (
            <TypePickerPopup
              current={field.fieldType}
              onSelect={(t) => {
                onChange({ fieldType: t, options: [], meta: {} });
                setShowTypePicker(false);
              }}
              onClose={() => setShowTypePicker(false)}
            />
          )}
        </div>

        {/* Type-specific config */}
        {(field.fieldType === 'select' || field.fieldType === 'multiselect') && (
          <InlineOptionsEditor
            options={field.options ?? []}
            onChange={(opts) => onChange({ options: opts })}
          />
        )}

        {field.fieldType === 'relationship' && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Links to Module</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={field.meta?.targetModule ?? ''}
                onChange={(e) => onChange({ meta: { ...field.meta, targetModule: e.target.value, subFields: [] } })}
              >
                <option value="">Select module…</option>
                <optgroup label="Built-in Modules">
                  {RELATIONSHIP_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                {customModules.length > 0 && (
                  <optgroup label="Custom Modules">
                    {customModules.map((m) => (
                      <option key={m.slug} value={m.slug}>{m.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {(() => {
              const target    = field.meta?.targetModule ?? '';
              const available = RELATIONSHIP_AVAILABLE_FIELDS[target] ?? [];
              const selected  = field.meta?.subFields ?? [];
              if (!target || available.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">
                    Sub-fields to show in table &amp; export
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {available.map((af) => {
                      const checked = selected.includes(af.key);
                      return (
                        <label key={af.key} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selected.filter((k) => k !== af.key)
                                : [...selected, af.key];
                              onChange({ meta: { ...field.meta, subFields: next } });
                            }}
                            className="rounded border-gray-300 accent-brand-600"
                          />
                          {af.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {field.fieldType === 'rating' && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Max Stars</label>
            <input
              type="number"
              min={3} max={10}
              className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={(field.meta as any)?.maxStars ?? 5}
              onChange={(e) => onChange({ meta: { ...field.meta, maxStars: parseInt(e.target.value) || 5 } as any })}
            />
          </div>
        )}

        {field.fieldType === 'categoryselect' && (() => {
          const tree       = field.meta?.cascadeTree ?? [];
          const levelNames = field.meta?.levelNames  ?? [];
          const defaults   = ['Category', 'Subcategory', 'Sub-level', 'Level 4', 'Level 5'];

          function calcDepth(nodes: CascadeNode[]): number {
            if (!nodes.length) return 0;
            return 1 + Math.max(...nodes.map((n) => calcDepth(n.children)));
          }
          const depth = calcDepth(tree);

          return (
            <>
              <CascadeTreeEditor
                tree={tree}
                onChange={(t) => onChange({ meta: { ...field.meta, cascadeTree: t } })}
              />
              {depth > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Level Labels <span className="text-gray-400 font-normal">(rename each level)</span></p>
                  <div className="space-y-1">
                    {Array.from({ length: depth }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0 w-14">Level {i + 1}</span>
                        <input
                          value={levelNames[i] ?? ''}
                          placeholder={defaults[Math.min(i, defaults.length - 1)]}
                          onChange={(e) => {
                            const next = [...levelNames];
                            next[i] = e.target.value;
                            onChange({ meta: { ...field.meta, levelNames: next } });
                          }}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {(field.fieldType === 'image' || field.fieldType === 'images') && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            📎 Supports JPG, PNG, PDF up to 5 MB.
            {field.fieldType === 'images' ? ' Multiple files allowed.' : ' Single file.'}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
          />
          Required field
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Remove
          </button>
          <button
            onClick={onDone}
            className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── TypePalette (right panel — field types only) ─────────────────────────── */

function TypePalette({ onAdd }: { onAdd: (type: CustomModuleFieldType) => void }) {
  return (
    <div className="w-44 shrink-0 bg-gray-50 border-l border-gray-200 overflow-y-auto py-4 px-3 space-y-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Field Types</p>
      {FIELD_TYPE_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">{g.label}</p>
          <div className="space-y-1">
            {g.types.map((t) => (
              <div
                key={t.value}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('fieldType', t.value)}
                onClick={() => onAdd(t.value)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing transition-colors ${GROUP_BADGE[g.types[0].group]} hover:opacity-90 select-none`}
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function CustomModuleBuilderPage() {
  const { data: modules = [], isLoading } = useCustomModulesQuery();
  const createMutation = useCustomModuleCreate();
  const updateMutation = useCustomModuleUpdate();
  const deleteMutation = useCustomModuleDelete();

  const [selectedId,  setSelectedId]  = useState<string | 'new' | null>(null);
  const [delTarget,   setDelTarget]   = useState<CustomModuleDef | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [activeField, setActiveField] = useState<string | null>(null);

  // Module info
  const [name,          setName]          = useState('');
  const [singularName,  setSingularName]  = useState('');
  const [icon,          setIcon]          = useState('📋');
  const [color,         setColor]         = useState('#6366f1');
  const [showInSidebar, setShowInSidebar] = useState(true);
  const [menuOrder,     setMenuOrder]     = useState(0);

  // Fields
  const [fields, setFields] = useState<BuilderField[]>([blank()]);

  // Drag state
  const dragSrc = useRef<number | null>(null);

  /* Load selected module */
  useEffect(() => {
    if (selectedId === 'new' || selectedId === null) {
      setName(''); setSingularName(''); setIcon('📋'); setColor('#6366f1');
      setShowInSidebar(true); setMenuOrder(0);
      setFields([blank()]); setActiveField(null); setSaveError('');
      return;
    }
    const mod = modules.find((m) => m._id === selectedId);
    if (!mod) return;
    setName(mod.name); setSingularName(mod.singularName);
    setIcon(mod.icon ?? '📋'); setColor(mod.color ?? '#6366f1');
    setShowInSidebar(mod.showInSidebar); setMenuOrder(mod.menuOrder ?? 0);
    setFields(
      mod.fields.length > 0
        ? mod.fields.map((f) => ({ ...f, _id: mkId() }))
        : [blank()]
    );
    setActiveField(null); setSaveError('');
  }, [selectedId, modules]);

  const updateField = (id: string, patch: Partial<BuilderField>) => {
    setFields((prev) => prev.map((f) => (f._id === id ? { ...f, ...patch } : f)));
  };

  const addField = (type: CustomModuleFieldType = 'text', preset?: Partial<BuilderField>) => {
    const f = { ...blank(), fieldType: type, ...preset };
    setFields((prev) => [...prev, f]);
    setActiveField(f._id);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id));
    if (activeField === id) setActiveField(null);
  };

  /* Save */
  const handleSave = async () => {
    if (!name.trim()) { setSaveError('Module name is required.'); return; }
    const builtFields = fields
      .filter((f) => f.label.trim())
      .map((f, i) => ({
        key:       f.key || labelToKey(f.label) || `field_${i + 1}`,
        label:     f.label,
        fieldType: f.fieldType,
        required:  f.required ?? false,
        options:   f.options ?? [],
        meta:      f.meta ?? {},
        order:     i,
      }));

    setSaving(true); setSaveError('');
    try {
      const dto = { name, singularName: singularName || name, icon, color, showInSidebar, menuOrder, fields: builtFields };
      if (selectedId === 'new' || selectedId === null) {
        await createMutation.mutateAsync(dto);
        setSelectedId(null);
      } else {
        await updateMutation.mutateAsync({ id: selectedId, data: dto });
      }
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    await deleteMutation.mutateAsync(delTarget._id);
    setDelTarget(null); setSelectedId(null);
  };

  /* Canvas drop */
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const moduleLink = e.dataTransfer.getData('moduleLink');
    if (moduleLink) {
      const [slug, label] = moduleLink.split('|');
      addField('relationship', {
        label,
        key: slug.replace(/-/g, '_'),
        meta: { targetModule: slug },
      });
      return;
    }
    const type = e.dataTransfer.getData('fieldType') as CustomModuleFieldType;
    if (type) addField(type);
  };

  const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  return (
    <div className="flex h-full">
      {/* ── Left Panel: module list ─────────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-2">
          <Cog6ToothIcon className="h-5 w-5 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Custom Modules</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* ── Custom modules list ─────────────────────────────────────── */}
          <div className="py-2">
            {isLoading && <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>}
            {!isLoading && modules.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400">No modules yet. Create your first one.</p>
            )}
            {modules.map((mod) => (
              <div
                key={mod._id}
                className={`group flex items-center gap-2 px-3 py-2 transition-colors text-sm ${
                  selectedId === mod._id
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <button
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  onClick={() => setSelectedId(mod._id)}
                >
                  <span className="text-base leading-none shrink-0">{mod.icon}</span>
                  <span className="truncate">{mod.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDelTarget(mod); }}
                  className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete module"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Modules palette (drag to add relationship fields) ────────── */}
          <div className="border-t border-gray-200 pt-3 pb-2 px-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Modules</p>
            <div className="space-y-1">
              {RELATIONSHIP_TARGETS.map((t) => (
                <div
                  key={t.value}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('moduleLink', `${t.value}|${t.label}`)}
                  onClick={() => selectedId !== null && addField('relationship', {
                    label: t.label,
                    key:   t.value,
                    meta:  { targetModule: t.value },
                  })}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing transition-colors bg-indigo-50 text-indigo-700 hover:opacity-80 select-none"
                >
                  <span className="leading-none">{BUILTIN_MODULE_ICONS[t.value] ?? '📋'}</span>
                  {t.label}
                </div>
              ))}
              {modules.filter((m) => m._id !== selectedId).map((m) => (
                <div
                  key={m.slug}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('moduleLink', `${m.slug}|${m.name}`)}
                  onClick={() => selectedId !== null && addField('relationship', {
                    label: m.name,
                    key:   m.slug.replace(/-/g, '_'),
                    meta:  { targetModule: m.slug },
                  })}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing transition-colors bg-violet-50 text-violet-700 hover:opacity-80 select-none"
                >
                  <span className="leading-none">{m.icon ?? '📋'}</span>
                  {m.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setSelectedId('new')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Module
          </button>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      {selectedId === null && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <span className="text-5xl">📋</span>
          <p className="text-gray-600 font-medium">Select a module to edit, or create a new one</p>
          <p className="text-xs text-gray-400 max-w-xs">Custom modules appear in the sidebar with full CRUD — table, form, import/export</p>
        </div>
      )}

      {selectedId !== null && (
        <>
          {/* ── Main editor ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

              {/* Module Info */}
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Module Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Module Name (plural) *</label>
                    <input className={inp} value={name} onChange={(e) => {
                      setName(e.target.value);
                      if (!singularName) setSingularName(e.target.value.replace(/s$/i, ''));
                    }} placeholder="e.g. Vehicle Inspections" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Singular Name</label>
                    <input className={inp} value={singularName} onChange={(e) => setSingularName(e.target.value)} placeholder="e.g. Vehicle Inspection" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-2">Icon (emoji)</label>
                    <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2 mb-2 bg-white">
                      <div className="grid grid-cols-10 gap-1">
                        {PRESET_ICONS.map((em) => (
                          <button key={em} type="button" onClick={() => setIcon(em)}
                            className={`text-xl p-1 rounded-lg transition-colors aspect-square flex items-center justify-center ${icon === em ? 'ring-2 ring-brand-500 bg-brand-50' : 'hover:bg-gray-100'}`}
                          >{em}</button>
                        ))}
                      </div>
                    </div>
                    <input className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Or type emoji" maxLength={4} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
                      <input className={`${inp} flex-1`} value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Menu Order</label>
                    <input type="number" className={inp} value={menuOrder} onChange={(e) => setMenuOrder(parseInt(e.target.value) || 0)} min={0} />
                  </div>
                  <div className="flex items-center col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showInSidebar} onChange={(e) => setShowInSidebar(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
                      <span className="text-sm text-gray-700">Show in sidebar</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Field Builder Canvas */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Form Fields</h3>
                  <p className="text-xs text-gray-400">Drag to reorder · Click field to edit</p>
                </div>

                <div
                  className="space-y-2 min-h-[80px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleCanvasDrop}
                >
                  {fields.map((f, idx) => (
                    <FieldCard
                      key={f._id}
                      field={f}
                      active={activeField === f._id}
                      onActivate={() => setActiveField(f._id)}
                      onDone={() => setActiveField(null)}
                      onChange={(patch) => updateField(f._id, patch)}
                      onRemove={() => removeField(f._id)}
                      onDragStart={() => { dragSrc.current = idx; }}
                      onDragEnter={() => {
                        if (dragSrc.current === null || dragSrc.current === idx) return;
                        const from = dragSrc.current;
                        dragSrc.current = idx;
                        setFields((prev) => {
                          const arr = [...prev];
                          const [moved] = arr.splice(from, 1);
                          arr.splice(idx, 0, moved);
                          return arr;
                        });
                      }}
                      onDragEnd={() => { dragSrc.current = null; }}
                      customModules={modules
                        .filter((m) => m._id !== selectedId)
                        .map((m) => ({ slug: m.slug, name: m.name }))}
                    />
                  ))}

                  {fields.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
                      Drag a field type from the right panel, or click "+ Add Field"
                    </div>
                  )}
                </div>

                <button
                  onClick={() => addField('text')}
                  className="mt-3 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Field
                </button>
              </section>

              {/* Save / Delete */}
              <section className="flex items-center gap-3 pb-10">
                {saveError && <p className="text-sm text-red-600 flex-1">{saveError}</p>}
                <div className="flex items-center gap-3 ml-auto">
                  {selectedId !== 'new' && (
                    <button
                      onClick={() => { const mod = modules.find((m) => m._id === selectedId); if (mod) setDelTarget(mod); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Module
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : selectedId === 'new' ? 'Create Module' : 'Save Changes'}
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* ── Type Palette (right side) ────────────────────────────────── */}
          <TypePalette onAdd={addField} />
        </>
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name}
          onClose={() => setDelTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
