import { useState, useEffect, useMemo } from 'react';
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
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useCustomerNameMap } from '../../../modules/native-crm/shared/useCustomerNameMap';

const STEP_LABEL: Record<string, string> = { quotation: 'Quotation', contract: 'Contract', invoice: 'Invoice' };
const STEP_PATH:  Record<string, string> = {
  quotation: '/native-crm/quotations',
  contract:  '/native-crm/contracts',
  invoice:   '/native-crm/invoices',
};

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

  // Tenant-configurable pipeline stages override the static defaults above —
  // falls back to today's hardcoded list while loading/on error/unconfigured.
  const { stages: pipelineStages } = usePipelineStages('workorder');
  const statusOptions = pipelineStages.length > 0
    ? [...pipelineStages].sort((a, b) => a.order - b.order).map((s) => s.key)
    : STATUS_OPTIONS;
  const fields = useMemo(
    () => FIELDS.map((f) => (f.key === 'status' ? { ...f, options: statusOptions } : f)),
    [statusOptions],
  );

  const customerNames = useCustomerNameMap();
  const columns: FSColumnDef[] = useMemo(() => [
    { key: 'workOrderId',   label: 'ID' },
    { key: 'title',         label: 'Title' },
    { key: 'customerName',  label: 'Customer',
      render: (r) => customerNames.get(r.customerId) ?? r.customerId ?? '—',
      exportValue: (r) => customerNames.get(r.customerId) ?? r.customerId ?? '' },
    { key: 'customerId',    label: 'Customer ID' },
    { key: 'scheduledDate', label: 'Scheduled', render: (r) => {
      if (!r.scheduledDate) return '—';
      const d = new Date(r.scheduledDate);
      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
      return hasTime ? d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString();
    }},
    { key: 'staffIds', label: 'Staff', render: (r) => {
      const ids: string[] = r.staffIds?.length ? r.staffIds : (r.staffId ? [r.staffId] : []);
      return ids.length ? ids.join(', ') : '—';
    }},
    { key: 'durationHours', label: 'Duration', render: (r) => formatDuration(r.durationHours) },
    { key: 'priority',      label: 'Priority',  render: (r) => {
      const colors: Record<string, string> = { high: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15', medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15', low: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/15' };
      const c = colors[r.priority] ?? 'text-text-muted bg-black/[0.06] dark:bg-white/[0.08]';
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c}`}>{r.priority ?? 'medium'}</span>;
    }},
    { key: 'status',   label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
    { key: 'branchId', label: 'Company', render: (r) => <CompanyBadge branchId={r.branchId} /> },
    { key: 'createdAt', label: 'Created Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ], [customerNames]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.openDrawer) {
      setDrawer({ open: true, record: state.prefill ?? null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading, error } = useWorkordersListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useWorkorderCreate();
  const updateMutation = useWorkorderUpdate();
  const deleteMutation = useWorkorderDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 flex items-center justify-center shrink-0">
            <ClipboardDocumentListIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Work Orders</h1>
            <p className="text-xs text-text-muted">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work orders…"
            className="pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg w-52 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        >
          <option value="">All Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Work Order
        </button>
      </div>

      <div className="px-6 pt-3 shrink-0">
        <CompanyFilterBar />
      </div>

      <FSTable
        columns={columns}
        data={items}
        loading={isLoading}
        errorStatus={(error as any)?.response?.status}
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
          const nextStep = steps[idx + 1] as 'quotation' | 'contract' | 'invoice';
          const path = STEP_PATH[nextStep];
          if (!path) return null;
          if ((row as any).workflowState === 'complete') {
            return (
              <span
                title={`Already converted to a ${STEP_LABEL[nextStep] ?? nextStep}`}
                className="px-2 py-1 rounded text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] text-text-muted"
              >
                Converted
              </span>
            );
          }
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(path, { state: { openDrawer: true, prefill: buildPrefill(row, 'workorder', nextStep) } });
              }}
              title={`Create ${STEP_LABEL[nextStep] ?? nextStep} from this work order`}
              className="px-2 py-1 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-colors"
            >
              {'→'} {STEP_LABEL[nextStep] ?? nextStep}
            </button>
          );
        }}
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Work Order' : 'New Work Order'}
          fields={fields}
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
