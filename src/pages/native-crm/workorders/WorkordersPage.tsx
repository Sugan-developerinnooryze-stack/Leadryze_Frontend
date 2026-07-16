import { useState, useEffect } from 'react';
import { ClipboardDocumentListIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNavigate, useLocation } from 'react-router-dom';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import {
  useWorkordersListQuery,
  useWorkorderCreate,
  useWorkorderUpdate,
  useWorkorderDelete,
} from '../../../modules/native-crm/queries/workorders.queries';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import { buildPrefill } from '../../../modules/native-crm/shared/buildPrefill';
import { formatDuration } from '../../../modules/native-crm/shared/duration';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId',      label: 'Company',         type: 'branch-select' },
  { key: 'customerId',    label: 'Customer',        type: 'lookup',       required: true,
    lookupModule: 'customers', lookupValueField: 'customerId', lookupLabelField: 'name' },
  { key: 'title',         label: 'Title',           type: 'text',         required: true },
  { key: 'siteId',        label: 'Site',            type: 'lookup',
    lookupModule: 'sites', lookupValueField: 'siteId', lookupLabelField: 'name',
    cascadeParentField: 'customerId' },
  { key: 'teamId',        label: 'Team',            type: 'lookup',
    lookupModule: 'teams', lookupValueField: 'teamId', lookupLabelField: 'name' },
  { key: 'staffIds',      label: 'Staff',           type: 'multilookup',
    lookupModule: 'staffs', multilookupValueField: 'staffId', lookupLabelField: 'fullName',
    cascadeParentField: 'teamId' },
  { key: 'categoryId',    label: 'Category Filter', type: 'lookup',       filterOnly: true,
    lookupModule: 'categories', lookupValueField: '_id', lookupLabelField: 'name' },
  { key: 'services',      label: 'Service Lines',   type: 'servicelines', categoryFilterField: 'categoryId' },
  { key: 'scheduledDate', label: 'Scheduled Date & Time', type: 'datetime' },
  { key: 'skills',        label: 'Required Skills', type: 'multiselect',
    options: ['electrical', 'plumbing', 'hvac', 'cleaning', 'carpentry', 'painting', 'roofing'] },
  { key: 'priority',      label: 'Priority',        type: 'select', options: ['low', 'medium', 'high'] },
  { key: 'status',        label: 'Status',          type: 'select', options: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'] },
  { key: 'notes',         label: 'Notes',           type: 'textarea' },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'workOrderId',   label: 'ID' },
  { key: 'title',         label: 'Title' },
  { key: 'customerId',    label: 'Customer' },
  { key: 'scheduledDate', label: 'Scheduled', render: (r) => {
    if (!r.scheduledDate) return 'â€"';
    const d = new Date(r.scheduledDate);
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    return hasTime ? d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString();
  }},
  { key: 'staffIds', label: 'Staff', render: (r) => {
    const ids: string[] = r.staffIds?.length ? r.staffIds : (r.staffId ? [r.staffId] : []);
    return ids.length ? ids.join(', ') : 'â€"';
  }},
  { key: 'durationHours', label: 'Duration', render: (r) => formatDuration(r.durationHours) },
  { key: 'priority',      label: 'Priority',  render: (r) => {
    const colors: Record<string, string> = { high: 'text-red-600 bg-red-50', medium: 'text-amber-600 bg-amber-50', low: 'text-green-600 bg-green-50' };
    const c = colors[r.priority] ?? 'text-gray-600 bg-gray-50';
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c}`}>{r.priority ?? 'medium'}</span>;
  }},
  { key: 'status',   label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
  { key: 'branchId', label: 'Company', render: (r) => <CompanyBadge branchId={r.branchId} /> },
];

const STATUS_OPTIONS = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];

export default function WorkordersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  const { data: settings } = useFSSettingsQuery();

  useEffect(() => {
    const state = location.state as any;
    if (state?.openDrawer) {
      setDrawer({ open: true, record: state.prefill ?? null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useWorkordersListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useWorkorderCreate();
  const updateMutation = useWorkorderUpdate();
  const deleteMutation = useWorkorderDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
            <ClipboardDocumentListIcon className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Work Orders</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work ordersâ€¦"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Work Order
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
        onEdit={(r) => setDrawer({
          open: true,
          // Legacy records may only have single staffId — normalize into staffIds for the drawer
          record: { ...r, staffIds: r.staffIds?.length ? r.staffIds : (r.staffId ? [r.staffId] : []) },
        })}
        onDelete={setDelTarget}
        moduleKey="workorders"
        emptyIcon={ClipboardDocumentListIcon}
        emptyLabel="No work orders yet - create your first one"
        onRowClick={(r) => navigate(`/native-crm/workorders/${r._id}`)}
        extraRowActions={(row) => {
          const steps: string[] = settings?.workflowSteps ?? ['quotation', 'workorder', 'invoice'];
          const idx = steps.indexOf('workorder');
          if (idx < 0 || idx >= steps.length - 1) return null;
          const nextStep = steps[idx + 1];
          if (nextStep !== 'invoice') return null;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/native-crm/invoices', { state: { openDrawer: true, prefill: buildPrefill(row, 'workorder', 'invoice') } });
              }}
              title="Create Invoice from this work order"
              className="px-2 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
            >
              {'→'} Invoice
            </button>
          );
        }}
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Work Order' : 'New Work Order'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="workorders"
          onUnlocked={() => setDrawer({ open: false, record: null })}
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.title ?? 'this work order'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
