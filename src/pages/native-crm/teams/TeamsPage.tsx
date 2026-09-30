import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserGroupIcon, PlusIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useTeamsListQuery,
  useTeamCreate,
  useTeamUpdate,
  useTeamDelete,
} from '../../../modules/native-crm/queries/teams.queries';
import {
  useStaffsListQuery,
  useStaffUpdate,
} from '../../../modules/native-crm/queries/staffs.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'name',        label: 'Team Name',   type: 'text',        required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'status',      label: 'Status',      type: 'select',      options: ['active', 'inactive'] },
  { key: 'managerUserId', label: 'Manager', type: 'lookup',
    lookupModule: 'users', lookupValueField: '_id', lookupLabelField: 'fullName' },
  { key: 'staffIds',    label: 'Staff Members', type: 'multilookup',
    lookupModule: 'staffs', lookupLabelField: 'fullName' },
  { key: 'serviceIds',  label: 'Services Handled', type: 'multilookup',
    lookupModule: 'services', lookupLabelField: 'name' },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'teamId',      label: 'ID' },
  { key: 'name',        label: 'Team Name', render: (r: any) => (
    <span className="inline-flex items-center gap-1.5">
      {r.name}
      {r.source === 'supervisor_flow' && (
        <span
          className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium shrink-0"
          title="Created via the Supervisors page"
        >
          Via Supervisor
        </span>
      )}
    </span>
  ) },
  { key: 'description', label: 'Description' },
  { key: 'status',      label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'active'} /> },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
  { key: 'createdAt', label: 'Created Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
];

export default function TeamsPage() {
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading, error } = useTeamsListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useTeamCreate();
  const updateMutation = useTeamUpdate();
  const deleteMutation = useTeamDelete();
  const staffUpdateMutation = useStaffUpdate();
  const { data: allStaffsData } = useStaffsListQuery({ page: 1, limit: 500 });

  const handleEdit = (r: any) => {
    const allStaffs = allStaffsData?.items ?? [];
    const teamId = r._id?.toString();
    const staffIds = allStaffs
      .filter(s => {
        const tid = typeof s.teamId === 'object' ? s.teamId?._id?.toString() : s.teamId?.toString();
        return tid === teamId;
      })
      .map(s => s._id?.toString());
    setDrawer({ open: true, record: { ...r, staffIds } });
  };

  const handleCreate = async (data: any) => {
    const { staffIds, ...teamData } = data;
    const res = await createMutation.mutateAsync(teamData);
    const teamMongoId = res.data?.data?._id ?? res.data?._id;
    if (staffIds?.length && teamMongoId) {
      await Promise.all(staffIds.map((sid: string) =>
        staffUpdateMutation.mutateAsync({ id: sid, data: { teamId: teamMongoId } })
      ));
    }
    return res;
  };

  const handleUpdate = async (id: string, data: any) => {
    const { staffIds, ...teamData } = data;
    const res = await updateMutation.mutateAsync({ id, data: teamData });
    const allStaffs = allStaffsData?.items ?? [];
    // Clear teamId from staffs previously in this team but now removed
    const prevStaffIds = allStaffs
      .filter(s => {
        const tid = typeof s.teamId === 'object' ? s.teamId?._id?.toString() : s.teamId?.toString();
        return tid === id;
      })
      .map(s => s._id?.toString());
    const removed = prevStaffIds.filter(sid => !(staffIds ?? []).includes(sid));
    const added   = (staffIds ?? []).filter((sid: string) => !prevStaffIds.includes(sid));
    await Promise.all([
      ...removed.map((sid: string) => staffUpdateMutation.mutateAsync({ id: sid, data: { teamId: null } })),
      ...added.map((sid: string)   => staffUpdateMutation.mutateAsync({ id: sid, data: { teamId: id } })),
    ]);
    return res;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
            <UserGroupIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Teams</h1>
            <p className="text-xs text-text-muted">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams…"
            className="pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg w-52 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Team
        </button>
      </div>

      <div className="px-6 pt-3 shrink-0">
        <CompanyFilterBar />
      </div>

      <FSTable
        columns={COLUMNS}
        data={items}
        loading={isLoading}
        errorStatus={(error as any)?.response?.status}
        total={meta.total}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        onEdit={handleEdit}
        onRowClick={(r) => navigate(`/native-crm/teams/${r._id}`)}
        extraRowActions={(r) => (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/native-crm/teams/${r._id}`); }} title="View Details" className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-colors">
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
        onDelete={setDelTarget}
        moduleKey="teams"
        emptyIcon={UserGroupIcon}
        emptyLabel="No teams yet — create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Team' : 'New Team'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          module="teams"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name ?? 'this team'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
