import { useState, useCallback, useRef } from 'react';
import {
  PlusIcon, MagnifyingGlassIcon, Squares2X2Icon, TableCellsIcon,
  XMarkIcon, UserPlusIcon, PhoneIcon, EnvelopeIcon, BuildingOfficeIcon,
  ArrowRightCircleIcon, CheckCircleIcon, ChevronDownIcon,
  ClockIcon, CurrencyRupeeIcon, TrophyIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  useLeadsQuery, useLeadCreate, useLeadUpdate,
  useLeadDelete, useLeadUpdateStage,
  useLeadsStatsQuery, useLeadConvertToContact,
  useLeadConvertToOpportunity, useLeadConvertToCustomer,
} from '../../../modules/native-crm/queries/leads.queries';
import { useEntityTimelineQuery } from '../../../modules/native-crm/queries/timeline.queries';
import { RecordLockBanner } from '../../../components/native-crm/RecordLockBanner';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useBranchStore } from '../../../stores/branch.store';
import { useQueryClient } from '@tanstack/react-query';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'new',              label: 'New',              color: '#6366f1' },
  { key: 'contacted',        label: 'Contacted',        color: '#0ea5e9' },
  { key: 'qualified',        label: 'Qualified',        color: '#f59e0b' },
  { key: 'meeting_scheduled',label: 'Meeting Scheduled',color: '#8b5cf6' },
  { key: 'proposal_sent',    label: 'Proposal Sent',    color: '#ec4899' },
  { key: 'negotiation',      label: 'Negotiation',      color: '#f97316' },
  { key: 'won',              label: 'Won',              color: '#10b981' },
  { key: 'lost',             label: 'Lost',             color: '#ef4444' },
  { key: 'on_hold',          label: 'On Hold',          color: '#94a3b8' },
  { key: 'disqualified',     label: 'Disqualified',     color: '#64748b' },
] as const;

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
  website:      'bg-violet-100 text-violet-700',
  landing_page: 'bg-blue-100 text-blue-700',
  chatbot:      'bg-cyan-100 text-cyan-700',
  whatsapp:     'bg-green-100 text-green-700',
  facebook:     'bg-indigo-100 text-indigo-700',
  google:       'bg-red-100 text-red-700',
  manual:       'bg-gray-100 text-gray-600',
  csv:          'bg-yellow-100 text-yellow-700',
  api:          'bg-pink-100 text-pink-700',
  referral:     'bg-teal-100 text-teal-700',
  other:        'bg-slate-100 text-slate-600',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', company: '', designation: '', industry: '',
  email: '', phone: '', mobile: '', whatsapp: '',
  address: '', city: '', state: '', country: '', postalCode: '',
  status: 'new', source: 'manual', rating: 'warm', priority: 'medium',
  score: 0, expectedRevenue: '', budget: '', leadOwner: '',
  requirement: '', painPoints: '', notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n?: number) {
  if (!n) return '';
  return '₹' + n.toLocaleString('en-IN');
}

function fullName(lead: any) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onDragStart,
  onClick,
}: {
  lead: any;
  onDragStart: (e: React.DragEvent, lead: any) => void;
  onClick: (lead: any) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{fullName(lead)}</span>
        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5 ${RATING_COLORS[lead.rating] ?? 'bg-gray-300'}`} title={lead.rating} />
      </div>
      {lead.company && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
          <BuildingOfficeIcon className="h-3 w-3" />
          <span className="truncate">{lead.company}</span>
        </div>
      )}
      {(lead.phone || lead.email) && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
          {lead.phone
            ? <><PhoneIcon className="h-3 w-3" /><span>{lead.phone}</span></>
            : <><EnvelopeIcon className="h-3 w-3" /><span className="truncate">{lead.email}</span></>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[lead.source] ?? 'bg-gray-100 text-gray-600'}`}>
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
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, leads, onDragStart, onDrop, onCardClick,
}: {
  stage: typeof STAGES[number];
  leads: any[];
  onDragStart: (e: React.DragEvent, lead: any) => void;
  onDrop: (e: React.DragEvent, stageKey: string) => void;
  onCardClick: (lead: any) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{stage.label}</span>
        <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { setOver(false); onDrop(e, stage.key); }}
        className={`flex-1 min-h-[120px] rounded-xl p-2 flex flex-col gap-2 transition-colors
          ${over ? 'bg-brand-50 dark:bg-gray-700 ring-2 ring-brand-300' : 'bg-gray-50 dark:bg-gray-900'}`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead._id} lead={lead} onDragStart={onDragStart} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

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

