import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import CrmField from './CrmField';
import type { ModulePageConfig, CrmRecord } from './types/crm.types';
import { useCustomFieldsQuery } from '../../native-crm/queries/custom-fields.queries';
import CustomFieldRenderer from '../../native-crm/shared/CustomFieldRenderer';
import FsRelationPicker, { FsRelation } from './FsRelationPicker';
import MeetingAssignmentPanel from './MeetingAssignmentPanel';

// Only these 4 modules can attach to a Field Service record — Contact/Company/
// Deal are already bridged via Lead conversion and don't need this picker.
const FS_LINKABLE_MODULES = new Set(['tasks', 'tickets', 'calls', 'meetings']);

export default function RecordDrawer({
  config, record, moduleName, onClose, onSaved, prefillRelation,
}: {
  config:     ModulePageConfig;
  record:     CrmRecord | null;
  moduleName: string;
  onClose:    () => void;
  onSaved:    () => void;
  /** Pre-fills the Field Service link when creating a brand-new record from
   * an ActivityFeedPanel's "quick add" — ignored when editing an existing
   * record (its own relatedModule/relatedId/relatedLabel win instead). */
  prefillRelation?: FsRelation;
}) {
  const isEdit = !!record;
  const showFsRelation = FS_LINKABLE_MODULES.has(moduleName);

  const { data: rawCustomFields = [] } = useCustomFieldsQuery(moduleName);
  const activeCustomFields = rawCustomFields.filter((cf) => cf.isActive);

  const initForm = useCallback(() => {
    const f: Record<string, string> = {};
    for (const field of config.fields) {
      const raw = record ? record[field.key] : undefined;
      if (raw == null || raw === '') { f[field.key] = ''; continue; }
      // <input type="datetime-local">/type="date"> require an exact
      // "YYYY-MM-DDTHH:mm" / "YYYY-MM-DD" value — the stored value is a full
      // ISO string (e.g. "...T12:30:00.000Z"), and a browser silently
      // renders anything else as empty rather than erroring, which is why
      // the edit form previously showed blank Start/End fields even though
      // the record itself had real values.
      if (field.type === 'datetime' && typeof raw === 'string') f[field.key] = raw.slice(0, 16);
      else if (field.type === 'date' && typeof raw === 'string') f[field.key] = raw.slice(0, 10);
      else if (field.isArray && Array.isArray(raw)) f[field.key] = raw.join(', ');
      else f[field.key] = String(raw);
    }
    return f;
  }, [config.fields, record]);

  const initCustomForm = useCallback(() => {
    const cf: Record<string, unknown> = {};
    const existingCF = record?.customFields as Record<string, unknown> | undefined;
    for (const f of activeCustomFields) {
      cf[f.fieldKey] = existingCF?.[f.fieldKey] ?? '';
    }
    return cf;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, activeCustomFields.map((f) => f._id).join(',')]);

  const initRelation = useCallback((): FsRelation => record ? {
    relatedModule: record.relatedModule as FsRelation['relatedModule'] | undefined,
    relatedId:     record.relatedId as string | undefined,
    relatedLabel:  record.relatedLabel as string | undefined,
  } : (prefillRelation ?? {}), [record, prefillRelation]);

  const [form,       setForm]       = useState<Record<string, string>>(initForm);
  const [customForm, setCustomForm] = useState<Record<string, unknown>>(initCustomForm);
  const [relation,   setRelation]   = useState<FsRelation>(initRelation);
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);

  useEffect(() => { setForm(initForm()); setErrors({}); }, [initForm]);
  useEffect(() => { setCustomForm(initCustomForm()); }, [initCustomForm]);
  useEffect(() => { setRelation(initRelation()); }, [initRelation]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.required && !form[f.key]?.trim()) errs[f.key] = `${f.label} is required`;
      if (f.type === 'email' && form[f.key] && !/^[\w.+%-]+@[\w.-]+\.\w{2,}$/.test(form[f.key]))
        errs[f.key] = 'Not a valid email address';
    }
    for (const f of activeCustomFields) {
      if (f.required && !customForm[f.fieldKey]) errs[`cf_${f.fieldKey}`] = `${f.label} is required`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (addAnother = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // A bare "YYYY-MM-DDTHH:mm" string (no timezone) is parsed by the JS
      // Date constructor as LOCAL time of whichever machine happens to run
      // the backend process — silently shifting the stored instant by the
      // server's own UTC offset (the same class of bug just fixed in the
      // meeting-confirmation email). Appending an explicit UTC designator
      // here makes the round-trip exact regardless of server timezone, and
      // matches the raw-digit convention this table/edit form already uses
      // everywhere else (no per-viewer timezone conversion).
      for (const field of config.fields) {
        const v = payload[field.key];
        if (field.type === 'datetime' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
          payload[field.key] = `${v}:00.000Z`;
        } else if (field.isArray && typeof v === 'string') {
          payload[field.key] = v.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (
          v === '' &&
          ['select', 'number', 'currency', 'date', 'datetime', 'staffSelect', 'teamSelect', 'categorySelect'].includes(field.type)
        ) {
          // An unfilled optional select/number/date field lands in `form` as
          // '' (its React-controlled empty state) — the backend's Zod schemas
          // use `.optional()`, which only accepts `undefined`, not ''. Sending
          // '' verbatim fails validation with a 400 that this same function's
          // catch block used to flatten into a generic, unhelpful "Save
          // failed" for every field on the form, not just the empty one.
          delete payload[field.key];
        }
      }
      if (activeCustomFields.length > 0) payload.customFields = customForm;
      // On edit, always send all three together (even cleared to '') so
      // removing a link actually persists — omitting them here would leave
      // the old relation untouched, since the backend's $set only applies
      // to keys present in the payload. On create with nothing selected,
      // omit them entirely so a plain new record stays free of empty-string
      // relation fields.
      if (showFsRelation && (isEdit || relation.relatedId)) {
        payload.relatedModule = relation.relatedModule ?? '';
        payload.relatedId     = relation.relatedId ?? '';
        payload.relatedLabel  = relation.relatedLabel ?? '';
      }
      if (isEdit) {
        await api.put(`${config.apiBase}/${record!._id}`, payload);
      } else {
        const res = await api.post(config.apiBase, payload);
        // LR-CONTACT-003: non-blocking — the record is already created
        // either way (present on Contact's create response; harmless no-op
        // for every other module that doesn't send this field).
        const duplicate = res.data?.data?.duplicateWarning;
        if (duplicate) {
          toast(`Possible duplicate: ${duplicate.label} already has this email/phone`, { icon: '⚠️', duration: 6000 });
        }
      }
      onSaved();
      if (addAnother) { setForm(initForm()); setCustomForm(initCustomForm()); setRelation({}); setErrors({}); }
      else onClose();
    } catch (err: unknown) {
      // Surface the real validation reason instead of a blanket "Save
      // failed" — a Zod 400 (e.g. `errors: {direction: ["Invalid enum
      // value..."]}`) previously vanished entirely, leaving no way to tell
      // an actual bad-field error apart from a network failure.
      const res = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response;
      const fieldErrors = res?.data?.errors;
      // LR-CONTACT-002: "lastName: String must contain at least 1
      // character(s)" is Zod's raw internal wording — rephrase the common
      // "empty/missing" case into what a user actually typed into, using
      // the field's own display label instead of its camelCase key.
      const friendly = (key: string, msg: string): string => {
        const label = config.fields.find((f) => f.key === key)?.label ?? key;
        if (/^Required$/.test(msg) || /must contain at least 1 character/.test(msg)) {
          return `${label} is required`;
        }
        return `${label}: ${msg}`;
      };
      const detail = fieldErrors
        ? Object.entries(fieldErrors).map(([k, msgs]) => friendly(k, msgs?.[0] ?? 'invalid')).join('; ')
        : undefined;
      setErrors({ _global: detail ?? res?.data?.message ?? 'Save failed. Please try again.' });
    } finally { setSaving(false); }
  };

  const nameOf = record
    ? String(record.firstName && record.lastName
        ? `${record.firstName} ${record.lastName}`
        : record.name ?? record.title ?? record.subject ?? record.contactName ?? record._id)
    : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 bottom-0 w-[46vw] min-w-[520px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {isEdit ? `Edit ${config.labelSingular}` : `Create ${config.labelSingular}`}
            </h2>
            {isEdit && <p className="text-xs text-text-muted mt-0.5 truncate">{nameOf}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {errors._global && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors._global}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {config.fields.filter((field) => !field.hideInForm).map((field) => (
              <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                <CrmField
                  field={field}
                  value={form[field.key] ?? ''}
                  onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
                  error={errors[field.key]}
                />
              </div>
            ))}
          </div>

          {/* Custom Fields section */}
          {activeCustomFields.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">
                Custom Fields
              </p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {activeCustomFields.map((cf) => (
                  <div key={cf._id} className={cf.fieldType === 'textarea' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      {cf.label}
                      {cf.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <CustomFieldRenderer
                      field={cf}
                      value={customForm[cf.fieldKey]}
                      onChange={(val) => setCustomForm((prev) => ({ ...prev, [cf.fieldKey]: val }))}
                    />
                    {errors[`cf_${cf.fieldKey}`] && (
                      <p className="text-xs text-red-500 mt-1">{errors[`cf_${cf.fieldKey}`]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showFsRelation && (
            <div className="mt-4 pt-4 border-t border-border">
              <FsRelationPicker value={relation} onChange={setRelation} />
            </div>
          )}

          {moduleName === 'meetings' && isEdit && record && (
            <div className="mt-4 pt-4 border-t border-border">
              <MeetingAssignmentPanel record={record} apiBase={config.apiBase} onReassigned={onSaved} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          {isEdit ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="w-full px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-background transition-colors"
              >
                Create and add another
              </button>
              <button
                onClick={onClose}
                className="w-full text-sm text-text-muted hover:text-text-primary transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
