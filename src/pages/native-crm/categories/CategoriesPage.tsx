import { useState, useEffect } from 'react';
import { TagIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDrawer from '../../../modules/native-crm/shared/FSDrawer';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import type { FSFieldDef, FSColumnDef } from '../../../modules/native-crm/shared/types';
import { CompanyBadge } from '../../../components/native-crm/CompanyBadge';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import {
  useCategoriesListQuery,
  useCategoryCreate,
  useCategoryUpdate,
  useCategoryDelete,
} from '../../../modules/native-crm/queries/categories.queries';
import {
  useServicesListQuery,
  useServiceUpdate,
} from '../../../modules/native-crm/queries/services.queries';

const FIELDS: FSFieldDef[] = [
  { key: 'branchId', label: 'Company', type: 'branch-select' },
  { key: 'name',        label: 'Name',        type: 'text',        required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'color',       label: 'Color Hex',   type: 'text',        placeholder: '#6366f1' },
  { key: 'icon',        label: 'Icon',        type: 'text',        placeholder: 'wrench' },
  { key: 'status',      label: 'Status',      type: 'select',      options: ['active', 'inactive'] },
  { key: 'serviceIds',  label: 'Services',    type: 'multilookup',
    lookupModule: 'services', lookupLabelField: 'name' },
];

const COLUMNS: FSColumnDef[] = [
  { key: 'categoryId',  label: 'ID' },
  { key: 'name',        label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'status',      label: 'Status', render: (r) => <FSStatusBadge value={r.status ?? 'active'} /> },
  { key: 'branchId', label: 'Company', render: (r: any) => <CompanyBadge branchId={r.branchId} /> },
];

export default function CategoriesPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<any | null>(null);

  useEffect(() => { setPage(1); }, [search, status]);

  const { data: result, isLoading } = useCategoriesListQuery({ page, limit: 20, search: search || undefined, status: status || undefined });
  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation    = useCategoryCreate();
  const updateMutation    = useCategoryUpdate();
  const deleteMutation    = useCategoryDelete();
  const serviceUpdateMutation = useServiceUpdate();
  const { data: allServicesData } = useServicesListQuery({ page: 1, limit: 500 });

  const handleEdit = (r: any) => {
    const allServices = allServicesData?.items ?? [];
    const catId = r._id?.toString();
    const serviceIds = allServices
      .filter(s => {
        const cid = typeof s.categoryId === 'object' ? s.categoryId?._id?.toString() : s.categoryId?.toString();
        return cid === catId;
      })
      .map(s => s._id?.toString());
    setDrawer({ open: true, record: { ...r, serviceIds } });
  };

  const handleCreate = async (data: any) => {
    const { serviceIds, ...catData } = data;
    const res = await createMutation.mutateAsync(catData);
    const catMongoId = res.data?.data?._id ?? res.data?._id;
    if (serviceIds?.length && catMongoId) {
      await Promise.all(serviceIds.map((sid: string) =>
        serviceUpdateMutation.mutateAsync({ id: sid, data: { categoryId: catMongoId } })
      ));
    }
    return res;
  };

  const handleUpdate = async (id: string, data: any) => {
    const { serviceIds, ...catData } = data;
    const res = await updateMutation.mutateAsync({ id, data: catData });
    const allServices = allServicesData?.items ?? [];
    const prevServiceIds = allServices
      .filter(s => {
        const cid = typeof s.categoryId === 'object' ? s.categoryId?._id?.toString() : s.categoryId?.toString();
        return cid === id;
      })
      .map(s => s._id?.toString());
    const removed = prevServiceIds.filter(sid => !(serviceIds ?? []).includes(sid));
    const added   = (serviceIds ?? []).filter((sid: string) => !prevServiceIds.includes(sid));
    await Promise.all([
      ...removed.map((sid: string) => serviceUpdateMutation.mutateAsync({ id: sid, data: { categoryId: null } })),
      ...added.map((sid: string)   => serviceUpdateMutation.mutateAsync({ id: sid, data: { categoryId: id } })),
    ]);
    return res;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <TagIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">Categories</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categoriesâ€¦"
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
          <option value="inactive">Inactive</option>
        </select>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New Category
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
        onEdit={handleEdit}
        onDelete={setDelTarget}
        moduleKey="categories"
        emptyIcon={TagIcon}
        emptyLabel="No categories yet â€” create your first one"
      />

      {drawer.open && (
        <FSDrawer
          title={drawer.record ? 'Edit Category' : 'New Category'}
          fields={FIELDS}
          record={drawer.record}
          onClose={() => setDrawer({ open: false, record: null })}
          onSaved={() => {}}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          module="categories"
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delTarget.name ?? 'this category'}
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteMutation.mutateAsync(delTarget._id)}
        />
      )}
    </div>
  );
}