function LeadForm({ form, setForm, onSubmit, saving, submitLabel }: {
  form: any; setForm: (f: any) => void;
  onSubmit: () => void; saving: boolean; submitLabel: string;
}) {
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const branches = useBranchStore((s) => s.branches.filter((b) => b.status === 'active'));
  const [section, setSection] = useState<'basic'|'contact'|'address'|'sales'>('basic');

  const tabs = [
    { key: 'basic',   label: 'Basic Info' },
    { key: 'contact', label: 'Contact' },
    { key: 'address', label: 'Address' },
    { key: 'sales',   label: 'Sales' },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
              ${section === t.key ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
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
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
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

      <button
        onClick={onSubmit}
        disabled={saving || !form.firstName?.trim()}
        className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
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
      className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      <ArrowRightCircleIcon className="h-5 w-5 text-brand-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {loading && <div className="ml-auto h-4 w-4 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />}
    </button>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white break-words">{String(value)}</span>
    </div>
  );
}

const ACTION_COLORS: Record<string, string> = {
  created:        'bg-emerald-100 text-emerald-700',
  status_changed: 'bg-blue-100 text-blue-700',
  updated:        'bg-gray-100 text-gray-600',
  note_added:     'bg-yellow-100 text-yellow-700',
  assigned:       'bg-purple-100 text-purple-700',
  uploaded:       'bg-pink-100 text-pink-700',
  deleted:        'bg-red-100 text-red-700',
};

const CONVERSION_TYPE_LABELS: Record<string, string> = {
  contact:     'Contact',
  opportunity: 'Opportunity',
  customer:    'Customer',
};

