import { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { FSFieldDef } from './types';
import { useBranchStore } from '../../../stores/branch.store';
import { useAuthStore } from '../../../stores/auth.store';
import { RecordLockBanner } from '../../../components/native-crm/RecordLockBanner';
import ServiceLinesEditor from './ServiceLinesEditor';
import { useCustomFieldsQuery } from '../queries/custom-fields.queries';
import { useCustomFormTemplatesQuery } from '../queries/custom-form-templates.queries';
import CustomFieldRenderer from './CustomFieldRenderer';
import { useCustomersListQuery  } from '../queries/customers.queries';
import { useSitesListQuery      } from '../queries/sites.queries';
import { useTeamsListQuery      } from '../queries/teams.queries';
import { useStaffsListQuery     } from '../queries/staffs.queries';
import { useCategoriesListQuery } from '../queries/categories.queries';
import { useServicesListQuery   } from '../queries/services.queries';
import { useWorkordersListQuery } from '../queries/workorders.queries';
import { useQuotationsListQuery } from '../queries/quotations.queries';
import { useFSSettingsQuery     } from '../queries/fs-settings.queries';
import api from '../../../services/api';
import {
  splitHours, joinHours, availabilityNote, availabilityShort, toDatetimeLocal,
  type StaffAvailability,
} from './duration';

interface FSDrawerProps {
  title:      string;
  fields:     FSFieldDef[];
  record:     any | null;
  onClose:    () => void;
  onSaved:    () => void;
  onCreate:   (data: any) => Promise<any>;
  onUpdate:   (id: string, data: any) => Promise<any>;
  module?:    string;
  onUnlocked?: () => void;
}

const base = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

export default function FSDrawer({ title, fields, record, onClose, onSaved, onCreate, onUpdate, module, onUnlocked }: FSDrawerProps) {
  const [form,            setForm]            = useState<Record<string, any>>({});
  const [customForm,      setCustomForm]      = useState<Record<string, any>>({});
  const [selectedLookups, setSelectedLookups] = useState<Record<string, any>>({});
  const [saving,          setSaving]          = useState(false);
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [staffBusyMap,    setStaffBusyMap]    = useState<Record<string, StaffAvailability>>({});
  const [nearestResults,  setNearestResults]  = useState<any[] | null>(null);
  const [nearestLoading,  setNearestLoading]  = useState(false);
  const nearestRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useFSSettingsQuery();

  const user    = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');

  const branches      = useBranchStore((s) => s.branches);
  const currentBranch = useBranchStore((s) => s.currentBranch);

  const { data: customFields = [] } = useCustomFieldsQuery(module);
  const activeCustomFields = customFields.filter((cf) => cf.isActive);
  const { data: formTemplates = [] } = useCustomFormTemplatesQuery();

  // Lookup data — always called (React hook rules), cached by react-query
  const { data: customersData  } = useCustomersListQuery ({ page: 1, limit: 500 });
  const { data: teamsData      } = useTeamsListQuery     ({ page: 1, limit: 500 });
  const { data: categoriesData } = useCategoriesListQuery({ page: 1, limit: 500 });
  const { data: workordersData } = useWorkordersListQuery({ page: 1, limit: 500 });
  const { data: quotationsData } = useQuotationsListQuery({ page: 1, limit: 500 });

  // Cascaded — refetch automatically when parent _id changes
  const { data: sitesData    } = useSitesListQuery  ({ page: 1, limit: 500, customerId: selectedLookups['customerId']?._id });
  const { data: staffsData   } = useStaffsListQuery ({ page: 1, limit: 500, teamId:     selectedLookups['teamId']?._id });
  const { data: servicesData } = useServicesListQuery({ page: 1, limit: 500, categoryId: selectedLookups['categoryId']?._id });

  const lookupDataMap: Record<string, any[]> = {
    customers:  customersData?.items  ?? [],
    sites:      sitesData?.items      ?? [],
    teams:      teamsData?.items      ?? [],
    staffs:     staffsData?.items     ?? [],
    services:   servicesData?.items   ?? [],
    categories: categoriesData?.items ?? [],
    workorders: workordersData?.items ?? [],
    quotations: quotationsData?.items ?? [],
  };

  useEffect(() => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === 'servicelines' || f.type === 'multilookup' || f.type === 'multiselect') {
        initial[f.key] = record?.[f.key] ?? [];
      } else if (f.type === 'lookup') {
        // Handle populated Mongoose objects (e.g. record.teamId = { _id: "...", name: "..." })
        const raw = record?.[f.key];
        if (raw && typeof raw === 'object' && raw._id) {
          initial[f.key] = f.lookupValueField === '_id' ? raw._id?.toString() : (raw[f.lookupValueField!] ?? '');
        } else {
          initial[f.key] = raw ?? '';
        }
      } else {
        initial[f.key] = record?.[f.key] ?? '';
      }
    });
    // Pre-fill branchId from global context when creating a new record
    if (!record && fields.some((f) => f.type === 'branch-select')) {
      initial.branchId = currentBranch?._id ?? null;
    }

    setForm(initial);

    // Restore selectedLookups from existing record so cascades work on edit
    const lookups: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.type === 'lookup' && record?.[f.key]) {
        const opts = lookupDataMap[f.lookupModule!] ?? [];
        const rawVal = typeof record[f.key] === 'object' ? record[f.key]?._id?.toString() : record[f.key];
        const found = opts.find(r => {
          const optVal = f.lookupValueField === '_id' ? r._id?.toString() : r[f.lookupValueField!];
          return optVal === rawVal;
        }) ?? null;
        if (found) lookups[f.key] = found;
      }
    });
    setSelectedLookups(lookups);

    const cf: Record<string, any> = {};
    activeCustomFields.forEach((f) => {
      cf[f.fieldKey] = record?.customFields?.[f.fieldKey] ?? '';
    });
    setCustomForm(cf);

    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, fields, module]);

  // Staff availability check — fires when scheduledDate / nextServiceDate / startDate changes
  const hasStaffField = fields.some(f => f.lookupModule === 'staffs');
  const checkDate = form.scheduledDate ?? form.nextServiceDate ?? form.startDate;
  useEffect(() => {
    if (!hasStaffField || !checkDate) { setStaffBusyMap({}); return; }
    const allStaffs = staffsData?.items ?? [];
    if (!allStaffs.length) return;
    let cancelled = false;
    const raw     = String(checkDate);
    const hasTime = raw.length > 10; // has a time component (input value or ISO from API)
    // Normalize to local wall-clock — ISO strings from the API are UTC and
    // slicing them directly would check availability against the wrong time
    const local   = hasTime ? toDatetimeLocal(raw) : raw;
    Promise.all(
      allStaffs.map(async (s: any) => {
        const staffId = s.staffId ?? s._id?.toString();
        try {
          const res = await api.get(`/api/v1/native-crm/workorders/staff-availability`, {
            params: {
              staffId,
              date: local.slice(0, 10),
              ...(hasTime ? { datetime: local.slice(0, 16) } : {}),
              ...(form.durationHours ? { duration: form.durationHours } : {}),
              ...(record?._id ? { excludeId: record._id } : {}),
            },
          });
          return [staffId, (res.data.data ?? { busy: false }) as StaffAvailability] as [string, StaffAvailability];
        } catch {
          return [staffId, { busy: false } as StaffAvailability] as [string, StaffAvailability];
        }
      })
    ).then((results) => {
      if (!cancelled) setStaffBusyMap(Object.fromEntries(results));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkDate, form.durationHours, staffsData?.items]);

  const handleChange = (key: string, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  };

  const handleLookupChange = (field: FSFieldDef, value: string) => {
    const opts     = lookupDataMap[field.lookupModule!] ?? [];
    const selected = opts.find(r => {
      const v = field.lookupValueField === '_id' ? r._id?.toString() : r[field.lookupValueField!];
      return v === value;
    }) ?? null;
    setSelectedLookups(prev => ({ ...prev, [field.key]: selected }));

    // Reset cascaded children
    fields.filter(f => f.cascadeParentField === field.key).forEach(f => {
      handleChange(f.key, '');
      setSelectedLookups(prev => ({ ...prev, [f.key]: null }));
    });

    handleChange(field.key, value);
  };

  const handleCustomChange = (key: string, val: any) => {
    setCustomForm((prev) => ({ ...prev, [key]: val }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.filterOnly || f.type === 'servicelines' || f.type === 'multilookup' || f.type === 'multiselect') return;
      if (f.required && !form[f.key]?.toString().trim()) errs[f.key] = `${f.label} is required`;
    });
    activeCustomFields.forEach((f) => {
      if (f.required && !customForm[f.fieldKey]?.toString?.()?.trim?.()) {
        errs[`cf_${f.fieldKey}`] = `${f.label} is required`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      // Create-mode prefill passthrough: keys seeded by buildPrefill / view pages
      // (e.g. contractId, quotationId, contractVisitNumber) that have no form
      // field of their own must still reach the API. Form fields overwrite below.
      if (!record?._id && record && typeof record === 'object') {
        for (const [k, v] of Object.entries(record)) {
          if (v !== undefined && v !== null) payload[k] = v;
        }
      }
      fields.forEach(f => {
        if (!f.filterOnly) {
          const val = form[f.key];
          if (f.type === 'number' || f.type === 'currency') {
            // Omit empty numeric inputs — zod z.number() rejects ''
            if (val !== '' && val !== null && val !== undefined) payload[f.key] = parseFloat(val) || 0;
          } else if ((f.type === 'select' || f.type === 'date' || f.type === 'datetime' || f.type === 'duration')
                     && (val === '' || val === null || val === undefined)) {
            // Omit empty selects/dates — zod z.enum() rejects '' and Mongo can't cast '' to Date
          } else {
            payload[f.key] = val;
          }
        }
      });

      if (activeCustomFields.length > 0) {
        payload.customFields = customForm;
      }

      // Compute servicesAmount / servicesAmountWithTax for financial documents
      const slField = fields.find(f => f.type === 'servicelines' && f.withTotals);
      if (slField) {
        const lines    = (form[slField.key] ?? []) as any[];
        const subtotal = lines.reduce((s: number, l: any) => s + (Number(l.amount) || 0) * (Number(l.count) || 1), 0);
        const disc     = Number(form.discount ?? 0);
        const gst      = Number(form.gstPercentage ?? 0);
        const after    = subtotal * (1 - disc / 100);
        payload.servicesAmount        = parseFloat(after.toFixed(2));
        payload.servicesAmountWithTax = parseFloat((after * (1 + gst / 100)).toFixed(2));
      }

      if (record?._id) {
        await onUpdate(record._id, payload);
      } else {
        await onCreate(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setErrors({ _server: err?.response?.data?.message ?? 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FSFieldDef) => {
    const value = form[field.key];

    if (field.type === 'branch-select') {
      const active = branches.filter((b) => b.status === 'active');
      return (
        <select
          className={base}
          value={value ?? ''}
          onChange={(e) => handleChange(field.key, e.target.value || null)}
        >
          <option value="">Default Company</option>
          {active.map((b) => (
            <option key={b._id} value={b._id}>{b.branchName}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'servicelines') {
      const catKey  = field.categoryFilterField;
      const catId   = catKey ? selectedLookups[catKey]?._id?.toString() : undefined;
      const allSvcs = servicesData?.items ?? [];
      const svcs    = catId
        ? allSvcs.filter(s => {
            const cId = typeof s.categoryId === 'object'
              ? s.categoryId?._id?.toString()
              : s.categoryId?.toString();
            return cId === catId;
          })
        : allSvcs;
      return (
        <ServiceLinesEditor
          value={value ?? []}
          onChange={val => handleChange(field.key, val)}
          availableServices={svcs}
          withTotals={field.withTotals}
          discount={parseFloat(form.discount ?? 0)}
          gstPercentage={parseFloat(form.gstPercentage ?? 0)}
        />
      );
    }

    if (field.type === 'multiselect' && field.options) {
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
          {field.options.map(opt => {
            const checked = selected.includes(opt);
            const label   = opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ');
            return (
              <label key={opt} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter(v => v !== opt);
                    handleChange(field.key, next);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (field.type === 'lookup') {
      const isStaffField = field.lookupModule === 'staffs';
      const hardBlock    = isStaffField && (settings?.staffHardBlock ?? false);
      const allOpts      = lookupDataMap[field.lookupModule!] ?? [];

      // Filter/mark busy staff
      const opts = isStaffField && checkDate
        ? (hardBlock
            ? allOpts.filter(o => !staffBusyMap[o.staffId ?? o._id?.toString()]?.busy)
            : allOpts)
        : allOpts;

      const storedVal = field.lookupValueField === '_id'
        ? (selectedLookups[field.key]?._id?.toString() ?? '')
        : (value ?? '');

      // Find Nearest Staff — shown when site with lat/lng is selected and date is set
      const site = isStaffField ? (selectedLookups['siteId'] ?? null) : null;
      const siteHasCoords = site && site.latitude != null && site.longitude != null;

      const handleFindNearest = async () => {
        if (!site) return;
        setNearestLoading(true);
        setNearestResults(null);
        try {
          const skills: string[] = Array.isArray(form.skills) ? form.skills : [];
          const params = new URLSearchParams({
            lat: String(site.latitude),
            lng: String(site.longitude),
            ...(checkDate ? { date: String(checkDate).slice(0, 10) } : {}),
            ...(skills.length ? { skills: skills.join(',') } : {}),
          });
          const res = await api.get(`/api/v1/native-crm/workorders/nearest-staff?${params}`);
          setNearestResults(res.data?.data ?? []);
        } catch { setNearestResults([]); } finally { setNearestLoading(false); }
      };

      return (
        <div className="relative" ref={isStaffField ? nearestRef : undefined}>
          <div className="flex gap-2">
            <select
              value={storedVal}
              onChange={e => handleLookupChange(field, e.target.value)}
              className={`${base} flex-1`}
            >
              <option value="">Select {field.label}…</option>
              {opts.map(opt => {
                const val = field.lookupValueField === '_id'
                  ? opt._id?.toString()
                  : opt[field.lookupValueField!];
                const baseLbl = field.lookupLabelField === 'fullName'
                  ? `${opt.firstName ?? ''} ${opt.lastName ?? ''}`.trim()
                  : (opt[field.lookupLabelField ?? 'name'] ?? val);
                const staffId = opt.staffId ?? opt._id?.toString();
                const avail   = isStaffField && !hardBlock ? staffBusyMap[staffId] : undefined;
                const lbl     = `${baseLbl}${availabilityShort(avail)}`;
                return (
                  <option key={opt._id} value={val}>
                    {lbl}{val && val !== baseLbl ? ` (${val})` : ''}
                  </option>
                );
              })}
            </select>
            {isStaffField && siteHasCoords && (
              <button
                type="button"
                onClick={handleFindNearest}
                disabled={nearestLoading}
                className="flex-shrink-0 px-3 py-2 text-xs rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50 disabled:opacity-50 whitespace-nowrap"
              >
                {nearestLoading ? '...' : 'Find Nearest'}
              </button>
            )}
          </div>
          {isStaffField && storedVal && (() => {
            const selOpt = allOpts.find(o => {
              const v = field.lookupValueField === '_id' ? o._id?.toString() : o[field.lookupValueField!];
              return v === storedVal;
            });
            const note = availabilityNote(staffBusyMap[selOpt?.staffId ?? selOpt?._id?.toString()]);
            return note ? <p className="mt-1 text-xs text-red-500">🔴 {note}</p> : null;
          })()}
          {nearestResults !== null && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
              {nearestResults.length === 0 ? (
                <p className="text-xs text-gray-400 p-3 text-center">No staff with location data found</p>
              ) : (
                nearestResults.map((s) => (
                  <button
                    key={s.staffId}
                    type="button"
                    onClick={() => {
                      handleLookupChange(field, s.staffId);
                      setNearestResults(null);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                      {s.skills?.length > 0 && (
                        <p className="text-xs text-gray-400">{s.skills.join(', ')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600">{s.distance_km} km</p>
                      {s.busy && <p className="text-xs text-red-500">🔴 Busy</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'multilookup') {
      const allOpts = lookupDataMap[field.lookupModule!] ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      const isStaffField = field.lookupModule === 'staffs';
      const hardBlock    = isStaffField && (settings?.staffHardBlock ?? false) && !!checkDate;
      const opts = allOpts;

      // Find Nearest Staff — same feature as the single staff lookup
      const mlSite = isStaffField ? (selectedLookups['siteId'] ?? null) : null;
      const mlSiteHasCoords = mlSite && mlSite.latitude != null && mlSite.longitude != null;
      const handleFindNearestMulti = async () => {
        if (!mlSite) return;
        setNearestLoading(true);
        setNearestResults(null);
        try {
          const skills: string[] = Array.isArray(form.skills) ? form.skills : [];
          const params = new URLSearchParams({
            lat: String(mlSite.latitude),
            lng: String(mlSite.longitude),
            ...(checkDate ? { date: String(checkDate).slice(0, 10) } : {}),
            ...(skills.length ? { skills: skills.join(',') } : {}),
          });
          const res = await api.get(`/api/v1/native-crm/workorders/nearest-staff?${params}`);
          setNearestResults(res.data?.data ?? []);
        } catch { setNearestResults([]); } finally { setNearestLoading(false); }
      };

      return (
        <div className="relative" ref={isStaffField ? nearestRef : undefined}>
          {isStaffField && mlSiteHasCoords && (
            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={handleFindNearestMulti}
                disabled={nearestLoading}
                className="px-3 py-1.5 text-xs rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50 disabled:opacity-50 whitespace-nowrap"
              >
                {nearestLoading ? '...' : 'Find Nearest'}
              </button>
            </div>
          )}
          {isStaffField && nearestResults !== null && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
              {nearestResults.length === 0 ? (
                <p className="text-xs text-gray-400 p-3 text-center">No staff with location data found</p>
              ) : (
                nearestResults.map((s) => (
                  <button
                    key={s.staffId}
                    type="button"
                    onClick={() => {
                      if (!selected.includes(s.staffId)) handleChange(field.key, [...selected, s.staffId]);
                      setNearestResults(null);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                      {s.skills?.length > 0 && (
                        <p className="text-xs text-gray-400">{s.skills.join(', ')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600">{s.distance_km} km</p>
                      {s.busy && <p className="text-xs text-red-500">🔴 Busy</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
          {opts.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-1">No {field.label.toLowerCase()} available</p>
          )}
          {opts.map(opt => {
            const val = field.multilookupValueField
              ? (opt[field.multilookupValueField] ?? opt._id?.toString())
              : opt._id?.toString();
            const baseLbl = field.lookupLabelField === 'fullName'
              ? `${opt.firstName ?? ''} ${opt.lastName ?? ''}`.trim()
              : (opt[field.lookupLabelField ?? 'name'] ?? val);
            const sid     = opt.staffId ?? opt._id?.toString();
            const avail   = isStaffField && !!checkDate ? staffBusyMap[sid] : undefined;
            const busy    = !!avail?.busy;
            const note    = availabilityNote(avail);
            const checked = selected.includes(val);
            // Hard block: busy staff stay visible but cannot be selected
            // (already-selected staff remain toggleable so editing never traps a record)
            const blocked = hardBlock && busy && !checked;
            return (
              <label
                key={opt._id}
                className={`flex items-start gap-2 px-2 py-1 rounded transition-colors ${
                  blocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={blocked}
                  onChange={e => {
                    const next = e.target.checked
                      ? [...selected, val]
                      : selected.filter(v => v !== val);
                    handleChange(field.key, next);
                  }}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400 disabled:cursor-not-allowed"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-gray-700">{baseLbl}</span>
                  {busy && note && (
                    <span className="block text-[11px] text-red-500 leading-snug">🔴 {note}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          rows={3}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={e => handleChange(field.key, e.target.value)}
          className={`${base} resize-none`}
        />
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <select value={value ?? ''} onChange={e => handleChange(field.key, e.target.value)} className={base}>
          <option value="">Select…</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => handleChange(field.key, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
          />
          <span className="text-sm text-gray-700">{field.placeholder ?? 'Enabled'}</span>
        </label>
      );
    }

    if (field.type === 'date') {
      const dateVal = value ? String(value).slice(0, 10) : '';
      return (
        <input
          type="date"
          value={dateVal}
          onChange={e => handleChange(field.key, e.target.value)}
          className={base}
        />
      );
    }

    if (field.type === 'duration') {
      const total = parseFloat(String(value ?? '')) || 0;
      const { hrs, mins } = splitHours(total);
      const setHM = (h: number, m: number) => {
        const joined = joinHours(h, m);
        handleChange(field.key, joined > 0 ? String(joined) : '');
      };
      return (
        <div className="flex items-center gap-2">
          <select
            value={hrs}
            onChange={e => setHM(parseInt(e.target.value, 10), mins)}
            className={base}
          >
            {Array.from({ length: 25 }, (_, i) => (
              <option key={i} value={i}>{i} hr{i !== 1 ? 's' : ''}</option>
            ))}
          </select>
          <select
            value={hrs === 24 ? 0 : mins}
            disabled={hrs === 24}
            onChange={e => setHM(hrs, parseInt(e.target.value, 10))}
            className={`${base} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'datetime') {
      // Convert stored UTC ISO strings to local wall-clock time for display —
      // slicing the raw ISO string would show UTC and shift the time on re-edit.
      const dtVal = toDatetimeLocal(value);
      return (
        <input
          type="datetime-local"
          value={dtVal}
          onChange={e => handleChange(field.key, e.target.value)}
          className={base}
        />
      );
    }

    const inputType =
      field.type === 'email'                                  ? 'email'
      : field.type === 'phone'                               ? 'tel'
      : field.type === 'number' || field.type === 'currency' ? 'number'
      : 'text';

    return (
      <input
        type={inputType}
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={e => handleChange(field.key, e.target.value)}
        className={base}
        step={field.type === 'currency' ? '0.01' : undefined}
        min={field.type === 'number' || field.type === 'currency' ? '0' : undefined}
      />
    );
  };

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />

      <div className={`fixed right-0 top-0 h-full w-full max-w-[52vw] min-w-[600px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{record?._id ? 'Edit record' : 'Create new record'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-7 py-5">
            <div className="grid grid-cols-2 gap-x-5 gap-y-5">
              {record?.isLocked && (
                <div className="col-span-2">
                  <RecordLockBanner
                    record={record}
                    entityModule={module ?? ''}
                    onUnlocked={onUnlocked ?? (() => {})}
                  />
                </div>
              )}

              {errors._server && (
                <div className="col-span-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {errors._server}
                </div>
              )}

              {fields.map((field) => {
                const fullWidth =
                  field.type === 'textarea' ||
                  field.type === 'servicelines' ||
                  field.type === 'multilookup' ||
                  field.type === 'multiselect' ||
                  field.type === 'boolean' ||
                  /address|note|description|remark|instruction|reason/i.test(field.key);
                return (
                  <div key={field.key} className={fullWidth ? 'col-span-2' : 'col-span-1'}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      {field.filterOnly && (
                        <span className="ml-1.5 text-xs font-normal text-gray-400 normal-case tracking-normal">(filter only)</span>
                      )}
                    </label>
                    {renderField(field)}
                    {errors[field.key] && (
                      <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>
                    )}
                  </div>
                );
              })}

              {activeCustomFields.length > 0 && (
                <div className="col-span-2 mt-1 pt-5 border-t border-dashed border-gray-200">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Custom Fields</p>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                    {activeCustomFields.map((cf) => (
                      <div key={cf.fieldKey} className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          {cf.label}
                          {cf.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <CustomFieldRenderer
                          field={cf}
                          value={customForm[cf.fieldKey]}
                          onChange={(val) => handleCustomChange(cf.fieldKey, val)}
                          templateFields={
                            cf.fieldType === 'custom_form'
                              ? formTemplates.find((t) => t._id === cf.formTemplateId)?.fields
                              : undefined
                          }
                        />
                        {errors[`cf_${cf.fieldKey}`] && (
                          <p className="mt-1 text-xs text-red-500">{errors[`cf_${cf.fieldKey}`]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-7 py-5 border-t border-gray-100 flex items-center justify-center gap-3 shrink-0 bg-gray-50/60">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!!record?.isLocked && !isAdmin)}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center gap-2 min-w-[120px] justify-center"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {saving ? 'Saving…' : record ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
