import { useState, useRef } from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  useCreateAutomationRule, useUpdateAutomationRule,
  useMessageTemplatesQuery, useCreateMessageTemplate, useFieldCatalogQuery,
  AutomationRule, AutomationModule, AutomationActionType, AutomationRecipientStrategy, AutomationTriggerType, FieldMapping,
  FlowCondition, ConditionOperator,
} from '../../../modules/native-crm/queries/automation-rules.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import BranchScopePicker from './BranchScopePicker';
import VariablePicker from './VariablePicker';
import { useEveryModule, useStageCapableModules, CONDITION_OPERATORS } from './AutomationRulesPage';

const RECIPIENT_LABELS: Record<AutomationRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
};

/** Extracted from AutomationRulesPage.tsx — new automations are now always
 * created through the unified Advanced canvas (AutomationFlowsPage.tsx /
 * AutomationFlowBuilderPage.tsx), but existing AutomationRule documents
 * still need an edit path, unchanged, which is exactly what this is: the
 * same CRUD form, same create/update endpoints, just living in its own file
 * so the unified hub can import it without AutomationRulesPage.tsx's own
 * list/Canvas-view chrome. */
export function RuleForm({ onClose, rule, initialCanvasPosition, initialTriggerType, initialActionType }: {
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
  const [assignTeamId, setAssignTeamId] = useState(rule?.assignTeamId ?? '');
  const [scheduleCron, setScheduleCron] = useState(rule?.scheduleCron ?? '*/5 * * * *');
  const [scheduleModule, setScheduleModule] = useState<AutomationModule | ''>(rule?.scheduleModule ?? '');
  const [scheduleFilter, setScheduleFilter] = useState<FlowCondition[]>(rule?.scheduleFilter ?? []);
  const [scheduleStampField, setScheduleStampField] = useState(rule?.scheduleStampField ?? '');
  const [branchIds, setBranchIds] = useState<string[] | undefined>(rule?.branchIds);
  const [enabled, setEnabled]   = useState(rule?.enabled ?? true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const { stages } = usePipelineStages(module);
  const templateChannel = actionType === 'send_email' ? 'email' : actionType === 'send_whatsapp' ? 'whatsapp' : 'sms';
  const { data: templates = [] } = useMessageTemplatesQuery(templateChannel);
  const { data: sourceFields = [] } = useFieldCatalogQuery(module);
  const { data: targetFields = [] } = useFieldCatalogQuery(targetModule);
  const { data: scheduleFields = [] } = useFieldCatalogQuery(scheduleModule);
  const { data: teamList } = useTeamsListQuery({ page: 1, limit: 1000 });
  const createMut = useCreateAutomationRule();
  const updateMut = useUpdateAutomationRule();
  const STAGE_CAPABLE_MODULES = useStageCapableModules();
  const EVERY_MODULE = useEveryModule();
  // A status_changed trigger needs a real stage to fire on, so its module
  // picker is limited to modules with one; record_created has no such
  // requirement, so every module (pipeline or not) is a valid source.
  const triggerModuleOptions = triggerType === 'status_changed' ? STAGE_CAPABLE_MODULES : EVERY_MODULE;

  const isLinkedRecord = actionType === 'create_linked_record';
  const isAssignment = actionType === 'assign_staff' || actionType === 'assign_team';
  const isScheduled = triggerType === 'scheduled';
  const triggerReady =
    triggerType === 'status_changed' ? !!triggerStage :
    triggerType === 'record_updated' ? !!triggerField :
    isScheduled ? !!scheduleCron.trim() && !!scheduleModule :
    true; // record_created / record_deleted need nothing further
  const canSave = name.trim() && triggerReady && (
    isLinkedRecord
      ? targetModule && fieldMappings.length > 0 && fieldMappings.every((m) => (m.sourceType === 'static' ? m.staticValue !== undefined && m.staticValue !== '' : !!m.sourceField))
      : isAssignment
        ? (actionType === 'assign_staff' || !!assignTeamId) // assign_staff's team scope is optional; assign_team requires one
        : !!templateId
  );

  const addMapping = () => setFieldMappings((prev) => [...prev, { targetField: '', sourceType: 'field', sourceField: '' }]);
  const removeMapping = (i: number) => setFieldMappings((prev) => prev.filter((_, idx) => idx !== i));
  const patchMapping = (i: number, patch: Partial<FieldMapping>) =>
    setFieldMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const addCondition = () => setScheduleFilter((prev) => [...prev, { field: '', operator: '=' }]);
  const removeCondition = (i: number) => setScheduleFilter((prev) => prev.filter((_, idx) => idx !== i));
  const patchCondition = (i: number, patch: Partial<FlowCondition>) =>
    setScheduleFilter((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const data = {
        // A scheduled rule's firing logic reads scheduleModule, not this
        // top-level module — but the schema still requires SOME value here,
        // so it's silently kept in sync rather than asking for two
        // confusingly-similar module pickers.
        module: isScheduled ? (scheduleModule || module) : module,
        name: name.trim(), triggerType,
        triggerStage: triggerType === 'status_changed' || triggerType === 'record_updated' ? (triggerStage || undefined) : undefined,
        triggerField: triggerType === 'record_updated' ? triggerField : undefined,
        // This form's own triggerType union has no 'webhook' member at all
        // (not a selectable option below — see the Trigger <select>), so
        // branchIds is always safe to submit as-is here; the "not valid on
        // webhook" rule is still enforced server-side for any rule created
        // some other way.
        branchIds,
        ...(isScheduled
          ? {
              scheduleCron: scheduleCron.trim(),
              scheduleModule: scheduleModule || undefined,
              scheduleFilter: scheduleFilter.length > 0 ? scheduleFilter : undefined,
              scheduleStampField: scheduleStampField.trim() || undefined,
            }
          : {}),
        actionType,
        ...(isLinkedRecord
          ? { targetModule: targetModule || undefined, fieldMappings, backReferenceField: backReferenceField || undefined }
          : isAssignment
            ? { assignTeamId: assignTeamId || undefined }
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
        <div className="bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{isEdit ? 'Edit Automation Rule' : 'New Automation Rule'}</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Rule name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notify customer on approval"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ryze-400 bg-background text-text-primary" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Scheduled rules pick their own "watch which records" module
                  below instead — showing both here would be two confusingly
                  similar module pickers for one rule. */}
              {triggerType !== 'scheduled' && (
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Module</label>
                  <select value={module} onChange={(e) => { setModule(e.target.value as AutomationModule); setTriggerStage(''); setTriggerField(''); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                    {triggerModuleOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              )}
              <div className={triggerType === 'scheduled' ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Trigger</label>
                <select value={triggerType} onChange={(e) => {
                  setTriggerType(e.target.value as AutomationTriggerType); setTriggerStage(''); setTriggerField('');
                  setScheduleModule(''); setScheduleFilter([]); setScheduleStampField('');
                }} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                  <option value="status_changed">Status changes to…</option>
                  <option value="record_created">New record created</option>
                  <option value="record_updated">Field updated</option>
                  <option value="record_deleted">Record deleted</option>
                  <option value="scheduled">On a schedule</option>
                </select>
              </div>
            </div>

            {isScheduled && (
              <div className="space-y-3 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Watch which records</label>
                    <select value={scheduleModule} onChange={(e) => { setScheduleModule(e.target.value as AutomationModule); setScheduleFilter([]); }}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                      <option value="">Select module…</option>
                      {EVERY_MODULE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Check every</label>
                    <select value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                      <option value="*/5 * * * *">5 minutes</option>
                      <option value="*/15 * * * *">15 minutes</option>
                      <option value="0 * * * *">Hour</option>
                      <option value="0 */6 * * *">6 hours</option>
                      <option value="0 0 * * *">Day (midnight)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide">Only matching records (optional)</label>
                    <button type="button" onClick={addCondition} disabled={!scheduleModule}
                      className="text-[11px] font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 disabled:opacity-40">
                      + Add condition
                    </button>
                  </div>
                  {scheduleFilter.length === 0 && (
                    <p className="text-[11px] text-text-muted">No conditions — every record in this module matches.</p>
                  )}
                  <div className="space-y-2">
                    {scheduleFilter.map((c, i) => {
                      const fieldDef = scheduleFields.find((f) => f.key === c.field);
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <select value={c.field} onChange={(e) => patchCondition(i, { field: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                            <option value="">Field…</option>
                            {scheduleFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                          <select value={c.operator} onChange={(e) => patchCondition(i, { operator: e.target.value as ConditionOperator })}
                            className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                            {CONDITION_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                          </select>
                          {!['is_empty', 'is_not_empty'].includes(c.operator) && (
                            fieldDef?.options ? (
                              <select value={c.value ?? ''} onChange={(e) => patchCondition(i, { value: e.target.value })}
                                className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                                <option value="">Value…</option>
                                {fieldDef.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <input value={c.value ?? ''} onChange={(e) => patchCondition(i, { value: e.target.value })}
                                placeholder={c.operator === '>' || c.operator === '<' ? 'e.g. now, today, 50000' : 'Value'}
                                className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
                            )
                          )}
                          {c.operator === 'between' && (
                            <input value={c.value2 ?? ''} onChange={(e) => patchCondition(i, { value2: e.target.value })}
                              placeholder="and…" className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
                          )}
                          <button type="button" onClick={() => removeCondition(i)} className="p-1.5 text-text-muted hover:text-red-500">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    Use <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1 rounded">now</code> or <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1 rounded">today</code> as a date value — e.g. a field "&lt;" "now" means overdue.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Prevent re-firing (optional)</label>
                  <select value={scheduleStampField} onChange={(e) => setScheduleStampField(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                    <option value="">Fire every time it matches</option>
                    {scheduleFields.filter((f) => f.type === 'date').map((f) => <option key={f.key} value={f.key}>{`Mark "${f.label}" once fired`}</option>)}
                  </select>
                  <p className="text-[11px] text-text-muted mt-1">
                    Once this rule fires for a record, the chosen field is stamped with the current time — add a condition above like "{scheduleStampField ? scheduleFields.find((f) => f.key === scheduleStampField)?.label : 'that field'} is empty" so a record only fires once instead of every check.
                  </p>
                </div>
              </div>
            )}

            {triggerType === 'status_changed' && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">When status changes to</label>
                <select value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
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
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Which field</label>
                    <select value={triggerField} onChange={(e) => { setTriggerField(e.target.value); setTriggerStage(''); }}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                      <option value="">Select field…</option>
                      {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Changes to (optional)</label>
                    {fieldDef?.options ? (
                      <select value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" disabled={!triggerField}>
                        <option value="">Any change</option>
                        {fieldDef.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input value={triggerStage} onChange={(e) => setTriggerStage(e.target.value)} placeholder="Any change"
                        disabled={!triggerField}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg disabled:opacity-50 bg-background text-text-primary" />
                    )}
                  </div>
                </div>
              );
            })()}

            {triggerType === 'record_deleted' && (
              <p className="text-xs text-text-muted bg-background border border-border rounded-lg px-3 py-2.5">
                This rule fires whenever a {triggerModuleOptions.find((m) => m.key === module)?.label ?? 'record'} is deleted — no further setup needed here.
              </p>
            )}

            <BranchScopePicker branchIds={branchIds} onChange={setBranchIds} />

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Action</label>
              <select value={actionType} onChange={(e) => { setActionType(e.target.value as AutomationActionType); setTemplateId(''); }}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                <option value="send_email">Send Email</option>
                <option value="send_sms">Send SMS</option>
                <option value="send_whatsapp">Send WhatsApp</option>
                <option value="create_linked_record">Create Linked Record</option>
                <option value="assign_staff">Assign Staff (Round Robin)</option>
                <option value="assign_team">Assign Team</option>
              </select>
            </div>

            {isAssignment && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">
                  {actionType === 'assign_staff' ? 'Rotate within team (optional)' : 'Target team'}
                </label>
                <select value={assignTeamId} onChange={(e) => setAssignTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                  <option value="">{actionType === 'assign_staff' ? 'Whole company (all active staff)' : 'Select a team…'}</option>
                  {(teamList?.items ?? []).map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <p className="text-[11px] text-text-muted mt-1">
                  {actionType === 'assign_staff'
                    ? 'Rotates through active staff (company-wide, or just this team) and writes staffId/teamId onto the record — no notification is sent by this action alone; chain a Send Email/WhatsApp action with recipient "Assigned staff" for that.'
                    : 'Sets teamId on the record to this fixed team — not rotated.'}
                </p>
              </div>
            )}

            {!isLinkedRecord && !isAssignment && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide">Template</label>
                      <button type="button" onClick={() => setCreatingTemplate(true)}
                        className="text-[11px] font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">
                        + New template
                      </button>
                    </div>
                    <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                      <option value="">Select template…</option>
                      {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    {templates.length === 0 && (
                      <p className="text-[11px] text-text-muted mt-1">No {templateChannel} templates yet — create one above.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Recipient</label>
                    <select value={recipientStrategy} onChange={(e) => setRecipientStrategy(e.target.value as AutomationRecipientStrategy)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
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
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Create a record in</label>
                  <select value={targetModule} onChange={(e) => { setTargetModule(e.target.value as AutomationModule); setFieldMappings([]); setBackReferenceField(''); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                    <option value="">Select module…</option>
                    {EVERY_MODULE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Field mapping</label>
                  <div className="space-y-2">
                    {fieldMappings.map((m, i) => {
                      const targetDef = targetFields.find((f) => f.key === m.targetField);
                      return (
                      <div key={i} className="flex items-center gap-1.5">
                        <select value={m.targetField} onChange={(e) => patchMapping(i, { targetField: e.target.value, staticValue: '' })}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                          <option value="">Target field…</option>
                          {targetFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                        <span className="text-xs text-text-muted shrink-0">=</span>
                        <select value={m.sourceType} onChange={(e) => patchMapping(i, { sourceType: e.target.value as 'field' | 'static', sourceField: '', staticValue: '' })}
                          className="shrink-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                          <option value="field">Copy from field</option>
                          <option value="static">Fixed value</option>
                        </select>
                        {m.sourceType === 'field' ? (
                          <select value={m.sourceField ?? ''} onChange={(e) => patchMapping(i, { sourceField: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                            <option value="">Source field…</option>
                            {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                        ) : targetDef?.options ? (
                          <select value={m.staticValue ?? ''} onChange={(e) => patchMapping(i, { staticValue: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
                            <option value="">Select value…</option>
                            {targetDef.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input value={m.staticValue ?? ''} onChange={(e) => patchMapping(i, { staticValue: e.target.value })}
                            placeholder="Value" className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
                        )}
                        <button onClick={() => removeMapping(i)} className="p-1 text-text-muted hover:text-red-500 shrink-0">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                  <button onClick={addMapping} disabled={!targetModule}
                    className="mt-2 text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 disabled:opacity-40 disabled:cursor-not-allowed">
                    + Add field mapping
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Link new record back to source (optional)</label>
                  <select value={backReferenceField} onChange={(e) => setBackReferenceField(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" disabled={!targetModule}>
                    <option value="">Don&rsquo;t link back</option>
                    {targetFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              </>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border text-ryze-600 dark:text-ryze-400 focus:ring-ryze-500" />
              <span className="text-sm text-text-primary">Enabled</span>
            </label>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              className="flex-1 px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
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
export function InlineTemplateModal({ channel, onClose, onCreated }: {
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
        <div className="bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary capitalize">New {channel} template</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deal won notification"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ryze-400 bg-background text-text-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Purpose</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
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
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Update on {{title}}"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ryze-400 bg-background text-text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide">Message body</label>
                <VariablePicker module="" targetRef={bodyRef} value={body} onChange={setBody} />
              </div>
              <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Hi {{name}}, ..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-ryze-400 bg-background text-text-primary" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!canSave || saving}
              className="flex-1 px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
              {saving ? 'Creating…' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
