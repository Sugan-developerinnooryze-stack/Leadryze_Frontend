import { useState, useEffect } from 'react';
import { BoltIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useActivitiesListQuery,
  useActivityCreate,
  useActivityUpdate,
  useActivityDelete,
} from '../../../modules/native-crm/queries/activities.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId',     label: 'Company',        type: 'branch-select' },
  { key: 'subject',       label: 'Subject',        type: 'text',     required: true },
  { key: 'type',          label: 'Type',           type: 'select',   options: ['note', 'call', 'email', 'visit', 'task'] },
  { key: 'description',   label: 'Description',    type: 'textarea' },
  { key: 'relatedModule', label: 'Related To',     type: 'select',   options: ['customer', 'workorder', 'quotation', 'contract', 'invoice'] },
  { key: 'relatedId',     label: 'Related ID',     type: 'text',     placeholder: 'e.g. tenant-wo-5' },
  { key: 'assignedTo',    label: 'Assigned To',    type: 'lookup',   lookupModule: 'staffs', lookupValueField: 'staffId', lookupLabelField: 'fullName' },
  { key: 'scheduledAt',   label: 'Scheduled Date', type: 'date' },
  { key: 'status',        label: 'Status',         type: 'select',   options: ['pending', 'completed', 'cancelled'] },
];

const TYPE_COLORS: Record<string, string> = {
  note:  'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted',
  call:  'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  email: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  visit: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  task:  'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
  pending:   'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

const COLUMNS: FSColumnDef[] = [
  { key: 'activityId',   label: 'ID' },
  {
    key: 'type',
    label: 'Type',
    render: (r) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_COLORS[r.type] ?? 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted'}`}>
        {r.type}
      </span>
    ),
  },
  { key: 'subject',      label: 'Subject' },
  { key: 'relatedModule', label: 'Related To', render: (r) => r.relatedModule ? `${r.relatedModule} / ${r.relatedId ?? ''}` : '—' },
  { key: 'assignedTo',   label: 'Assigned To', render: (r) => r.assignedTo ?? '—' },
  { key: 'scheduledAt',  label: 'Scheduled',   render: (r) => r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString() : '—' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[r.status] ?? 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted'}`}>
        {r.status}
      </span>
    ),
  },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

export default function ActivitiesPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading, error } = useActivitiesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useActivityCreate();
  const updateMutation = useActivityUpdate();
  const deleteMutation = useActivityDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
            <BoltIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Activities</h1>
            <p className="text-xs text-text-muted">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities…"
            className="pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg w-52 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Activity
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
        onEdit={(r) => setDrawer({ open: true, record: r })}
        onDelete={setDelTarget}
        moduleKey="activities"
        emptyIcon={BoltIcon}
        emptyLabel="No activities yet — log your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Activity' : 'New Activity'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="activities"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.subject ?? 'this activity'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
