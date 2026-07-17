import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import FSTable from '../../../modules/native-crm/shared/FSTable';
import FSDeleteModal from '../../../modules/native-crm/shared/FSDeleteModal';
import type { FSColumnDef } from '../../../modules/native-crm/shared/types';
import {
  useCustomModuleBySlugQuery,
  useCustomRecordsQuery,
  useCustomRecordCreate,
  useCustomRecordUpdate,
  useCustomRecordDelete,
} from '../../../modules/native-crm/queries/custom-modules.queries';
import type { ICustomModuleField, CustomRecord, ITableColumn } from '../../../modules/native-crm/queries/custom-modules.queries';
import { evalFormulaWith } from '../../../modules/native-crm/shared/formulaEval';
import { useCustomersListQuery  } from '../../../modules/native-crm/queries/customers.queries';
import { useStaffsListQuery     } from '../../../modules/native-crm/queries/staffs.queries';
import { useTeamsListQuery      } from '../../../modules/native-crm/queries/teams.queries';
import { useSitesListQuery      } from '../../../modules/native-crm/queries/sites.queries';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';
import { useServicesListQuery   } from '../../../modules/native-crm/queries/services.queries';
import { useCategoriesListQuery } from '../../../modules/native-crm/queries/categories.queries';
import { usePartsListQuery      } from '../../../modules/native-crm/queries/parts.queries';
import { useExpensesListQuery   } from '../../../modules/native-crm/queries/expenses.queries';
import { useProductsListQuery   } from '../../../modules/native-crm/queries/products.queries';
import { useAssetsListQuery     } from '../../../modules/native-crm/queries/assets.queries';
import { useVehiclesListQuery   } from '../../../modules/native-crm/queries/vehicles.queries';
import { useLeadsQuery          } from '../../../modules/native-crm/queries/leads.queries';
import { useDealsQuery          } from '../../../modules/native-crm/queries/deals.queries';
import { useBranchesQuery       } from '../../../modules/native-crm/queries/branch.queries';
import CustomModuleFormDrawer from './CustomModuleFormDrawer';

/* ── Column builder ───────────────────────────────────────────────────────── */

type LookupMap = Map<string, Record<string, any>>;

function summarizeTableRows(rows: Record<string, any>[], columns?: ITableColumn[]): string {
  const labelFor = (key: string) => columns?.find((c) => c.key === key)?.label ?? key;
  return rows
    .map((row) => Object.entries(row).map(([k, v]) => `${labelFor(k)}: ${v ?? ''}`).join(', '))
    .join(' | ');
}

function getRelLabel(record: Record<string, any>, target: string): string {
  if (!record) return '';
  if (target === 'staffs' || target === 'leads')
    return [record.firstName, record.lastName].filter(Boolean).join(' ') || String(record._id ?? '');
  if (target === 'branches') return record.branchName ?? '';
  return record.name ?? record.title ?? record.branchName ?? String(record._id ?? '');
}

