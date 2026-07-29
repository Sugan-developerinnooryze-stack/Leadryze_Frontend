import { useState, useRef, useEffect, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import {
  BoltIcon, PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon,
  ArrowRightIcon, ListBulletIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline';
import {
  useAutomationRulesQuery, useCreateAutomationRule, useUpdateAutomationRule, useDeleteAutomationRule,
  useMessageTemplatesQuery, useCreateMessageTemplate, useFieldCatalogQuery,
  AutomationRule, AutomationModule, AutomationActionType, AutomationRecipientStrategy, AutomationTriggerType, FieldMapping,
} from '../../../modules/native-crm/queries/automation-rules.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useCustomModulesQuery } from '../../../modules/native-crm/queries/custom-modules.queries';

const BUILT_IN_MODULES: { key: AutomationModule; label: string }[] = [
  { key: 'lead',       label: 'Leads' },
  { key: 'deal',       label: 'Deals' },
  { key: 'task',       label: 'Tasks' },
  { key: 'ticket',     label: 'Tickets' },
  { key: 'quotation',  label: 'Quotations' },
  { key: 'workorder',  label: 'Work Orders' },
  { key: 'contract',   label: 'Contracts' },
  { key: 'invoice',    label: 'Invoices' },
];

/** For a 'status_changed' trigger only — Custom Modules only show up here
 * once a tenant has designated a pipeline field for them
 * (CustomModuleBuilderPage), since no pipeline field means no stage to
 * trigger a rule off. Do NOT reuse this for anything that doesn't require a
 * stage (record_created triggers, create_linked_record targets, label
 * lookups) — those apply equally to every custom module, pipeline or not. */
function useStageCapableModules(): { key: AutomationModule; label: string }[] {
  const { data: customModules = [] } = useCustomModulesQuery();
  const withPipeline = customModules.filter((m) => m.pipelineFieldKey);
  return [
    ...BUILT_IN_MODULES,
    ...withPipeline.map((m) => ({ key: `custom:${m.slug}` as AutomationModule, label: m.name })),
  ];
}

/** Every module a tenant could plausibly reference — built-ins plus ALL
 * custom modules, regardless of whether they have a pipeline field. Used
 * anywhere a stage isn't required: record_created triggers, the
 * create_linked_record target picker, the rules list's module filter, and
 * friendly-label lookups (so a module never silently falls back to showing
 * its raw custom:<slug> key just because it has no pipeline configured). */
function useEveryModule(): { key: AutomationModule; label: string }[] {
  const { data: customModules = [] } = useCustomModulesQuery();
  return [
    ...BUILT_IN_MODULES,
    ...customModules.map((m) => ({ key: `custom:${m.slug}` as AutomationModule, label: m.name })),
  ];
}

const RECIPIENT_LABELS: Record<AutomationRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
};

function RuleForm({ onClose, rule, initialCanvasPosition, initialTriggerType, initialActionType }: {
  onClose: () => void; rule?: AutomationRule;
  /** Set only when this form was opened by clicking empty space (or dropping
   * a palette item) on the automation canvas — stamps the new rule's node at
   * that exact spot so it doesn't jump to the auto-layout grid on first
   * render. Edits never touch position; only a card drag does that (see
   * RuleCanvasView). */
  initialCanvasPosition?: { x: number; y: number };
  /** Set only when this form was opened by dragging a palette node onto the
   * canvas (see NODE_PALETTE / RuleCanvasView's onDrop) — pre-fills the
   * trigger/action picker instead of defaulting to the generic first option,
   * so dropping "Send WhatsApp" actually opens a form already set to that. */
  initialTriggerType?: AutomationTriggerType;
  initialActionType?: AutomationActionType;
}) {
  const isEdit = !!rule;
  const [module, setModule]     = useState<AutomationModule>(rule?.module ?? 'lead');
  const [name, setName]         = useState(rule?.name ?? '');
  const [triggerType, setTriggerType]   = useState<AutomationTriggerType>(rule?.triggerType ?? initialTriggerType ?? 'status_changed');
  const [triggerStage, setTriggerStage] = useState(rule?.triggerStage ?? '');
  const [triggerField, setTriggerField] = useState(rule?.triggerField ?? '');
  const [actionType, setActionType]     = useState<AutomationActionType>(rule?.actionType ?? initialActionType ?? 'send_email');
  const [templateId, setTemplateId]     = useState(rule?.templateId ?? '');
  const [recipientStrategy, setRecipientStrategy] = useState<AutomationRecipientStrategy>(rule?.recipientStrategy ?? 'record_contact');
  const [targetModule, setTargetModule] = useState<AutomationModule | ''>(rule?.targetModule ?? '');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(rule?.fieldMappings ?? []);
  const [backReferenceField, setBackReferenceField] = useState(rule?.backReferenceField ?? '');
  const [enabled, setEnabled]   = useState(rule?.enabled ?? true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const { stages } = usePipelineStages(module);
  const templateChannel = actionType === 'send_email' ? 'email' : actionType === 'send_whatsapp' ? 'whatsapp' : 'sms';
  const { data: templates = [] } = useMessageTemplatesQuery(templateChannel);
  const { data: sourceFields = [] } = useFieldCatalogQuery(module);
  const { data: targetFields = [] } = useFieldCatalogQuery(targetModule);
  const createMut = useCreateAutomationRule();
  const updateMut = useUpdateAutomationRule();
  const STAGE_CAPABLE_MODULES = useStageCapableModules();
  const EVERY_MODULE = useEveryModule();
  // A status_changed trigger needs a real stage to fire on, so its module
  // picker is limited to modules with one; record_created has no such
  // requirement, so every module (pipeline or not) is a valid source.
  const triggerModuleOptions = triggerType === 'status_changed' ? STAGE_CAPABLE_MODULES : EVERY_MODULE;

  const isLinkedRecord = actionType === 'create_linked_record';
  const triggerReady =
    triggerType === 'status_changed' ? !!triggerStage :
    triggerType === 'record_updated' ? !!triggerField :
    true; // record_created / record_deleted need nothing further
  const canSave = name.trim() && triggerReady && (
    isLinkedRecord
      ? targetModule && fieldMappings.length > 0 && fieldMappings.every((m) => (m.sourceType === 'static' ? m.staticValue !== undefined && m.staticValue !== '' : !!m.sourceField))
      : !!templateId
  );

  const addMapping = () => setFieldMappings((prev) => [...prev, { targetField: '', sourceType: 'field', sourceField: '' }]);
  const removeMapping = (i: number) => setFieldMappings((prev) => prev.filter((_, idx) => idx !== i));
  const patchMapping = (i: number, patch: Partial<FieldMapping>) =>
    setFieldMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const data = {
        module, name: name.trim(), triggerType,
        triggerStage: triggerType === 'status_changed' || triggerType === 'record_updated' ? (triggerStage || undefined) : undefined,
        triggerField: triggerType === 'record_updated' ? triggerField : undefined,
        actionType,
        ...(isLinkedRecord
          ? { targetModule: targetModule || undefined, fieldMappings, backReferenceField: backReferenceField || undefined }
          : { templateId, recipientStrategy }),
        enabled,
        ...(!isEdit && initialCanvasPosition ? { canvasPosition: initialCanvasPosition } : {}),
      };
      if (isEdit) await updateMut.mutateAsync({ id: rule!._id, data });
      else await createMut.mutateAsync(data);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? `Failed to ${isEdit ? 'save' : 'create'} rule`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Automation Rule' : 'New Automation Rule'}</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Rule name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notify customer on approval"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Module</label>
                <select value={module} onChange={(e) => { setModule(e.target.value as AutomationModule); setTriggerStage(''); setTriggerField(''); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  {triggerModuleOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Trigger</label>
                <select value={triggerType} onChange={(e) => { setTriggerType(e.target.value as AutomationTriggerType); setTriggerStage(''); setTriggerField(''); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value="status_changed">Status changes to…</option>
                  <option value="record_created">New record created</option>
                  <option value="record_updated">Field updated</option>
                  <option value="record_deleted">Record deleted</option>
                </select>
              </div>
            </div>

            {triggerType === 'status_changed' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">When status changes to</label>
                <select value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value="">Select stage…</option>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}

            {triggerType === 'record_updated' && (() => {
              const fieldDef = sourceFields.find((f) => f.key === triggerField);
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Which field</label>
                    <select value={triggerField} onChange={(e) => { setTriggerField(e.target.value); setTriggerStage(''); }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                      <option value="">Select field…</option>
                      {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Changes to (optional)</label>
                    {fieldDef?.options ? (
                      <select value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" disabled={!triggerField}>
                        <option value="">Any change</option>
                        {fieldDef.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)} placeholder="Any change"
                        disabled={!triggerField}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50" />
                    )}
                  </div>
                </div>
              );
            })()}

            {triggerType === 'record_deleted' && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                This rule fires whenever a {triggerModuleOptions.find((m) => m.key === module)?.label ?? 'record'} is deleted — no further setup needed here.
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Action</label>
              <select value={actionType} onChange={(e) => { setActionType(e.target.value as AutomationActionType); setTemplateId(''); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="send_email">Send Email</option>
                <option value="send_sms">Send SMS</option>
                <option value="send_whatsapp">Send WhatsApp</option>
                <option value="create_linked_record">Create Linked Record</option>
              </select>
            </div>

            {!isLinkedRecord && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Template</label>
                      <button type="button" onClick={() => setCreatingTemplate(true)}
                        className="text-[11px] font-medium text-brand-600 hover:text-brand-700">
                        + New template
                      </button>
                    </div>
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                      <option value="">Select template…</option>
                      {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    {templates.length === 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">No {templateChannel} templates yet — create one above.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Recipient</label>
                    <select value={recipientStrategy} onChange={(e) => setRecipientStrategy(e.target.value as AutomationRecipientStrategy)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                      {(Object.entries(RECIPIENT_LABELS) as [AutomationRecipientStrategy, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {isLinkedRecord && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Create a record in</label>
                  <select value={targetModule} onChange={(e) => { setTargetModule(e.target.value as AutomationModule); setFieldMappings([]); setBackReferenceField(''); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option value="">Select module…</option>
                    {EVERY_MODULE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Field mapping</label>
                  <div className="space-y-2">
                    {fieldMappings.map((m, i) => {
                      const targetDef = targetFields.find((f) => f.key === m.targetField);
                      return (
                      <div key={i} className="flex items-center gap-1.5">
                        <select value={m.targetField} onChange={(e) => patchMapping(i, { targetField: e.target.value, staticValue: '' })}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
                          <option value="">Target field…</option>
                          {targetFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                        <span className="text-xs text-gray-400 shrink-0">=</span>
                        <select value={m.sourceType} onChange={(e) => patchMapping(i, { sourceType: e.target.value as 'field' | 'static', sourceField: '', staticValue: '' })}
                          className="shrink-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
                          <option value="field">Copy from field</option>
                          <option value="static">Fixed value</option>
                        </select>
                        {m.sourceType === 'field' ? (
                          <select value={m.sourceField ?? ''} onChange={(e) => patchMapping(i, { sourceField: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
                            <option value="">Source field…</option>
                            {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                        ) : targetDef?.options ? (
                          <select value={m.staticValue ?? ''} onChange={(e) => patchMapping(i, { staticValue: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
                            <option value="">Select value…</option>
                            {targetDef.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input value={m.staticValue ?? ''} onChange={(e) => patchMapping(i, { staticValue: e.target.value })}
                            placeholder="Value" className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
                        )}
                        <button onClick={() => removeMapping(i)} className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                  <button onClick={addMapping} disabled={!targetModule}
                    className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    + Add field mapping
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Link new record back to source (optional)</label>
                  <select value={backReferenceField} onChange={(e) => setBackReferenceField(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" disabled={!targetModule}>
                    <option value="">Don&rsquo;t link back</option>
                    {targetFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              </>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      </div>

      {creatingTemplate && (
        <InlineTemplateModal
          channel={templateChannel}
          onClose={() => setCreatingTemplate(false)}
          onCreated={(id) => setTemplateId(id)}
        />
      )}
    </>
  );
}

/** Lets a template be created without leaving the rule builder — same
 * `/api/v1/templates` endpoint and payload shape as the standalone Templates
 * page, just trimmed to the fields needed mid-rule-building (no language
 * picker, no sample-hint button). Both surfaces edit the exact same records,
 * so a template created here also shows up on the standalone page. */
function InlineTemplateModal({ channel, onClose, onCreated }: {
  channel: 'email' | 'sms' | 'whatsapp';
  onClose: () => void;
  onCreated: (templateId: string) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const createMut = useCreateMessageTemplate();

  const canSave = name.trim() && body.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const tpl = await createMut.mutateAsync({
        name: name.trim(), type: channel, category, language: 'en',
        subject: channel === 'email' ? (subject.trim() || undefined) : undefined,
        body: body.trim(),
      });
      onCreated(tpl._id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 capitalize">New {channel} template</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deal won notification"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Purpose</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="custom">Custom</option>
                <option value="followup">Follow-up</option>
                <option value="reminder">Reminder</option>
                <option value="onboarding">Onboarding</option>
                <option value="task">Task</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
            {channel === 'email' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Update on {{title}}"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Message body</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Hi {{name}}, ..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <p className="text-[11px] text-gray-400 mt-1">
                Dynamic values: {'{{name}}'} {'{{title}}'} {'{{status}}'} {'{{company}}'} {'{{id}}'}
              </p>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
              {saving ? 'Creating…' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Visual automation canvas (Phase 3) ────────────────────────────────────────
// A rule renders as one draggable card holding a Trigger chip and an Action
// chip, connected by a short fixed arrow INSIDE the card (their relative
// offset never changes, so this connector needs no recomputation — see the
// plan's "3b — intra-rule connector"). Cross-rule chain connectors ("3c",
// the actual architecture-map payoff) are real SVG lines computed from each
// card's live canvas position, redrawn as either end is dragged.

const CANVAS_CARD_W = 260;
const CANVAS_CARD_H = 108;
const CANVAS_GRID_COLS = 4;
const CANVAS_GRID_GAP = 36;
const CANVAS_GRID_PAD = 32;

function describeTriggerShort(rule: AutomationRule): string {
  if (rule.triggerType === 'record_created') return 'New record created';
  if (rule.triggerType === 'record_deleted') return 'Record deleted';
  if (rule.triggerType === 'record_updated') {
    return rule.triggerStage ? `${rule.triggerField} → ${rule.triggerStage}` : `${rule.triggerField} changes`;
  }
  return `Status → ${rule.triggerStage}`;
}

function describeActionShort(rule: AutomationRule, moduleLabel: (m: AutomationModule) => string): string {
  if (rule.actionType === 'create_linked_record') return `Create ${moduleLabel(rule.targetModule as AutomationModule)} record`;
  if (rule.actionType === 'send_sms') return 'Send SMS';
  if (rule.actionType === 'send_whatsapp') return 'Send WhatsApp';
  return 'Send Email';
}

/** A one-line, at-a-glance answer to "what data actually flows into the
 * target record" — reads straight off the rule's own fieldMappings (already
 * in memory, no extra fetch) rather than making someone open the edit form
 * just to see what's mapped. Raw field keys, not human labels — resolving
 * labels would need a per-card field-catalog call this canvas deliberately
 * avoids; the full form (one click away) already shows friendly labels. */
function describeMappingPreview(rule: AutomationRule): string | null {
  const mappings = rule.fieldMappings;
  if (!mappings || mappings.length === 0) return null;
  const first = mappings[0];
  const firstText = first.sourceType === 'static'
    ? `"${first.staticValue}" → ${first.targetField}`
    : `${first.sourceField} → ${first.targetField}`;
  return mappings.length > 1 ? `${firstText} +${mappings.length - 1} more` : firstText;
}

function actionAccentClasses(rule: AutomationRule): { bg: string; text: string; border: string } {
  if (rule.actionType === 'create_linked_record') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  if (rule.actionType === 'send_sms') return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
  if (rule.actionType === 'send_whatsapp') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
}

/** A rule chains into another when its create_linked_record action targets a
 * module that some OTHER rule itself triggers on — e.g. "Site Visit
 * completed" (module A) creates a record in module B, and module B has its
 * own rule watching for that creation. This is what turns the flat rule list
 * into a real architecture diagram: the connector is always DERIVED from
 * existing rule configuration, never a relationship a user draws by hand
 * (the engine is one-trigger-plus-one-action per rule, not an arbitrary
 * graph — see the plan's explicit "deliberately not attempted"). */
function computeChains(rules: AutomationRule[]): { from: string; to: string }[] {
  const chains: { from: string; to: string }[] = [];
  for (const r of rules) {
    if (r.actionType !== 'create_linked_record' || !r.targetModule) continue;
    for (const other of rules) {
      if (other._id === r._id || other.module !== r.targetModule) continue;
      chains.push({ from: r._id, to: other._id });
    }
  }
  return chains;
}

/** Drag-and-drop payload for a palette item — deliberately tiny (just which
 * picker to pre-fill), not a full node definition, since the actual rule
 * shape is still one-trigger-plus-one-action (see computeChains' comment on
 * why connectors stay derived, not user-drawn, in this engine). */
interface PaletteDrag { kind: 'trigger' | 'action'; value: AutomationTriggerType | AutomationActionType; }
const PALETTE_MIME = 'application/x-automation-node';

const TRIGGER_PALETTE: { value: AutomationTriggerType; label: string; hint: string }[] = [
  { value: 'status_changed', label: 'Status Changed', hint: 'When status reaches a stage' },
  { value: 'record_created', label: 'New Record',      hint: 'When a record is created' },
  { value: 'record_updated', label: 'Field Updated',    hint: 'When one field changes' },
  { value: 'record_deleted', label: 'Record Deleted',   hint: 'When a record is removed' },
];
const ACTION_PALETTE: { value: AutomationActionType; label: string; hint: string }[] = [
  { value: 'send_email',           label: 'Send Email',          hint: 'Email via a template' },
  { value: 'send_sms',             label: 'Send SMS',             hint: 'SMS via a template' },
  { value: 'send_whatsapp',        label: 'Send WhatsApp',        hint: 'WhatsApp via a template' },
  { value: 'create_linked_record', label: 'Create Linked Record', hint: 'Create a record in another module' },
];

function PaletteItem({ kind, value, label, hint, accentClass }: {
  kind: 'trigger' | 'action'; value: AutomationTriggerType | AutomationActionType;
  label: string; hint: string; accentClass: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        const payload: PaletteDrag = { kind, value };
        e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing bg-white hover:shadow-sm transition-shadow ${accentClass}`}
      title="Drag onto the canvas to start a new rule with this preset"
    >
      <p className="text-[11.5px] font-semibold text-gray-800">{label}</p>
      <p className="text-[10px] text-gray-400 leading-tight">{hint}</p>
    </div>
  );
}

function RuleCanvasView({ rules, moduleLabel, onEdit }: {
  rules: AutomationRule[];
  moduleLabel: (m: AutomationModule) => string;
  onEdit: (rule: AutomationRule) => void;
}) {
  const updateMut = useUpdateAutomationRule();
  const deleteMut = useDeleteAutomationRule();
  const canvasInnerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [createAt, setCreateAt] = useState<{ x: number; y: number } | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [hoveredChain, setHoveredChain] = useState<number | null>(null);
  const [paletteDrop, setPaletteDrop] = useState<PaletteDrag | null>(null);

  // Grid slots are only handed out to rules that have never been dragged
  // (no saved canvasPosition) — assigned by their order among JUST that
  // subset, so a manually positioned card never gets bumped by one nearby.
  const autoPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    let i = 0;
    for (const r of rules) {
      if (r.canvasPosition) continue;
      map.set(r._id, {
        x: CANVAS_GRID_PAD + (i % CANVAS_GRID_COLS) * (CANVAS_CARD_W + CANVAS_GRID_GAP),
        y: CANVAS_GRID_PAD + Math.floor(i / CANVAS_GRID_COLS) * (CANVAS_CARD_H + CANVAS_GRID_GAP),
      });
      i++;
    }
    return map;
  }, [rules]);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const r of rules) {
        next[r._id] = prev[r._id] ?? r.canvasPosition ?? autoPositions.get(r._id) ?? { x: CANVAS_GRID_PAD, y: CANVAS_GRID_PAD };
      }
      return next;
    });
  }, [rules, autoPositions]);

  const posOf = (id: string) => positions[id] ?? { x: CANVAS_GRID_PAD, y: CANVAS_GRID_PAD };
  const chains = useMemo(() => computeChains(rules), [rules]);

  const canvasW = Math.max(1200, ...rules.map((r) => posOf(r._id).x + CANVAS_CARD_W + CANVAS_GRID_PAD));
  const canvasH = Math.max(700, ...rules.map((r) => posOf(r._id).y + CANVAS_CARD_H + CANVAS_GRID_PAD));

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasInnerRef.current) return; // a card's own click bubbles here too — ignore it
    const rect = canvasInnerRef.current!.getBoundingClientRect();
    setCreateAt({
      x: Math.max(0, Math.round(e.clientX - rect.left - CANVAS_CARD_W / 2)),
      y: Math.max(0, Math.round(e.clientY - rect.top - CANVAS_CARD_H / 2)),
    });
    setCreating(true);
  };

  const handlePaletteDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    if (!raw) return;
    const drag = JSON.parse(raw) as PaletteDrag;
    const rect = canvasInnerRef.current!.getBoundingClientRect();
    setCreateAt({
      x: Math.max(0, Math.round(e.clientX - rect.left - CANVAS_CARD_W / 2)),
      y: Math.max(0, Math.round(e.clientY - rect.top - CANVAS_CARD_H / 2)),
    });
    setPaletteDrop(drag);
    setCreating(true);
  };

  return (
    <div className="flex gap-4 items-start">
      <div className="w-[168px] shrink-0 space-y-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Triggers</p>
          <div className="space-y-1.5">
            {TRIGGER_PALETTE.map((t) => (
              <PaletteItem key={t.value} kind="trigger" value={t.value} label={t.label} hint={t.hint}
                accentClass="border-amber-200 hover:border-amber-300" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Actions</p>
          <div className="space-y-1.5">
            {ACTION_PALETTE.map((a) => (
              <PaletteItem key={a.value} kind="action" value={a.value} label={a.label} hint={a.hint}
                accentClass="border-gray-200 hover:border-brand-300" />
            ))}
          </div>
        </div>
        <p className="text-[10.5px] text-gray-400 px-0.5 leading-relaxed">Drag one onto the canvas to start a new rule pre-set to that trigger or action.</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-2.5">
          Click empty canvas space (or drop a node from the left) to add a rule · drag a card to reposition it · click a card to edit it.
          Dashed arrows show rules that chain into each other (one rule's action creates a record in a module another rule watches).
        </p>
        <div
          className="relative border border-gray-200 rounded-xl bg-gray-50 overflow-auto"
          style={{
            height: '70vh',
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <div ref={canvasInnerRef} onClick={handleBackgroundClick}
            onDragOver={(e) => e.preventDefault()} onDrop={handlePaletteDrop}
            style={{ position: 'relative', width: canvasW, height: canvasH }}>
          <svg width={canvasW} height={canvasH} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 0 }}>
            <defs>
              <marker id="automation-chain-arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
              </marker>
            </defs>
            {chains.map(({ from, to }, i) => {
              const a = posOf(from);
              const b = posOf(to);
              const x1 = a.x + CANVAS_CARD_W, y1 = a.y + CANVAS_CARD_H / 2;
              const x2 = b.x, y2 = b.y + CANVAS_CARD_H / 2;
              const midX = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 4"
                    opacity={hoveredChain === i ? 1 : 0.65} markerEnd="url(#automation-chain-arrow)" />
                  {/* Wide, invisible hit-area on top of the thin visible line — a
                     2px stroke is nearly impossible to hover precisely, so this
                     overrides the SVG's own pointer-events:none just for itself
                     to make the "what data flows here" popover discoverable. */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredChain(i)} onMouseLeave={() => setHoveredChain((h) => (h === i ? null : h))} />
                </g>
              );
            })}
          </svg>

          {hoveredChain !== null && chains[hoveredChain] && (() => {
            const { from, to } = chains[hoveredChain];
            const sourceRule = rules.find((r) => r._id === from);
            const targetRule = rules.find((r) => r._id === to);
            const a = posOf(from);
            const b = posOf(to);
            const midX = (a.x + CANVAS_CARD_W + b.x) / 2;
            const midY = (a.y + b.y) / 2 + CANVAS_CARD_H / 2;
            return (
              <div
                className="absolute z-20 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
                style={{ left: midX, top: midY, transform: 'translate(-50%, -110%)', minWidth: 180, maxWidth: 260 }}
              >
                <p className="font-semibold text-gray-700 mb-1 truncate">{sourceRule?.name} → {targetRule?.name}</p>
                {sourceRule?.fieldMappings && sourceRule.fieldMappings.length > 0 ? (
                  <ul className="space-y-0.5">
                    {sourceRule.fieldMappings.map((m, mi) => (
                      <li key={mi} className="text-gray-500 truncate">
                        {m.sourceType === 'static' ? `"${m.staticValue}"` : m.sourceField} <span className="text-gray-300">→</span> <span className="text-gray-700">{m.targetField}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">No field mappings on this rule.</p>
                )}
              </div>
            );
          })()}

          {rules.map((rule) => {
            const pos = posOf(rule._id);
            const accent = actionAccentClasses(rule);
            return (
              <Rnd
                key={rule._id}
                size={{ width: CANVAS_CARD_W, height: CANVAS_CARD_H }}
                position={{ x: pos.x, y: pos.y }}
                enableResizing={false}
                onDragStart={(_, d) => { dragStart.current = { x: d.x, y: d.y }; }}
                onDrag={(_, d) => setPositions((prev) => ({ ...prev, [rule._id]: { x: d.x, y: d.y } }))}
                onDragStop={(_, d) => {
                  setPositions((prev) => ({ ...prev, [rule._id]: { x: d.x, y: d.y } }));
                  const start = dragStart.current;
                  const moved = start ? Math.hypot(d.x - start.x, d.y - start.y) : 0;
                  if (moved < 4) onEdit(rule);
                  else updateMut.mutate({ id: rule._id, data: { canvasPosition: { x: d.x, y: d.y } } });
                }}
                style={{ zIndex: 1 }}
              >
                <div className={`h-full w-full bg-white rounded-xl border shadow-sm flex flex-col cursor-grab active:cursor-grabbing select-none ${rule.enabled ? 'border-gray-200' : 'border-gray-200 opacity-50'}`}>
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 shrink-0">
                    <p className="text-xs font-semibold text-gray-800 truncate min-w-0">{rule.name}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(rule); }}
                        className="p-1 text-gray-300 hover:text-brand-600" title="Edit rule">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule._id); }}
                        className="p-1 text-gray-300 hover:text-red-500" title="Delete rule">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-1 px-2.5 py-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="flex-1 min-w-0 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide truncate">{moduleLabel(rule.module)}</p>
                        <p className="text-[11px] text-amber-800 truncate">{describeTriggerShort(rule)}</p>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      <div className={`flex-1 min-w-0 rounded-lg ${accent.bg} border ${accent.border} px-2 py-1.5`}>
                        <p className={`text-[9px] font-bold uppercase tracking-wide truncate ${accent.text}`}>Action</p>
                        <p className={`text-[11px] truncate ${accent.text}`}>{describeActionShort(rule, moduleLabel)}</p>
                      </div>
                    </div>
                    {describeMappingPreview(rule) && (
                      <p className="text-[10px] text-gray-400 truncate px-1" title={describeMappingPreview(rule) ?? undefined}>
                        {describeMappingPreview(rule)}
                      </p>
                    )}
                  </div>
                </div>
              </Rnd>
            );
          })}
        </div>
      </div>
      </div>

      {creating && (
        <RuleForm
          onClose={() => { setCreating(false); setPaletteDrop(null); }}
          initialCanvasPosition={createAt}
          initialTriggerType={paletteDrop?.kind === 'trigger' ? paletteDrop.value as AutomationTriggerType : undefined}
          initialActionType={paletteDrop?.kind === 'action' ? paletteDrop.value as AutomationActionType : undefined}
        />
      )}
    </div>
  );
}

export default function AutomationRulesPage() {
  const [moduleFilter, setModuleFilter] = useState<AutomationModule | ''>('');
  const [view, setView] = useState<'list' | 'canvas'>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const { data: rules = [], isLoading } = useAutomationRulesQuery(moduleFilter || undefined);
  const updateMut = useUpdateAutomationRule();
  const deleteMut = useDeleteAutomationRule();
  const MODULES = useEveryModule();

  const moduleLabel = (m: AutomationModule) => MODULES.find((x) => x.key === m)?.label ?? m;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <BoltIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Automations</h1>
            <p className="text-xs text-gray-500">When a record is created or its status changes, send an email/SMS or create a linked record automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg shrink-0">
          <button
            onClick={() => setView('list')}
            title="List view"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListBulletIcon className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView('canvas')}
            title="Canvas view — see how rules chain together"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'canvas' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Squares2X2Icon className="h-3.5 w-3.5" /> Canvas
          </button>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New Rule
        </button>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setModuleFilter('')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            moduleFilter === '' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setModuleFilter(m.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
              moduleFilter === m.key ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className={view === 'canvas' ? '' : 'max-w-4xl mx-auto'}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <BoltIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No automation rules yet{moduleFilter ? ` for ${moduleLabel(moduleFilter)}` : ''}.</p>
            </div>
          ) : view === 'canvas' ? (
            <RuleCanvasView rules={rules} moduleLabel={moduleLabel} onEdit={setEditingRule} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {rules.map((rule) => (
                <div key={rule._id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => updateMut.mutate({ id: rule._id, data: { enabled: !rule.enabled } })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      rule.enabled ? 'bg-brand-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      rule.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{rule.name}</p>
                    <p className="text-xs text-gray-500">
                      {moduleLabel(rule.module)} ·{' '}
                      {rule.triggerType === 'record_created' ? 'on new record'
                        : rule.triggerType === 'record_deleted' ? 'on delete'
                        : rule.triggerType === 'record_updated'
                          ? <>when <span className="font-medium">{rule.triggerField}</span> {rule.triggerStage ? <>→ <span className="font-medium">{rule.triggerStage}</span></> : 'changes'}</>
                        : <>when status → <span className="font-medium">{rule.triggerStage}</span></>}
                      {' '}·{' '}
                      {rule.actionType === 'create_linked_record'
                        ? <>Create <span className="font-medium">{moduleLabel(rule.targetModule as AutomationModule)}</span> record</>
                        : <>{rule.actionType === 'send_email' ? 'Email' : rule.actionType === 'send_whatsapp' ? 'WhatsApp' : 'SMS'} · {RECIPIENT_LABELS[rule.recipientStrategy ?? 'record_contact']}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 text-gray-400 hover:text-brand-600 shrink-0"
                    title="Edit rule"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteMut.mutate(rule._id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"
                    title="Delete rule"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {formOpen && <RuleForm onClose={() => setFormOpen(false)} />}
      {editingRule && <RuleForm rule={editingRule} onClose={() => setEditingRule(null)} />}
    </div>
  );
}
