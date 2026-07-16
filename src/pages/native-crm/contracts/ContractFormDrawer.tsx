import { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useBranchStore } from '../../../stores/branch.store';
import { useAuthStore } from '../../../stores/auth.store';
import { RecordLockBanner } from '../../../components/native-crm/RecordLockBanner';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { useSitesListQuery } from '../../../modules/native-crm/queries/sites.queries';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import { useServicesListQuery } from '../../../modules/native-crm/queries/services.queries';
import { useSchedulePreview, type ScheduleSummary } from '../../../modules/native-crm/queries/contracts.queries';
import { useCustomFieldsQuery } from '../../../modules/native-crm/queries/custom-fields.queries';
import { useCustomFormTemplatesQuery } from '../../../modules/native-crm/queries/custom-form-templates.queries';
import CustomFieldRenderer from '../../../modules/native-crm/shared/CustomFieldRenderer';
import { toDatetimeLocal, availabilityNote, type StaffAvailability } from '../../../modules/native-crm/shared/duration';
import ContractServiceLinesEditor, { type ContractServiceLine } from './ContractServiceLinesEditor';
import api from '../../../services/api';

interface Props {
  record:   any | null;   // null / no _id = create; with _id = edit
  onClose:  () => void;
  onSaved:  () => void;
  onCreate: (data: any) => Promise<any>;
  onUpdate: (id: string, data: any) => Promise<any>;
  onUnlocked?: () => void;
}

const inp  = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';
const lbl  = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

const CONTRACT_TYPES = ['amc', 'maintenance', 'rental', 'warranty', 'preventive', 'corrective', 'installation', 'inspection', 'custom'];
const PRIORITIES     = ['low', 'medium', 'high', 'critical'];
const STATUSES       = ['draft', 'pending', 'active', 'suspended', 'completed', 'expired', 'cancelled'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-5 first:pt-0">
      <p className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-3 pb-1.5 border-b border-gray-100">{title}</p>
      {children}
    </div>
  );
}

