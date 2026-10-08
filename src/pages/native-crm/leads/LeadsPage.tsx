import { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, MagnifyingGlassIcon, Squares2X2Icon, TableCellsIcon,
  XMarkIcon, UserPlusIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon,
  ArrowRightCircleIcon, CheckCircleIcon, ChevronDownIcon,
  CurrencyRupeeIcon, TrophyIcon, ArrowTrendingUpIcon,
  AdjustmentsHorizontalIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FileActionsDropdown, { fmtVal } from '../../../modules/crm/shared/FileActionsDropdown';
import ColumnEditor from '../../../modules/crm/shared/ColumnEditor';
import type { FieldConfig } from '../../../modules/crm/shared/types/crm.types';
import {
  useLeadsQuery, useLeadCreate, useLeadUpdate,
  useLeadDelete, useLeadUpdateStage, useLeadQuery,
  useLeadsStatsQuery, useLeadConvertToContact,
  useLeadConvertToOpportunity, useLeadConvertToCustomer,
} from '../../../modules/native-crm/queries/leads.queries';
import RecordTimeline from '../../../modules/native-crm/shared/RecordTimeline';
import ActivityFeedPanel from '../../../modules/native-crm/shared/ActivityFeedPanel';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import { useUsersListQuery } from '../../../modules/native-crm/queries/users.queries';
import { usePipelineStages, type PipelineStage } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { RecordLockBanner } from '../../../components/native-crm/RecordLockBanner';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useBranchStore } from '../../../stores/branch.store';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomFieldsQuery } from '../../../modules/native-crm/queries/custom-fields.queries';
import { useCustomFormTemplatesQuery } from '../../../modules/native-crm/queries/custom-form-templates.queries';
import CustomFieldRenderer from '../../../modules/native-crm/shared/CustomFieldRenderer';

// ─── Constants ────────────────────────────────────────────────────────────────

// Today's defaults — used as the fallback while a tenant's own configured
// Lead pipeline (native-crm/pipeline-config) loads, or if they've never
// customized it. Kept identical to the backend's seed defaults so nothing
// visibly changes for tenants who haven't edited their pipeline.
const DEFAULT_LEAD_STAGES: PipelineStage[] = [
  { key: 'new',               label: 'New',               color: '#6366f1', order: 0, isTerminal: false, outcome: null,   isActive: true },
  { key: 'contacted',         label: 'Contacted',         color: '#0ea5e9', order: 1, isTerminal: false, outcome: null,   isActive: true },
  { key: 'qualified',         label: 'Qualified',         color: '#f59e0b', order: 2, isTerminal: false, outcome: null,   isActive: true },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', color: '#8b5cf6', order: 3, isTerminal: false, outcome: null,   isActive: true },
  { key: 'proposal_sent',     label: 'Proposal Sent',     color: '#ec4899', order: 4, isTerminal: false, outcome: null,   isActive: true },
  { key: 'negotiation',       label: 'Negotiation',       color: '#f97316', order: 5, isTerminal: false, outcome: null,   isActive: true },
  { key: 'won',               label: 'Won',               color: '#10b981', order: 6, isTerminal: true,  outcome: 'won',  isActive: true },
  { key: 'lost',              label: 'Lost',              color: '#ef4444', order: 7, isTerminal: true,  outcome: 'lost', isActive: true },
  { key: 'on_hold',           label: 'On Hold',           color: '#94a3b8', order: 8, isTerminal: false, outcome: null,   isActive: true },
  { key: 'disqualified',      label: 'Disqualified',      color: '#64748b', order: 9, isTerminal: true,  outcome: null,   isActive: true },
];

const SOURCES = [
  'website','landing_page','chatbot','whatsapp','facebook',
  'google','manual','csv','api','referral','other',
];

const RATINGS = ['hot','warm','cold'] as const;
const PRIORITIES = ['high','medium','low'] as const;
const INDUSTRIES = [
  'Technology','Manufacturing','Healthcare','Education','Finance',
  'Real Estate','Retail','Construction','Logistics','Other',
];

const RATING_COLORS: Record<string, string> = {
  hot:  'bg-red-500',
  warm: 'bg-orange-400',
  cold: 'bg-blue-400',
};

const SOURCE_COLORS: Record<string, string> = {
  website:      'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400',
  landing_page: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  chatbot:      'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  whatsapp:     'bg-success-500/15 text-success-700 dark:text-success-500',
  facebook:     'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  google:       'bg-danger-500/15 text-danger-700 dark:text-danger-500',
  manual:       'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',
  csv:          'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  api:          'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
  referral:     'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400',
  other:        'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', company: '', designation: '', industry: '',
  email: '', phone: '', mobile: '', whatsapp: '',
  address: '', city: '', state: '', country: '', postalCode: '',
  status: 'new', source: 'manual', rating: 'warm', priority: 'medium',
  score: 0, expectedRevenue: '', budget: '', leadOwner: '', leadOwnerStaffId: '',
  requirement: '', painPoints: '', notes: '',
  customFields: {} as Record<string, any>,
};

// Full field set — used by the File dropdown (Export Excel/CSV, Download
// Template, Import from File), same mechanism Deals/Categories/etc. already
// use, so a filled-in template round-trips correctly.
const LEAD_FIELD_CONFIG: FieldConfig[] = [
  { key: 'leadId',          label: 'Lead ID',          type: 'text' },
  { key: 'firstName',       label: 'First Name',       type: 'text' },
  { key: 'lastName',        label: 'Last Name',        type: 'text' },
  { key: 'company',         label: 'Company',          type: 'text' },
  { key: 'designation',     label: 'Designation',      type: 'text' },
  { key: 'email',           label: 'Email',            type: 'email' },
  { key: 'phone',           label: 'Phone',            type: 'phone' },
  { key: 'mobile',          label: 'Mobile',           type: 'phone' },
  { key: 'status',          label: 'Status',           type: 'text' },
  { key: 'source',          label: 'Source',           type: 'text' },
  { key: 'rating',          label: 'Rating',           type: 'text' },
  { key: 'priority',        label: 'Priority',         type: 'text' },
  { key: 'leadOwner',       label: 'Owner',            type: 'text' },
  { key: 'leadOwnerStaffId', label: 'Owner Staff ID',  type: 'text' },
  { key: 'city',            label: 'City',             type: 'text' },
  { key: 'state',           label: 'State',            type: 'text' },
  { key: 'country',         label: 'Country',          type: 'text' },
  { key: 'expectedRevenue', label: 'Expected Revenue', type: 'currency' },
  { key: 'tags',            label: 'Tags',             type: 'text' },
  { key: 'isConverted',     label: 'Converted',        type: 'text' },
  { key: 'createdAt',       label: 'Created At',       type: 'date' },
];

