import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PlusIcon, MagnifyingGlassIcon, Squares2X2Icon, TableCellsIcon,
  XMarkIcon, BriefcaseIcon, ChevronDownIcon, CheckIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
  useDealsQuery, useDealCreate, useDealUpdate,
  useDealDelete, useDealUpdateStage,
} from '../../../modules/native-crm/queries/deals.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { RecordLockBanner } from '../../../components/native-crm/RecordLockBanner';
import { usePipelineStages, type PipelineStage } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useCustomFieldsQuery } from '../../../modules/native-crm/queries/custom-fields.queries';
import { useCustomFormTemplatesQuery } from '../../../modules/native-crm/queries/custom-form-templates.queries';
import CustomFieldRenderer from '../../../modules/native-crm/shared/CustomFieldRenderer';
import RecordTimeline from '../../../modules/native-crm/shared/RecordTimeline';
import ColumnEditor from '../../../modules/crm/shared/ColumnEditor';
import { fmtVal } from '../../../modules/crm/shared/FileActionsDropdown';
import type { FieldConfig } from '../../../modules/crm/shared/types/crm.types';

// ─── Constants ────────────────────────────────────────────────────────────────

// Falls back to this while Pipeline Settings' 'deal' stages are loading or
// unconfigured — the tenant's own configured stages (usePipelineStages)
// take over the moment they load, same convention LeadsPage.tsx already uses.
const DEFAULT_DEAL_STAGES: PipelineStage[] = [
  { key: 'prospect',    label: 'Prospect',    color: '#6366f1', order: 0, isTerminal: false, outcome: null,  isActive: true },
  { key: 'qualified',   label: 'Qualified',   color: '#0ea5e9', order: 1, isTerminal: false, outcome: null,  isActive: true },
  { key: 'proposal',    label: 'Proposal',    color: '#f59e0b', order: 2, isTerminal: false, outcome: null,  isActive: true },
  { key: 'negotiation', label: 'Negotiation', color: '#f97316', order: 3, isTerminal: false, outcome: null,  isActive: true },
  { key: 'closed_won',  label: 'Won',         color: '#10b981', order: 4, isTerminal: true,  outcome: 'won',  isActive: true },
  { key: 'closed_lost', label: 'Lost',        color: '#ef4444', order: 5, isTerminal: true,  outcome: 'lost', isActive: true },
];

const EMPTY_FORM = {
  title: '', amount: '', currency: 'INR', stage: 'prospect',
  contactName: '', companyName: '', closeDate: '', notes: '',
  customFields: {} as Record<string, any>,
};

function formatCurrency(n?: number) {
  if (!n) return '';
  return '₹' + n.toLocaleString('en-IN');
}

// Optional extra list-view columns, same "Edit Columns" mechanism
// LeadsPage.tsx already has — merged with the tenant's custom fields inside
// the component once they load (see allExtraColumns below).
const DEAL_EXTRA_COLUMNS: FieldConfig[] = [
  { key: 'currency',        label: 'Currency',        type: 'text' },
  { key: 'assignedStaffId', label: 'Assigned To',     type: 'text' },
  { key: 'notes',           label: 'Notes',           type: 'text' },
  { key: 'tags',            label: 'Tags',            type: 'text' },
  { key: 'createdAt',       label: 'Created At',      type: 'date' },
];

const DEAL_SORT_FIELDS: { key: string; label: string }[] = [
  { key: 'createdAt', label: 'Created' },
  { key: 'title',     label: 'Title' },
  { key: 'amount',    label: 'Amount' },
  { key: 'closeDate', label: 'Close Date' },
];

/** Same resolution rule as LeadsPage.tsx's own getFieldValue — a plain key
 * reads directly, `customFields.<key>` reads out of the record's own
 * customFields sub-object. */