const RELATIONSHIP_AVAILABLE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  customers:  [{ key:'name',label:'Name' },{ key:'phone',label:'Phone' },{ key:'email',label:'Email' },{ key:'company',label:'Company' },{ key:'address',label:'Address' },{ key:'city',label:'City' },{ key:'status',label:'Status' }],
  staffs:     [{ key:'firstName',label:'First Name' },{ key:'lastName',label:'Last Name' },{ key:'email',label:'Email' },{ key:'phone',label:'Phone' },{ key:'role',label:'Role' },{ key:'status',label:'Status' }],
  teams:      [{ key:'name',label:'Name' },{ key:'description',label:'Description' },{ key:'status',label:'Status' }],
  sites:      [{ key:'name',label:'Name' },{ key:'address',label:'Address' },{ key:'city',label:'City' },{ key:'phone',label:'Phone' },{ key:'contactPerson',label:'Contact Person' }],
  services:   [{ key:'name',label:'Name' },{ key:'price',label:'Price' },{ key:'unit',label:'Unit' },{ key:'duration',label:'Duration (min)' }],
  categories: [{ key:'name',label:'Name' },{ key:'description',label:'Description' }],
  parts:      [{ key:'name',label:'Name' },{ key:'partNumber',label:'Part Number' },{ key:'price',label:'Price' },{ key:'unit',label:'Unit' },{ key:'quantity',label:'Quantity' }],
  expenses:   [{ key:'title',label:'Title' },{ key:'category',label:'Category' },{ key:'amount',label:'Amount' },{ key:'date',label:'Date' },{ key:'status',label:'Status' }],
  products:   [{ key:'name',label:'Name' },{ key:'sku',label:'SKU' },{ key:'sellingPrice',label:'Price' },{ key:'unit',label:'Unit' },{ key:'stock',label:'Stock' }],
  assets:     [{ key:'name',label:'Name' },{ key:'category',label:'Category' },{ key:'serialNumber',label:'Serial No.' },{ key:'condition',label:'Condition' },{ key:'status',label:'Status' }],
  vehicles:   [{ key:'name',label:'Name' },{ key:'registrationNumber',label:'Reg. Number' },{ key:'make',label:'Make' },{ key:'vehicleModel',label:'Model' },{ key:'fuelType',label:'Fuel Type' }],
  leads:      [{ key:'firstName',label:'First Name' },{ key:'lastName',label:'Last Name' },{ key:'company',label:'Company' },{ key:'email',label:'Email' },{ key:'phone',label:'Phone' },{ key:'status',label:'Status' },{ key:'rating',label:'Rating' }],
  deals:      [{ key:'title',label:'Title' },{ key:'amount',label:'Amount' },{ key:'stage',label:'Stage' },{ key:'closeDate',label:'Close Date' }],
  branches:   [{ key:'branchName',label:'Branch Name' },{ key:'branchType',label:'Type' },{ key:'city',label:'City' },{ key:'phone',label:'Phone' },{ key:'email',label:'Email' }],
};

