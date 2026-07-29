import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, BuildingOffice2Icon, BriefcaseIcon, ClockIcon, UserGroupIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import ActivityFeedPanel from '../../../modules/native-crm/shared/ActivityFeedPanel';
import { useCompanyQuery } from '../../../modules/crm/queries/companies.queries';
import { useContactsListQuery } from '../../../modules/crm/queries/contacts.queries';
import { useDealsQuery } from '../../../modules/native-crm/queries/deals.queries';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BuildingOffice2Icon },
  { id: 'contacts', label: 'Contacts', icon: UserGroupIcon },
  { id: 'deals',    label: 'Deals',    icon: BriefcaseIcon },
  { id: 'activity', label: 'Activity', icon: ClockIcon },
];

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  );
}

const CONTACT_COLS: FSColumnDef[] = [
  { key: 'name',  label: 'Name', render: (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—' },
  { key: 'email', label: 'Email' },
  { key: 'jobTitle', label: 'Job Title' },
];

const DEAL_COLS: FSColumnDef[] = [
  { key: 'title',  label: 'Deal' },
  { key: 'amount', label: 'Amount', render: (r) => r.amount ? `${r.currency ?? 'INR'} ${Number(r.amount).toLocaleString()}` : '—' },
  { key: 'stage',  label: 'Stage', render: (r) => <FSStatusBadge value={r.stage ?? 'prospect'} /> },
];

export default function CompanyViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [contactsPage, setContactsPage] = useState(1);
  const [dealsPage, setDealsPage] = useState(1);

  const { data: item, isLoading } = useCompanyQuery(id ?? '');

  const { data: contactsData, isLoading: contactsLoading } = useContactsListQuery({
    page: contactsPage, limit: 10, search: item?.name,
  });
  const { data: dealsData, isLoading: dealsLoading } = useDealsQuery(
    { page: dealsPage, limit: 10, search: item?.name },
    activeTab === 'deals' && !!item?.name,
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Company not found.</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/crm/companies')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Companies
          </button>
          <button
            onClick={() => navigate('/crm/companies')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" /> Edit
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
            <BuildingOffice2Icon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{item.name}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 text-sm text-gray-600">
              {item.industry && <p>{item.industry}</p>}
              {item.employeeCount && <p>{item.employeeCount} employees</p>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-gray-500">
              {item.website && <p>{item.website}</p>}
              {item.phone && <p>{item.phone}</p>}
              {(item.city || item.country) && <p>{[item.city, item.country].filter(Boolean).join(', ')}</p>}
            </div>
          </div>
          <div className="shrink-0">
            <FSStatusBadge value={item.companyStatus ?? 'active'} />
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
                  <h3 className="text-sm font-semibold text-gray-700">Company Details</h3>
                </div>
                <div className="px-6 py-4">
                  <InfoRow label="Company Name" value={item.name} />
                  <InfoRow label="Domain / Website" value={item.domain || item.website} />
                  <InfoRow label="Industry" value={item.industry} />
                  <InfoRow label="Employees" value={item.employeeCount} />
                  <InfoRow label="Phone" value={item.phone} />
                  <InfoRow label="City" value={item.city} />
                  <InfoRow label="Country" value={item.country} />
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

          {activeTab === 'contacts' && (
            <div className="max-w-4xl">
              <p className="text-xs text-gray-400 mb-3">
                Matched by company name — Contacts don't yet carry a direct link to Companies.
              </p>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[560px] overflow-hidden">
                <FSTable
                  columns={CONTACT_COLS}
                  data={contactsData?.items ?? []}
                  loading={contactsLoading}
                  total={contactsData?.meta.total ?? 0}
                  page={contactsPage}
                  limit={10}
                  totalPages={contactsData?.meta.totalPages ?? 1}
                  onPageChange={setContactsPage}
                  onEdit={() => navigate('/crm/contacts')}
                  onDelete={() => {}}
                  onRowClick={(r: any) => navigate(`/crm/contacts/${r._id}`)}
                  emptyIcon={UserGroupIcon}
                  emptyLabel="No matching contacts found"
                />
              </div>
            </div>
          )}

          {activeTab === 'deals' && (
            <div className="max-w-4xl">
              <p className="text-xs text-gray-400 mb-3">
                Matched by company name — Deals don't yet carry a direct link to Companies.
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
              relatedModule="company"
              relatedId={item._id}
              relatedLabel={item.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
