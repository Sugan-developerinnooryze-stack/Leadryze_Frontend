import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import CrmField from './CrmField';
import type { ModulePageConfig, CrmRecord } from './types/crm.types';
import { useCustomFieldsQuery } from '../../native-crm/queries/custom-fields.queries';
import CustomFieldRenderer from '../../native-crm/shared/CustomFieldRenderer';
import FsRelationPicker, { FsRelation } from './FsRelationPicker';

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
    for (const field of config.fields) f[field.key] = record ? String(record[field.key] ?? '') : '';
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
      if (isEdit) await api.put(`${config.apiBase}/${record!._id}`, payload);
      else        await api.post(config.apiBase, payload);
      onSaved();
      if (addAnother) { setForm(initForm()); setCustomForm(initCustomForm()); setRelation({}); setErrors({}); }
      else onClose();
    } catch {
      setErrors({ _global: 'Save failed. Please try again.' });
    } finally { setSaving(false); }
  };

  const nameOf = record
    ? String(record.firstName && record.lastName
        ? `${record.firstName} ${record.lastName}`
        : record.name ?? record.title ?? record.subject ?? record.contactName ?? record._id)
    : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? `Edit ${config.labelSingular}` : `Create ${config.labelSingular}`}
            </h2>
            {isEdit && <p className="text-xs text-gray-400 mt-0.5 truncate">{nameOf}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {errors._global && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors._global}
            </div>
          )}
          {config.fields.map((field) => (
            <CrmField
              key={field.key}
              field={field}
              value={form[field.key] ?? ''}
              onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
              error={errors[field.key]}
            />
          ))}

          {/* Custom Fields section */}
          {activeCustomFields.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Custom Fields
              </p>
              <div className="space-y-4">
                {activeCustomFields.map((cf) => (
                  <div key={cf._id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <FsRelationPicker value={relation} onChange={setRelation} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0">
          {isEdit ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
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
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {saving && <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Create and add another
              </button>
              <button
                onClick={onClose}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
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
