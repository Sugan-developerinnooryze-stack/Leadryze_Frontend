import { useState, useEffect, useMemo } from 'react';
import { WrenchScrewdriverIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import {
  useServicesListQuery,
  useServiceCreate,
  useServiceUpdate,
  useServiceDelete,
} from '../../../modules/native-crm/queries/services.queries';

const CUR_SYMBOL: Record<string, string> = { AUD:'$',USD:'$',GBP:'£',EUR:'€',INR:'₹',CAD:'$',NZD:'$',SGD:'$' };

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'name',        label: 'Service Name', type: 'text',     required: true },
  { key: 'description', label: 'Description',  type: 'textarea' },
  { key: 'price',       label: 'Price',        type: 'currency', placeholder: '0.00' },
  { key: 'unit',        label: 'Unit',         type: 'text',     placeholder: 'e.g. hour, sq.ft, visit' },
  { key: 'status',      label: 'Status',       type: 'select',   options: ['active', 'inactive'] },
];

export default function ServicesPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  const { data: settings } = useFSSettingsQuery();

  useEffect(() => { setPage(1); }, [search, status]);

  const columns: FSColumnDef[] = useMemo(() => [
    { key: 'serviceId',  label: 'ID' },
    { key: 'name',       label: 'Name' },
    { key: 'price',      label: 'Price',  render: (r) => r.price != null ? `${CUR_SYMBOL[settings?.currency ?? 'AUD'] ?? '$'}${Number(r.price).toFixed(2)}` : '—' },
    { key: 'unit',       label: 'Unit' },
    { key: 'status',     label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'active'} /> },
    { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
    { key: 'createdAt', label: 'Created Date', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—' },
  ], [settings?.currency]);

  const { data: result, isLoading, error } = useServicesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useServiceCreate();
  const updateMutation = useServiceUpdate();
  const deleteMutation = useServiceDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center shrink-0">
            <WrenchScrewdriverIcon className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary">Services</h1>
            <p className="text-xs text-text-muted">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
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
          New Service
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
        onEdit={(r) => setDrawer({ open: true, record: r })}
        onDelete={setDelTarget}
        moduleKey="services"
        emptyIcon={WrenchScrewdriverIcon}
        emptyLabel="No services yet — create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record?._id ? 'Edit Service' : 'New Service'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="services"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name ?? 'this service'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
