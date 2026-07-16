import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import type { ICustomModuleField, CascadeNode } from '../../../modules/native-crm/queries/custom-modules.queries';
import { useCustomRecordsQuery } from '../../../modules/native-crm/queries/custom-modules.queries';
import { useCustomFieldUpload } from '../../../modules/native-crm/queries/custom-fields.queries';
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

/* ── Types ────────────────────────────────────────────────────────────────── */

interface CustomModuleFormDrawerProps {
  title:    string;
  fields:   ICustomModuleField[];
  record:   Record<string, unknown> | null;
  onClose:  () => void;
  onCreate: (data: Record<string, unknown>) => Promise<any>;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<any>;
}

/* ── Relationship metadata ────────────────────────────────────────────────── */

const RELATIONSHIP_META: Record<string, { labelField?: string; getLabelFn?: (item: any) => string; valueField: string }> = {
  customers:  { labelField: 'name',                                                               valueField: 'customerId'  },
  staffs:     { getLabelFn: (i) => [i.firstName, i.lastName].filter(Boolean).join(' ') || i._id,  valueField: 'staffId'     },
  teams:      { labelField: 'name',                                                               valueField: 'teamId'      },
  sites:      { labelField: 'name',                                                               valueField: 'siteId'      },
  workorders: { labelField: 'title',                                                              valueField: 'workOrderId' },
  quotations: { labelField: 'title',                                                              valueField: 'quotationId' },
  services:   { labelField: 'name',                                                               valueField: '_id'         },
  categories: { labelField: 'name',                                                               valueField: '_id'         },
  parts:      { labelField: 'name',                                                               valueField: 'partId'      },
  expenses:   { labelField: 'title',                                                              valueField: 'expenseId'   },
  products:   { labelField: 'name',                                                               valueField: 'productId'   },
  assets:     { labelField: 'name',                                                               valueField: 'assetId'     },
  vehicles:   { labelField: 'name',                                                               valueField: 'vehicleId'   },
  leads:      { getLabelFn: (i) => [i.firstName, i.lastName].filter(Boolean).join(' ') || i._id,  valueField: 'leadId'      },
  deals:      { labelField: 'title',                                                              valueField: '_id'         },
  branches:   { labelField: 'branchName',                                                         valueField: '_id'         },
};

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

/* ── Shared input style ───────────────────────────────────────────────────── */

const inp = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

/* ── ImageUploader ────────────────────────────────────────────────────────── */