function toFSColumns(
  fields: ICustomModuleField[],
  lookupMaps: Record<string, LookupMap>,
): FSColumnDef<CustomRecord>[] {
  const cols: FSColumnDef<CustomRecord>[] = [
    {
      key:    'recordId',
      label:  'ID',
      render: (r) => <span className="text-xs font-mono text-gray-500">{r.recordId ?? '—'}</span>,
    },
  ];

  fields.slice(0, 6).forEach((f) => {
    if (f.fieldType === 'categoryselect') {
      const defaults   = ['Category', 'Subcategory', 'Sub-level', 'Level 4', 'Level 5'];
      const levelNames = f.meta?.levelNames ?? [];
      const getLevelLabel = (i: number) =>
        levelNames[i] || defaults[Math.min(i, defaults.length - 1)];

      function calcDepth(nodes: any[]): number {
        if (!nodes?.length) return 0;
        return 1 + Math.max(...nodes.map((n: any) => calcDepth(n.children ?? [])));
      }
      const depth = Math.max(calcDepth(f.meta?.cascadeTree ?? []), 1);

      // Table column: shows joined path
      cols.push({
        key:   f.key,
        label: f.label,
        render: (r) => {
          const val = r.data?.[f.key] as string[] | undefined;
          if (!val?.length) return <span className="text-gray-400">—</span>;
          return <span className="text-sm text-gray-700">{val.join(' › ')}</span>;
        },
        exportValue: (r) => {
          const val = r.data?.[f.key] as string[] | undefined;
          return val?.join(' > ') ?? '';
        },
      });

      // Per-level export-only columns
      for (let l = 0; l < depth; l++) {
        const level = l;
        cols.push({
          key:        `${f.key}__lvl${level}`,
          label:      `${f.label} (${getLevelLabel(level)})`,
          exportOnly: true,
          exportValue: (r) => {
            const val = r.data?.[f.key] as string[] | undefined;
            return val?.[level] ?? '';
          },
        });
      }
      return;
    }

    if (f.fieldType === 'relationship') {
      const target = f.meta?.targetModule ?? '';
      const map    = lookupMaps[target];

      cols.push({
        key:   f.key,
        label: f.label,
        render: (r) => {
          const id  = r.data?.[f.key] as string | undefined;
          const rec = id ? map?.get(id) : undefined;
          const name = rec ? getRelLabel(rec, target) : (id ?? '');
          return <span className="text-sm text-gray-700">{name || '—'}</span>;
        },
        exportValue: (r) => {
          const id  = r.data?.[f.key] as string | undefined;
          const rec = id ? map?.get(id) : undefined;
          return rec ? getRelLabel(rec, target) : (id ?? '');
        },
      });

      const subFields = f.meta?.subFields ?? [];
      const available = RELATIONSHIP_AVAILABLE_FIELDS[target] ?? [];
      subFields.forEach((sfKey) => {
        const sfDef = available.find((a) => a.key === sfKey);
        cols.push({
          key:   `${f.key}__${sfKey}`,
          label: `${f.label} (${sfDef?.label ?? sfKey})`,
          render: (r) => {
            const id  = r.data?.[f.key] as string | undefined;
            const rec = id ? map?.get(id) : undefined;
            const val = rec?.[sfKey];
            if (val === undefined || val === null) return <span className="text-gray-400">—</span>;
            return <span className="text-sm text-gray-700">{String(val)}</span>;
          },
          exportValue: (r) => {
            const id  = r.data?.[f.key] as string | undefined;
            const rec = id ? map?.get(id) : undefined;
            return String(rec?.[sfKey] ?? '');
          },
        });
      });

      return;
    }

    if (f.fieldType === 'table') {
      const tableCols = f.meta?.columns ?? [];

      if (tableCols.length === 0) {
        // No columns defined on this field yet — fall back to a single summary column
        cols.push({
          key:   f.key,
          label: f.label,
          render: (r) => {
            const val = r.data?.[f.key];
            if (!Array.isArray(val) || val.length === 0) return <span className="text-gray-400">—</span>;
            return <span className="text-xs text-gray-700 whitespace-nowrap">{summarizeTableRows(val, tableCols)}</span>;
          },
          exportValue: (r) => {
            const val = r.data?.[f.key];
            return Array.isArray(val) ? summarizeTableRows(val, tableCols) : '';
          },
        });
        return;
      }

      // One real column per defined table column (qty/nos/parts/total/...) — same
      // "own checkbox in Edit Columns + own Excel column" treatment as relationship
      // sub-fields above, instead of one flattened cell.
      tableCols.forEach((tc) => {
        // Formula columns are never stored on the row (the drawer computes them
        // live for display only) — recompute from the row's real cell values,
        // same {col_key} engine used everywhere else, instead of reading a key
        // that was never persisted.
        const cellValue = (row: Record<string, any>) =>
          tc.type === 'formula' ? evalFormulaWith(tc.formula ?? '', row) : row?.[tc.key];

        cols.push({
          key:   `${f.key}__${tc.key}`,
          label: `${f.label} (${tc.label})`,
          render: (r) => {
            const rows = (r.data?.[f.key] ?? []) as Record<string, any>[];
            const vals = Array.isArray(rows)
              ? rows.map(cellValue).filter((v) => v !== undefined && v !== null && v !== '')
              : [];
            if (vals.length === 0) return <span className="text-gray-400">—</span>;
            return <span className="text-xs text-gray-700 whitespace-nowrap">{vals.join(', ')}</span>;
          },
          exportValue: (r) => {
            const rows = (r.data?.[f.key] ?? []) as Record<string, any>[];
            if (!Array.isArray(rows)) return '';
            return rows.map(cellValue).filter((v) => v !== undefined && v !== null && v !== '').join(', ');
          },
        });
      });

      return;
    }

    cols.push({
      key:   f.key,
      label: f.label,
      render: (r) => {
        const val = r.data?.[f.key];
        if (val === null || val === undefined) return <span className="text-gray-400">—</span>;
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (f.fieldType === 'date' && typeof val === 'string') return val.slice(0, 10);
        if (f.fieldType === 'image' && typeof val === 'string' && val) {
          if (val.toLowerCase().includes('.pdf'))
            return <a href={val} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline font-medium">PDF</a>;
          return <img src={val} alt="" className="h-8 w-8 object-cover rounded" />;
        }
        if (f.fieldType === 'images' && Array.isArray(val) && val.length > 0) {
          const firstUrl = val[0] as string;
          if (firstUrl.toLowerCase().includes('.pdf'))
            return <span className="text-xs text-gray-600">{val.length} file{val.length > 1 ? 's' : ''}</span>;
          return (
            <div className="flex items-center gap-1">
              <img src={firstUrl} alt="" className="h-8 w-8 object-cover rounded" />
              {val.length > 1 && <span className="text-xs text-gray-400">+{val.length - 1}</span>}
            </div>
          );
        }
        if (f.fieldType === 'rating') return `${'★'.repeat(Number(val))}`;
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      },
      exportValue: (r) => {
        const val = r.data?.[f.key];
        if (val === undefined || val === null) return '';
        if (f.fieldType === 'image') return typeof val === 'string' ? val : '';
        if (f.fieldType === 'images') return Array.isArray(val) ? (val as string[]).join(', ') : '';
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        return String(val);
      },
    });
  });

  return cols;
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function CustomModulePage() {
  const { slug = '' } = useParams<{ slug: string }>();

  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [drawer,    setDrawer]    = useState<{ open: boolean; record: CustomRecord | null }>({ open: false, record: null });
  const [delTarget, setDelTarget] = useState<CustomRecord | null>(null);

  const { data: modDef, isLoading: modLoading } = useCustomModuleBySlugQuery(slug);
  const { data: result, isLoading: listLoading } = useCustomRecordsQuery(slug, {
    page,
    limit: 20,
    search: search || undefined,
  });

  const items = result?.items ?? [];
  const meta  = result?.meta  ?? { total: 0, page: 1, totalPages: 1 };

  const createMutation = useCustomRecordCreate(slug);
  const updateMutation = useCustomRecordUpdate(slug);
  const deleteMutation = useCustomRecordDelete(slug);

  /* ── Lookup data for relationship columns ──────────────────────────────── */
  const { data: customersData  } = useCustomersListQuery ({ page: 1, limit: 1000 });
  const { data: staffsData     } = useStaffsListQuery    ({ page: 1, limit: 1000 });
  const { data: teamsData      } = useTeamsListQuery     ({ page: 1, limit: 1000 });
  const { data: sitesData      } = useSitesListQuery     ({ page: 1, limit: 1000 });
  const { data: workordersData } = useWorkordersListQuery({ page: 1, limit: 1000 });
  const { data: quotationsData } = useQuotationsListQuery({ page: 1, limit: 1000 });
  const { data: servicesData   } = useServicesListQuery  ({ page: 1, limit: 1000 });
  const { data: categoriesData } = useCategoriesListQuery({ page: 1, limit: 1000 });
  const { data: partsData      } = usePartsListQuery     ({ page: 1, limit: 1000 });
  const { data: expensesData   } = useExpensesListQuery  ({ page: 1, limit: 1000 });
  const { data: productsData   } = useProductsListQuery  ({ page: 1, limit: 1000 });
  const { data: assetsData     } = useAssetsListQuery    ({ page: 1, limit: 1000 });
  const { data: vehiclesData   } = useVehiclesListQuery  ({ page: 1, limit: 1000 });
  const { data: leadsData      } = useLeadsQuery         ({ page: 1, limit: 1000 });
  const { data: dealsData      } = useDealsQuery         ({ page: 1, limit: 1000 });
  const { data: branchesData   } = useBranchesQuery     ();

  const lookupMaps = useMemo<Record<string, LookupMap>>(() => ({
    customers:  new Map((customersData?.items  ?? []).map((c: any) => [c.customerId,  c])),
    staffs:     new Map((staffsData?.items     ?? []).map((s: any) => [s.staffId,     s])),
    teams:      new Map((teamsData?.items      ?? []).map((t: any) => [t.teamId,      t])),
    sites:      new Map((sitesData?.items      ?? []).map((s: any) => [s.siteId,      s])),
    workorders: new Map((workordersData?.items ?? []).map((w: any) => [w.workOrderId, w])),
    quotations: new Map((quotationsData?.items ?? []).map((q: any) => [q.quotationId, q])),
    services:   new Map((servicesData?.items   ?? []).map((s: any) => [s._id,         s])),
    categories: new Map((categoriesData?.items ?? []).map((c: any) => [c._id,         c])),
    parts:      new Map((partsData?.items      ?? []).map((p: any) => [p.partId,      p])),
    expenses:   new Map((expensesData?.items   ?? []).map((e: any) => [e.expenseId,   e])),
    products:   new Map((productsData?.items   ?? []).map((p: any) => [p.productId,   p])),
    assets:     new Map((assetsData?.items     ?? []).map((a: any) => [a.assetId,     a])),
    vehicles:   new Map((vehiclesData?.items   ?? []).map((v: any) => [v.vehicleId,   v])),
    leads:      new Map((leadsData?.items      ?? []).map((l: any) => [l.leadId,      l])),
    deals:      new Map((dealsData?.items      ?? []).map((d: any) => [d._id,         d])),
    branches:   new Map((branchesData?.items   ?? []).map((b: any) => [b._id,         b])),
  }), [customersData, staffsData, teamsData, sitesData, workordersData, quotationsData, servicesData, categoriesData, partsData, expensesData, productsData, assetsData, vehiclesData, leadsData, dealsData, branchesData]);

  if (modLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>;
  }
  if (!modDef) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Module not found.</div>;
  }

  const fsColumns = toFSColumns(modDef.fields, lookupMaps);

  const flatRecord = (rec: CustomRecord | null) =>
    rec ? { ...rec.data, _id: rec._id } : null;

  const delLabel = delTarget
    ? String(delTarget.data?.['name'] ?? delTarget.data?.['title'] ?? delTarget.recordId ?? 'this record')
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-lg select-none"
            style={{ backgroundColor: `${modDef.color}22` }}
          >
            {modDef.icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900">{modDef.name}</h1>
            <p className="text-xs text-gray-500">{meta.total} total</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${modDef.name.toLowerCase()}…`}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <button
          onClick={() => setDrawer({ open: true, record: null })}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          New {modDef.singularName}
        </button>
      </div>

      <FSTable
        columns={fsColumns}
        data={items}
        loading={listLoading}
        total={meta.total}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        onEdit={(r) => setDrawer({ open: true, record: r })}
        onDelete={(r) => setDelTarget(r)}
        moduleKey={slug}
        emptyIcon={TableCellsIcon}
        emptyLabel={`No ${modDef.name.toLowerCase()} yet — create your first one`}
      />

      {drawer.open && (
        <CustomModuleFormDrawer
          title={drawer.record ? `Edit ${modDef.singularName}` : `New ${modDef.singularName}`}
          fields={modDef.fields}
          record={flatRecord(drawer.record)}
          onClose={() => setDrawer({ open: false, record: null })}
          onCreate={(data) => createMutation.mutateAsync(data)}
          onUpdate={(id, data) => updateMutation.mutateAsync({ id, data })}
        />
      )}

      {delTarget && (
        <FSDeleteModal
          label={delLabel}
          onClose={() => setDelTarget(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(delTarget._id);
            setDelTarget(null);
          }}
        />
      )}
    </div>
  );
}
