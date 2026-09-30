import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, PencilIcon, AdjustmentsHorizontalIcon, CheckIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  useCustomFieldsQuery,
  useCustomFieldCreate,
  useCustomFieldUpdate,
  useCustomFieldDelete,
  type NativeCustomField,
} from '../../../modules/native-crm/queries/custom-fields.queries';
import { useCustomFormTemplatesQuery } from '../../../modules/native-crm/queries/custom-form-templates.queries';
import { useCustomModulesQuery } from '../../../modules/native-crm/queries/custom-modules.queries';

// Mirrors the sidebar's own two sections (Sidebar.tsx's NATIVE_MODULES and
// FIELD_SERVICE_MODULES) — 'deals' lives only under Field Service here,
// matching the sidebar's own placement (Native CRM's module list
// deliberately excludes it to avoid a duplicate nav entry for the same
// /deals collection).
const NATIVE_CRM_MODULES = ['contacts', 'companies', 'tasks', 'tickets', 'calls', 'meetings'];
const FIELD_SERVICE_MODULES = [
  'leads', 'deals', 'categories', 'services', 'teams', 'staffs',
  'customers', 'sites', 'parts', 'quotations', 'workorders', 'contracts', 'invoices',
  'receipts', 'expenses', 'activities', 'products', 'assets', 'vehicles',
];
const FS_MODULES = [...NATIVE_CRM_MODULES, ...FIELD_SERVICE_MODULES];

const FIELD_TYPES = [
  { value: 'text',         label: 'Text' },
  { value: 'textarea',     label: 'Textarea' },
  { value: 'number',       label: 'Number' },
  { value: 'currency',     label: 'Currency' },
  { value: 'date',         label: 'Date' },
  { value: 'datetime',     label: 'Date & Time' },
  { value: 'email',        label: 'Email' },
  { value: 'phone',        label: 'Phone' },
  { value: 'url',          label: 'URL' },
  { value: 'dropdown',     label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'radio',        label: 'Radio' },
  { value: 'checkbox',     label: 'Checkbox' },
  { value: 'boolean',      label: 'Boolean (Yes/No)' },
  { value: 'rating',       label: 'Rating (1–5)' },
  { value: 'image',        label: 'Image (Single)' },
  { value: 'images',       label: 'Images (Multiple)' },
  { value: 'video',        label: 'Video (Single)' },
  { value: 'videos',       label: 'Videos (Multiple)' },
  { value: 'custom_form',  label: 'Custom Form (Google Forms style)' },
];

const TYPES_WITH_OPTIONS = ['dropdown', 'multi_select', 'radio'];

const BLANK = {
  module:         FS_MODULES[0],
  fieldKey:       '',
  label:          '',
  fieldType:      'text',
  options:        [] as string[],
  formTemplateId: '',
  required:       false,
  order:          0,
};

interface FormState {
  module:         string;
  fieldKey:       string;
  label:          string;
  fieldType:      string;
  options:        string[];
  formTemplateId: string;
  required:       boolean;
  order:          number;
}

