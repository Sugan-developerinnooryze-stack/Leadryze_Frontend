import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersIcon, PlusIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import {
  useCustomersListQuery,
  useCustomerCreate,
  useCustomerUpdate,
  useCustomerDelete,
} from '../../../modules/native-crm/queries/customers.queries';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company',   type: 'branch-select' },
  { key: 'name',     label: 'Full Name', type: 'text',    required: true },
  { key: 'email',    label: 'Email',     type: 'email' },
  { key: 'phone',    label: 'Phone',     type: 'phone' },
  { key: 'addEmail', label: 'Additional Emails', type: 'emaillist' },
  { key: 'addPhone', label: 'Additional Phones', type: 'phonelist' },
  { key: 'address',  label: 'Address',   type: 'text' },
  { key: 'city',     label: 'City',      type: 'text' },
  { key: 'state',    label: 'State',     type: 'text' },
  { key: 'postcode', label: 'Postcode',  type: 'text' },
  { key: 'billingName',     label: 'Billing Name',     type: 'text', copyFromKey: 'name',           copyFromLabel: 'Same as Above' },
  { key: 'billingAddress',  label: 'Billing Address',  type: 'text', copyFromKey: 'address',        copyFromLabel: 'Same as Above' },
  { key: 'deliveryAddress', label: 'Delivery Address', type: 'text', copyFromKey: 'billingAddress', copyFromLabel: 'Same as Billing' },
  { key: 'notes',    label: 'Notes',     type: 'textarea' },
  { key: 'status',   label: 'Status',    type: 'select',  options: ['active', 'inactive'] },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'customerId', label: 'ID' },
  { key: 'name',       label: 'Name' },
  { key: 'email',      label: 'Email' },
  { key: 'phone',      label: 'Phone' },
  { key: 'city',       label: 'City' },
  { key: 'status',     label: 'Status',  render: (r) => <FSStatusBadge value={r.status ?? 'active'} /> },
  { key: 'branchId',  label: 'Company', render: (r) => <CompanyBadge branchId={r.branchId} /> },
  { key: 'createdAt', label: 'Created Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading, error } = useCustomersListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useCustomerCreate();
  const updateMutation = useCustomerUpdate();
  const deleteMutation = useCustomerDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-ryze-600/10 flex items-center justify-center shrink-0">
            <UsersIcon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Customers</h1>
            <p className="text-xs text-text-muted">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
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
          New Customer
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
        onRowClick={(r) => navigate(`/native-crm/customers/${r._id}`)}
        extraRowActions={(r) => (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/native-crm/customers/${r._id}`); }} title="View Details" className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-colors">
            <EyeIcon className="h-4 w-4" />
          </button>
        )}
        moduleKey="customers"
        emptyIcon={UsersIcon}
        emptyLabel="No customers yet — create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Customer' : 'New Customer'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="customers"
          onUnlocked={() => setDrawer({ open: false, record: null })}
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name ?? 'this customer'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
