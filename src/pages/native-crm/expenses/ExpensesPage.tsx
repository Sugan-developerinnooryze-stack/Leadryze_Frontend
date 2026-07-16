import { useState, useEffect } from 'react';
import { CreditCardIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useExpensesListQuery,
  useExpenseCreate,
  useExpenseUpdate,
  useExpenseDelete,
} from '../../../modules/native-crm/queries/expenses.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId',    label: 'Company',        type: 'branch-select' },
  { key: 'title',       label: 'Title',          type: 'text',     required: true },
  { key: 'category',    label: 'Category',       type: 'text',     placeholder: 'e.g. Fuel, Materials, Labour' },
  { key: 'amount',      label: 'Amount',         type: 'currency', required: true },
  { key: 'date',        label: 'Date',           type: 'text',     placeholder: 'YYYY-MM-DD' },
  { key: 'paidBy',      label: 'Paid By',        type: 'text',     placeholder: 'Staff name or ID' },
  { key: 'workOrderId', label: 'Work Order ID',  type: 'text',     placeholder: 'Link to work order' },
  { key: 'notes',       label: 'Notes',          type: 'textarea' },
  { key: 'status',      label: 'Status',         type: 'select',   options: ['pending', 'approved', 'rejected'] },
];

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending:  'bg-amber-100 text-amber-700',
};

const COLUMNS: FSColumnDef[] = [
  { key: 'expenseId',   label: 'ID' },
  { key: 'title',       label: 'Title' },
  { key: 'category',    label: 'Category', render: (r) => r.category ?? 'â€”' },
  { key: 'amount',      label: 'Amount',   render: (r) => r.amount != null ? `$${Number(r.amount).toFixed(2)}` : 'â€”' },
  { key: 'paidBy',      label: 'Paid By',  render: (r) => r.paidBy ?? 'â€”' },
  { key: 'date',        label: 'Date',     render: (r) => r.date ? new Date(r.date).toLocaleDateString() : 'â€”' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
        {r.status}
      </span>
    ),
  },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

export default function ExpensesPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useExpensesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useExpenseCreate();
  const updateMutation = useExpenseUpdate();
  const deleteMutation = useExpenseDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
            <CreditCardIcon className="h-5 w-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Expenses</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expensesâ€¦"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Expense
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
        moduleKey="expenses"
        emptyIcon={CreditCardIcon}
        emptyLabel="No expenses yet â€” create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Expense' : 'New Expense'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="expenses"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.title ?? 'this expense'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