function getFieldValue(record: any, key: string): any {
  if (key.startsWith('customFields.')) return record.customFields?.[key.slice('customFields.'.length)];
  return record[key];
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  stageMeta,
  onDragStart,
  onClick,
}: {
  deal: any;
  stageMeta?: PipelineStage;
  onDragStart: (e: React.DragEvent, deal: any) => void;
  onClick: (deal: any) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal)}
      onClick={() => onClick(deal)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
    >
      <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight mb-1.5 line-clamp-2">{deal.title}</p>
      {deal.companyName && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{deal.companyName}</p>
      )}
      {deal.contactName && (
        <p className="text-xs text-gray-400 mb-2">{deal.contactName}</p>
      )}
      <div className="flex items-center justify-between mt-auto">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: stageMeta?.color ?? '#6b7280' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageMeta?.color ?? '#6b7280' }} />
          {stageMeta?.label ?? deal.stage}
        </span>
        {deal.amount ? (
          <span className="text-xs font-bold text-green-600 dark:text-green-400">{formatCurrency(deal.amount)}</span>
        ) : null}
      </div>
      {deal.closeDate && (
        <p className="text-[10px] text-gray-400 mt-1">
          Close: {new Date(deal.closeDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, deals, onDragStart, onDrop, onCardClick,
}: {
  stage: PipelineStage;
  deals: any[];
  onDragStart: (e: React.DragEvent, deal: any) => void;
  onDrop: (e: React.DragEvent, stageKey: string) => void;
  onCardClick: (deal: any) => void;
}) {
  const [over, setOver] = useState(false);
  const totalValue = deals.reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{stage.label}</span>
        <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
          {deals.length}
        </span>
      </div>
      {totalValue > 0 && (
        <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 px-1 mb-1">
          {formatCurrency(totalValue)}
        </p>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { setOver(false); onDrop(e, stage.key); }}
        className={`flex-1 min-h-[120px] rounded-xl p-2 flex flex-col gap-2 transition-colors
          ${over ? 'bg-brand-50 dark:bg-gray-700 ring-2 ring-brand-300' : 'bg-gray-50 dark:bg-gray-900'}`}
      >
        {deals.map((deal) => (
          <DealCard key={deal._id} deal={deal} stageMeta={stage} onDragStart={onDragStart} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function inp(extra?: string) {
  return `w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 ${extra ?? ''}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Customer Picker (searchable dropdown) ────────────────────────────────────

function CustomerPicker({ contactName, companyName, onSelect }: {
  contactName: string;
  companyName: string;
  onSelect: (name: string, company: string) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data } = useCustomersListQuery({ search: search || undefined, limit: 50 });
  const customers = data?.items ?? [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (cust: any) => {
    onSelect(cust.name ?? '', cust.company ?? '');
    setOpen(false);
    setSearch('');
  };

  const displayValue = contactName
    ? `${contactName}${companyName ? ` — ${companyName}` : ''}`
    : '';

  return (
    <div ref={wrapRef} className="col-span-2 relative">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        Customer (Contact &amp; Company)
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inp()} flex items-center justify-between text-left`}
      >
        <span className={displayValue ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
          {displayValue || 'Search and select a customer…'}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl overflow-hidden">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {customers.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-gray-400">No customers found</li>
            )}
            {customers.map((cust: any) => {
              const selected = cust.name === contactName;
              return (
                <li
                  key={cust._id}
                  onMouseDown={() => handleSelect(cust)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors
                    ${selected ? 'bg-brand-50 dark:bg-gray-700' : ''}`}
                >
                  <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-300 flex-shrink-0">
                    {(cust.name ?? 'C')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cust.name}</p>
                    {cust.company && <p className="text-xs text-gray-400 truncate">{cust.company}</p>}
                  </div>
                  {selected && <CheckIcon className="h-4 w-4 text-brand-600 ml-auto flex-shrink-0" />}
                </li>
              );
            })}
          </ul>

          {/* Manual entry option */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-2">
            <button
              type="button"
              onMouseDown={() => {
                if (search) { onSelect(search, ''); setOpen(false); setSearch(''); }
              }}
              className="w-full text-left text-xs text-gray-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors"
            >
              {search ? `Use "${search}" as contact name` : 'Type above to enter a custom name'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deal Form ────────────────────────────────────────────────────────────────

function DealForm({ form, setForm, onSubmit, saving, submitLabel }: {
  form: any; setForm: (f: any) => void;
  onSubmit: () => void; saving: boolean; submitLabel: string;
}) {
  const { stages } = usePipelineStages('deal', DEFAULT_DEAL_STAGES);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const { data: customFields = [] } = useCustomFieldsQuery('deals');
  const activeCustomFields = customFields.filter((cf) => cf.isActive);
  const { data: formTemplates = [] } = useCustomFormTemplatesQuery();
  const setCustomField = (key: string, val: any) =>
    setForm((p: any) => ({ ...p, customFields: { ...p.customFields, [key]: val } }));

  // Seed any active field the current form doesn't already have a value for
  // (new create, or a field added to the tenant's config since this deal was
  // last saved) — same convention ContractFormDrawer.tsx already uses, keeps
  // every input controlled from the first render instead of flipping
  // uncontrolled->controlled once a value is typed.
  useEffect(() => {
    setForm((p: any) => {
      const cf = { ...p.customFields };
      let changed = false;
      activeCustomFields.forEach((f) => {
        if (cf[f.fieldKey] === undefined) { cf[f.fieldKey] = ''; changed = true; }
      });
      return changed ? { ...p, customFields: cf } : p;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFields.length]);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Deal Title *">
        <input className={inp()} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Annual Maintenance Contract" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)">
          <input className={inp()} type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Stage">
          <select className={inp()} value={form.stage} onChange={(e) => set('stage', e.target.value)}>
            {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>

        {/* Customer picker — fills contactName + companyName together */}
        <CustomerPicker
          contactName={form.contactName}
          companyName={form.companyName}
          onSelect={(name, company) => setForm((p: any) => ({ ...p, contactName: name, companyName: company }))}
        />

        <div className="col-span-2">
          <Field label="Expected Close Date">
            <input className={inp()} type="date" value={form.closeDate} onChange={(e) => set('closeDate', e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes">
            <textarea className={inp()} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Deal notes..." />
          </Field>
        </div>
      </div>

      {activeCustomFields.length > 0 && (
        <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-3">Custom Fields</p>
          <div className="flex flex-col gap-3">
            {activeCustomFields.map((cf) => (
              <Field key={cf.fieldKey} label={`${cf.label}${cf.required ? ' *' : ''}`}>
                <CustomFieldRenderer
                  field={cf}
                  value={form.customFields?.[cf.fieldKey]}
                  onChange={(val) => setCustomField(cf.fieldKey, val)}
                  templateFields={
                    cf.fieldType === 'custom_form'
                      ? formTemplates.find((t) => t._id === cf.formTemplateId)?.fields
                      : undefined
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={saving || !form.title?.trim()}
        className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

// ─── Deal Detail Panel ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white break-words">{String(value)}</span>
    </div>
  );
}

function DealDetailPanel({
  deal, onClose, onEdit, onUnlocked,
}: {
  deal: any; onClose: () => void; onEdit: (deal: any) => void; onUnlocked: () => void;
}) {
  const { stages } = usePipelineStages('deal', DEFAULT_DEAL_STAGES);
  const stageMeta = stages.find((s) => s.key === deal.stage);
  const { data: customFields = [] } = useCustomFieldsQuery('deals');
  const activeCustomFields = customFields.filter((cf) => cf.isActive);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageMeta?.color ?? '#6b7280' }} />
            <span className="text-xs font-semibold" style={{ color: stageMeta?.color ?? '#6b7280' }}>
              {stageMeta?.label ?? deal.stage}
            </span>
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{deal.title}</h2>
          {deal.companyName && <p className="text-sm text-gray-500">{deal.companyName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onEdit(deal)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Edit
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <RecordLockBanner record={deal} entityModule="deals" onUnlocked={onUnlocked} />
        {deal.amount && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 mb-0.5">Deal Value</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(deal.amount)}</p>
          </div>
        )}
        <InfoRow label="Contact"    value={deal.contactName} />
        <InfoRow label="Company"    value={deal.companyName} />
        <InfoRow label="Close Date" value={deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-IN') : undefined} />
        <InfoRow label="Currency"   value={deal.currency} />
        {deal.notes && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">{deal.notes}</p>
          </>
        )}

        {activeCustomFields.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Custom Fields</p>
            {activeCustomFields.map((cf) => {
              const val = deal.customFields?.[cf.fieldKey];
              const display = Array.isArray(val) ? val.join(', ') : (val && typeof val === 'object' ? JSON.stringify(val) : val);
              return <InfoRow key={cf.fieldKey} label={cf.label} value={display} />;
            })}
          </>
        )}

        {/* Stage changer */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Move to Stage</p>
          <div className="flex flex-wrap gap-2">
            {stages.map((s) => (
              <span
                key={s.key}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold cursor-default
                  ${deal.stage === s.key
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                style={deal.stage === s.key ? { backgroundColor: s.color } : undefined}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Activity Timeline</p>
          <RecordTimeline entityModule="deal" entityId={deal._id} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [view,         setView]         = useState<'kanban'|'list'>('kanban');
  const [search,       setSearch]       = useState('');
  const [filterStage,  setFilterStage]  = useState('');
  const [panelMode,    setPanelMode]    = useState<'none'|'create'|'edit'|'detail'>('none');
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [form,         setForm]         = useState<any>({ ...EMPTY_FORM });
  const [saving,       setSaving]       = useState(false);
  const [showFilters,  setShowFilters]  = useState(false);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [extraVisibleKeys, setExtraVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('crm-cols-deals-extra');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  });
  const [sortBy,  setSortBy]  = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [customFieldFilterValues, setCustomFieldFilterValues] = useState<Record<string, string>>({});
  const dragDealRef = useRef<any>(null);

  const { data: mainCustomFields = [] } = useCustomFieldsQuery('deals');
  const activeCustomFields = mainCustomFields.filter((f) => f.isActive);
  const customFieldColumns: FieldConfig[] = activeCustomFields.map((f) => ({
    key: `customFields.${f.fieldKey}`, label: f.label, type: 'text',
  }));
  const allExtraColumns = [...DEAL_EXTRA_COLUMNS, ...customFieldColumns];
  const allSortFields = [...DEAL_SORT_FIELDS, ...customFieldColumns.map((c) => ({ key: c.key, label: c.label }))];
  const extraCols = extraVisibleKeys
    .map((k) => allExtraColumns.find((f) => f.key === k))
    .filter(Boolean) as FieldConfig[];
  const handleApplyExtraColumns = (keys: string[]) => {
    setExtraVisibleKeys(keys);
    try { localStorage.setItem('crm-cols-deals-extra', JSON.stringify(keys)); } catch {}
  };

  const customFieldFilterConditions = Object.entries(customFieldFilterValues)
    .filter(([, v]) => v.trim() !== '')
    .map(([key, value]) => ({ field: key, operator: 'contains' as const, value }));

  const { data, isLoading } = useDealsQuery({
    search: search || undefined, stage: filterStage || undefined,
    sortBy: sortBy || undefined, sortDir,
    customFieldFilters: customFieldFilterConditions.length > 0 ? JSON.stringify(customFieldFilterConditions) : undefined,
    limit: 500,
  });
  const deals = data?.items ?? [];

  const { stages } = usePipelineStages('deal', DEFAULT_DEAL_STAGES);

  const createMut = useDealCreate();
  const updateMut = useDealUpdate();
  const deleteMut = useDealDelete();
  const stageMut  = useDealUpdateStage();

  // Stats — "Won" is membership in any stage tagged outcome:'won', not a
  // hardcoded 'closed_won' string, so a tenant renaming that stage (or using
  // a different key entirely) doesn't silently break these numbers.
  const wonStageKeys = new Set(stages.filter((s) => s.outcome === 'won').map((s) => s.key));
  const totalValue = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const wonDeals   = deals.filter((d) => wonStageKeys.has(d.stage)).length;
  const wonValue   = deals.filter((d) => wonStageKeys.has(d.stage)).reduce((s, d) => s + (d.amount ?? 0), 0);

  // Kanban grouping
  const byStage = stages.reduce<Record<string, any[]>>((acc, s) => {
    acc[s.key] = deals.filter((d) => d.stage === s.key);
    return acc;
  }, {} as any);

  // Drag & Drop
  const handleDragStart = useCallback((e: React.DragEvent, deal: any) => {
    dragDealRef.current = deal;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const deal = dragDealRef.current;
    if (!deal || deal.stage === stageKey) return;
    stageMut.mutate({ id: deal._id, stage: stageKey });
    dragDealRef.current = null;
  }, [stageMut]);

  // Panel
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setPanelMode('create'); setSelectedDeal(null); };
  const openEdit   = (deal: any) => { setForm({ ...deal, amount: deal.amount ?? '', closeDate: deal.closeDate ? deal.closeDate.split('T')[0] : '' }); setSelectedDeal(deal); setPanelMode('edit'); };
  const openDetail = (deal: any) => { setSelectedDeal(deal); setPanelMode('detail'); };
  const closePanel = () => { setPanelMode('none'); setSelectedDeal(null); };

  const handleSubmit = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: form.amount ? Number(form.amount) : undefined };
      if (panelMode === 'create') {
        await createMut.mutateAsync(payload);
      } else if (panelMode === 'edit' && selectedDeal) {
        await updateMut.mutateAsync({ id: selectedDeal._id, data: payload });
      }
      closePanel();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deal: any) => {
    if (!confirm(`Delete deal "${deal.title}"?`)) return;
    await deleteMut.mutateAsync(deal._id);
    closePanel();
  };

  const panelOpen = panelMode !== 'none';

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${panelOpen ? 'mr-[420px]' : ''}`}>

        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 mr-2">
            <BriefcaseIcon className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Deals</h1>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{deals.length}</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-2 focus:outline-none"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="">All Stages</option>
            {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors
              ${showFilters ? 'border-brand-400 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" /> Sort
          </button>
          {view === 'list' && (
            <button onClick={() => setColumnEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Columns{extraCols.length > 0 ? ` (${extraCols.length})` : ''}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button onClick={() => setView('kanban')}
                className={`p-2 transition-colors ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}>
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50'}`}>
                <TableCellsIcon className="h-4 w-4" />
              </button>
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
              <PlusIcon className="h-4 w-4" /> New Deal
            </button>
          </div>
        </div>

        {/* Sort / custom-field filter bar */}
        {showFilters && (
          <div className="flex flex-col gap-2 px-5 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-gray-400">Sort:</span>
              <select className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">Default</option>
                {allSortFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              {sortBy && (
                <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              )}
              {(sortBy || Object.values(customFieldFilterValues).some((v) => v.trim())) && (
                <button onClick={() => { setSortBy(''); setCustomFieldFilterValues({}); }} className="text-xs text-red-500 hover:text-red-700">
                  Clear
                </button>
              )}
            </div>
            {activeCustomFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-50 dark:border-gray-800">
                <span className="text-xs text-gray-400">Custom fields:</span>
                {activeCustomFields.map((f) => (
                  <input
                    key={f.fieldKey}
                    placeholder={f.label}
                    value={customFieldFilterValues[`customFields.${f.fieldKey}`] ?? ''}
                    onChange={(e) => setCustomFieldFilterValues((prev) => ({ ...prev, [`customFields.${f.fieldKey}`]: e.target.value }))}
                    className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats bar */}
        {deals.length > 0 && (
          <div className="flex gap-3 px-5 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            {[
              { label: 'Total Deals',    value: String(deals.length),         color: 'text-blue-600'   },
              { label: 'Pipeline Value', value: formatCurrency(totalValue),   color: 'text-violet-600' },
              { label: 'Won Deals',      value: String(wonDeals),             color: 'text-emerald-600'},
              { label: 'Won Value',      value: formatCurrency(wonValue),     color: 'text-green-600'  },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-1.5 min-w-[120px]">
                <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
                <p className={`text-sm font-bold ${stat.color}`}>{stat.value || '₹0'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex gap-2">
                {[0,1,2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          ) : view === 'kanban' ? (
            <div className="flex gap-3 p-4 min-w-max h-full">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  deals={byStage[stage.key] ?? []}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onCardClick={openDetail}
                />
              ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Deal</th>
                      <th className="px-4 py-3 text-left font-semibold">Contact</th>
                      <th className="px-4 py-3 text-left font-semibold">Stage</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Close Date</th>
                      {extraCols.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left font-semibold">{col.label}</th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {deals.length === 0 && (
                      <tr><td colSpan={6 + extraCols.length} className="py-12 text-center text-gray-400">No deals found</td></tr>
                    )}
                    {deals.map((deal) => {
                      const s = stages.find((x) => x.key === deal.stage);
                      return (
                        <tr key={deal._id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => openDetail(deal)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white">{deal.title}</div>
                            {deal.companyName && <div className="text-xs text-gray-400">{deal.companyName}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{deal.contactName}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color ?? '#6b7280' }} />
                              {s?.label ?? deal.stage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-green-600">{formatCurrency(deal.amount)}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          {extraCols.map((col) => (
                            <td key={col.key} className="px-4 py-3 text-xs text-gray-500">
                              {fmtVal(getFieldValue(deal, col.key), col.type)}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(deal); }}
                              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 mr-1">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(deal); }}
                              className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Del</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in panel */}
      {panelOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-30 flex flex-col overflow-hidden">
          {(panelMode === 'create' || panelMode === 'edit') && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {panelMode === 'create' ? 'New Deal' : `Edit: ${selectedDeal?.title}`}
                </h2>
                <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {panelMode === 'edit' && selectedDeal?.isLocked && (
                  <div className="mb-4">
                    <RecordLockBanner record={selectedDeal} entityModule="deals" onUnlocked={closePanel} />
                  </div>
                )}
                <DealForm
                  form={form}
                  setForm={setForm}
                  onSubmit={handleSubmit}
                  saving={saving}
                  submitLabel={panelMode === 'create' ? 'Create Deal' : 'Save Changes'}
                />
                {panelMode === 'edit' && selectedDeal && (
                  <button onClick={() => handleDelete(selectedDeal)}
                    className="w-full mt-3 py-2 rounded-xl border border-red-300 text-red-600 text-sm hover:bg-red-50 transition-colors">
                    Delete Deal
                  </button>
                )}
              </div>
            </>
          )}

          {panelMode === 'detail' && selectedDeal && (
            <DealDetailPanel
              deal={selectedDeal}
              onClose={closePanel}
              onEdit={openEdit}
              onUnlocked={closePanel}
            />
          )}
        </div>
      )}

      {columnEditorOpen && (
        <ColumnEditor
          allFields={allExtraColumns}
          visibleKeys={extraVisibleKeys}
          onApply={handleApplyExtraColumns}
          onClose={() => setColumnEditorOpen(false)}
        />
      )}
    </div>
  );
}
