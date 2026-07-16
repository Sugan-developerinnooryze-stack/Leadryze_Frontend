import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, UsersIcon, DocumentTextIcon,
  WrenchScrewdriverIcon, DocumentCheckIcon, CurrencyDollarIcon, BanknotesIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import CredentialsPanel from '../../../modules/native-crm/shared/CredentialsPanel';
import { useCustomerQuery } from '../../../modules/native-crm/queries/customers.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';
import { useContractsListQuery } from '../../../modules/native-crm/queries/contracts.queries';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';
import { useInvoicesListQuery } from '../../../modules/native-crm/queries/invoices.queries';
import { useReceiptsListQuery } from '../../../modules/native-crm/queries/receipts.queries';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: UsersIcon },
  { id: 'quotations', label: 'Quotations', icon: DocumentTextIcon },
  { id: 'contracts',  label: 'Contracts',  icon: DocumentCheckIcon },
  { id: 'workorders', label: 'Work Orders',icon: WrenchScrewdriverIcon },
  { id: 'invoices',   label: 'Invoices',   icon: CurrencyDollarIcon },
  { id: 'receipts',   label: 'Receipts',   icon: BanknotesIcon },
  { id: 'credentials', label: 'Credentials', icon: KeyIcon },
];

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  );
}

function GenericTabList({ queryHook, customerId, onRowClick, columns }: any) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = queryHook({ page, limit: 10, search: customerId });
  const items = data?.items ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
      <FSTable
        columns={columns}
        data={items}
        loading={isLoading}
        total={meta.total}
        page={meta.page}
        limit={10}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        onEdit={(r) => onRowClick(r)}
        onDelete={() => {}}
        onRowClick={onRowClick}
        emptyIcon={DocumentTextIcon}
        emptyLabel={`No records found`}
      />
    </div>
  );
}

const QUOTATION_COLS: FSColumnDef[] = [
  { key: 'quotationId', label: 'ID' },
  { key: 'title',       label: 'Title' },
  { key: 'status',      label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
];

const CONTRACT_COLS: FSColumnDef[] = [
  { key: 'contractId', label: 'ID' },
  { key: 'title',      label: 'Title' },
  { key: 'status',     label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
];

const WORKORDER_COLS: FSColumnDef[] = [
  { key: 'workOrderId', label: 'ID' },
  { key: 'title',       label: 'Title' },
  { key: 'status',      label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
];

const INVOICE_COLS: FSColumnDef[] = [
  { key: 'invoiceId', label: 'ID' },
  { key: 'title',     label: 'Title' },
  { key: 'status',    label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'draft'} /> },
];

const RECEIPT_COLS: FSColumnDef[] = [
  { key: 'receiptId', label: 'ID' },
  { key: 'amount',    label: 'Amount' },
];

export default function CustomerViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: item, isLoading } = useCustomerQuery(id ?? '');

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
  
  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Customer not found.</div>;

  const addr = [item.address, item.city, item.state, item.postcode, item.country].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/native-crm/customers')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Customers
          </button>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
            <UsersIcon className="h-8 w-8 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-600">
              {item.email && <p><strong>Email:</strong> {item.email}</p>}
              {item.phone && <p><strong>Phone:</strong> {item.phone}</p>}
              {addr && <p><strong>Address:</strong> {addr}</p>}
            </div>
          </div>
          <div className="shrink-0">
            <FSStatusBadge value={item.status ?? 'active'} />
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-white border-r border-gray-200 shrink-0 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    active 
                      ? 'bg-brand-50 text-brand-700 shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">Customer Details</h3>
                </div>
                <div className="px-6 py-4">
                  <InfoRow label="Customer ID" value={item.customerId} />
                  <InfoRow label="Full Name" value={item.name} />
                  <InfoRow label="Email" value={item.email} />
                  <InfoRow label="Phone" value={item.phone} />
                  <InfoRow label="Address" value={item.address} />
                  <InfoRow label="City" value={item.city} />
                  <InfoRow label="State" value={item.state} />
                  <InfoRow label="Postcode" value={item.postcode} />
                  <InfoRow label="Country" value={item.country} />
                  <InfoRow label="Notes" value={item.notes} />
                </div>
              </div>

              {item.customFields && Object.keys(item.customFields).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700">Custom Fields</h3>
                  </div>
                  <div className="px-6 py-4">
                    {Object.entries(item.customFields).map(([k, v]) => (
                      <InfoRow key={k} label={k.replace(/_/g, ' ').toUpperCase()} value={String(v)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotations' && (
            <GenericTabList 
              queryHook={useQuotationsListQuery} 
              customerId={item.customerId} 
              columns={QUOTATION_COLS}
              onRowClick={() => navigate(`/native-crm/quotations`)}
            />
          )}

          {activeTab === 'contracts' && (
            <GenericTabList 
              queryHook={useContractsListQuery} 
              customerId={item.customerId} 
              columns={CONTRACT_COLS}
              onRowClick={() => navigate(`/native-crm/contracts`)}
            />
          )}

          {activeTab === 'workorders' && (
            <GenericTabList 
              queryHook={useWorkordersListQuery} 
              customerId={item.customerId} 
              columns={WORKORDER_COLS}
              onRowClick={(r: any) => navigate(`/native-crm/workorders/${r._id}/view`)} 
            />
          )}

          {activeTab === 'invoices' && (
            <GenericTabList 
              queryHook={useInvoicesListQuery} 
              customerId={item.customerId} 
              columns={INVOICE_COLS}
              onRowClick={() => navigate(`/native-crm/invoices`)}
            />
          )}

          {activeTab === 'receipts' && (
            <GenericTabList
              queryHook={useReceiptsListQuery}
              customerId={item.customerId}
              columns={RECEIPT_COLS}
              onRowClick={() => navigate(`/native-crm/receipts`)}
            />
          )}

          {activeTab === 'credentials' && id && (
            <CredentialsPanel entity="customers" id={id} appName="Customer App" />
          )}
        </div>
      </div>
    </div>
  );
}
