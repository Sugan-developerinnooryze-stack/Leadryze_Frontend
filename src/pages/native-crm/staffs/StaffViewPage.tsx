import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, UserIcon, WrenchScrewdriverIcon, KeyIcon,
} from '@heroicons/react/24/outline';
import { useStaffQuery } from '../../../modules/native-crm/queries/staffs.queries';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';
import CredentialsPanel from '../../../modules/native-crm/shared/CredentialsPanel';
import { renderFieldValue } from '../../../modules/native-crm/shared/fieldValueRenderer';

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: UserIcon },
  { id: 'workorders',  label: 'Work Orders', icon: WrenchScrewdriverIcon },
  { id: 'credentials', label: 'Credentials', icon: KeyIcon },
];

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  );
}

const WORKORDER_COLS: FSColumnDef[] = [
  { key: 'workOrderId',   label: 'ID' },
  { key: 'title',         label: 'Title' },
  { key: 'customerId',    label: 'Customer' },
  { key: 'scheduledDate', label: 'Scheduled', render: (r) => {
    if (!r.scheduledDate) return '—';
    const d = new Date(r.scheduledDate);
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    return hasTime ? d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString();
  }},
  { key: 'status', label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
];

function AssignedWorkorders({ staffId, onRowClick }: { staffId: string; onRowClick: (r: any) => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWorkordersListQuery({ page, limit: 10, staffId });
  const items = data?.items ?? [];
  const meta  = data?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
      <FSTable
        columns={WORKORDER_COLS}
        data={items}
        loading={isLoading}
        total={meta.total}
        page={meta.page}
        limit={10}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        onEdit={onRowClick}
        onDelete={() => {}}
        onRowClick={onRowClick}
        emptyIcon={WrenchScrewdriverIcon}
        emptyLabel="No work orders assigned to this staff yet"
      />
    </div>
  );
}

export default function StaffViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: item, isLoading } = useStaffQuery(id ?? '');

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Staff not found.</div>;

  const fullName = `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
  const teamName = typeof item.teamId === 'object' ? item.teamId?.name : undefined;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/native-crm/staffs')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Staffs
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200">
            <UserIcon className="h-8 w-8 text-orange-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-600">
              {item.staffId && <p><strong>ID:</strong> {item.staffId}</p>}
              {item.email && <p><strong>Email:</strong> {item.email}</p>}
              {item.phone && <p><strong>Phone:</strong> {item.phone}</p>}
              {item.role && <p><strong>Role:</strong> {item.role}</p>}
              {teamName && <p><strong>Team:</strong> {teamName}</p>}
            </div>
          </div>
          <div className="shrink-0">
            <FSStatusBadge value={item.status ?? 'active'} />
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
                    active
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                  <h3 className="text-sm font-semibold text-gray-700">Staff Details</h3>
                </div>
                <div className="px-6 py-4">
                  <InfoRow label="Staff ID"   value={item.staffId} />
                  <InfoRow label="First Name" value={item.firstName} />
                  <InfoRow label="Last Name"  value={item.lastName} />
                  <InfoRow label="Email"      value={item.email} />
                  <InfoRow label="Phone"      value={item.phone} />
                  <InfoRow label="Role"       value={item.role} />
                  <InfoRow label="Team"       value={teamName} />
                  <InfoRow label="Status"     value={<FSStatusBadge value={item.status ?? 'active'} />} />
                  <InfoRow label="Skills"     value={item.skills?.length ? item.skills.join(', ') : undefined} />
                  {item.location?.lat != null && (
                    <InfoRow label="Last Location" value={`${item.location.lat}, ${item.location.lng}`} />
                  )}
                  <InfoRow label="Created" value={item.createdAt ? new Date(item.createdAt).toLocaleString() : undefined} />
                </div>
              </div>

              {item.customFields && Object.keys(item.customFields).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">Custom Fields</h3>
                  </div>
                  <div className="px-6 py-4">
                    {Object.entries(item.customFields).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ').toUpperCase()} value={renderFieldValue(v)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workorders' && item.staffId && (
            <AssignedWorkorders
              staffId={item.staffId}
              onRowClick={(r: any) => navigate(`/native-crm/workorders/${r._id}`)}
            />
          )}

          {activeTab === 'credentials' && id && (
            <CredentialsPanel entity="staffs" id={id} appName="Staff App" />
          )}
        </div>
      </div>
    </div>
  );
}
