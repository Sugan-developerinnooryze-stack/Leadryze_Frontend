import { useState, useEffect } from 'react';
import { TruckIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useVehiclesListQuery,
  useVehicleCreate,
  useVehicleUpdate,
  useVehicleDelete,
} from '../../../modules/native-crm/queries/vehicles.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'name',               label: 'Vehicle Name',       type: 'text',   required: true },
  { key: 'registrationNumber', label: 'Registration No.',   type: 'text' },
  { key: 'make',               label: 'Make',               type: 'text',   placeholder: 'e.g. Toyota' },
  { key: 'vehicleModel',       label: 'Model',              type: 'text',   placeholder: 'e.g. HiLux' },
  { key: 'year',               label: 'Year',               type: 'number' },
  { key: 'assignedTeam',       label: 'Assigned Team',      type: 'text' },
  { key: 'assignedDriver',     label: 'Assigned Driver',    type: 'text' },
  { key: 'fuelType',           label: 'Fuel Type',          type: 'select', options: ['petrol', 'diesel', 'electric', 'hybrid'] },
  { key: 'lastServiceDate',    label: 'Last Service Date',  type: 'text',   placeholder: 'YYYY-MM-DD' },
  { key: 'notes',              label: 'Notes',              type: 'textarea' },
  { key: 'status',             label: 'Status',             type: 'select', options: ['active', 'in_use', 'under_maintenance', 'retired'] },
];

const STATUS_COLORS: Record<string, string> = {
  active:            'bg-green-100 text-green-700',
  in_use:            'bg-blue-100 text-blue-700',
  under_maintenance: 'bg-amber-100 text-amber-700',
  retired:           'bg-gray-100 text-gray-500',
};

const COLUMNS: FSColumnDef[] = [
  { key: 'vehicleId',          label: 'ID' },
  { key: 'name',               label: 'Name' },
  { key: 'registrationNumber', label: 'Rego',      render: (r) => r.registrationNumber ?? 'â€”' },
  { key: 'make',               label: 'Make/Model',render: (r) => [r.make, r.vehicleModel].filter(Boolean).join(' ') || 'â€”' },
  { key: 'assignedDriver',     label: 'Driver',    render: (r) => r.assignedDriver ?? 'â€”' },
  { key: 'fuelType',           label: 'Fuel',      render: (r) => r.fuelType ?? 'â€”' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
        {r.status?.replace('_', ' ')}
      </span>
    ),
  },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

export default function VehiclesPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useVehiclesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useVehicleCreate();
  const updateMutation = useVehicleUpdate();
  const deleteMutation = useVehicleDelete();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <TruckIcon className="h-5 w-5 text-sky-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Vehicles</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehiclesâ€¦"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="in_use">In Use</option>
          <option value="under_maintenance">Under Maintenance</option>
          <option value="retired">Retired</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Vehicle
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
        moduleKey="vehicles"
        emptyIcon={TruckIcon}
        emptyLabel="No vehicles yet â€” create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Vehicle' : 'New Vehicle'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={createMutation.mutateAsync}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
          module="vehicles"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name ?? 'this vehicle'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