function ImageUploader({
  value, onChange, multiple,
}: {
  value:    string | string[];
  onChange: (v: string | string[]) => void;
  multiple: boolean;
}) {
  const upload = useCustomFieldUpload('image');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const urls: string[] = multiple
    ? Array.isArray(value) ? value as string[] : (value ? [value as string] : [])
    : (value ? [value as string] : []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const MAX = 5 * 1024 * 1024;
    for (const f of Array.from(files)) {
      if (f.size > MAX) { setError(`${f.name} exceeds 5 MB`); return; }
    }
    try {
      const fd = new FormData();
      if (multiple) {
        Array.from(files).forEach((f) => fd.append('files', f));
        const res = await upload.mutateAsync(fd);
        const newUrls = res.urls ?? (res.url ? [res.url] : []);
        onChange([...urls, ...newUrls]);
      } else {
        fd.append('file', files[0]);
        const res = await upload.mutateAsync(fd);
        onChange(res.url ?? '');
      }
    } catch {
      setError('Upload failed. Please try again.');
    }
  };

  const removeUrl = (url: string) => {
    if (multiple) onChange((urls).filter((u) => u !== url));
    else onChange('');
  };

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf');

  return (
    <div className="space-y-2">
      {/* Previews */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="relative group">
              {isPdf(url) ? (
                <a href={url} target="_blank" rel="noreferrer"
                  className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-200 transition-colors">
                  PDF
                </a>
              ) : (
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
              )}
              <button
                onClick={() => removeUrl(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {(multiple || urls.length === 0) && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
            multiple={multiple}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50"
          >
            {upload.isPending ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              '📎'
            )}
            {upload.isPending ? 'Uploading…' : multiple ? 'Upload Files' : 'Upload File'}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}

/* ── StarRating ───────────────────────────────────────────────────────────── */

function StarRating({ value, max = 5, onChange }: { value: number; max?: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none"
        >
          {star <= (hover || value)
            ? <StarSolid  className="h-6 w-6 text-amber-400" />
            : <StarIcon   className="h-6 w-6 text-gray-300" />}
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-gray-400">{value}/{max}</span>
      )}
    </div>
  );
}

/* ── Built-in module slugs (handled via lookupDataMap) ───────────────────── */

const BUILTIN_SLUGS = new Set(['customers','staffs','teams','sites','workorders','quotations','services','categories','parts','expenses','products','assets','vehicles','leads','deals','branches']);

/* ── CustomModuleRelationSelect ───────────────────────────────────────────── */

function CustomModuleRelationSelect({
  slug, value, onChange, fieldInp,
}: {
  slug: string;
  value: string;
  onChange: (v: string) => void;
  fieldInp: string;
}) {
  const { data, isLoading } = useCustomRecordsQuery(slug, { limit: 200 });
  const records = data?.items ?? [];

  return (
    <select className={fieldInp} value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading}>
      <option value="">{isLoading ? 'Loading…' : `Select ${slug}…`}</option>
      {records.map((rec) => {
        const firstVal = Object.values(rec.data ?? {}).find((v) => typeof v === 'string' && v);
        const label = (firstVal as string | undefined) ?? rec.recordId;
        return <option key={rec._id} value={rec.recordId}>{label}</option>;
      })}
      {!isLoading && records.length === 0 && <option disabled value="">No records found</option>}
    </select>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

export default function CustomModuleFormDrawer({
  title, fields, record, onClose, onCreate, onUpdate,
}: CustomModuleFormDrawerProps) {
  const [form,    setForm]    = useState<Record<string, unknown>>({});
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  // Load all lookup data (React Query caches them — same pattern as FSDrawer)
  const { data: customersData  } = useCustomersListQuery ({ page: 1, limit: 500 });
  const { data: staffsData     } = useStaffsListQuery    ({ page: 1, limit: 500 });
  const { data: teamsData      } = useTeamsListQuery     ({ page: 1, limit: 500 });
  const { data: sitesData      } = useSitesListQuery     ({ page: 1, limit: 500 });
  const { data: workordersData } = useWorkordersListQuery({ page: 1, limit: 500 });
  const { data: quotationsData } = useQuotationsListQuery({ page: 1, limit: 500 });
  const { data: servicesData   } = useServicesListQuery  ({ page: 1, limit: 500 });
  const { data: categoriesData } = useCategoriesListQuery({ page: 1, limit: 500 });
  const { data: partsData      } = usePartsListQuery     ({ page: 1, limit: 500 });
  const { data: expensesData   } = useExpensesListQuery  ({ page: 1, limit: 500 });
  const { data: productsData   } = useProductsListQuery  ({ page: 1, limit: 500 });
  const { data: assetsData     } = useAssetsListQuery    ({ page: 1, limit: 500 });
  const { data: vehiclesData   } = useVehiclesListQuery  ({ page: 1, limit: 500 });
  const { data: leadsData      } = useLeadsQuery         ({ page: 1, limit: 500 });
  const { data: dealsData      } = useDealsQuery         ({ page: 1, limit: 500 });
  const { data: branchesData   } = useBranchesQuery     ();

  const lookupDataMap: Record<string, any[]> = {
    customers:  customersData?.items  ?? [],
    staffs:     staffsData?.items     ?? [],
    teams:      teamsData?.items      ?? [],
    sites:      sitesData?.items      ?? [],
    workorders: workordersData?.items ?? [],
    quotations: quotationsData?.items ?? [],
    services:   servicesData?.items   ?? [],
    categories: categoriesData?.items ?? [],
    parts:      partsData?.items      ?? [],
    expenses:   expensesData?.items   ?? [],
    products:   productsData?.items   ?? [],
    assets:     assetsData?.items     ?? [],
    vehicles:   vehiclesData?.items   ?? [],
    leads:      leadsData?.items      ?? [],
    deals:      dealsData?.items      ?? [],
    branches:   branchesData?.items   ?? [],
  };

  // Initialize form from record
  useEffect(() => {
    const init: Record<string, unknown> = {};
    fields.forEach((f) => {
      if (f.fieldType === 'multiselect' || f.fieldType === 'images' || f.fieldType === 'categoryselect') {
        init[f.key] = Array.isArray(record?.[f.key]) ? record![f.key] : [];
      } else {
        init[f.key] = record?.[f.key] ?? '';
      }
    });
    setForm(init);
    setErrors({});
  }, [record, fields]);

  const set = (key: string, val: unknown) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      if (!f.required) return;
      const val = form[f.key];
      const empty = val === '' || val === null || val === undefined ||
        (Array.isArray(val) && val.length === 0);
      if (empty) errs[f.key] = `${f.label} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      fields.forEach((f) => {
        const val = form[f.key];
        if (f.fieldType === 'categoryselect') {
          payload[f.key] = form[f.key]; // string[]
        } else if (f.fieldType === 'number' || f.fieldType === 'currency') {
          payload[f.key] = val !== '' && val !== null && val !== undefined ? parseFloat(val as string) || 0 : null;
        } else {
          payload[f.key] = val;
        }
      });

      if (record?._id) {
        await onUpdate(record._id as string, payload);
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (err: any) {
      setErrors({ _server: err?.response?.data?.message ?? 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: ICustomModuleField) => {
    const val = form[f.key];
    const err = errors[f.key];

    const wrap = (content: React.ReactNode) => (
      <div key={f.key} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {f.label}
          {f.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {content}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    );

    switch (f.fieldType) {
      case 'text':
        return wrap(<input type="text" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'email':
        return wrap(<input type="email" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'phone':
        return wrap(<input type="tel" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'url':
        return wrap(<input type="url" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder="https://" />);

      case 'number':
        return wrap(<input type="number" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'currency':
        return wrap(
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" className={`${inp} pl-7`} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />
          </div>
        );

      case 'date':
        return wrap(<input type="date" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'datetime':
        return wrap(<input type="datetime-local" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'textarea':
        return wrap(<textarea className={inp} rows={3} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);

      case 'boolean':
        return wrap(
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => set(f.key, !val)}
              className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${val ? 'bg-brand-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-gray-600">{val ? 'Yes' : 'No'}</span>
          </label>
        );

      case 'select':
        return wrap(
          <select className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Select…</option>
            {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );

      case 'multiselect': {
        const selected = Array.isArray(val) ? val as string[] : [];
        return wrap(
          <div className="space-y-1.5">
            {(f.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={(e) => set(f.key, e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                />
                <span className="text-sm text-gray-700">{o}</span>
              </label>
            ))}
            {(!f.options || f.options.length === 0) && (
              <p className="text-xs text-gray-400">No options defined for this field.</p>
            )}
          </div>
        );
      }

      case 'rating': {
        const max = (f.meta as any)?.maxStars ?? 5;
        return wrap(
          <StarRating value={Number(val ?? 0)} max={max} onChange={(v) => set(f.key, v)} />
        );
      }

      case 'categoryselect': {
        const tree     = (f.meta?.cascadeTree ?? []) as CascadeNode[];
        const selected = (form[f.key] as string[] | undefined) ?? [];

        // Max depth so ALL levels are always visible at once
        function calcDepth(nodes: CascadeNode[]): number {
          if (!nodes.length) return 0;
          return 1 + Math.max(...nodes.map((n) => calcDepth(n.children)));
        }
        const totalLevels = calcDepth(tree);

        // Resolve node list for each level based on current selections
        const levelNodes: CascadeNode[][] = [tree];
        for (let l = 0; l < totalLevels - 1; l++) {
          const parentNode = (levelNodes[l] ?? []).find((n) => n.name === selected[l]);
          levelNodes.push(parentNode?.children ?? []);
        }

        const LEVEL_DEFAULTS = ['Category', 'Subcategory', 'Sub-level', 'Level 4', 'Level 5'];
        const configuredNames = f.meta?.levelNames ?? [];
        const getLevelLabel = (i: number) =>
          configuredNames[i] || LEVEL_DEFAULTS[Math.min(i, LEVEL_DEFAULTS.length - 1)];

        return wrap(
          <div className="space-y-3">
            {totalLevels === 0 && (
              <p className="text-xs text-gray-400 italic">No categories configured for this field.</p>
            )}
            {Array.from({ length: totalLevels }, (_, level) => {
              const isEnabled   = level === 0 || !!selected[level - 1];
              const nodes       = levelNodes[level] ?? [];
              const label       = getLevelLabel(level);
              const parentLabel = level > 0 ? getLevelLabel(level - 1).toLowerCase() : '';
              return (
                <div key={level}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                  <select
                    className={`${inp} ${!isEnabled ? 'opacity-50 bg-gray-50 cursor-not-allowed' : ''}`}
                    value={selected[level] ?? ''}
                    disabled={!isEnabled}
                    onChange={(e) => {
                      const next = [...selected.slice(0, level), e.target.value].filter(Boolean);
                      set(f.key, next);
                    }}
                  >
                    <option value="">
                      {!isEnabled ? `Select ${parentLabel} first…` : `Select ${label.toLowerCase()}…`}
                    </option>
                    {nodes.map((n) => (
                      <option key={n.name} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        );
      }

      case 'relationship': {
        const target      = f.meta?.targetModule ?? '';
        const subFields   = f.meta?.subFields ?? [];
        const selectedVal = val as string ?? '';
        const relMeta     = RELATIONSHIP_META[target];
        const allItems    = lookupDataMap[target] ?? [];

        const selectedRec = selectedVal
          ? allItems.find((item: any) =>
              (relMeta ? (item[relMeta.valueField] ?? item._id) : item._id) === selectedVal
            )
          : undefined;

        const subFieldPanel = subFields.length > 0 && selectedRec ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {subFields.map((sfKey) => {
              const sfDef = (RELATIONSHIP_AVAILABLE_FIELDS[target] ?? []).find((a) => a.key === sfKey);
              const sfVal = selectedRec[sfKey];
              return (
                <div key={sfKey}>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{sfDef?.label ?? sfKey}</p>
                  <p className="text-xs text-gray-800 mt-0.5">
                    {sfVal !== undefined && sfVal !== null && sfVal !== '' ? String(sfVal) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null;

        if (!BUILTIN_SLUGS.has(target) && target) {
          return wrap(
            <>
              <CustomModuleRelationSelect
                slug={target}
                value={selectedVal}
                onChange={(v) => set(f.key, v)}
                fieldInp={inp}
              />
              {subFieldPanel}
            </>
          );
        }

        return wrap(
          <>
            <select className={inp} value={selectedVal} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">Select {target}…</option>
              {allItems.map((item: any) => {
                const label = relMeta
                  ? (relMeta.getLabelFn ? relMeta.getLabelFn(item) : (item[relMeta.labelField!] ?? item.name ?? item.title ?? item._id))
                  : (item.name ?? item._id);
                const value = relMeta ? (item[relMeta.valueField] ?? item._id) : item._id;
                return <option key={item._id} value={value}>{label}</option>;
              })}
              {allItems.length === 0 && <option disabled value="">No records found</option>}
            </select>
            {subFieldPanel}
          </>
        );
      }

      case 'image':
        return wrap(
          <ImageUploader
            value={val as string ?? ''}
            onChange={(v) => set(f.key, v)}
            multiple={false}
          />
        );

      case 'images':
        return wrap(
          <ImageUploader
            value={val as string[] ?? []}
            onChange={(v) => set(f.key, v)}
            multiple={true}
          />
        );

      default:
        return wrap(<input type="text" className={inp} value={val as string ?? ''} onChange={(e) => set(f.key, e.target.value)} />);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {fields.map((f) => renderField(f))}
            {fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No fields defined for this module yet.</p>
            )}
            {errors._server && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors._server}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : record?._id ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
}
