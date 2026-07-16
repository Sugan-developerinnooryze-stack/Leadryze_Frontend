import { useState, useEffect } from 'react';
import { DocumentDuplicateIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNavigate, useLocation } from 'react-router-dom';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';
import ContractFormDrawer from './ContractFormDrawer';
import {
  useContractsListQuery,
  useContractCreate,
  useContractUpdate,
  useContractDelete,
} from '../../../modules/native-crm/queries/contracts.queries';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import { buildPrefill } from '../../../modules/native-crm/shared/buildPrefill';

const STEP_LABEL: Record<string, string> = { workorder: 'WO', invoice: 'Invoice' };
const STEP_PATH:  Record<string, string> = {
  workorder: '/native-crm/workorders',
  invoice:   '/native-crm/invoices',
};

const RECURRING_LABEL: Record<string, string> = {
  day: 'Daily', week: 'Weekly', fortnight: 'Fortnightly', month: 'Monthly',
  bimonthly: 'Bi-Monthly', quarter: 'Quarterly', halfyear: 'Half-Yearly', year: 'Yearly', custom: 'Custom',
};

const COLUMNS: FSColumnDef[] = [
  { key: 'contractId',  label: 'ID' },
  { key: 'title',       label: 'Title' },
  { key: 'customerId',  label: 'Customer' },
  { key: 'serviceRangeSummary', label: 'Service Range', render: (r) =>
    r.serviceRangeSummary || (r.recurringUnit ? RECURRING_LABEL[r.recurringUnit] : 'â€"') },
  { key: 'serviceBalance', label: 'Service Balance', render: (r) => {
    const b = r.serviceBalance;
    if (!b) return 'â€"';
    return (
      <span title={`Total ${b.total} · Completed ${b.completed} · Upcoming ${b.upcoming} · Overdue ${b.overdue} · Cancelled ${b.cancelled}`}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
        {b.remaining} / {b.total}
      </span>
    );
  }},
  { key: 'startDate',   label: 'Start', render: (r) => r.startDate ? new Date(r.startDate).toLocaleDateString() : 'â€"' },
  { key: 'endDate',     label: 'End',   render: (r) => r.endDate   ? new Date(r.endDate).toLocaleDateString()   : 'â€"' },
  { key: 'servicesAmountWithTax', label: 'Total', render: (r) => r.servicesAmountWithTax != null ? `$${Number(r.servicesAmountWithTax).toFixed(2)}` : 'â€"' },
  { key: 'status',   label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
  { key: 'branchId', label: 'Company', render: (r) => <CompanyBadge branchId={r.branchId} /> },
];

const STATUS_OPTIONS = ['draft', 'pending', 'active', 'suspended', 'completed', 'expired', 'cancelled'];

export default function ContractsPage() {
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

  const { data: result, isLoading } = useContractsListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useContractCreate();
  const updateMutation = useContractUpdate();
  const deleteMutation = useContractDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <DocumentDuplicateIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Contracts</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contractsâ€¦"
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
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Contract
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
        moduleKey="contracts"
        emptyIcon={DocumentDuplicateIcon}
        emptyLabel="No contracts yet - create your first one"
        onRowClick={(r) => navigate(`/native-crm/contracts/${r._id}`)}
        extraRowActions={(row) => {
          const steps: string[] = settings?.workflowSteps ?? ['quotation', 'workorder', 'invoice'];
          const idx = steps.indexOf('contract');
          if (idx < 0 || idx >= steps.length - 1) return null;
          const nextStep = steps[idx + 1] as any;
          const path = STEP_PATH[nextStep];
          if (!path) return null;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(path, { state: { openDrawer: true, prefill: buildPrefill(row, 'contract', nextStep) } });
              }}
              title={`Create ${STEP_LABEL[nextStep] ?? nextStep} from this contract`}
              className="px-2 py-1 rounded text-xs font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
            >
              {'→'} {STEP_LABEL[nextStep] ?? nextStep}
            </button>
          );
        }}
      />

      {drawer.open && (
        <ContractFormDrawer
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          onUnlocked={() => setDrawer({ open: false, record: null })}
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.title ?? 'this contract'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