export default function ContractFormDrawer({ record, onClose, onSaved, onCreate, onUpdate, onUnlocked }: Props) {
  const isEdit = !!record?._id;

  const user    = useAuthStore((s) => s.user);
  const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN'].includes(user?.role ?? '');
  const branches      = useBranchStore((s) => s.branches);
  const currentBranch = useBranchStore((s) => s.currentBranch);

  /* ── form state ─────────────────────────────────────────────────────────── */
  const [form, setForm] = useState<Record<string, any>>({});
  const [services, setServices] = useState<ContractServiceLine[]>([]);
  const [customForm, setCustomForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const r = record ?? {};
    setForm({
      branchId:         r.branchId ?? currentBranch?._id ?? null,
      customerId:       r.customerId ?? '',
      title:            r.title ?? '',
      contractType:     r.contractType ?? '',
      priority:         r.priority ?? '',
      status:           r.status ?? 'draft',
      startDate:        r.startDate ? toDatetimeLocal(r.startDate) : '',
      endDate:          r.endDate ? String(r.endDate).slice(0, 10) : '',
      noEndDate:        r.noEndDate ?? false,
      renewalType:      r.renewalType ?? 'manual',
      renewBeforeDays:  r.renewBeforeDays ?? 30,
      siteId:           r.siteId ?? '',
      teamId:           r.teamId ?? '',
      staffIds:         r.staffIds?.length ? r.staffIds : (r.staffId ? [r.staffId] : []),
      woGenerationMode: r.woGenerationMode ?? 'manual',
      woLeadDays:       r.woLeadDays ?? 7,
      discount:         r.discount ?? 0,
      gstPercentage:    r.gstPercentage ?? 0,
      notes:            r.notes ?? '',
      termsAndConditions: r.termsAndConditions ?? '',
      quotationId:      r.quotationId ?? '',
    });
    setServices(Array.isArray(r.services) ? r.services.map((s: any) => ({ ...s })) : []);
    setErrors({});
    setServerError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const set = (k: string, v: any) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => { const e = { ...p }; delete e[k]; return e; });
  };

  /* ── lookups ────────────────────────────────────────────────────────────── */
  const { data: customersData } = useCustomersListQuery({ page: 1, limit: 500 });
  const { data: teamsData }     = useTeamsListQuery({ page: 1, limit: 500 });
  const { data: servicesData }  = useServicesListQuery({ page: 1, limit: 500 });

  const customers = customersData?.items ?? [];
  const selectedCustomer = customers.find((c: any) => c.customerId === form.customerId) ?? null;
  const { data: sitesData }  = useSitesListQuery({ page: 1, limit: 500, customerId: selectedCustomer?._id });
  const teams = teamsData?.items ?? [];
  const selectedTeam = teams.find((t: any) => t.teamId === form.teamId) ?? null;
  const { data: staffsData } = useStaffsListQuery({ page: 1, limit: 500, teamId: selectedTeam?._id });
  const staffs = staffsData?.items ?? [];

  const { data: customFields = [] } = useCustomFieldsQuery('contracts');
  const activeCustomFields = customFields.filter((cf) => cf.isActive);
  const { data: formTemplates = [] } = useCustomFormTemplatesQuery();

  useEffect(() => {
    const cf: Record<string, any> = {};
    activeCustomFields.forEach((f) => { cf[f.fieldKey] = record?.customFields?.[f.fieldKey] ?? ''; });
    setCustomForm(cf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, customFields.length]);

  /* ── No End Date → auto +1 year ─────────────────────────────────────────── */
  useEffect(() => {
    if (form.noEndDate && form.startDate) {
      const d = new Date(String(form.startDate));
      if (!isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        set('endDate', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.noEndDate, form.startDate]);

  /* ── staff availability (soft note, contract start date) ────────────────── */
  const [staffBusyMap, setStaffBusyMap] = useState<Record<string, StaffAvailability>>({});
  useEffect(() => {
    if (!form.startDate || !staffs.length) { setStaffBusyMap({}); return; }
    let cancelled = false;
    Promise.all(
      staffs.map(async (s: any) => {
        const sid = s.staffId ?? s._id?.toString();
        try {
          const res = await api.get('/api/v1/native-crm/workorders/staff-availability', {
            params: { staffId: sid, date: String(form.startDate).slice(0, 10) },
          });
          return [sid, (res.data.data ?? { busy: false }) as StaffAvailability] as const;
        } catch { return [sid, { busy: false } as StaffAvailability] as const; }
      })
    ).then((entries) => { if (!cancelled) setStaffBusyMap(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, staffsData?.items]);

  /* ── schedule preview (debounced dry-run) ───────────────────────────────── */
  const previewMutation = useSchedulePreview();
  const [preview, setPreview] = useState<ScheduleSummary | null>(null);
  const [previewError, setPreviewError] = useState('');
  const rulesKey = useMemo(() => JSON.stringify(services.map((s) => ({
    a: s.amount, c: s.count, t: s.taxPercent, d: s.discountPercent, h: s.durationHours, r: s.scheduleRule,
  }))), [services]);

  useEffect(() => {
    const hasRules = services.some((s) => s.scheduleRule?.frequency);
    if (!hasRules || !form.startDate || !form.endDate) { setPreview(null); setPreviewError(''); return; }
    const t = setTimeout(() => {
      previewMutation.mutate(
        {
          services: services.map((s) => ({
            ...s,
            amount: parseFloat(String(s.amount)) || 0,
            count:  parseFloat(String(s.count))  || 1,
            taxPercent:      s.taxPercent      !== '' && s.taxPercent      != null ? parseFloat(String(s.taxPercent))      : undefined,
            discountPercent: s.discountPercent !== '' && s.discountPercent != null ? parseFloat(String(s.discountPercent)) : undefined,
            durationHours:   s.durationHours   !== '' && s.durationHours   != null ? parseFloat(String(s.durationHours))   : undefined,
          })),
          startDate: String(form.startDate),
          endDate:   String(form.endDate),
        },
        {
          onSuccess: (d) => { setPreview(d.summary); setPreviewError(''); },
          onError:   (e: any) => { setPreview(null); setPreviewError(e?.response?.data?.message ?? 'Preview failed'); },
        },
      );
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesKey, form.startDate, form.endDate]);

  /* ── submit ─────────────────────────────────────────────────────────────── */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.customerId) e.customerId = 'Customer is required';
    if (!form.title?.trim()) e.title = 'Title is required';
    const hasRules = services.some((s) => s.scheduleRule?.frequency);
    if (hasRules) {
      if (!form.startDate) e.startDate = 'Start date is required for scheduled services';
      if (!form.endDate)   e.endDate   = 'End date is required for scheduled services';
      if (form.startDate && form.endDate && new Date(String(form.endDate)) < new Date(String(form.startDate).slice(0, 10))) {
        e.endDate = 'End date must be after start date';
      }
    }
    services.forEach((s, i) => { if (!s.name?.trim()) e[`svc${i}`] = `Service ${i + 1} needs a name`; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError('');
    try {
      const payload: any = {
        branchId:         form.branchId || null,
        customerId:       form.customerId,
        title:            form.title,
        status:           form.status || 'draft',
        startDate:        form.startDate || undefined,
        endDate:          form.endDate || undefined,
        noEndDate:        !!form.noEndDate,
        renewalType:      form.renewalType || undefined,
        renewBeforeDays:  Number(form.renewBeforeDays) || 0,
        siteId:           form.siteId || undefined,
        teamId:           form.teamId || undefined,
        staffIds:         form.staffIds ?? [],
        staffId:          (form.staffIds ?? [])[0] ?? undefined,
        woGenerationMode: form.woGenerationMode || 'manual',
        woLeadDays:       Number(form.woLeadDays) || 0,
        discount:         parseFloat(String(form.discount)) || 0,
        gstPercentage:    parseFloat(String(form.gstPercentage)) || 0,
        notes:            form.notes || undefined,
        termsAndConditions: form.termsAndConditions || undefined,
        quotationId:      form.quotationId || undefined,
        services: services.map((s) => ({
          name:        s.name,
          description: s.description || undefined,
          amount:      parseFloat(String(s.amount)) || 0,
          count:       parseFloat(String(s.count)) || 1,
          scheduleRule:    s.scheduleRule?.frequency ? s.scheduleRule : undefined,
          durationHours:   s.durationHours   !== '' && s.durationHours   != null ? parseFloat(String(s.durationHours))   : undefined,
          taxPercent:      s.taxPercent      !== '' && s.taxPercent      != null ? parseFloat(String(s.taxPercent))      : undefined,
          discountPercent: s.discountPercent !== '' && s.discountPercent != null ? parseFloat(String(s.discountPercent)) : undefined,
          requiredSkill: s.requiredSkill || undefined,
          serviceId:   s.serviceId || undefined,
        })),
      };
      if (form.contractType) payload.contractType = form.contractType;
      if (form.priority)     payload.priority     = form.priority;
      if (activeCustomFields.length > 0) payload.customFields = customForm;

      if (isEdit) await onUpdate(record._id, payload);
      else        await onCreate(payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  /* ── render ─────────────────────────────────────────────────────────────── */
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const scheduleLocked = isEdit && (record?.visits ?? []).some(
    (v: any) => v.status === 'scheduled' || v.status === 'completed',
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-full max-w-[56vw] min-w-[640px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-brand-500 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                {isEdit ? 'Edit Contract' : 'New Contract'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Each service can have its own frequency — the schedule is generated automatically.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-1">
            {record?.isLocked && (
              <RecordLockBanner record={record} entityModule="contracts" onUnlocked={onUnlocked ?? (() => {})} />
            )}
            {serverError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{serverError}</div>
            )}
            {scheduleLocked && (
              <div className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-4 py-2.5 rounded-xl">
                Work orders already exist for this schedule — dates and services can be edited, but the generated visit schedule will not be regenerated.
              </div>
            )}

            {/* 1. Customer */}
            <Section title="Customer">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Company</label>
                  <select className={inp} value={form.branchId ?? ''} onChange={(e) => set('branchId', e.target.value || null)}>
                    <option value="">Default Company</option>
                    {branches.filter((b) => b.status === 'active').map((b) => (
                      <option key={b._id} value={b._id}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Customer <span className="text-red-500">*</span></label>
                  <select className={inp} value={form.customerId ?? ''} onChange={(e) => { set('customerId', e.target.value); set('siteId', ''); }}>
                    <option value="">Select customer…</option>
                    {customers.map((c: any) => (
                      <option key={c._id} value={c.customerId}>{c.name} ({c.customerId})</option>
                    ))}
                  </select>
                  {errors.customerId && <p className="mt-1 text-xs text-red-500">{errors.customerId}</p>}
                </div>
                {selectedCustomer && (
                  <div className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex flex-wrap gap-x-5 gap-y-1">
                    {selectedCustomer.email && <span><strong>Email:</strong> {selectedCustomer.email}</span>}
                    {selectedCustomer.phone && <span><strong>Phone:</strong> {selectedCustomer.phone}</span>}
                    {selectedCustomer.address && <span><strong>Address:</strong> {selectedCustomer.address}</span>}
                  </div>
                )}
                <div>
                  <label className={lbl}>Site</label>
                  <select className={inp} value={form.siteId ?? ''} onChange={(e) => set('siteId', e.target.value)}>
                    <option value="">Select site…</option>
                    {(sitesData?.items ?? []).map((s: any) => (
                      <option key={s._id} value={s.siteId}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* 2. Contract Info */}
            <Section title="Contract Information">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <label className={lbl}>Contract Name <span className="text-red-500">*</span></label>
                  <input className={inp} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Annual AC Maintenance — Tower A" />
                  {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
                </div>
                <div>
                  <label className={lbl}>Contract Type</label>
                  <select className={inp} value={form.contractType ?? ''} onChange={(e) => set('contractType', e.target.value)}>
                    <option value="">Select…</option>
                    {CONTRACT_TYPES.map((t) => (
                      <option key={t} value={t}>{t === 'amc' ? 'AMC' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Priority</label>
                  <select className={inp} value={form.priority ?? ''} onChange={(e) => set('priority', e.target.value)}>
                    <option value="">Select…</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp} value={form.status ?? 'draft'} onChange={(e) => set('status', e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* 3. Duration & Renewal */}
            <Section title="Contract Period & Renewal">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Start Date & Time</label>
                  <input type="datetime-local" className={inp} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
                  {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
                </div>
                <div>
                  <label className={lbl}>End Date</label>
                  <input type="date" className={`${inp} ${form.noEndDate ? 'bg-gray-50 text-gray-400' : ''}`}
                    disabled={!!form.noEndDate}
                    value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} />
                  {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate}</p>}
                  <label className="mt-1.5 flex items-center gap-2 cursor-pointer text-xs text-gray-500">
                    <input type="checkbox" checked={!!form.noEndDate} onChange={(e) => set('noEndDate', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
                    No fixed term (auto-set 1 year from start)
                  </label>
                </div>
                <div>
                  <label className={lbl}>Renewal</label>
                  <select className={inp} value={form.renewalType ?? 'manual'} onChange={(e) => set('renewalType', e.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatic</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Renew Before</label>
                  <select className={inp} value={String(form.renewBeforeDays ?? 30)} onChange={(e) => set('renewBeforeDays', parseInt(e.target.value, 10))}>
                    {[15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* 4. Services */}
            <Section title="Services & Frequency">
              <ContractServiceLinesEditor
                value={services}
                onChange={setServices}
                availableServices={servicesData?.items ?? []}
              />
              {Object.entries(errors).filter(([k]) => k.startsWith('svc')).map(([k, v]) => (
                <p key={k} className="mt-1 text-xs text-red-500">{v}</p>
              ))}
            </Section>

            {/* 5. Schedule Preview */}
            {(preview || previewMutation.isPending || previewError) && (
              <Section title="Schedule Preview">
                {previewError ? (
                  <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{previewError}</p>
                ) : preview ? (
                  <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        ['Total Visits', String(preview.totalVisits)],
                        ['Total Days', String(preview.totalDays)],
                        ['Est. Revenue', preview.estimatedRevenue.toLocaleString()],
                        ['Est. Hours', `${preview.estimatedHours} hrs`],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-white rounded-lg border border-brand-100 px-3 py-2.5 text-center">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                          <p className="text-lg font-bold text-brand-700 mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                    {preview.perMonth.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {preview.perMonth.map((m) => (
                          <span key={m.month} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-brand-100 text-xs text-gray-600">
                            <CalendarDaysIcon className="h-3.5 w-3.5 text-brand-400" />
                            {m.month} · <strong>{m.count}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Calculating schedule…</p>
                )}
              </Section>
            )}

            {/* 6. Team & Staff */}
            <Section title="Team & Staff">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Team</label>
                  <select className={inp} value={form.teamId ?? ''} onChange={(e) => { set('teamId', e.target.value); set('staffIds', []); }}>
                    <option value="">Select team…</option>
                    {teams.map((t: any) => <option key={t._id} value={t.teamId}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Staff</label>
                  <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                    {staffs.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No staff available</p>}
                    {staffs.map((s: any) => {
                      const sid = s.staffId ?? s._id?.toString();
                      const checked = (form.staffIds ?? []).includes(sid);
                      const note = availabilityNote(staffBusyMap[sid]);
                      return (
                        <label key={s._id} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={(e) => {
                              const cur: string[] = form.staffIds ?? [];
                              set('staffIds', e.target.checked ? [...cur, sid] : cur.filter((x) => x !== sid));
                            }}
                            className="h-4 w-4 mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-gray-700">{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</span>
                            {note && <span className="block text-[11px] text-red-500 leading-snug">🔴 {note}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Section>

            {/* 7. Work Order Generation */}
            <Section title="Work Order Generation">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Mode</label>
                  <select className={inp} value={form.woGenerationMode ?? 'manual'} onChange={(e) => set('woGenerationMode', e.target.value)}>
                    <option value="manual">Manual — I create work orders from the schedule</option>
                    <option value="on_visit_day">Automatic — on the visit day</option>
                    <option value="days_before">Automatic — N days before the visit</option>
                  </select>
                </div>
                {form.woGenerationMode === 'days_before' && (
                  <div>
                    <label className={lbl}>Lead Days</label>
                    <input type="number" min={1} className={inp} value={form.woLeadDays ?? 7}
                      onChange={(e) => set('woLeadDays', parseInt(e.target.value, 10) || 1)} />
                  </div>
                )}
              </div>
            </Section>

            {/* 8. Pricing & Notes */}
            <Section title="Pricing & Notes">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Discount (flat)</label>
                  <input type="number" min={0} step="0.01" className={inp} value={form.discount ?? 0} onChange={(e) => set('discount', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>GST %</label>
                  <input type="number" min={0} step="0.01" className={inp} value={form.gstPercentage ?? 0} onChange={(e) => set('gstPercentage', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Notes</label>
                  <textarea rows={2} className={`${inp} resize-none`} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Terms & Conditions</label>
                  <textarea rows={2} className={`${inp} resize-none`} value={form.termsAndConditions ?? ''} onChange={(e) => set('termsAndConditions', e.target.value)} />
                </div>
              </div>
            </Section>

            {/* 9. Custom Fields */}
            {activeCustomFields.length > 0 && (
              <Section title="Custom Fields">
                <div className="space-y-4">
                  {activeCustomFields.map((cf) => (
                    <div key={cf.fieldKey}>
                      <label className={lbl}>{cf.label}{cf.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                      <CustomFieldRenderer
                        field={cf}
                        value={customForm[cf.fieldKey]}
                        onChange={(val) => setCustomForm((p) => ({ ...p, [cf.fieldKey]: val }))}
                        templateFields={
                          cf.fieldType === 'custom_form'
                            ? formTemplates.find((t) => t._id === cf.formTemplateId)?.fields
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Footer */}
          <div className="px-7 py-5 border-t border-gray-100 flex items-center justify-center gap-3 shrink-0 bg-gray-50/60">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || (!!record?.isLocked && !isAdmin)}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center gap-2 min-w-[140px] justify-center">
              {saving && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