// Fields already visually represented by the list view's own rich columns
// (Lead/Contact/Source/Stage/Rating/Revenue) — excluded from the optional
// "Edit columns" extras so nothing shows twice.
const CORE_COVERED_KEYS = new Set([
  'leadId', 'firstName', 'lastName', 'company', 'email', 'phone',
  'status', 'source', 'rating', 'expectedRevenue',
]);
const LEAD_EXTRA_COLUMNS: FieldConfig[] = LEAD_FIELD_CONFIG.filter((f) => !CORE_COVERED_KEYS.has(f.key));

// Built-in fields a user can sort the list by — custom fields are appended
// to this dynamically inside the component, once their definitions load.
const LEAD_SORT_FIELDS: { key: string; label: string }[] = [
  { key: 'lastActivityAt', label: 'Last Activity' },
  { key: 'createdAt',      label: 'Created' },
  { key: 'firstName',      label: 'First Name' },
  { key: 'company',        label: 'Company' },
  { key: 'expectedRevenue',label: 'Expected Revenue' },
  { key: 'score',          label: 'Score' },
];

/** Resolves a FieldConfig's `key` against a record — a plain key reads
 * directly, a `customFields.<key>` key reads out of the record's own
 * customFields sub-object. Lets extraCols stay a flat list mixing built-in
 * and custom-field columns without the render code needing to know which
 * is which. */
function getFieldValue(record: any, key: string): any {
  if (key.startsWith('customFields.')) return record.customFields?.[key.slice('customFields.'.length)];
  return record[key];
}

// Leads has no bulk-selection UI — a stable empty Set so FileActionsDropdown
// always treats "all loaded leads" as the export/selection scope.
const EMPTY_SELECTION = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n?: number) {
  if (!n) return '';
  return '₹' + n.toLocaleString('en-IN');
}

function fullName(lead: any) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

/** The card's actual visual content — shared between the real sortable
 * card and the floating DragOverlay clone, so the thing following your
 * cursor while dragging looks pixel-identical to the thing that was
 * sitting in the column a moment ago. */
function LeadCardBody({ lead, onEditClick }: { lead: any; onEditClick?: (lead: any) => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-sm text-text-primary dark:text-white leading-tight">{fullName(lead)}</span>
        <div className="flex items-center gap-1 shrink-0">
          {onEditClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditClick(lead); }}
              title="Edit lead"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 -m-1 rounded-md text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-all duration-150"
            >
              <PencilSquareIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={`h-2.5 w-2.5 rounded-full mt-0.5 ${RATING_COLORS[lead.rating] ?? 'bg-black/[0.08] dark:bg-white/[0.1]'}`} title={lead.rating} />
        </div>
      </div>
      {lead.company && (
        <div className="flex items-center gap-1 text-xs text-text-muted mb-1">
          <BuildingOfficeIcon className="h-3 w-3" />
          <span className="truncate">{lead.company}</span>
        </div>
      )}
      {(lead.phone || lead.email) && (
        <div className="flex items-center gap-1 text-xs text-text-muted mb-2">
          {lead.phone
            ? <><PhoneIcon className="h-3 w-3" /><span>{lead.phone}</span></>
            : <><EnvelopeIcon className="h-3 w-3" /><span className="truncate">{lead.email}</span></>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[lead.source] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
          {(lead.source ?? '').replace(/_/g, ' ')}
        </span>
        {lead.expectedRevenue ? (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">{formatCurrency(lead.expectedRevenue)}</span>
        ) : null}
      </div>
      {lead.isConverted && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
          <CheckCircleIcon className="h-3 w-3" /> Converted
        </div>
      )}
    </>
  );
}

/** Real, in-column card — draggable via dnd-kit's sortable primitives
 * (pointer-tracked, not native HTML5 DnD), which is what makes the
 * Trello-style "other cards smoothly slide over to open a gap" effect
 * possible: dnd-kit knows the live cursor position the whole time, native
 * HTML5 drag events only fire at coarse dragenter/dragover boundaries. A
 * short activationConstraint distance (see the sensor setup below) means a
 * plain click still opens the detail view instead of every click being
 * mistaken for a drag. */
function LeadCard({
  lead, stageColor, onClick, onEditClick,
}: {
  lead: any;
  stageColor?: string;
  onClick: (lead: any) => void;
  onEditClick: (lead: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead._id,
    data: { stageKey: lead.status },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: stageColor || 'transparent',
    borderLeftWidth: 3,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(lead)}
      className={`group relative bg-surface rounded-xl border border-border pl-3 pr-3 py-3 cursor-grab active:cursor-grabbing select-none touch-none
        ${isDragging ? 'opacity-30' : 'shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-shadow duration-200 ease-out'}`}
    >
      <LeadCardBody lead={lead} onEditClick={onEditClick} />
    </div>
  );
}

/** The floating clone rendered inside <DragOverlay> — a plain, non-sortable
 * copy elevated well above the board (scale + rotate + heavy shadow), which
 * is the other half of the Trello feel: the card you're holding visually
 * detaches from the board and floats with the cursor, while its old slot
 * just shows a light placeholder gap (handled by the real card's own
 * isDragging opacity, above). */
function LeadCardDragPreview({ lead, stageColor }: { lead: any; stageColor?: string }) {
  return (
    <div
      style={{ borderLeftColor: stageColor || 'transparent', borderLeftWidth: 3 }}
      className="w-64 bg-surface rounded-xl border border-border pl-3 pr-3 py-3 shadow-2xl scale-105 rotate-2 cursor-grabbing"
    >
      <LeadCardBody lead={lead} />
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, leads, onCardClick, onEditClick, collapsed, onToggleCollapse,
}: {
  stage: PipelineStage;
  leads: any[];
  onCardClick: (lead: any) => void;
  onEditClick: (lead: any) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  // The column itself is a droppable zone (dropping into empty space below
  // the last card, or into an empty column) — separate from the individual
  // cards inside it, which are each their own sortable/droppable item via
  // LeadCard's own useSortable() call.
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stage.key}`, data: { stageKey: stage.key } });
  const leadIds = useMemo(() => leads.map((l) => l._id), [leads]);

  // Collapsed columns stay real drop targets (a lead can still be dropped
  // on a minimized column, not just the expanded ones) — just a thin
  // vertical strip instead of the full card list, so a long pipeline fits
  // on screen without scrolling forever.
  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onToggleCollapse}
        title={`Expand ${stage.label}`}
        className={`flex-shrink-0 w-10 flex flex-col items-center gap-2.5 py-3 rounded-xl border transition-all duration-200
          ${isOver ? 'border-ryze-400 bg-ryze-600/10 ring-2 ring-ryze-300' : 'border-border bg-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'}`}
      >
        <ChevronRightIcon className="h-3.5 w-3.5 text-text-muted shrink-0" />
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span
          className="text-[11px] font-bold text-text-primary uppercase tracking-wide whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {stage.label}
        </span>
        <span className="text-[10px] font-semibold text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0">
          {leads.length}
        </span>
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-64 flex flex-col animate-column-expand">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-bold text-text-primary uppercase tracking-wide truncate">{stage.label}</span>
        <span className="text-xs font-semibold text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full shrink-0">
          {leads.length}
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          title={`Collapse ${stage.label}`}
          className="ml-auto p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-xl p-2 flex flex-col gap-2 border-2 border-dashed transition-colors duration-150
          ${isOver ? 'border-ryze-400 bg-ryze-600/10' : 'border-transparent bg-background'}`}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead._id}
              lead={lead}
              stageColor={stage.color}
              onClick={onCardClick}
              onEditClick={onEditClick}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="text-xs text-text-muted text-center py-6 select-none border border-dashed border-border rounded-lg">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

