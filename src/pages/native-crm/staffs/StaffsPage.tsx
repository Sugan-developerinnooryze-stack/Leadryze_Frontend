import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircleIcon, PlusIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useStaffsListQuery,
  useStaffCreate,
  useStaffUpdate,
  useStaffDelete,
} from '../../../modules/native-crm/queries/staffs.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'firstName', label: 'First Name', type: 'text',   required: true },
  { key: 'lastName',  label: 'Last Name',  type: 'text',   required: true },
  { key: 'email',     label: 'Email',      type: 'email' },
  { key: 'phone',     label: 'Phone',      type: 'phone' },
  { key: 'role',      label: 'Role',       type: 'text',   placeholder: 'Technician / Supervisor' },
  { key: 'teamId',    label: 'Team',       type: 'lookup',
    lookupModule: 'teams', lookupValueField: '_id', lookupLabelField: 'name' },
  { key: 'status',    label: 'Status',     type: 'select', options: ['active', 'inactive', 'onleave'] },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'staffId', label: 'ID' },
  { key: 'name',    label: 'Name',   render: (r) => [r.firstName, r.lastName].filter(Boolean).join(' ') || 'â€”' },
  { key: 'email',   label: 'Email' },
  { key: 'phone',   label: 'Phone' },
  { key: 'role',    label: 'Role' },
  { key: 'status',  label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'active'} /> },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

export default function StaffsPage() {
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useStaffsListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useStaffCreate();
  const updateMutation = useStaffUpdate();
  const deleteMutation = useStaffDelete();

  const getDisplayName = (r: any) => [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Staff';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
            <UserCircleIcon className="h-5 w-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Staffs</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staffsâ€¦"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="onleave">On Leave</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Staff
        </button>
      </div>

      <div className="px-6 pt-3 shrink-0">
        <CompanyFilterBar />
      </div>

      <FSTable
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        total={meta.total}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        onEdit={(r) => setDrawer({ open: true, record: r })}
        onDelete={setDelTarget}
        onRowClick={(r) => navigate(`/native-crm/staffs/${r._id}`)}
        extraRowActions={(r) => (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/native-crm/staffs/${r._id}`); }} title="View Details" className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
        moduleKey="staffs"
        emptyIcon={UserCircleIcon}
        emptyLabel="No staff members yet â€” create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Staff' : 'New Staff'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="staffs"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={getDisplayName(delTarget)}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
