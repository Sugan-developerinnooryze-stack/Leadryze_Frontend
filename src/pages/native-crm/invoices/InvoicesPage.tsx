import { useState, useEffect } from 'react';
import { BanknotesIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNavigate, useLocation } from 'react-router-dom';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import {
  useInvoicesListQuery,
  useInvoiceCreate,
  useInvoiceUpdate,
  useInvoiceDelete,
} from '../../../modules/native-crm/queries/invoices.queries';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId',      label: 'Company',           type: 'branch-select' },
  { key: 'customerId',    label: 'Customer',          type: 'lookup',       required: true,
    lookupModule: 'customers', lookupValueField: 'customerId', lookupLabelField: 'name' },
  { key: 'workOrderId',   label: 'Linked Work Order', type: 'lookup',
    lookupModule: 'workorders', lookupValueField: 'workOrderId', lookupLabelField: 'title' },
  { key: 'address',       label: 'Address',           type: 'textarea',     required: true },
  { key: 'services',      label: 'Service Lines',     type: 'servicelines', withTotals: true },
  { key: 'discount',      label: 'Discount %',        type: 'number',       placeholder: '0' },
  { key: 'gstPercentage', label: 'GST %',             type: 'number',       placeholder: '0' },
  { key: 'dueDate',       label: 'Due Date',          type: 'date' },
  { key: 'status',        label: 'Status',            type: 'select',       options: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
  { key: 'notes',         label: 'Notes',             type: 'textarea' },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'invoiceId',  label: 'ID' },
  { key: 'customerId', label: 'Customer' },
  { key: 'servicesAmountWithTax', label: 'Total', render: (r) => r.servicesAmountWithTax != null ? `$${Number(r.servicesAmountWithTax).toFixed(2)}` : 'â€"' },
  { key: 'dueDate',    label: 'Due Date', render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'â€"' },
  { key: 'paid',       label: 'Paid',     render: (r) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${r.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {r.paid ? 'Yes' : 'No'}
    </span>
  )},
  { key: 'status',    label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
  { key: 'branchId', label: 'Company', render: (r) => <CompanyBadge branchId={r.branchId} /> },
];

const STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => {
    const state = location.state as any;
    if (state?.openDrawer) {
      setDrawer({ open: true, record: state.prefill ?? null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useInvoicesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useInvoiceCreate();
  const updateMutation = useInvoiceUpdate();
  const deleteMutation = useInvoiceDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <BanknotesIcon className="h-5 w-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Invoices</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoicesâ€¦"
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
          New Invoice
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
        moduleKey="invoices"
        emptyIcon={BanknotesIcon}
        emptyLabel="No invoices yet - create your first one"
        onRowClick={(r) => navigate(`/native-crm/invoices/${r._id}`)}
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Invoice' : 'New Invoice'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="invoices"
          onUnlocked={() => setDrawer({ open: false, record: null })}
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.invoiceId ?? 'this invoice'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
