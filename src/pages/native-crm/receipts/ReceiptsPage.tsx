import { useState, useEffect } from 'react';
import { ReceiptRefundIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useReceiptsListQuery,
  useReceiptCreate,
  useReceiptUpdate,
  useReceiptDelete,
} from '../../../modules/native-crm/queries/receipts.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'invoiceId',     label: 'Invoice ID',      type: 'text',     required: true, placeholder: 'Invoice reference' },
  { key: 'customerId',    label: 'Customer ID',     type: 'text',     required: true, placeholder: 'Customer reference' },
  { key: 'amount',        label: 'Amount',          type: 'currency', required: true, placeholder: '0.00' },
  { key: 'paymentMethod', label: 'Payment Method',  type: 'select',   options: ['cash', 'bank_transfer', 'card', 'cheque', 'online'] },
  { key: 'paymentDate',   label: 'Payment Date',    type: 'text',     placeholder: 'YYYY-MM-DD' },
  { key: 'status',        label: 'Status',          type: 'select',   options: ['pending', 'completed', 'refunded'] },
  { key: 'notes',         label: 'Notes',           type: 'textarea' },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'receiptId',     label: 'ID' },
  { key: 'invoiceId',     label: 'Invoice' },
  { key: 'customerId',    label: 'Customer' },
  { key: 'amount',        label: 'Amount',  render: (r) => r.amount != null ? `$${Number(r.amount).toFixed(2)}` : 'â€”' },
  { key: 'paymentMethod', label: 'Method',  render: (r) => r.paymentMethod?.replace(/_/g, ' ') ?? 'â€”' },
  { key: 'paymentDate',   label: 'Date',    render: (r) => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : 'â€”' },
  { key: 'status',        label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'completed'} /> },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

const STATUS_OPTIONS = ['pending', 'completed', 'refunded'];

export default function ReceiptsPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useReceiptsListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useReceiptCreate();
  const updateMutation = useReceiptUpdate();
  const deleteMutation = useReceiptDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <ReceiptRefundIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Receipts</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receiptsâ€¦"
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
          New Receipt
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
        moduleKey="receipts"
        emptyIcon={ReceiptRefundIcon}
        emptyLabel="No receipts yet â€” create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Receipt' : 'New Receipt'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="receipts"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.receiptId ?? 'this receipt'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