export default function CustomFieldsAdminPage() {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState(FS_MODULES[0]);
  const [showForm,       setShowForm]       = useState(false);
  const [editId,         setEditId]         = useState<string | null>(null);
  const [form,           setForm]           = useState<FormState>({ ...BLANK, module: selectedModule });
  const [optionInput,    setOptionInput]    = useState('');

  const { data: fields = [], isLoading } = useCustomFieldsQuery(selectedModule);
  const { data: formTemplates = [] } = useCustomFormTemplatesQuery();
  const createMutation = useCustomFieldCreate();
  const updateMutation = useCustomFieldUpdate();
  const deleteMutation = useCustomFieldDelete();

  // Real, confirmed bug this fixes: this page's module list was a fully
  // static array — a newly created Custom Module never appeared here, so
  // there was no way to configure custom fields on it at all. Same dynamic
  // merge pattern PipelineSettingsPage.tsx already uses for its own module
  // list, and the same `custom:<slug>` key convention it already applies —
  // custom-field.model.ts's `module` field is free-text, so it already
  // accepts this without any backend change.
  const { data: customModules = [] } = useCustomModulesQuery();
  const label = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
  const moduleGroups = [
    { group: 'Native CRM', items: NATIVE_CRM_MODULES.map((m) => ({ key: m, label: label(m) })) },
    { group: 'Field Service', items: FIELD_SERVICE_MODULES.map((m) => ({ key: m, label: label(m) })) },
    // Custom Modules already have their own, separate field-builder (see
    // isCustomModule below) — kept selectable here so they're still
    // reachable from this page, not because fields are managed here.
    { group: 'Custom Modules', items: customModules.map((m) => ({ key: `custom:${m.slug}`, label: m.name })) },
  ].filter((g) => g.items.length > 0);
  const moduleOptions = moduleGroups.flatMap((g) => g.items);
  const isCustomModule = selectedModule.startsWith('custom:');

  const set = (key: keyof FormState) => (val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const openCreate = () => {
    setForm({ ...BLANK, module: selectedModule });
    setEditId(null);
    setOptionInput('');
    setShowForm(true);
  };

  const openEdit = (field: NativeCustomField) => {
    setForm({
      module:         field.module,
      fieldKey:       field.fieldKey,
      label:          field.label,
      fieldType:      field.fieldType,
      options:        field.options ?? [],
      formTemplateId: field.formTemplateId ?? '',
      required:       field.required,
      order:          field.order,
    });
    setEditId(field._id);
    setOptionInput('');
    setShowForm(true);
  };

  const addOption = () => {
    const val = optionInput.trim();
    if (!val || form.options.includes(val)) return;
    set('options')([...form.options, val]);
    setOptionInput('');
  };

  const removeOption = (opt: string) => set('options')(form.options.filter((o) => o !== opt));

  const handleSave = async () => {
    if (!form.label.trim() || !form.fieldKey.trim()) return;
    const payload = {
      ...form,
      fieldKey: form.fieldKey.trim().replace(/\s+/g, '_').toLowerCase(),
      formTemplateId: form.fieldType === 'custom_form' ? form.formTemplateId : undefined,
    };
    if (editId) {
      await updateMutation.mutateAsync({ id: editId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowForm(false);
  };

  const BASE_INPUT = 'w-full rounded-lg bg-surface text-text-primary border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ryze-400';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar for Modules */}
        <div className="w-64 bg-surface border-r border-border overflow-y-auto shrink-0 flex flex-col">
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
              Custom Fields
            </h2>
            <p className="text-xs text-text-muted mt-1">Configure additional data fields per module</p>
          </div>
          <nav className="p-3 space-y-4">
            {moduleGroups.map((grp) => (
              <div key={grp.group}>
                <p className="px-3 mb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">{grp.group}</p>
                <div className="space-y-1">
                  {grp.items.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setSelectedModule(key); setShowForm(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all ${
                        selectedModule === key
                          ? 'bg-ryze-600/10 text-ryze-700 dark:text-ryze-400 font-semibold shadow-sm'
                          : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary font-medium'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <div className="bg-surface border-b border-border px-8 py-5 flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-xl font-bold text-text-primary">{moduleOptions.find((m) => m.key === selectedModule)?.label ?? selectedModule} Fields</h1>
              <p className="text-sm text-text-muted mt-0.5">Manage custom fields for the {moduleOptions.find((m) => m.key === selectedModule)?.label ?? selectedModule} module</p>
            </div>
            {!isCustomModule && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/native-crm/custom-fields/form-templates')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-text-primary text-sm font-medium rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shadow-sm"
                >
                  <DocumentTextIcon className="h-4 w-4" />
                  Form Templates
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 transition-colors shadow-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Field
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Field List */}
            <div className="flex-1 min-w-0 overflow-y-auto p-8">
              {isCustomModule ? (
                <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-border max-w-xl mx-auto">
                  <div className="h-16 w-16 bg-ryze-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AdjustmentsHorizontalIcon className="h-8 w-8 text-ryze-500" />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-1">Fields are managed in the Custom Module Builder</h3>
                  <p className="text-sm text-text-muted mb-4 max-w-sm mx-auto">
                    {moduleOptions.find((m) => m.key === selectedModule)?.label ?? selectedModule} is a custom module — its fields (including relationship, table, and category-select types this page doesn't support) live directly on the module definition, not here.
                  </p>
                  <button
                    onClick={() => navigate('/native-crm/custom-modules')}
                    className="text-ryze-600 dark:text-ryze-400 font-medium text-sm hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 transition-colors bg-ryze-600/10 px-4 py-2 rounded-lg"
                  >
                    Open Custom Module Builder →
                  </button>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                </div>
              ) : fields.length === 0 ? (
                <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-border">
                  <div className="h-16 w-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4">
                    <AdjustmentsHorizontalIcon className="h-8 w-8 text-text-muted" />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-1">No custom fields</h3>
                  <p className="text-sm text-text-muted mb-4 max-w-sm mx-auto">You haven't defined any custom fields for the {moduleOptions.find((m) => m.key === selectedModule)?.label ?? selectedModule} module yet.</p>
                  <button onClick={openCreate} className="text-ryze-600 dark:text-ryze-400 font-medium text-sm hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 transition-colors bg-ryze-600/10 px-4 py-2 rounded-lg">Create First Field</button>
                </div>
              ) : (
                <div className="space-y-3 max-w-4xl">
                  {fields.map((field) => (
                    <div key={field._id} className="group flex items-center gap-4 bg-surface border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-ryze-300 dark:border-ryze-700 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold text-text-primary">{field.label}</span>
                          {field.required && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-full">Required</span>}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <span className="font-mono text-xs bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 rounded text-text-muted">{field.fieldKey}</span>
                          </div>
                          <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
                          <span className="text-text-muted font-medium capitalize">{field.fieldType.replace('_', ' ')}</span>
                          
                          {field.options && field.options.length > 0 && (
                            <>
                              <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.08]" />
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {field.options.slice(0, 3).map((opt: string) => (
                                  <span key={opt} className="px-2 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] text-text-muted text-xs rounded-md">{opt}</span>
                                ))}
                                {field.options.length > 3 && (
                                  <span className="px-2 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] text-text-muted text-xs rounded-md">+{field.options.length - 3}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1 items-end shrink-0">
                         <span className="text-xs text-text-muted mb-2 font-medium">Order: {field.order}</span>
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(field)}
                              className="px-3 py-1.5 text-xs font-medium bg-surface border border-border text-text-primary hover:text-ryze-600 dark:text-ryze-400 dark:hover:text-ryze-300 hover:border-ryze-200 dark:border-ryze-800 hover:bg-ryze-600/10 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <PencilIcon className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(field._id)}
                              className="px-3 py-1.5 text-xs font-medium bg-surface border border-border text-text-primary hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <TrashIcon className="h-3.5 w-3.5" /> Delete
                            </button>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side panel form */}
            {showForm && (
              <div className="w-96 border-l border-border bg-surface flex flex-col overflow-y-auto shrink-0 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] sticky top-0 z-10">
                  <h3 className="text-base font-bold text-text-primary">{editId ? 'Edit Field' : 'New Field'}</h3>
                  <button onClick={() => setShowForm(false)} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-lg transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Module</label>
                    <div className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-muted font-medium">
                      {moduleOptions.find((m) => m.key === form.module)?.label ?? form.module}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Label <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const autoKey = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        set('label')(label);
                        if (!editId) set('fieldKey')(autoKey);
                      }}
                      className={BASE_INPUT}
                      placeholder="e.g. Contract Type"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Field Key <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.fieldKey}
                      onChange={(e) => set('fieldKey')(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className={`${BASE_INPUT} font-mono bg-background`}
                      placeholder="contract_type"
                    />
                    <p className="text-xs text-text-muted mt-1.5">Unique identifier, lowercase + underscores</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Field Type</label>
                    <select value={form.fieldType} onChange={(e) => set('fieldType')(e.target.value)} className={BASE_INPUT}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {form.fieldType === 'custom_form' && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <label className="block text-sm font-semibold text-text-primary mb-2">Form Template <span className="text-red-500">*</span></label>
                      <select
                        value={form.formTemplateId}
                        onChange={(e) => set('formTemplateId')(e.target.value)}
                        className={BASE_INPUT}
                      >
                        <option value="">— Select a template —</option>
                        {formTemplates.map((t) => (
                          <option key={t._id} value={t._id}>{t.name} ({t.fields.length} fields)</option>
                        ))}
                      </select>
                      {formTemplates.length === 0 && (
                        <p className="text-xs text-purple-600 mt-1.5">
                          No templates yet.{' '}
                          <button type="button" onClick={() => navigate('/native-crm/custom-fields/form-templates')}
                            className="underline font-medium">Create one →</button>
                        </p>
                      )}
                    </div>
                  )}

                  {TYPES_WITH_OPTIONS.includes(form.fieldType) && (
                    <div className="bg-background p-4 rounded-xl border border-border">
                      <label className="block text-sm font-semibold text-text-primary mb-2">Dropdown Options</label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={optionInput}
                          onChange={(e) => setOptionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                          className={`${BASE_INPUT} flex-1`}
                          placeholder="Type option and press Enter"
                        />
                        <button onClick={addOption} className="px-3 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 shadow-sm transition-colors">
                          Add
                        </button>
                      </div>
                      {form.options.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {form.options.map((o) => (
                            <span key={o} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border text-text-primary text-sm font-medium rounded-lg shadow-sm">
                              {o}
                              <button onClick={() => removeOption(o)} className="text-text-muted hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors">
                                <XMarkIcon className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted italic">No options added yet.</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Display Order</label>
                    <input
                      type="number"
                      value={form.order}
                      onChange={(e) => set('order')(parseInt(e.target.value) || 0)}
                      className={BASE_INPUT}
                      min="0"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 border border-border rounded-xl cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(e) => set('required')(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-ryze-600 dark:text-ryze-400 focus:ring-ryze-500"
                    />
                    <div>
                      <span className="block text-sm font-semibold text-text-primary">Required Field</span>
                      <span className="block text-xs text-text-muted">Users must fill this field before saving</span>
                    </div>
                  </label>

                  <div className="pt-6 mt-6 border-t border-border flex gap-3">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-lg border border-border text-sm font-bold text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex-1 py-2.5 rounded-lg bg-ryze-600 text-white text-sm font-bold hover:bg-ryze-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <CheckIcon className="h-5 w-5" />
                      {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Field'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
