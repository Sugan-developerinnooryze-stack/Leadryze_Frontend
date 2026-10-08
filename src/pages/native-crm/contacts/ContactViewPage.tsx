import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, UserCircleIcon, BriefcaseIcon, ClockIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import ActivityFeedPanel from '../../../modules/native-crm/shared/ActivityFeedPanel';
import { useContactQuery } from '../../../modules/crm/queries/contacts.queries';
import RecordDrawer from '../../../modules/crm/shared/RecordDrawer';
import { config as contactsConfig } from '../../../modules/crm/contacts/pages/ContactsPage';
import { useDealsQuery } from '../../../modules/native-crm/queries/deals.queries';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';
import { useUserNameMap } from '../../../modules/native-crm/shared/useUserNameMap';
import { useCompanyNameMap } from '../../../modules/native-crm/shared/useCompanyNameMap';

const TABS = [
  { id: 'overview', label: 'Overview', icon: UserCircleIcon },
  { id: 'deals',    label: 'Deals',    icon: BriefcaseIcon },
  { id: 'activity', label: 'Activity', icon: ClockIcon },
];

const LIFECYCLE_COLORS: Record<string, string> = {
  subscriber: 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted',
  lead: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  marketing_qualified_lead: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  sales_qualified_lead: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  opportunity: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  customer: 'bg-success-500/15 text-success-700 dark:text-success-500',
  evangelist: 'bg-success-500/15 text-success-700 dark:text-success-500',
  other: 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted',
};

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-muted w-40 shrink-0">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value ?? '—'}</span>
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
  const [editing, setEditing] = useState(false);

  const { data: item, isLoading, refetch } = useContactQuery(id ?? '');
  const fullName = item ? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() : '';
  const userNameMap = useUserNameMap();
  const companyNameMap = useCompanyNameMap();
  const companyDisplay = (item?.companyId && companyNameMap.get(item.companyId)) || item?.company;
  const ownerDisplay = (item?.contactOwner && userNameMap.get(item.contactOwner)) || item?.contactOwner;
  // LR-CONTACT-001: matches the real contactId link (set via the Deal
  // form's "Link to CRM Contact" field) instead of a fuzzy name search,
  // which could show another contact's deals just for sharing a name.
  const { data: dealsData, isLoading: dealsLoading } = useDealsQuery(
    { page: dealsPage, limit: 10, contactId: item?._id },
    activeTab === 'deals' && !!item?._id,
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!item) return <div className="flex items-center justify-center h-full text-text-muted">Contact not found.</div>;

  const initials = `${item.firstName?.[0] ?? ''}${item.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-border px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/crm/contacts')}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Contacts
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-primary border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-500/30">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary truncate">{fullName || 'Unnamed Contact'}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 text-sm text-text-muted">
              {item.jobTitle && companyDisplay && <p>{item.jobTitle} at <strong className="text-text-primary">{companyDisplay}</strong></p>}
              {item.jobTitle && !companyDisplay && <p>{item.jobTitle}</p>}
              {!item.jobTitle && companyDisplay && <p><strong className="text-text-primary">{companyDisplay}</strong></p>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-text-muted">
              {item.email && <p>{item.email}</p>}
              {item.phone && <p>{item.phone}</p>}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            {item.lifecycleStage && (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${LIFECYCLE_COLORS[item.lifecycleStage] ?? 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted'}`}>
                {item.lifecycleStage.replace(/_/g, ' ')}
              </span>
            )}
            <FSStatusBadge value={item.status ?? 'lead'} />
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-64 bg-surface border-r border-border shrink-0 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    active ? 'bg-ryze-600/10 text-ryze-700 dark:text-ryze-400 shadow-sm'
                      : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-ryze-600 dark:text-ryze-400' : 'text-text-muted'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
                  <h3 className="text-sm font-semibold text-text-primary">Contact Details</h3>
                </div>
                <div className="px-6 py-4">
                  <InfoRow label="First Name" value={item.firstName} />
                  <InfoRow label="Last Name" value={item.lastName} />
                  <InfoRow label="Email" value={item.email} />
                  <InfoRow label="Phone" value={item.phone} />
                  <InfoRow label="Company" value={companyDisplay} />
                  <InfoRow label="Job Title" value={item.jobTitle} />
                  <InfoRow label="Contact Owner" value={ownerDisplay} />
                  <InfoRow label="Lead Status" value={item.leadStatus?.replace(/_/g, ' ')} />
                  <InfoRow label="Source" value={item.source} />
                  <InfoRow label="Notes" value={item.notes} />
                </div>
              </div>

              {item.customFields && Object.keys(item.customFields).length > 0 && (
                <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
                    <h3 className="text-sm font-semibold text-text-primary">Custom Fields</h3>
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
              <p className="text-xs text-text-muted mb-3">
                Matched by contact name — Deals don't yet carry a direct link to Contacts, so this list may miss or over-include records with similar names.
              </p>
              <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[560px] overflow-hidden">
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

      {editing && (
        <RecordDrawer
          config={contactsConfig}
          record={item}
          moduleName="contacts"
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refetch(); }}
        />
      )}
    </div>
  );
}