function ConvertTab({ lead }: { lead: any }) {
  const contactMut     = useLeadConvertToContact();
  const opportunityMut = useLeadConvertToOpportunity();
  const customerMut    = useLeadConvertToCustomer();

  const history: any[] = lead.conversionHistory ?? [];

  const handleAction = async (mutate: (id: string) => Promise<any>) => {
    try {
      await mutate(lead._id);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Conversion failed');
    }
  };

  if (lead.status !== 'won') {
    return (
      <div className="text-center py-10">
        <TrophyIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lead must be Won to convert</p>
        <p className="text-xs text-gray-400 mt-1">Move this lead to the <strong>Won</strong> stage first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Convert Lead</p>
      <ConvertButton
        label="Convert to Contact"
        description="Create a CRM Contact from this lead"
        done={!!lead.contactId}
        doneLabel="Contact created"
        onClick={() => handleAction(contactMut.mutateAsync)}
        loading={contactMut.isPending}
      />
      <ConvertButton
        label="Convert to Opportunity"
        description="Create a Deal / Opportunity linked to this lead"
        done={!!lead.opportunityId}
        doneLabel="Opportunity created"
        onClick={() => handleAction(opportunityMut.mutateAsync)}
        loading={opportunityMut.isPending}
      />
      <ConvertButton
        label="Convert to Customer"
        description="Create a Customer record for billing and field service"
        done={!!lead.isConverted}
        doneLabel={lead.convertedCustomerId ? `Customer: ${lead.convertedCustomerId}` : 'Customer created'}
        onClick={() => handleAction(customerMut.mutateAsync)}
        loading={customerMut.isPending}
      />

      {history.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Conversion History</p>
          <div className="space-y-2">
            {history.map((item: any) => (
              <div key={item.entityId} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <p className="text-xs text-gray-400">
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
  lead, onClose, onEdit,
}: {
  lead: any; onClose: () => void;
  onEdit: (lead: any) => void;
}) {
  const [tab, setTab] = useState<'overview'|'sales'|'timeline'|'convert'>('overview');
  const stageMeta = STAGES.find((s) => s.key === lead.status);
  const { data: timelineEvents = [], isLoading: tlLoading } = useEntityTimelineQuery('leads', lead._id);
  const qc = useQueryClient();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{fullName(lead)}</h2>
          {lead.company && <p className="text-sm text-gray-500">{lead.company} {lead.designation ? `· ${lead.designation}` : ''}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{lead.leadId}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onEdit(lead)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            Edit
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
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
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 overflow-x-auto">
        {[
          { key: 'overview',  label: 'Overview' },
          { key: 'sales',     label: 'Sales' },
          { key: 'timeline',  label: 'Timeline' },
          { key: 'convert', label: '🎉 Convert' },
        ].map((t) => (
          <button key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`text-xs font-semibold py-3 px-3 border-b-2 transition-colors
              ${tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact</p>
            <InfoRow label="Email"         value={lead.email} />
            <InfoRow label="Phone"         value={lead.phone} />
            <InfoRow label="Mobile"        value={lead.mobile} />
            <InfoRow label="WhatsApp"      value={lead.whatsapp} />
            <InfoRow label="Industry"      value={lead.industry} />
            <InfoRow label="Website"       value={lead.website} />
            <InfoRow label="Rating"        value={lead.rating} />
            <InfoRow label="Priority"      value={lead.priority} />
            <InfoRow label="Source"        value={(lead.source ?? '').replace(/_/g, ' ')} />
            <InfoRow label="Score"         value={lead.score} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Address</p>
            <InfoRow label="Address"    value={lead.address} />
            <InfoRow label="City"       value={lead.city} />
            <InfoRow label="State"      value={lead.state} />
            <InfoRow label="Country"    value={lead.country} />
            <InfoRow label="Postal Code" value={lead.postalCode} />
            {lead.notes && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">{lead.notes}</p>
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Requirement</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">{lead.requirement}</p>
              </>
            )}
            {lead.painPoints && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Pain Points</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 whitespace-pre-wrap">{lead.painPoints}</p>
              </>
            )}
            {lead.lostReason && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Lost Reason</p>
                <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{lead.lostReason}</p>
              </>
            )}
            {lead.campaign && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Marketing</p>
                <InfoRow label="Campaign"    value={lead.campaign} />
                <InfoRow label="UTM Source"  value={lead.utmSource} />
                <InfoRow label="UTM Medium"  value={lead.utmMedium} />
                <InfoRow label="Landing Page" value={lead.landingPage} />
              </>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div>
            {tlLoading ? (
              <div className="flex justify-center py-10">
                <div className="flex gap-1.5">
                  {[0,1,2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                {timelineEvents.map((ev: any, i: number) => (
                  <div key={ev._id ?? i} className="relative">
                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-white dark:bg-gray-900 border-2 border-brand-400" />
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_COLORS[ev.action] ?? 'bg-gray-100 text-gray-600'}`}>
                          {(ev.action ?? '').replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'convert' && (
          <ConvertTab lead={lead} />
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [view,        setView]        = useState<'kanban'|'list'>('kanban');
  const [search,      setSearch]      = useState('');
  const [filterSrc,   setFilterSrc]   = useState('');
  const [filterRating,setFilterRating]= useState('');
  const [panelMode,   setPanelMode]   = useState<'none'|'create'|'edit'|'detail'>('none');
  const [selectedLead,setSelectedLead]= useState<any | null>(null);
  const [form,        setForm]        = useState<any>({ ...EMPTY_FORM });
  const [saving,      setSaving]      = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dragLeadRef = useRef<any>(null);
  const currentBranch = useBranchStore((s) => s.currentBranch);

  const { data, isLoading } = useLeadsQuery({
    search:      search || undefined,
    source:      filterSrc    || undefined,
    rating:      filterRating || undefined,
    limit:       500,
  });
  const leads = data?.items ?? [];

  const createMut      = useLeadCreate();
  const updateMut      = useLeadUpdate();
  const deleteMut      = useLeadDelete();
  const stageMut       = useLeadUpdateStage();
  const { data: statsData } = useLeadsStatsQuery();

  // ── Kanban grouping
  const byStage = STAGES.reduce<Record<string, any[]>>((acc, s) => {
    acc[s.key] = leads.filter((l) => l.status === s.key);
    return acc;
  }, {} as any);

  // ── Drag & Drop
  const handleDragStart = useCallback((e: React.DragEvent, lead: any) => {
    dragLeadRef.current = lead;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const lead = dragLeadRef.current;
    if (!lead || lead.status === stageKey) return;
    stageMut.mutate({ id: lead._id, status: stageKey });
    dragLeadRef.current = null;
  }, [stageMut]);

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
        await createMut.mutateAsync(payload);
      } else if (panelMode === 'edit' && selectedLead) {
        await updateMut.mutateAsync({ id: selectedLead._id, data: payload });
      }
      closePanel();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead: any) => {
    if (!confirm(`Delete lead "${fullName(lead)}"?`)) return;
    await deleteMut.mutateAsync(lead._id);
    closePanel();
  };

  const panelOpen = panelMode !== 'none';

  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Main area */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${panelOpen ? 'mr-[50vw]' : ''}`}>
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 mr-2">
            <UserPlusIcon className="h-5 w-5 text-violet-600" />
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Leads</h1>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{leads.length}</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters toggle */}
          <button onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
              ${showFilters ? 'border-brand-400 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            Filters <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
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
              <PlusIcon className="h-4 w-4" /> New Lead
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {statsData && (
          <div className="flex gap-3 px-5 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            {[
              { icon: UserPlusIcon,        label: 'Total Leads',    value: String(statsData.total),                           color: 'text-violet-600' },
              { icon: CurrencyRupeeIcon,   label: 'Pipeline Value', value: '₹' + (statsData.totalRevenue ?? 0).toLocaleString('en-IN'), color: 'text-blue-600'   },
              { icon: TrophyIcon,          label: 'Won',            value: String(statsData.converted),                       color: 'text-emerald-600'},
              { icon: ArrowTrendingUpIcon, label: 'Conversion',     value: `${statsData.conversionRate}%`,                   color: 'text-orange-500' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-1.5 min-w-[120px]">
                <stat.icon className={`h-4 w-4 ${stat.color} flex-shrink-0`} />
                <div>
                  <p className="text-[10px] text-gray-400 font-medium">{stat.label}</p>
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        {showFilters && (
          <div className="flex items-center gap-3 px-5 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <select className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={filterSrc} onChange={(e) => setFilterSrc(e.target.value)}>
              <option value="">All Sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
              <option value="">All Ratings</option>
              {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {(filterSrc || filterRating) && (
              <button onClick={() => { setFilterSrc(''); setFilterRating(''); }} className="text-xs text-red-500 hover:text-red-700">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Company filter bar */}
        <div className="px-5 pt-2 shrink-0 bg-white dark:bg-gray-900">
          <CompanyFilterBar />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex gap-2">
                {[0,1,2].map((i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            </div>
          ) : view === 'kanban' ? (
            <div className="flex gap-3 p-4 min-w-max h-full">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  leads={byStage[stage.key] ?? []}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onCardClick={openDetail}
                />
              ))}
            </div>
          ) : (
            /* List view */
            <div className="p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Lead</th>
                      <th className="px-4 py-3 text-left font-semibold">Contact</th>
                      <th className="px-4 py-3 text-left font-semibold">Source</th>
                      <th className="px-4 py-3 text-left font-semibold">Stage</th>
                      <th className="px-4 py-3 text-left font-semibold">Rating</th>
                      <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                      <th className="px-4 py-3 text-left font-semibold">Company</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {leads.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-gray-400">No leads found</td></tr>
                    )}
                    {leads.map((lead) => {
                      const s = STAGES.find((x) => x.key === lead.status);
                      return (
                        <tr key={lead._id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => openDetail(lead)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white">{fullName(lead)}</div>
                            {lead.company && <div className="text-xs text-gray-400">{lead.company}</div>}
                            <div className="text-xs text-gray-400">{lead.leadId}</div>
                          </td>
                          <td className="px-4 py-3">
                            {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                            {lead.phone && <div className="text-xs text-gray-500">{lead.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[lead.source] ?? 'bg-gray-100 text-gray-600'}`}>
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
                              <span className={`h-2 w-2 rounded-full ${RATING_COLORS[lead.rating] ?? 'bg-gray-300'}`} />
                              {lead.rating}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">
                            {formatCurrency(lead.expectedRevenue)}
                          </td>
                          <td className="px-4 py-3">
                            <CompanyBadge branchId={lead.branchId} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(lead); }}
                              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 mr-1">Edit</button>
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
        <div className="fixed right-0 top-0 bottom-0 w-[50vw] min-w-[600px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-30 flex flex-col overflow-hidden">
          {(panelMode === 'create' || panelMode === 'edit') && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {panelMode === 'create' ? 'New Lead' : `Edit: ${fullName(selectedLead)}`}
                </h2>
                <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
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
    </div>
  );
}