function inp(extra?: string) {
  return `w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-ryze-400 ${extra ?? ''}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function LeadForm({ form, setForm, onSubmit, saving, submitLabel }: {
  form: any; setForm: (f: any) => void;
  onSubmit: () => void; saving: boolean; submitLabel: string;
}) {
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const branches = useBranchStore((s) => s.branches.filter((b) => b.status === 'active'));
  const [section, setSection] = useState<'basic'|'contact'|'address'|'sales'|'custom'>('basic');
  const { stages } = usePipelineStages('lead', DEFAULT_LEAD_STAGES);
  const { data: staffData } = useStaffsListQuery({ page: 1, limit: 1000 });
  const staffOptions = staffData?.items ?? [];
  // LR-RULE-003: Owner should be a CRM/sales user, not only Field-Service
  // staff — leadOwnerStaffId is a plain string (no Mongoose ref), so a
  // platform User's _id is just as valid a value as a NativeStaff staffId.
  const { data: userData } = useUsersListQuery({ limit: 500 });
  const userOptions = userData?.items ?? [];

  const { data: customFields = [] } = useCustomFieldsQuery('leads');
  const activeCustomFields = customFields.filter((cf) => cf.isActive);
  const { data: formTemplates = [] } = useCustomFormTemplatesQuery();
  const setCustomField = (key: string, val: any) =>
    setForm((p: any) => ({ ...p, customFields: { ...p.customFields, [key]: val } }));

  // Seed any active field the current form doesn't already have a value for —
  // same convention DealsPage.tsx/ContractFormDrawer.tsx already use, keeps
  // every input controlled from the first render.
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

  // Owner is a real staff reference (leadOwnerStaffId) so automation rules
  // can actually email the assigned owner — leadOwner is kept in sync as
  // that staff's display name for existing exports/search that read it as
  // plain text.
  const setOwner = (ownerId: string) => {
    const staff = staffOptions.find((s: any) => s.staffId === ownerId);
    const user  = !staff ? userOptions.find((u: any) => u._id === ownerId) : undefined;
    const name = staff ? `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim()
      : user ? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email)
      : '';
    setForm((p: any) => ({ ...p, leadOwnerStaffId: ownerId, leadOwner: name }));
  };

  const tabs = [
    { key: 'basic',   label: 'Basic Info' },
    { key: 'contact', label: 'Contact' },
    { key: 'address', label: 'Address' },
    { key: 'sales',   label: 'Sales' },
    ...(activeCustomFields.length > 0 ? [{ key: 'custom' as const, label: 'Custom Fields' }] : []),
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Section tabs */}
      <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
              ${section === t.key ? 'bg-surface dark:bg-gray-600 text-text-primary dark:text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {section === 'basic' && (
        <div className="grid grid-cols-2 gap-3">
          {branches.length > 0 && (
            <div className="col-span-2">
              <Field label="Branch / Company">
                <select className={inp()} value={form.branchId ?? ''} onChange={(e) => set('branchId', e.target.value || null)}>
                  <option value="">Default Company</option>
                  {branches.map((b: any) => <option key={b._id} value={b._id}>{b.branchName}</option>)}
                </select>
              </Field>
            </div>
          )}
          <Field label="First Name *">
            <input className={inp()} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="First Name" />
          </Field>
          <Field label="Last Name">
            <input className={inp()} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Last Name" />
          </Field>
          <Field label="Company">
            <input className={inp()} value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Company" />
          </Field>
          <Field label="Designation">
            <input className={inp()} value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Designation" />
          </Field>
          <Field label="Industry">
            <select className={inp()} value={form.industry} onChange={(e) => set('industry', e.target.value)}>
              <option value="">Select Industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Website">
            <input className={inp()} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Source">
            <select className={inp()} value={form.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </Field>
          <Field label="Rating">
            <select className={inp()} value={form.rating} onChange={(e) => set('rating', e.target.value)}>
              {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inp()} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inp()} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select className={inp()} value={form.leadOwnerStaffId ?? ''} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Unassigned</option>
              {userOptions.length > 0 && (
                <optgroup label="CRM Users">
                  {userOptions.map((u: any) => (
                    <option key={u._id} value={u._id}>{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email}</option>
                  ))}
                </optgroup>
              )}
              {staffOptions.length > 0 && (
                <optgroup label="Field Service Staff">
                  {staffOptions.map((s: any) => (
                    <option key={s.staffId} value={s.staffId}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea className={inp()} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes about this lead..." />
            </Field>
          </div>
        </div>
      )}

      {section === 'contact' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input className={inp()} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" />
          </Field>
          <Field label="Secondary Email">
            <input className={inp()} type="email" value={form.secondaryEmail} onChange={(e) => set('secondaryEmail', e.target.value)} placeholder="alt@example.com" />
          </Field>
          <Field label="Phone">
            <input className={inp()} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Mobile">
            <input className={inp()} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="WhatsApp">
            <input className={inp()} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Alternate Phone">
            <input className={inp()} value={form.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} placeholder="Alternate number" />
          </Field>
          <Field label="LinkedIn">
            <input className={inp()} value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/..." />
          </Field>
          <Field label="Twitter">
            <input className={inp()} value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="@handle" />
          </Field>
        </div>
      )}

      {section === 'address' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Address Line 1">
              <input className={inp()} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Address Line 2">
              <input className={inp()} value={form.address2} onChange={(e) => set('address2', e.target.value)} placeholder="Apt, Suite, etc." />
            </Field>
          </div>
          <Field label="City">
            <input className={inp()} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
          </Field>
          <Field label="State">
            <input className={inp()} value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" />
          </Field>
          <Field label="Postal Code">
            <input className={inp()} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="PIN code" />
          </Field>
          <Field label="Country">
            <input className={inp()} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" />
          </Field>
        </div>
      )}

      {section === 'sales' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected Revenue (₹)">
            <input className={inp()} type="number" value={form.expectedRevenue} onChange={(e) => set('expectedRevenue', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Budget (₹)">
            <input className={inp()} type="number" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Expected Close Date">
            <input className={inp()} type="date" value={form.expectedCloseDate ?? ''} onChange={(e) => set('expectedCloseDate', e.target.value)} />
          </Field>
          <Field label="Lead Score (0-100)">
            <input className={inp()} type="number" min={0} max={100} value={form.score} onChange={(e) => set('score', Number(e.target.value))} />
          </Field>
          <div className="col-span-2">
            <Field label="Requirement">
              <textarea className={inp()} rows={2} value={form.requirement} onChange={(e) => set('requirement', e.target.value)} placeholder="What does the lead need?" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Pain Points">
              <textarea className={inp()} rows={2} value={form.painPoints} onChange={(e) => set('painPoints', e.target.value)} placeholder="Current challenges..." />
            </Field>
          </div>
          <Field label="Decision Maker">
            <input className={inp()} value={form.decisionMaker ?? ''} onChange={(e) => set('decisionMaker', e.target.value)} placeholder="Who makes the decision?" />
          </Field>
          <Field label="Purchase Timeline">
            <input className={inp()} value={form.purchaseTimeline ?? ''} onChange={(e) => set('purchaseTimeline', e.target.value)} placeholder="e.g. This quarter" />
          </Field>
          <Field label="Competitor">
            <input className={inp()} value={form.competitor ?? ''} onChange={(e) => set('competitor', e.target.value)} placeholder="Competing vendors?" />
          </Field>
          {(form.status === 'lost') && (
            <Field label="Lost Reason">
              <input className={inp()} value={form.lostReason ?? ''} onChange={(e) => set('lostReason', e.target.value)} placeholder="Why was this lead lost?" />
            </Field>
          )}
        </div>
      )}

      {section === 'custom' && (
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
      )}

      <button
        onClick={onSubmit}
        disabled={saving || !form.firstName?.trim()}
        className="w-full py-2.5 rounded-xl bg-ryze-600 hover:bg-ryze-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

// ─── ConvertButton ────────────────────────────────────────────────────────────

function ConvertButton({
  label, description, done, doneLabel, onClick, loading,
}: {
  label: string; description: string;
  done: boolean; doneLabel: string;
  onClick: () => void; loading: boolean;
}) {
  if (done) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <CheckCircleIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{label}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">{doneLabel}</p>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:border-ryze-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
    >
      <ArrowRightCircleIcon className="h-5 w-5 text-ryze-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-text-primary dark:text-white">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      {loading && <div className="ml-auto h-4 w-4 rounded-full border-2 border-ryze-400 border-t-transparent animate-spin" />}
    </button>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 py-2 border-b border-border last:border-0">
      <span className="text-xs text-text-muted w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-text-primary dark:text-white break-words">{String(value)}</span>
    </div>
  );
}

const CONVERSION_TYPE_LABELS: Record<string, string> = {
  contact:     'Contact',
  opportunity: 'Opportunity',
  customer:    'Customer',
};

function ConvertTab({ lead, stages }: { lead: any; stages: PipelineStage[] }) {
  const contactMut     = useLeadConvertToContact();
  const opportunityMut = useLeadConvertToOpportunity();
  const customerMut    = useLeadConvertToCustomer();

  const history: any[] = lead.conversionHistory ?? [];

  // LR-UX-009: conversion fired instantly on click with no confirmation
  // and no success message at all — the only feedback was the card
  // eventually turning green once the drawer happened to refresh. Also
  // fixes a bare browser alert() on failure (same class as LR-UX-005).
  const [confirmConvert, setConfirmConvert] = useState<{ label: string; mutate: (id: string) => Promise<any>; successMsg: string } | null>(null);

  const handleAction = async (mutate: (id: string) => Promise<any>, successMsg: string) => {
    try {
      await mutate(lead._id);
      toast.success(successMsg);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Conversion failed');
    } finally {
      setConfirmConvert(null);
    }
  };

  // Checks the current stage's `outcome` tag, not a hardcoded stage key — a
  // tenant renaming/reconfiguring their "Won" stage must not silently break
  // conversion eligibility (same bug class Deal's own stage-rename
  // regression test guards against; see DealsPage.tsx).
  const isWon = stages.find((s) => s.key === lead.status)?.outcome === 'won';
  if (!isWon) {
    return (
      <div className="text-center py-10">
        <TrophyIcon className="h-10 w-10 text-text-muted mx-auto mb-3" />
        <p className="text-sm font-semibold text-text-primary">Lead must be Won to convert</p>
        <p className="text-xs text-text-muted mt-1">Move this lead to the <strong>Won</strong> stage first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Convert Lead</p>
      <ConvertButton
        label="Convert to Contact"
        description="Create a CRM Contact from this lead"
        done={!!lead.contactId}
        doneLabel="Contact created"
        onClick={() => setConfirmConvert({ label: 'Convert to Contact', mutate: contactMut.mutateAsync, successMsg: 'Contact created' })}
        loading={contactMut.isPending}
      />
      <ConvertButton
        label="Convert to Opportunity"
        description="Create a Deal / Opportunity linked to this lead"
        done={!!lead.opportunityId}
        doneLabel="Opportunity created"
        onClick={() => setConfirmConvert({ label: 'Convert to Opportunity', mutate: opportunityMut.mutateAsync, successMsg: 'Opportunity created' })}
        loading={opportunityMut.isPending}
      />
      <ConvertButton
        label="Convert to Customer"
        description="Create a Customer record for billing and field service"
        done={!!lead.isConverted}
        doneLabel={lead.convertedCustomerId ? `Customer: ${lead.convertedCustomerId}` : 'Customer created'}
        onClick={() => setConfirmConvert({ label: 'Convert to Customer', mutate: customerMut.mutateAsync, successMsg: 'Customer created' })}
        loading={customerMut.isPending}
      />

      {confirmConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmConvert(null)}>
          <div className="bg-surface-elevated border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-text-primary font-semibold text-base">{confirmConvert.label}?</h3>
            <p className="text-sm text-text-muted mt-1 mb-5">
              This creates a new record from {fullName(lead) || 'this lead'}'s current details right away. It can't be undone from here.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmConvert(null)}
                className="flex-1 px-4 py-2 text-sm bg-surface hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-border text-text-primary rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => handleAction(confirmConvert.mutate, confirmConvert.successMsg)}
                className="flex-1 px-4 py-2 text-sm bg-ryze-600 hover:bg-ryze-700 text-white rounded-xl transition-colors">
                {confirmConvert.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Conversion History</p>
          <div className="space-y-2">
            {history.map((item: any) => (
              <div key={item.entityId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-white">{item.name}</p>
                  <p className="text-xs text-text-muted">
                    {CONVERSION_TYPE_LABELS[item.type] ?? item.type}
                    {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString('en-IN')}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadDetailPanel({
  lead: listLead, onClose, onEdit,
}: {
  lead: any; onClose: () => void;
  onEdit: (lead: any) => void;
}) {
  const [tab, setTab] = useState<'overview'|'sales'|'activity'|'timeline'|'convert'>('overview');
  const { stages } = usePipelineStages('lead', DEFAULT_LEAD_STAGES);
  // The list response (listLead) omits supervisorName (live-resolved,
  // single-record only — see lead.controller.ts's own comment on why it's
  // never included in a list to avoid an N+1 join on every page load).
  // Fetching the single record here fills that one gap; everything else
  // already comes through on the list response since listLeads() has no
  // field projection.
  const { data: fullLead } = useLeadQuery(listLead._id);
  const lead = fullLead ?? listLead;
  const stageMeta = stages.find((s) => s.key === lead.status);
  const { data: customFields = [] } = useCustomFieldsQuery('leads');
  const activeCustomFields = customFields.filter((cf) => cf.isActive);
  const qc = useQueryClient();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageMeta?.color ?? '#6b7280' }} />
            <span className="text-xs font-semibold" style={{ color: stageMeta?.color ?? '#6b7280' }}>
              {stageMeta?.label ?? lead.status}
            </span>
            {lead.isConverted && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Converted</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-text-primary dark:text-white">{fullName(lead)}</h2>
          {lead.company && <p className="text-sm text-text-muted">{lead.company} {lead.designation ? `· ${lead.designation}` : ''}</p>}
          <p className="text-xs text-text-muted mt-0.5">{lead.leadId}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onEdit(lead)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
            Edit
          </button>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary dark:hover:text-text-muted">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Lock banner */}
      <div className="px-4 pt-3">
        <RecordLockBanner
          record={lead}
          entityModule="leads"
          onUnlocked={() => qc.invalidateQueries({ queryKey: ['native-crm', 'leads'] })}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4 overflow-x-auto">
        {[
          { key: 'overview',  label: 'Overview' },
          { key: 'sales',     label: 'Sales' },
          { key: 'activity',  label: 'Activity' },
          { key: 'timeline',  label: 'Timeline' },
          { key: 'convert', label: '🎉 Convert' },
        ].map((t) => (
          <button key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`text-xs font-semibold py-3 px-3 border-b-2 transition-colors
              ${tab === t.key ? 'border-ryze-500 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Contact</p>
            <InfoRow label="Email"         value={lead.email} />
            {/* LR-UX-007: these 4 are captured and saved but were only ever
                visible by opening Edit — never shown here at all. */}
            <InfoRow label="Secondary Email" value={lead.secondaryEmail} />
            <InfoRow label="Phone"         value={lead.phone} />
            <InfoRow label="Mobile"        value={lead.mobile} />
            <InfoRow label="Alternate Phone" value={lead.alternatePhone} />
            <InfoRow label="WhatsApp"      value={lead.whatsapp} />
            <InfoRow label="LinkedIn"      value={lead.linkedin} />
            <InfoRow label="Twitter"       value={lead.twitter} />
            <InfoRow label="Industry"      value={lead.industry} />
            <InfoRow label="Website"       value={lead.website} />
            <InfoRow label="Rating"        value={lead.rating} />
            <InfoRow label="Priority"      value={lead.priority} />
            <InfoRow label="Source"        value={(lead.source ?? '').replace(/_/g, ' ')} />
            <InfoRow label="Score"         value={lead.score} />
            <InfoRow label="Owner"         value={lead.leadOwner} />
            <InfoRow label="Team"          value={lead.teamName} />
            <InfoRow label="Supervisor"    value={lead.supervisorName} />
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Address</p>
            <InfoRow label="Address"    value={lead.address} />
            <InfoRow label="Address Line 2" value={lead.address2} />
            <InfoRow label="City"       value={lead.city} />
            <InfoRow label="State"      value={lead.state} />
            <InfoRow label="Country"    value={lead.country} />
            <InfoRow label="Postal Code" value={lead.postalCode} />
            {lead.notes && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Notes</p>
                <p className="text-sm text-text-primary bg-background rounded-lg p-3 whitespace-pre-wrap">{lead.notes}</p>
              </>
            )}
            {activeCustomFields.length > 0 && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Custom Fields</p>
                {activeCustomFields.map((cf) => {
                  const val = lead.customFields?.[cf.fieldKey];
                  const display = Array.isArray(val) ? val.join(', ') : (val && typeof val === 'object' ? JSON.stringify(val) : val);
                  return <InfoRow key={cf.fieldKey} label={cf.label} value={display} />;
                })}
              </>
            )}
          </div>
        )}

        {tab === 'sales' && (
          <div>
            <InfoRow label="Expected Revenue"   value={lead.expectedRevenue ? formatCurrency(lead.expectedRevenue) : undefined} />
            <InfoRow label="Budget"             value={lead.budget ? formatCurrency(lead.budget) : undefined} />
            <InfoRow label="Expected Close"     value={lead.expectedCloseDate ? new Date(lead.expectedCloseDate).toLocaleDateString('en-IN') : undefined} />
            <InfoRow label="Decision Maker"     value={lead.decisionMaker} />
            <InfoRow label="Purchase Timeline"  value={lead.purchaseTimeline} />
            <InfoRow label="Competitor"         value={lead.competitor} />
            {lead.requirement && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Requirement</p>
                <p className="text-sm text-text-primary bg-background rounded-lg p-3 whitespace-pre-wrap">{lead.requirement}</p>
              </>
            )}
            {lead.painPoints && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Pain Points</p>
                <p className="text-sm text-text-primary bg-background rounded-lg p-3 whitespace-pre-wrap">{lead.painPoints}</p>
              </>
            )}
            {lead.lostReason && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Lost Reason</p>
                <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{lead.lostReason}</p>
              </>
            )}
            {lead.campaign && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 mt-4">Marketing</p>
                <InfoRow label="Campaign"    value={lead.campaign} />
                <InfoRow label="UTM Source"  value={lead.utmSource} />
                <InfoRow label="UTM Medium"  value={lead.utmMedium} />
                <InfoRow label="Landing Page" value={lead.landingPage} />
              </>
            )}
          </div>
        )}

        {tab === 'activity' && (
          <ActivityFeedPanel relatedModule="lead" relatedId={lead._id} relatedLabel={fullName(lead)} />
        )}

        {tab === 'timeline' && (
          <RecordTimeline entityModule="leads" entityId={lead._id} />
        )}

        {tab === 'convert' && (
          <ConvertTab lead={lead} stages={stages} />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// LR-UX-008: the chosen list/Kanban view was forgotten on every reload,
// always resetting to Kanban — this reads/writes the one preference to
// localStorage, guarded against a private-browsing/blocked-storage tab
// where it should just silently fall back to the old default.
function initialLeadsView(): 'kanban' | 'list' {
  try {
    const stored = localStorage.getItem('leadryze-leads-view');
    return stored === 'list' ? 'list' : 'kanban';
  } catch { return 'kanban'; }
}

export default function LeadsPage() {
  const [view,        setViewState]   = useState<'kanban'|'list'>(initialLeadsView);
  const setView = (v: 'kanban' | 'list') => {
    setViewState(v);
    try { localStorage.setItem('leadryze-leads-view', v); } catch { /* ignore */ }
  };
  const [search,      setSearch]      = useState('');
  const [filterSrc,   setFilterSrc]   = useState('');
  const [filterRating,setFilterRating]= useState('');
  const [customFieldFilterValues, setCustomFieldFilterValues] = useState<Record<string, string>>({});
  const [sortBy,  setSortBy]  = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [panelMode,   setPanelMode]   = useState<'none'|'create'|'edit'|'detail'>('none');
  const [selectedLead,setSelectedLead]= useState<any | null>(null);
  const [delTarget,   setDelTarget]   = useState<any | null>(null);
  const [form,        setForm]        = useState<any>({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [extraVisibleKeys, setExtraVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('crm-cols-leads-extra');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  });
  // Which Kanban columns are minimized — same persisted-preference pattern
  // as extraVisibleKeys above, so a collapsed pipeline stage (e.g. a
  // terminal "Lost"/"Disqualified" column nobody needs open all the time)
  // stays collapsed across visits instead of resetting on every reload.
  const [collapsedStages, setCollapsedStages] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('crm-kanban-leads-collapsed');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  });
  const toggleStageCollapse = useCallback((key: string) => {
    setCollapsedStages((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem('crm-kanban-leads-collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const currentBranch = useBranchStore((s) => s.currentBranch);
  const queryClient = useQueryClient();

  const { data: customFieldDefs = [] } = useCustomFieldsQuery('leads');
  const activeCustomFields = customFieldDefs.filter((f) => f.isActive);
  // Merged into the SAME optional-column mechanism as the built-in extras
  // below — a custom field is just another FieldConfig, keyed
  // `customFields.<fieldKey>` so getFieldValue()/the export/sort/filter
  // wiring all resolve it the same way.
  const customFieldColumns: FieldConfig[] = activeCustomFields.map((f) => ({
    key: `customFields.${f.fieldKey}`, label: f.label, type: 'text',
  }));
  const allExtraColumns = [...LEAD_EXTRA_COLUMNS, ...customFieldColumns];
  const allSortFields = [...LEAD_SORT_FIELDS, ...customFieldColumns.map((c) => ({ key: c.key, label: c.label }))];

  const customFieldFilterConditions = Object.entries(customFieldFilterValues)
    .filter(([, v]) => v.trim() !== '')
    .map(([key, value]) => ({ field: key, operator: 'contains' as const, value }));

  const { data, isLoading } = useLeadsQuery({
    search:      search || undefined,
    source:      filterSrc    || undefined,
    rating:      filterRating || undefined,
    sortBy:      sortBy || undefined,
    sortDir,
    customFieldFilters: customFieldFilterConditions.length > 0 ? JSON.stringify(customFieldFilterConditions) : undefined,
    limit:       500,
  });
  const leads = data?.items ?? [];

  const createMut      = useLeadCreate();
  const updateMut      = useLeadUpdate();
  const deleteMut      = useLeadDelete();
  const stageMut       = useLeadUpdateStage();
  const { data: statsData } = useLeadsStatsQuery();
  const { stages } = usePipelineStages('lead', DEFAULT_LEAD_STAGES);

  // Optional extra table columns, controlled via Edit Columns — persisted
  // separately from the core rich columns, which always stay visible.
  const extraCols = extraVisibleKeys
    .map((k) => allExtraColumns.find((f) => f.key === k))
    .filter(Boolean) as FieldConfig[];
  const handleApplyExtraColumns = (keys: string[]) => {
    setExtraVisibleKeys(keys);
    try { localStorage.setItem('crm-cols-leads-extra', JSON.stringify(keys)); } catch {}
  };

  // ── Kanban grouping (server truth)
  const byStage = stages.reduce<Record<string, any[]>>((acc, s) => {
    acc[s.key] = leads.filter((l) => l.status === s.key);
    return acc;
  }, {} as any);
  const leadsById = useMemo(() => new Map(leads.map((l) => [l._id, l])), [leads]);

  // ── Drag & Drop (dnd-kit — pointer-tracked, not native HTML5 DnD; see
  // LeadCard's own comment for why that matters for the Trello-style feel).
  //
  // boardColumns is the *ephemeral* per-column ordering dnd-kit needs to
  // live-animate cards sliding out of the way as you drag — re-synced from
  // byStage whenever the server data changes. A same-column reorder is
  // never persisted (no manual-order field exists on Lead), so it settles
  // visually on drop but reverts to server order on the next refetch; a
  // cross-column move fires the existing stage-change mutation exactly
  // like before, which is what actually sticks.
  const [boardColumns, setBoardColumns] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const next: Record<string, string[]> = {};
    stages.forEach((s) => { next[s.key] = (byStage[s.key] ?? []).map((l) => l._id); });
    setBoardColumns(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, stages.length]);

  const [activeLead, setActiveLead] = useState<any | null>(null);
  const activeStageColor = activeLead ? stages.find((s) => s.key === activeLead.status)?.color : undefined;

  const sensors = useSensors(
    // Requires 6px of pointer movement before a drag actually starts, so a
    // plain click (on the card or the edit button) still fires normally
    // instead of every click being swallowed as a would-be drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveLead(leadsById.get(String(event.active.id)) ?? null);
  }, [leadsById]);

  // Fires continuously while hovering — migrates the card between the
  // source and target column arrays live, so the rest of the target column
  // visibly slides over to open a gap as you drag, not just once you let
  // go. Same-column hovering is left alone here; dnd-kit's own
  // SortableContext already previews that case without any state change.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setBoardColumns((prev) => {
      const fromKey = Object.keys(prev).find((k) => prev[k].includes(activeId));
      const overKey = overId.startsWith('column:') ? overId.slice(7) : Object.keys(prev).find((k) => prev[k].includes(overId));
      if (!fromKey || !overKey || fromKey === overKey) return prev;

      const fromItems = prev[fromKey].filter((id) => id !== activeId);
      const toItems = [...prev[overKey]];
      const overIndex = toItems.indexOf(overId);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, activeId);

      return { ...prev, [fromKey]: fromItems, [overKey]: toItems };
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const lead = activeLead;
    setActiveLead(null);
    if (!lead || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Settle a same-column drop into its hovered slot (arrayMove) instead
    // of snapping back — cross-column placement was already handled live
    // by handleDragOver above, so this only ever touches one column.
    setBoardColumns((prev) => {
      const fromKey = Object.keys(prev).find((k) => prev[k].includes(activeId));
      if (!fromKey) return prev;
      const overKey = overId.startsWith('column:') ? overId.slice(7) : Object.keys(prev).find((k) => prev[k].includes(overId));
      if (overKey !== fromKey) return prev;
      const oldIndex = prev[fromKey].indexOf(activeId);
      const newIndex = prev[fromKey].indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return { ...prev, [fromKey]: arrayMove(prev[fromKey], oldIndex, newIndex) };
    });

    const finalStageKey = Object.keys(boardColumns).find((k) => boardColumns[k].includes(activeId));
    if (finalStageKey && finalStageKey !== lead.status) {
      stageMut.mutate({ id: activeId, status: finalStageKey });
    }
  }, [activeLead, boardColumns, stageMut]);

  // ── Panel actions
  const openCreate = () => { setForm({ ...EMPTY_FORM, branchId: currentBranch?._id ?? null }); setPanelMode('create'); setSelectedLead(null); };
  const openEdit   = (lead: any) => { setForm({ ...lead, expectedRevenue: lead.expectedRevenue ?? '', budget: lead.budget ?? '' }); setSelectedLead(lead); setPanelMode('edit'); };
  const openDetail = (lead: any) => { setSelectedLead(lead); setPanelMode('detail'); };
  const closePanel = () => { setPanelMode('none'); setSelectedLead(null); };

  const handleSubmit = async () => {
    if (!form.firstName?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        expectedRevenue: form.expectedRevenue ? Number(form.expectedRevenue) : undefined,
        budget:          form.budget          ? Number(form.budget)          : undefined,
        score:           Number(form.score ?? 0),
      };
      if (panelMode === 'create') {
        const created = await createMut.mutateAsync(payload);
        toast.success('Lead created');
        // LR-LEAD-001: non-blocking — the lead is already created either way.
        if (created?.duplicateWarning) {
          toast(`Possible duplicate: ${created.duplicateWarning.label} already has this email/phone`, { icon: '⚠️', duration: 6000 });
        }
      } else if (panelMode === 'edit' && selectedLead) {
        await updateMut.mutateAsync({ id: selectedLead._id, data: payload });
        toast.success('Lead updated');
      }
      closePanel();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (lead: any) => setDelTarget(lead);

  const panelOpen = panelMode !== 'none';

  return (
    <div className="flex h-full overflow-hidden bg-background dark:bg-gray-950">
      {/* Main area */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${panelOpen ? 'mr-[50vw]' : ''}`}>
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2 mr-2">
            <UserPlusIcon className="h-5 w-5 text-violet-600" />
            <h1 className="text-base font-bold text-text-primary dark:text-white">Leads</h1>
            <span className="text-xs text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full">{leads.length}</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-ryze-400"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters toggle */}
          <button onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
              ${showFilters ? 'border-ryze-400 text-ryze-600 dark:text-ryze-400 bg-ryze-600/10 dark:bg-ryze-900/20' : 'border-border text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
            Filters <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView('kanban')}
                className={`p-2 transition-colors ${view === 'kanban' ? 'bg-ryze-600 text-white' : 'bg-surface text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-ryze-600 text-white' : 'bg-surface text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>
                <TableCellsIcon className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setColumnEditorOpen(true)}
              title="Choose which extra columns show in the list view"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-sm font-medium transition-colors">
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Edit columns{extraCols.length > 0 ? ` (${extraCols.length})` : ''}</span>
            </button>
            <FileActionsDropdown
              moduleName="Leads"
              tableCols={LEAD_FIELD_CONFIG}
              allCols={LEAD_FIELD_CONFIG}
              sortedRecords={leads}
              selectedIds={EMPTY_SELECTION}
              apiBase="/api/v1/native-crm/leads"
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['native-crm', 'leads'] })}
              page={1}
              limit={Math.max(leads.length, 1)}
            />
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ryze-600 hover:bg-ryze-700 text-white text-sm font-semibold transition-colors">
              <PlusIcon className="h-4 w-4" /> New Lead
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {statsData && (
          <div className="flex gap-3 px-5 py-2.5 bg-surface border-b border-border">
            {[
              { icon: UserPlusIcon,        label: 'Total Leads',    value: String(statsData.total),                           color: 'text-violet-600' },
              { icon: CurrencyRupeeIcon,   label: 'Pipeline Value', value: '₹' + (statsData.totalRevenue ?? 0).toLocaleString('en-IN'), color: 'text-blue-600'   },
              { icon: TrophyIcon,          label: 'Won',            value: String(statsData.converted),                       color: 'text-emerald-600'},
              { icon: ArrowTrendingUpIcon, label: 'Conversion',     value: `${statsData.conversionRate}%`,                   color: 'text-orange-500' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 bg-background rounded-xl px-3 py-1.5 min-w-[120px]">
                <stat.icon className={`h-4 w-4 ${stat.color} flex-shrink-0`} />
                <div>
                  <p className="text-[10px] text-text-muted font-medium">{stat.label}</p>
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        {showFilters && (
          <div className="flex flex-col gap-2 px-5 py-2.5 bg-surface border-b border-border">
            <div className="flex flex-wrap items-center gap-3">
              <select className="text-xs rounded-lg border border-border bg-surface text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ryze-400"
                value={filterSrc} onChange={(e) => setFilterSrc(e.target.value)}>
                <option value="">All Sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select className="text-xs rounded-lg border border-border bg-surface text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ryze-400"
                value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
                <option value="">All Ratings</option>
                {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="text-xs text-text-muted">Sort:</span>
              <select className="text-xs rounded-lg border border-border bg-surface text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ryze-400"
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">Default</option>
                {allSortFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              {sortBy && (
                <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-border text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                  {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              )}
              {(filterSrc || filterRating || sortBy || Object.values(customFieldFilterValues).some((v) => v.trim())) && (
                <button onClick={() => { setFilterSrc(''); setFilterRating(''); setSortBy(''); setCustomFieldFilterValues({}); }} className="text-xs text-red-500 hover:text-red-700">
                  Clear filters
                </button>
              )}
            </div>
            {activeCustomFields.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                <span className="text-xs text-text-muted">Custom fields:</span>
                {activeCustomFields.map((f) => (
                  <input
                    key={f.fieldKey}
                    placeholder={f.label}
                    value={customFieldFilterValues[`customFields.${f.fieldKey}`] ?? ''}
                    onChange={(e) => setCustomFieldFilterValues((prev) => ({ ...prev, [`customFields.${f.fieldKey}`]: e.target.value }))}
                    className="text-xs rounded-lg border border-border bg-surface text-text-primary px-2 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-ryze-400"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Company filter bar */}
        <div className="px-5 pt-2 shrink-0 bg-surface">
          <CompanyFilterBar />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex gap-2">
                {[0,1,2].map((i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          ) : view === 'kanban' ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 p-4 min-w-max h-full">
                {stages.map((stage) => (
                  <KanbanColumn
                    key={stage.key}
                    stage={stage}
                    leads={(boardColumns[stage.key] ?? []).map((id) => leadsById.get(id)).filter(Boolean)}
                    onCardClick={openDetail}
                    onEditClick={openEdit}
                    collapsed={collapsedStages.includes(stage.key)}
                    onToggleCollapse={() => toggleStageCollapse(stage.key)}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeLead ? <LeadCardDragPreview lead={activeLead} stageColor={activeStageColor} /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            /* List view */
            <div className="p-4">
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background text-xs text-text-muted uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Lead</th>
                      <th className="px-4 py-3 text-left font-semibold">Contact</th>
                      <th className="px-4 py-3 text-left font-semibold">Source</th>
                      <th className="px-4 py-3 text-left font-semibold">Stage</th>
                      <th className="px-4 py-3 text-left font-semibold">Rating</th>
                      <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                      {/* LR-UX-008: this cell renders CompanyBadge, the
                          tenant's own Branch/business-unit — "Company"
                          read as if it showed the lead's own company
                          (already shown, easy to miss, under "Lead"). */}
                      <th className="px-4 py-3 text-left font-semibold">Branch</th>
                      {extraCols.map((col) => (
                        <th key={col.key} className="px-4 py-3 text-left font-semibold">{col.label}</th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-gray-800">
                    {leads.length === 0 && (
                      <tr><td colSpan={8 + extraCols.length} className="py-12 text-center text-text-muted">No leads found</td></tr>
                    )}
                    {leads.map((lead) => {
                      const s = stages.find((x) => x.key === lead.status);
                      return (
                        <tr key={lead._id} className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer" onClick={() => openDetail(lead)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-text-primary dark:text-white">{fullName(lead)}</div>
                            {lead.company && <div className="text-xs text-text-muted">{lead.company}</div>}
                            <div className="text-xs text-text-muted">{lead.leadId}</div>
                          </td>
                          <td className="px-4 py-3">
                            {lead.email && <div className="text-xs text-text-muted">{lead.email}</div>}
                            {lead.phone && <div className="text-xs text-text-muted">{lead.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[lead.source] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
                              {(lead.source ?? '').replace(/_/g,' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color ?? '#6b7280' }} />
                              {s?.label ?? lead.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold`}>
                              <span className={`h-2 w-2 rounded-full ${RATING_COLORS[lead.rating] ?? 'bg-black/[0.08] dark:bg-white/[0.1]'}`} />
                              {lead.rating}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">
                            {formatCurrency(lead.expectedRevenue)}
                          </td>
                          <td className="px-4 py-3">
                            <CompanyBadge branchId={lead.branchId} />
                          </td>
                          {extraCols.map((col) => (
                            <td key={col.key} className="px-4 py-3 text-xs text-text-muted">
                              {fmtVal(getFieldValue(lead, col.key), col.type)}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                              className="text-xs px-2 py-1 rounded border border-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] mr-1">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(lead); }}
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
        <div className="fixed right-0 top-0 bottom-0 w-[50vw] min-w-[600px] bg-surface border-l border-border shadow-2xl z-30 flex flex-col overflow-hidden">
          {(panelMode === 'create' || panelMode === 'edit') && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="text-base font-bold text-text-primary dark:text-white">
                  {panelMode === 'create' ? 'New Lead' : `Edit: ${fullName(selectedLead)}`}
                </h2>
                <button onClick={closePanel} className="text-text-muted hover:text-text-primary">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <LeadForm
                  form={form}
                  setForm={setForm}
                  onSubmit={handleSubmit}
                  saving={saving}
                  submitLabel={panelMode === 'create' ? 'Create Lead' : 'Save Changes'}
                />
                {panelMode === 'edit' && selectedLead && (
                  <button onClick={() => handleDelete(selectedLead)}
                    className="w-full mt-3 py-2 rounded-xl border border-red-300 text-red-600 text-sm hover:bg-red-50 transition-colors">
                    Delete Lead
                  </button>
                )}
              </div>
            </>
          )}

          {panelMode === 'detail' && selectedLead && (
            <LeadDetailPanel
              lead={selectedLead}
              onClose={closePanel}
              onEdit={openEdit}
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

      {delTarget && (
        <FSDeleteModal
          label={fullName(delTarget) || 'this lead'}
          onClose={() => setDelTarget(null)}
          onConfirm={async () => {
            await deleteMut.mutateAsync(delTarget._id);
            if (selectedLead?._id === delTarget._id) closePanel();
          }}
        />
      )}
    </div>
  );
}
