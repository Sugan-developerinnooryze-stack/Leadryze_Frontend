import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, UserCircleIcon, BriefcaseIcon, ClockIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import ActivityFeedPanel from '../../../modules/native-crm/shared/ActivityFeedPanel';
import { useContactQuery } from '../../../modules/crm/queries/contacts.queries';
import { useDealsQuery } from '../../../modules/native-crm/queries/deals.queries';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';

const TABS = [
  { id: 'overview', label: 'Overview', icon: UserCircleIcon },
  { id: 'deals',    label: 'Deals',    icon: BriefcaseIcon },
  { id: 'activity', label: 'Activity', icon: ClockIcon },
];

const LIFECYCLE_COLORS: Record<string, string> = {
  subscriber: 'bg-slate-100 text-slate-600',
  lead: 'bg-amber-100 text-amber-700',
  marketing_qualified_lead: 'bg-amber-100 text-amber-700',
  sales_qualified_lead: 'bg-blue-100 text-blue-700',
  opportunity: 'bg-purple-100 text-purple-700',
  customer: 'bg-emerald-100 text-emerald-700',
  evangelist: 'bg-emerald-100 text-emerald-700',
  other: 'bg-slate-100 text-slate-600',
};

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  );
}

const DEAL_COLS: FSColumnDef[] = [
  { key: 'title',  label: 'Deal' },
  { key: 'amount', label: 'Amount', render: (r) => r.amount ? `${r.currency ?? 'INR'} ${Number(r.amount).toLocaleString()}` : '—' },
  { key: 'stage',  label: 'Stage', render: (r) => <FSStatusBadge value={r.stage ?? 'prospect'} /> },
];

export default function ContactViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dealsPage, setDealsPage] = useState(1);

  const { data: item, isLoading } = useContactQuery(id ?? '');
  const fullName = item ? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() : '';
  const { data: dealsData, isLoading: dealsLoading } = useDealsQuery(
    { page: dealsPage, limit: 10, search: fullName },
    activeTab === 'deals' && !!fullName,
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Contact not found.</div>;

  const initials = `${item.firstName?.[0] ?? ''}${item.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/crm/contacts')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Contacts
          </button>
          <button
            onClick={() => navigate('/crm/contacts')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
            <span className="text-xl font-bold text-indigo-600">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{fullName || 'Unnamed Contact'}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 text-sm text-gray-600">
              {item.jobTitle && item.company && <p>{item.jobTitle} at <strong className="text-gray-800">{item.company}</strong></p>}
              {item.jobTitle && !item.company && <p>{item.jobTitle}</p>}
              {!item.jobTitle && item.company && <p><strong className="text-gray-800">{item.company}</strong></p>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-gray-500">
              {item.email && <p>{item.email}</p>}
              {item.phone && <p>{item.phone}</p>}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            {item.lifecycleStage && (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${LIFECYCLE_COLORS[item.lifecycleStage] ?? 'bg-slate-100 text-slate-600'}`}>
                {item.lifecycleStage.replace(/_/g, ' ')}
              </span>
            )}
            <FSStatusBadge value={item.status ?? 'lead'} />
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-64 bg-white border-r border-gray-200 shrink-0 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    active ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">Contact Details</h3>
                </div>
                <div className="px-6 py-4">
                  <InfoRow label="First Name" value={item.firstName} />
                  <InfoRow label="Last Name" value={item.lastName} />
                  <InfoRow label="Email" value={item.email} />
                  <InfoRow label="Phone" value={item.phone} />
                  <InfoRow label="Company" value={item.company} />
                  <InfoRow label="Job Title" value={item.jobTitle} />
                  <InfoRow label="Contact Owner" value={item.contactOwner} />
                  <InfoRow label="Lead Status" value={item.leadStatus?.replace(/_/g, ' ')} />
                  <InfoRow label="Source" value={item.source} />
                  <InfoRow label="Notes" value={item.notes} />
                </div>
              </div>

              {item.customFields && Object.keys(item.customFields).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">Custom Fields</h3>
                  </div>
                  <div className="px-6 py-4">
                    {Object.entries(item.customFields).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ').toUpperCase()} value={String(v ?? '—')} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deals' && (
            <div className="max-w-4xl">
              <p className="text-xs text-gray-400 mb-3">
                Matched by contact name — Deals don't yet carry a direct link to Contacts, so this list may miss or over-include records with similar names.
              </p>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[560px] overflow-hidden">
                <FSTable
                  columns={DEAL_COLS}
                  data={dealsData?.items ?? []}
                  loading={dealsLoading}
                  total={dealsData?.meta.total ?? 0}
                  page={dealsPage}
                  limit={10}
                  totalPages={dealsData?.meta.totalPages ?? 1}
                  onPageChange={setDealsPage}
                  onEdit={() => navigate('/crm/deals')}
                  onDelete={() => {}}
                  onRowClick={() => navigate('/crm/deals')}
                  emptyIcon={BriefcaseIcon}
                  emptyLabel="No matching deals found"
                />
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <ActivityFeedPanel
              relatedModule="contact"
              relatedId={item._id}
              relatedLabel={fullName || item.email || item._id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
