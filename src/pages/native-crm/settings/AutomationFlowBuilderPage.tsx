import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  TrashIcon, XMarkIcon, ArrowLeftIcon, PlayIcon,
  BeakerIcon, RectangleStackIcon, ExclamationTriangleIcon,
  MagnifyingGlassIcon, BookmarkIcon, PauseCircleIcon,
  EllipsisVerticalIcon, DocumentDuplicateIcon, SparklesIcon, UserIcon, PencilIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import {
  useAutomationFlowQuery, useAutomationFlowsQuery, useCreateAutomationFlow, useUpdateAutomationFlow,
  usePublishFlow, useDiscardDraft, useDryRunFlow, useFlowRunsQuery, useFlowRunQuery,
  useDeleteAutomationFlow, fetchFlowForDuplicate,
  type FlowNode, type FlowEdge, type FlowNodeType, type FlowRecipientStrategy, type FlowRunStep, type AutomationFlow,
} from '../../../modules/native-crm/queries/automation-flows.queries';
import { SYSTEM_TOKENS } from './VariablePicker';
import {
  useFieldCatalogQuery, useMessageTemplatesQuery,
  type AutomationModule, type FlowCondition,
} from '../../../modules/native-crm/queries/automation-rules.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useEveryModule, useStageCapableModules, CONDITION_OPERATORS } from './AutomationRulesPage';
import ActionNodeConfig from './ActionNodeConfig';
import BranchScopePicker from './BranchScopePicker';
import {
  useAutomationTemplateQuery, useAutomationTemplatesQuery, useCreateAutomationTemplate, useDeleteAutomationTemplate,
  type AutomationTemplate,
} from '../../../modules/native-crm/queries/automation-templates.queries';
import GroupedSearchableSelect from '../../../modules/native-crm/shared/GroupedSearchableSelect';
import { groupModules } from './automation-module-groups';
import { useAutomationSettingsQuery } from '../../../modules/native-crm/queries/automation-settings.queries';
import { ApprovalDecisionButtons, RUN_STATUS_COLOR } from './RunStepRow';
import { useRegisterOverlayOpen } from '../../../hooks/useRegisterOverlayOpen';
import {
  NODE_META, NODE_TYPES, edgeColorFor, needsConfiguration, configurationIssue,
  RunOverlayContext, NodeActionsContext, type DiagramNodeStatus,
} from './flow-node-visuals';
import FlowExecutionDiagram, { RunStepFallbackList, type DiagramStep } from './FlowExecutionDiagram';
import ChainPreview from './ChainPreview';

/** Left-palette node *types* (Trigger excluded — auto-seeded, singular,
 * never palette-addable) grouped for the searchable palette. Distinct from
 * the 7 action *types* (send_email/webhook_call/etc.) inside the Action
 * node's own already-categorized config dropdown (ActionNodeConfig.tsx) —
 * this groups the 7 structural node types the palette itself offers. */
const NODE_PALETTE_GROUPS: { label: string; types: FlowNodeType[] }[] = [
  { label: 'Logic',        types: ['condition', 'merge'] },
  { label: 'Flow Control', types: ['delay', 'approval'] },
  { label: 'Action',       types: ['action'] },
  { label: 'Advanced',     types: ['subFlow', 'loop'] },
];

const RECIPIENT_LABELS: Record<FlowRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
  tenant_admin:   'Tenant admin',
  manager:        'Manager',
};

/* ── Small reusable editors (mirrors AutomationRulesPage's own patterns) ─ */

function ConditionsEditor({ conditions, onChange, fields }: {
  conditions: FlowCondition[]; onChange: (c: FlowCondition[]) => void; fields: { key: string; label: string }[];
}) {
  const add = () => onChange([...conditions, { field: '', operator: '=' }]);
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<FlowCondition>) => onChange(conditions.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  return (
    <div className="space-y-2">
      {conditions.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select value={c.field} onChange={(e) => patch(i, { field: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
            <option value="">Field…</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={c.operator} onChange={(e) => patch(i, { operator: e.target.value as any })} className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary">
            {CONDITION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {c.operator !== 'is_empty' && c.operator !== 'is_not_empty' && (
            <input value={c.value ?? ''} onChange={(e) => patch(i, { value: e.target.value })} placeholder="Value"
              className="w-20 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
          )}
          {c.operator === 'between' && (
            <input value={c.value2 ?? ''} onChange={(e) => patch(i, { value2: e.target.value })} placeholder="and…"
              className="w-20 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
          )}
          <button onClick={() => remove(i)} className="p-1 text-text-muted hover:text-red-500 shrink-0"><TrashIcon className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={add} className="text-[11px] font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">+ Add condition</button>
    </div>
  );
}

/* ── Node config side panel ───────────────────────────────────────────── */

function NodeConfigPanel({
  node, onChange, onDelete, onClose, triggerModule, flowIdForSubFlowExclusion, allFlows, runStep, onRunTest,
}: {
  node: FlowNode;
  onChange: (patch: Partial<FlowNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  triggerModule: AutomationModule | '';
  flowIdForSubFlowExclusion?: string;
  allFlows: { _id: string; name: string }[];
  /** This node's own step from whichever run is currently overlaid on the
   * canvas (History panel's run selection) — undefined when no run is
   * selected, or when that run never reached this node. Drives the Data
   * tab's real input/output view. */
  runStep?: FlowRunStep;
  /** Wired to the builder's own Dry Run modal — the Data tab's own
   * shortcut into it, per plan item #7 ("Test this step" reuses the
   * existing whole-chain dry-run rather than a second execution path).
   * Called with this node's own id so the modal can auto-select/scroll to
   * its result once the run completes. */
  onRunTest?: (nodeId: string) => void;
}) {
  useRegisterOverlayOpen();
  const EVERY_MODULE = useEveryModule();
  const STAGE_CAPABLE = useStageCapableModules();
  const { stages } = usePipelineStages((node.type === 'trigger' ? node.module : triggerModule) as any, []);
  const { data: triggerFields = [] } = useFieldCatalogQuery(triggerModule || undefined as any);
  const { data: targetFields = [] } = useFieldCatalogQuery((node.targetModule as AutomationModule) || undefined as any);
  const templateChannel = node.actionType === 'send_whatsapp' ? 'whatsapp' : node.actionType === 'send_sms' ? 'sms' : 'email';
  const { data: templates = [] } = useMessageTemplatesQuery(templateChannel);
  const { data: loopFields = [] } = useFieldCatalogQuery((node.loopSourceModule as AutomationModule) || undefined as any);

  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const configIssue = configurationIssue(node);
  const [tab, setTab] = useState<'configure' | 'data'>('configure');
  const [copiedKey, setCopiedKey] = useState<string | undefined>();
  const copyToken = (key: string) => {
    navigator.clipboard?.writeText(`{{${key}}}`).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? undefined : k)), 1200);
  };

  // Slide-over drawer convention established elsewhere in the app
  // (FSDrawer.tsx) — this panel used to sit inline-docked beside the canvas;
  // now it overlays it, same mount-transition mechanics as FSDrawer's own
  // `visible` + requestAnimationFrame pattern.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const close = () => { setVisible(false); setTimeout(onClose, 200); };

  // Scoped to the canvas area (the relatively-positioned wrapper one level
  // up), not the whole viewport — a `fixed top-0` drawer would otherwise
  // overlay the header bar above it, covering Save draft/Publish/History
  // (caught live: those buttons became unclickable behind the drawer).
  return (
    <>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={close} />
      <div className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-surface border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className={`px-4 py-3.5 border-b border-border flex items-center gap-2.5 ${meta.bg}`}>
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label} node</span>
        <button onClick={close} className="ml-auto p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-muted"><XMarkIcon className="h-4 w-4" /></button>
      </div>

      <div className="px-4 pt-3 flex gap-1 border-b border-border">
        {(['configure', 'data'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 -mb-px ${tab === t ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'}`}
          >
            {t === 'configure' ? 'Configure' : 'Data'}
          </button>
        ))}
      </div>

      {tab === 'data' && (
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {runStep ? (
            <>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${RUN_STATUS_COLOR[runStep.status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>{runStep.status}</span>
                {runStep.durationMs !== undefined && <span className="text-[11px] text-text-muted">{runStep.durationMs}ms</span>}
              </div>
              {runStep.error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{runStep.error}</p>}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Input</p>
                <pre className="text-[11px] bg-background border border-border rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                  {runStep.input ? JSON.stringify(runStep.input, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Output</p>
                <pre className="text-[11px] bg-background border border-border rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                  {runStep.output ? JSON.stringify(runStep.output, null, 2) : '—'}
                </pre>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-text-muted">No run selected — showing what's available to map into this node's fields. Open History and select a run to see real input/output here instead.</p>
              {onRunTest && (
                <button onClick={() => onRunTest(node.id)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-ryze-700 dark:text-ryze-400 border border-ryze-200 dark:border-ryze-800 rounded-lg bg-ryze-600/10 hover:bg-ryze-600/15">
                  <BeakerIcon className="h-3.5 w-3.5" /> Test this step
                </button>
              )}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Trigger fields</p>
                {triggerFields.length === 0 ? (
                  <p className="text-[11px] text-text-muted">No trigger module selected yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {triggerFields.map((f) => (
                      <button key={f.key} onClick={() => copyToken(`record.${f.key}`)} title="Click to copy {{token}}"
                        className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-background border border-border hover:border-ryze-300 text-text-primary">
                        {copiedKey === `record.${f.key}` ? 'Copied!' : `record.${f.key}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">System</p>
                <div className="flex flex-wrap gap-1">
                  {SYSTEM_TOKENS.map((t) => (
                    <button key={t.key} onClick={() => copyToken(t.key)} title="Click to copy {{token}}"
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-background border border-border hover:border-ryze-300 text-text-primary">
                      {copiedKey === t.key ? 'Copied!' : t.key}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className={`p-4 space-y-4 flex-1 ${tab === 'data' ? 'hidden' : ''}`}>
        {/* Kept mounted (hidden, not unmounted) while the Data tab is open —
            cheaper than remounting every field's local state/refs on every
            tab switch, and matches this panel's existing "never lose
            in-progress edits" posture elsewhere. */}
        {configIssue && (
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{configIssue}</span>
          </div>
        )}
        {node.type === 'trigger' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Fires when</label>
              <select value={node.triggerType ?? 'record_created'} onChange={(e) => onChange({ triggerType: e.target.value as any, triggerStage: '', triggerField: '' })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                <option value="record_created">New record created</option>
                <option value="status_changed">Status changes to…</option>
                <option value="record_updated">Field updated</option>
                <option value="record_deleted">Record deleted</option>
                <option value="scheduled">On a schedule</option>
                <option value="webhook">Webhook received</option>
              </select>
            </div>
            {node.triggerType !== 'webhook' && node.triggerType !== 'scheduled' && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Module</label>
                <GroupedSearchableSelect
                  groups={groupModules(node.triggerType === 'status_changed' ? STAGE_CAPABLE : EVERY_MODULE)}
                  value={node.module ?? ''}
                  onChange={(key) => onChange({ module: key as any })}
                  placeholder="Select a module…"
                />
              </div>
            )}
            {node.triggerType === 'status_changed' && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Stage</label>
                <select value={node.triggerStage ?? ''} onChange={(e) => onChange({ triggerStage: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                  <option value="">Select stage…</option>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}
            {node.triggerType === 'record_updated' && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Watch field</label>
                <select value={node.triggerField ?? ''} onChange={(e) => onChange({ triggerField: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                  <option value="">Select field…</option>
                  {triggerFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            )}
            {node.triggerType === 'scheduled' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Watch which records</label>
                  <GroupedSearchableSelect
                    groups={groupModules(EVERY_MODULE)}
                    value={node.scheduleModule ?? ''}
                    onChange={(key) => onChange({ scheduleModule: key as any })}
                    placeholder="Select a module…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Check every</label>
                  <select value={node.scheduleCron ?? '*/15 * * * *'} onChange={(e) => onChange({ scheduleCron: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                    <option value="*/15 * * * *">15 minutes</option>
                    <option value="0 * * * *">Hour</option>
                    <option value="0 */6 * * *">6 hours</option>
                    <option value="0 0 * * *">Day (midnight)</option>
                  </select>
                </div>
              </>
            )}
            {node.triggerType === 'webhook' && (
              <div className="bg-background border border-border rounded-lg p-3 text-xs text-text-muted">
                {node.webhookToken
                  ? <>Webhook URL token is minted on save. Once saved, copy the receiving URL from the flow list.</>
                  : <>A webhook token will be generated the first time this flow is saved.</>}
              </div>
            )}
            {node.triggerType !== 'webhook' && (
              <BranchScopePicker branchIds={node.branchIds} onChange={(branchIds) => onChange({ branchIds })} />
            )}
          </>
        )}

        {node.type === 'condition' && (
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">All of these must match</label>
            <ConditionsEditor conditions={node.conditions ?? []} onChange={(c) => onChange({ conditions: c })} fields={triggerFields} />
          </div>
        )}

        {node.type === 'action' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Action</label>
              <select value={node.actionType ?? 'send_email'} onChange={(e) => onChange({ actionType: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                <optgroup label="Communication">
                  <option value="send_email">Send Email</option>
                  <option value="send_sms">Send SMS</option>
                  <option value="send_whatsapp">Send WhatsApp</option>
                </optgroup>
                <optgroup label="CRM">
                  <option value="create_linked_record">Create Linked Record</option>
                  <option value="update_record">Update Record</option>
                  <option value="assign_record">Assign Record</option>
                  <option value="change_status">Change Status</option>
                  <option value="add_note">Add Note</option>
                </optgroup>
                <optgroup label="Integration">
                  <option value="webhook_call">Webhook</option>
                </optgroup>
              </select>
            </div>
            <ActionNodeConfig
              node={node} onChange={onChange} triggerModule={triggerModule}
              triggerFields={triggerFields} targetFields={targetFields}
              everyModule={EVERY_MODULE} templates={templates}
            />
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Retry on failure</label>
              <div className="flex gap-2">
                <select value={node.retryCount ?? 0} onChange={(e) => onChange({ retryCount: Number(e.target.value) as any })} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                  <option value={0}>No retry</option>
                  <option value={1}>1 retry</option>
                  <option value={2}>2 retries</option>
                  <option value={3}>3 retries</option>
                </select>
                {(node.retryCount ?? 0) > 0 && (
                  <select value={node.retryBackoffMs ?? 5000} onChange={(e) => onChange({ retryBackoffMs: Number(e.target.value) as any })} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                    <option value={1000}>1s apart</option>
                    <option value={5000}>5s apart</option>
                    <option value={30000}>30s apart</option>
                    <option value={60000}>60s apart</option>
                  </select>
                )}
              </div>
            </div>
          </>
        )}

        {node.type === 'delay' && (
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Pause for (minutes)</label>
            <input type="number" min={1} max={129600} value={node.delayMinutes ?? 5} onChange={(e) => onChange({ delayMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" />
            <p className="text-[11px] text-text-muted mt-1">Up to 129,600 minutes (90 days).</p>
          </div>
        )}

        {node.type === 'merge' && (
          <p className="text-xs text-text-muted">Merge nodes have no settings — they simply wait for every incoming branch to arrive before continuing.</p>
        )}

        {node.type === 'subFlow' && (
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Flow to invoke</label>
            <select value={node.targetFlowId ?? ''} onChange={(e) => onChange({ targetFlowId: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
              <option value="">Select flow…</option>
              {allFlows.filter((f) => f._id !== flowIdForSubFlowExclusion).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <p className="text-[11px] text-text-muted mt-1">The target flow can't itself contain a Sub-Flow, Loop, Delay, or Approval node.</p>
          </div>
        )}

        {node.type === 'loop' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Iterate over</label>
              <GroupedSearchableSelect
                groups={groupModules([{ key: 'customer', label: 'Customers' }, ...EVERY_MODULE])}
                value={node.loopSourceModule ?? ''}
                onChange={(key) => onChange({ loopSourceModule: key as any })}
                placeholder="Select a module…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Only matching (optional)</label>
              <ConditionsEditor conditions={node.loopFilter ?? []} onChange={(c) => onChange({ loopFilter: c })} fields={loopFields} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Flow to run per item</label>
              <select value={node.loopSubFlowId ?? ''} onChange={(e) => onChange({ loopSubFlowId: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
                <option value="">Select flow…</option>
                {allFlows.filter((f) => f._id !== flowIdForSubFlowExclusion).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Max items</label>
                <input type="number" min={1} max={2000} value={node.loopMaxItems ?? 50} onChange={(e) => onChange({ loopMaxItems: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Batch size</label>
                <input type="number" min={1} value={node.loopBatchSize ?? 10} onChange={(e) => onChange({ loopBatchSize: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Concurrency</label>
                <input type="number" min={1} value={node.loopConcurrency ?? 1} onChange={(e) => onChange({ loopConcurrency: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
              </div>
            </div>
          </>
        )}

        {node.type === 'approval' && (
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Notify</label>
            <select value={node.approvalRecipientStrategy ?? 'manager'} onChange={(e) => onChange({ approvalRecipientStrategy: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
              {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="text-[11px] text-text-muted mt-1">Both the Approve and Reject paths below must be connected.</p>
          </div>
        )}
      </div>

      {node.type !== 'trigger' && (
        <div className="p-4 border-t border-border">
          <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <TrashIcon className="h-3.5 w-3.5" /> Delete node
          </button>
        </div>
      )}
      </div>
    </>
  );
}

/* ── Dry-run modal ─────────────────────────────────────────────────────── */

function DryRunModal({ flowId, triggerModule, flow, focusNodeId, onClose }: {
  flowId: string; triggerModule: AutomationModule | ''; flow?: AutomationFlow;
  /** Set when opened via a node drawer's "Test this step" (plan item #7) —
   * once results arrive, the diagram auto-selects/scrolls to this node
   * instead of leaving the viewer to hunt for it. */
  focusNodeId?: string;
  onClose: () => void;
}) {
  useRegisterOverlayOpen();
  const [sampleRecordId, setSampleRecordId] = useState('');
  const dryRunMut = useDryRunFlow();
  // Same draft-or-live content the backend's own dryRunFlow() picks
  // (usingDraft = !!flow.draft) — this is the one place a run's nodes/
  // edges ARE guaranteed current, since dry-run always walks whichever of
  // these two is live right now, never a stale snapshot.
  const content = flow ? (flow.draft ?? { nodes: flow.nodes, edges: flow.edges, canvasPositions: flow.canvasPositions }) : undefined;
  const diagramSteps: DiagramStep[] = (dryRunMut.data?.steps ?? []).map((s) => ({
    nodeId: s.nodeId, status: s.status === 'ok' ? 'success' : 'would-skip', branch: s.branch, label: s.label, result: s.result,
  }));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2"><BeakerIcon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" /> Test this flow</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Simulates every node against one real {triggerModule || 'record'}.{' '}
            <span className="font-medium text-text-primary">No real email, WhatsApp, or SMS is ever sent, and nothing is created or saved</span> — Email/WhatsApp/SMS nodes only report who and what WOULD be sent.
          </p>
          <div className="flex gap-2 mb-4">
            <input value={sampleRecordId} onChange={(e) => setSampleRecordId(e.target.value)} placeholder={`${triggerModule || 'Record'} ID (from its list/detail page)`}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" />
            <button
              disabled={!sampleRecordId.trim() || !triggerModule || dryRunMut.isPending}
              onClick={() => dryRunMut.mutate({ id: flowId, sampleModule: triggerModule, sampleRecordId: sampleRecordId.trim() })}
              className="px-4 py-2 bg-ryze-600 text-white text-sm font-medium rounded-lg hover:bg-ryze-700 disabled:opacity-40"
            >
              {dryRunMut.isPending ? 'Running…' : 'Run'}
            </button>
          </div>

          {dryRunMut.isError && (() => {
            // `issues` is the rich, always-array shape — populated by both
            // validate.middleware.ts (a Zod-level rejection) and
            // automation-flow.controller.ts's sendFlowError (a
            // FlowValidationError) alike. `errors` is kept only as a
            // last-resort fallback for an older response shape.
            const data = (dryRunMut.error as any)?.response?.data;
            const issues: string[] | undefined = data?.issues ?? (Array.isArray(data?.errors) ? data.errors : undefined);
            return (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">
                <p className="font-medium">{data?.message ?? 'Dry-run failed'}</p>
                {issues && issues.length > 1 && (
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                )}
              </div>
            );
          })()}

          {dryRunMut.data && (
            <div className="space-y-2">
              <p className="text-[11px] text-text-muted">{dryRunMut.data.usingDraft ? 'Simulated against your unpublished draft.' : 'Simulated against the live published flow.'}</p>
              {content ? (
                <FlowExecutionDiagram nodes={content.nodes} edges={content.edges} canvasPositions={content.canvasPositions} steps={diagramSteps} focusNodeId={focusNodeId} heightClassName="h-96" />
              ) : (
                dryRunMut.data.steps.map((s, i) => (
                  <div key={i} className="bg-background rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-text-muted uppercase">{s.nodeType} · {s.label}</p>
                    <p className="text-xs text-text-primary mt-0.5">{s.result}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Execution history panel ──────────────────────────────────────────── */

// The Executions tab's content — scoped to the open flow. Used to live as a
// right-side slide-over drawer (HistoryPanel); now rendered inline as one of
// the Studio's tabs (plan: "Unified n8n-style Automation Studio"), so it no
// longer owns any overlay/backdrop chrome or its own close button — closing
// just means switching tabs.
function FlowExecutionsPanel({ flowId, flow, initialRunId, onSelectRun }: {
  flowId: string; flow?: AutomationFlow; initialRunId?: string; onSelectRun?: (runId: string | undefined) => void;
}) {
  const { data: runs = [], isLoading, isFetching, refetch } = useFlowRunsQuery(flowId);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(initialRunId);
  const { data: run } = useFlowRunQuery(selectedRunId);
  // Pre-select once runs arrive, for the backward-compatible redirect from
  // the old standalone Executions URL (?runId=) — a run fetched directly by
  // id (useFlowRunQuery) doesn't depend on the list, but selecting it here
  // too keeps the left rail's highlight in sync.
  useEffect(() => {
    if (initialRunId) setSelectedRunId(initialRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRunId]);
  // The run's OWN pinned snapshot (automation-flow-run.model.ts's
  // flowSnapshot) is the accurate source — correct even after the flow's
  // been edited, republished, or deleted since this run happened, since it
  // doesn't depend on the live flow document at all. Only a run from
  // before this field existed falls back to the flow's current layout
  // (best-effort, may not match what actually ran); only when NEITHER
  // exists (that old a run AND the flow has since been deleted) is there
  // truly nothing to draw.
  const content = run?.flowSnapshot
    ? { nodes: run.flowSnapshot.nodes, edges: run.flowSnapshot.edges, canvasPositions: undefined }
    : flow ? (flow.draft ?? { nodes: flow.nodes, edges: flow.edges, canvasPositions: flow.canvasPositions }) : undefined;
  const diagramSteps: DiagramStep[] = useMemo(() => {
    if (!run) return [];
    const steps: DiagramStep[] = run.steps.map((s) => ({
      nodeId: s.nodeId, status: s.status, label: s.label, result: s.result, error: s.error,
      input: s.input, output: s.output, durationMs: s.durationMs, startedAt: s.startedAt,
      // A condition step's own output is {result, branch} (see
      // automation-flow.service.ts's condition branch — captured as
      // structured data, not just free text), so the real executed port is
      // read straight off it rather than re-parsed from `result`.
      branch: s.nodeType === 'condition' ? (s.output?.branch as 'true' | 'false' | undefined) : undefined,
    }));
    // A paused run's own pausing node (delay/approval) is logged as plain
    // 'success' by the engine ("pausing succeeded") — the UI distinguishes
    // "still waiting here" from "ran to completion" for the viewer. Always
    // the LAST logged step while paused (see automation-flow.service.ts's
    // delay/approval branches — both log their own step immediately before
    // flipping the run to 'paused').
    if (run.status === 'paused' && steps.length > 0) {
      steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'waiting' };
    }
    return steps;
  }, [run]);

  const selectRun = (id: string | undefined) => { setSelectedRunId(id); onSelectRun?.(id); };

  return (
    <div className="flex-1 flex min-h-0 flex-col sm:flex-row">
      <div className="w-full sm:w-72 max-h-48 sm:max-h-none border-b sm:border-b-0 sm:border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
          <RectangleStackIcon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">Execution history</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh run list"
            className="ml-auto p-1 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-10 px-4 text-text-muted">
              <RectangleStackIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No runs yet</p>
              <p className="text-[11px] mt-1">Runs appear here once this flow fires for real.</p>
            </div>
          ) : runs.map((r) => (
            <button key={r._id} onClick={() => selectRun(r._id)}
              className={`w-full text-left px-4 py-3 border-b border-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${selectedRunId === r._id ? 'bg-ryze-600/10' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${RUN_STATUS_COLOR[r.status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>{r.status}</span>
                {r.flowVersion && <span className="text-[10px] text-text-muted">v{r.flowVersion}</span>}
              </div>
              <p className="text-[11px] text-text-muted mt-1">{new Date(r.startedAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3.5 border-b border-border">
          <span className="text-sm font-semibold text-text-primary">{run ? `Run detail` : 'Select a run'}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {run ? (
            <>
              <ApprovalDecisionButtons run={run} />
              {content ? (
                <FlowExecutionDiagram nodes={content.nodes} edges={content.edges} canvasPositions={content.canvasPositions} steps={diagramSteps} heightClassName="h-96" />
              ) : (
                <RunStepFallbackList
                  steps={diagramSteps}
                  reason="this run predates per-run flow snapshots, and its original flow can no longer be found — it may have been deleted."
                />
              )}
            </>
          ) : runs.length > 0 ? (
            <div className="h-full flex items-center justify-center text-center text-text-muted">
              <div>
                <RectangleStackIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Pick a run on the left to see its diagram, input/output, and errors.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// The Templates tab's content — available both for a brand-new flow and for
// an existing one (per review feedback: templates must be reachable while
// editing, not only when starting fresh). Used to live as TemplateGalleryModal,
// a popup only ever opened from the hub; now rendered inline as one of the
// Studio's tabs, so it no longer owns any overlay/backdrop chrome.
function TemplateCard({ template, isSystem, onUse, onDelete }: {
  template: AutomationTemplate; isSystem: boolean; onUse: () => void; onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded-xl p-4 hover:border-ryze-300 dark:border-ryze-700 hover:shadow-sm transition-all flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-text-primary">{template.name}</h3>
        {!isSystem && onDelete && (
          <button onClick={onDelete} className="p-1 text-text-muted hover:text-red-500 shrink-0" title="Delete this template">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {template.description && <p className="text-xs text-text-muted mb-2 flex-1">{template.description}</p>}
      <ChainPreview nodes={template.nodes} edges={template.edges} className="mb-2" />
      <div className="flex items-center gap-1.5 mb-3">
        {template.category && <span className="badge badge-gray text-[10px]">{template.category}</span>}
        {template.triggerModule && <span className="badge badge-blue text-[10px]">{template.triggerModule}</span>}
      </div>
      <button onClick={onUse} className="w-full px-3 py-2 bg-ryze-600 text-white text-xs font-medium rounded-lg hover:bg-ryze-700">
        Use this template
      </button>
    </div>
  );
}

function FlowTemplatesPanel({ onUseTemplate }: { onUseTemplate: (templateId: string) => void }) {
  const { data: templates = [], isLoading } = useAutomationTemplatesQuery();
  const deleteMut = useDeleteAutomationTemplate();

  const systemTemplates = templates.filter((t) => t.tenantId === null);
  const myTemplates = templates.filter((t) => t.tenantId !== null);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {isLoading && <p className="text-sm text-text-muted">Loading templates…</p>}
      {!isLoading && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <SparklesIcon className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">System Templates</h3>
              <span className="text-[10px] text-text-muted">— available to everyone, read-only</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {systemTemplates.map((t) => (
                <TemplateCard key={t._id} template={t} isSystem onUse={() => onUseTemplate(t._id)} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <UserIcon className="h-4 w-4 text-text-muted" />
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">My Templates</h3>
              <span className="text-[10px] text-text-muted">— created by your team, reuse or delete anytime</span>
            </div>
            {myTemplates.length === 0 ? (
              <p className="text-xs text-text-muted">No saved templates yet — use "Save as template" from any flow you've built.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myTemplates.map((t) => (
                  <TemplateCard
                    key={t._id} template={t} isSystem={false}
                    onUse={() => onUseTemplate(t._id)}
                    onDelete={() => { if (window.confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t._id); }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

let nodeIdCounter = 1;
function nextNodeId() { return `n${Date.now()}_${nodeIdCounter++}`; }

function defaultNodeFor(type: FlowNodeType): FlowNode {
  const id = nextNodeId();
  switch (type) {
    case 'condition': return { id, type, conditions: [{ field: '', operator: '=' }] };
    case 'action':     return { id, type, actionType: 'send_email', recipientStrategy: 'record_contact' };
    case 'delay':      return { id, type, delayMinutes: 5 };
    case 'merge':      return { id, type };
    case 'subFlow':    return { id, type };
    case 'loop':       return { id, type, loopMaxItems: 50, loopBatchSize: 10, loopConcurrency: 1 };
    case 'approval':   return { id, type, approvalRecipientStrategy: 'manager' };
    default:           return { id, type: 'trigger', triggerType: 'record_created' };
  }
}

/* ── Flow-level "⋯" menu ──────────────────────────────────────────────────
 * Consolidates actions that used to be scattered between the hub's own
 * cards (Duplicate/Delete) and this builder's header (Save as
 * template/Discard draft) into one place, mirroring the per-node "⋯" menu
 * (NodeMoreMenu, flow-node-visuals.tsx). Only rendered for a saved flow
 * (!isNew) — a brand-new, never-saved flow has nothing yet to duplicate,
 * delete, template, or discard. */
function FlowMoreMenu({
  flow, onRename, onDuplicate, duplicating, onDelete, onSaveAsTemplate, saveAsTemplatePending, onDiscardDraft, discardPending,
}: {
  flow: AutomationFlow;
  onRename: () => void;
  onDuplicate: () => void; duplicating: boolean;
  onDelete: () => void;
  onSaveAsTemplate: () => void; saveAsTemplatePending: boolean;
  onDiscardDraft: () => void; discardPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // `Node` in this file's scope is React Flow's canvas-node type (imported
    // above for the editor's own nodes/edges state) — `globalThis.Node`
    // disambiguates back to the DOM type this outside-click check needs.
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted border border-border"
        title="More actions"
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-surface border border-border rounded-xl shadow-lg py-1">
          <button
            onClick={() => { setOpen(false); onRename(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <PencilIcon className="h-3.5 w-3.5 text-text-muted" /> Rename
          </button>
          <button
            onClick={() => { setOpen(false); onDuplicate(); }}
            disabled={duplicating}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
          >
            <DocumentDuplicateIcon className="h-3.5 w-3.5 text-text-muted" /> {duplicating ? 'Duplicating…' : 'Duplicate'}
          </button>
          <button
            onClick={() => { setOpen(false); onSaveAsTemplate(); }}
            disabled={saveAsTemplatePending || !!flow.draft}
            title={flow.draft ? "Publish your unpublished changes first — Save as Template only copies the last published version" : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
          >
            <BookmarkIcon className="h-3.5 w-3.5 text-text-muted" /> Save as template
          </button>
          {flow.draft && (
            <button
              onClick={() => { setOpen(false); onDiscardDraft(); }}
              disabled={discardPending}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
            >
              <TrashIcon className="h-3.5 w-3.5 text-text-muted" /> {discardPending ? 'Discarding…' : 'Discard draft'}
            </button>
          )}
          <div className="border-t border-border my-1" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Delete flow
          </button>
        </div>
      )}
    </div>
  );
}

function BuilderInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId') ?? undefined;
  // Set by CreateAutomationModal's trigger-first picker for a from-scratch
  // flow (mutually exclusive with templateId — the modal always navigates to
  // one or the other, never both). Pre-seeds the auto-added Trigger node
  // instead of leaving it at the bare record_created default.
  const prefillTriggerType = searchParams.get('triggerType') as FlowNode['triggerType'] | null;
  const prefillModule = (searchParams.get('module') ?? undefined) as AutomationModule | undefined;
  const isNew = id === 'new';
  const { data: flow, isLoading } = useAutomationFlowQuery(isNew ? undefined : id);
  const { data: template } = useAutomationTemplateQuery(isNew ? templateId : undefined);
  const createMut = useCreateAutomationFlow();
  const updateMut = useUpdateAutomationFlow();
  const publishMut = usePublishFlow();
  const discardMut = useDiscardDraft();
  const deleteMut = useDeleteAutomationFlow();
  const saveAsTemplateMut = useCreateAutomationTemplate();
  const { data: allFlowsRaw = [] } = useAutomationFlowsQuery();
  // Lifecycle polish — the builder previously had no visibility into either
  // of these while editing: whether THIS flow is enabled/disabled (only the
  // hub's cards exposed that toggle), and whether the tenant-wide kill
  // switch (a completely different, unrelated-looking "Paused" state) is
  // engaged, which would silently stop this flow from ever firing even
  // while it shows "Published."
  const { data: automationSettings } = useAutomationSettingsQuery();
  const tenantWidePaused = !!automationSettings?.automationsPaused;

  const [flowName, setFlowName] = useState('New Flow');
  const flowNameInputRef = useRef<HTMLInputElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const incompleteCount = useMemo(
    () => nodes.filter((n) => needsConfiguration((n.data as any).node as FlowNode)).length,
    [nodes],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  // Seeded from the URL (?openTest=1) rather than always starting false —
  // Test on a never-saved flow silently saves a draft first (see
  // handleTest below), which changes the URL from .../new to a real id and
  // forces BuilderInner to remount (the `key` prop on the default export's
  // ReactFlowProvider — see its own comment). That remount would otherwise
  // drop "the user just clicked Test" entirely, since local state doesn't
  // survive it; carrying the intent through the URL (same pattern already
  // used for ?tab=/?runId=) is what lets the modal actually open once the
  // new, saved instance mounts.
  const [showDryRun, setShowDryRun] = useState(() => searchParams.get('openTest') === '1');
  // Set when Dry Run is opened via a node drawer's "Test this step"
  // (plan item #7) rather than the header's own "Test" button — tells
  // DryRunModal which node's result to auto-select/scroll to once the run
  // completes. Cleared on close so a later plain "Test" doesn't inherit it.
  // Also seeded from the URL (?testNodeId=) for the same save-then-remount
  // reason as showDryRun above.
  const [dryRunFocusNodeId, setDryRunFocusNodeId] = useState<string | undefined>(() => searchParams.get('testNodeId') ?? undefined);
  // Editor / Executions / Templates — one Studio workspace instead of a
  // History drawer + a separate standalone Executions page + a Templates
  // popup (plan: "Unified n8n-style Automation Studio"). Initialized from
  // the URL so the backward-compatible redirect from the old standalone
  // Executions route (and any other deep link) can land directly on the
  // right tab.
  const [tab, setTab] = useState<'editor' | 'executions' | 'templates'>(
    searchParams.get('tab') === 'executions' ? 'executions' : searchParams.get('tab') === 'templates' ? 'templates' : 'editor',
  );
  const initialRunId = searchParams.get('runId') ?? undefined;
  const [overlayRunId, setOverlayRunId] = useState<string | undefined>(initialRunId);
  const { data: overlayRun } = useFlowRunQuery(overlayRunId);
  const runStatusMap = useMemo(() => {
    if (!overlayRun) return null;
    const map: Record<string, DiagramNodeStatus> = {};
    for (const s of overlayRun.steps) map[s.nodeId] = s.status;
    if (overlayRun.status === 'paused' && overlayRun.steps.length > 0) {
      map[overlayRun.steps[overlayRun.steps.length - 1].nodeId] = 'waiting';
    }
    return map;
  }, [overlayRun]);
  // `issues` is only set when the backend returned a FlowValidationError's
  // full accumulated list (more than one problem) — see
  // automation-flow.controller.ts's sendFlowError (backend). A single-issue
  // or non-validation error just carries `message`.
  const [error, setError] = useState<{ message: string; issues?: string[] } | null>(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Seed canvas state once: from a starter template (isNew + ?templateId=),
  // an existing flow's draft-or-live content, or a fresh single trigger node
  // for a brand-new flow with no template. `initialized` guards against
  // re-seeding on every background refetch (would wipe in-progress edits),
  // matching this codebase's own "load once, then own local state" pattern
  // for editors backed by a query. Seeding from a template is purely a
  // *local, unsaved* canvas fill — the tenant still explicitly Saves/
  // Publishes through the completely unmodified createFlow/publishFlow path
  // below, which re-validates the whole graph exactly as it would for any
  // hand-built flow.
  useEffect(() => {
    if (initialized) return;
    if (isNew) {
      if (templateId) {
        if (!template) return; // wait for the template to load
        setFlowName(template.name);
        setNodes(template.nodes.map((n, i) => ({
          id: n.id, type: n.type,
          position: { x: 250 + (i % 3) * 260, y: 60 + Math.floor(i / 3) * 180 },
          data: { node: n, label: NODE_META[n.type].label },
        })));
        setEdges(template.edges.map((e, i) => ({
          id: `e${i}_${e.from}_${e.to}_${e.fromPort ?? ''}`, source: e.from, target: e.to, sourceHandle: e.fromPort, animated: false,
          style: { stroke: edgeColorFor(e.fromPort) },
        })));
        setInitialized(true);
        return;
      }
      const trigger = defaultNodeFor('trigger');
      if (prefillTriggerType) trigger.triggerType = prefillTriggerType;
      if (prefillModule) trigger.module = prefillModule;
      setNodes([{ id: trigger.id, type: 'trigger', position: { x: 300, y: 60 }, data: { node: trigger, label: 'Trigger' } }]);
      setEdges([]);
      setInitialized(true);
      return;
    }
    if (!flow) return;
    const content = flow.draft ?? { nodes: flow.nodes, edges: flow.edges, canvasPositions: flow.canvasPositions };
    setFlowName(flow.name);
    setNodes(content.nodes.map((n, i) => ({
      id: n.id, type: n.type,
      position: content.canvasPositions?.[n.id] ?? { x: 250 + (i % 3) * 260, y: 60 + Math.floor(i / 3) * 180 },
      data: { node: n, label: NODE_META[n.type].label },
    })));
    setEdges(content.edges.map((e, i) => ({
      id: `e${i}_${e.from}_${e.to}_${e.fromPort ?? ''}`, source: e.from, target: e.to, sourceHandle: e.fromPort, animated: false,
      style: { stroke: edgeColorFor(e.fromPort) },
    })));
    setInitialized(true);
  }, [flow, isNew, initialized, setNodes, setEdges, template, templateId, prefillTriggerType, prefillModule]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const triggerFlowNode = useMemo(() => nodes.find((n) => n.type === 'trigger')?.data as any, [nodes]);
  const triggerModule: AutomationModule | '' = (triggerFlowNode?.node as FlowNode | undefined)?.module ?? '';
  const hasTrigger = nodes.some((n) => n.type === 'trigger');

  const onConnect = useCallback((c: Connection) => {
    const color = c.sourceHandle === 'false' || c.sourceHandle === 'failure' || c.sourceHandle === 'reject' ? '#ef4444'
      : c.sourceHandle === 'true' || c.sourceHandle === 'success' || c.sourceHandle === 'approve' ? '#10b981' : '#9ca3af';
    setEdges((eds) => addEdge({ ...c, style: { stroke: color } }, eds));
  }, [setEdges]);

  const addNode = (type: FlowNodeType) => {
    const fn = defaultNodeFor(type);
    // Staggers each new node below/right of the last one added, rather than
    // a random scatter that tends to overlap — still just a starting point,
    // the canvas is fully draggable afterward.
    setNodes((nds) => {
      const count = nds.length;
      return [...nds, { id: fn.id, type, position: { x: 260 + (count % 3) * 260, y: 260 + Math.floor(count / 3) * 200 }, data: { node: fn, label: NODE_META[type].label } }];
    });
  };

  const patchSelectedNode = (patch: Partial<FlowNode>) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, node: { ...(n.data as any).node, ...patch } } } : n)));
  };

  // Single buffered last-delete slot (not a general multi-level undo stack —
  // scoped narrowly so it's reliable, per the plan's own "only ship undo if
  // implemented reliably" principle) backing the "Undo" toast below.
  const lastDeletedRef = useRef<{ node: Node; edges: Edge[] } | null>(null);

  const duplicateNode = (nodeId: string) => {
    const source = nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const sourceFlowNode = (source.data as any).node as FlowNode;
    const newId = nextNodeId();
    const copy: Node = {
      id: newId, type: source.type,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      data: { node: { ...sourceFlowNode, id: newId }, label: (source.data as any).label },
    };
    setNodes((nds) => [...nds, copy]);
    setSelectedNodeId(newId);
    toast.success("Node duplicated — its connections weren't copied");
  };

  // Generalized so it's callable both from the drawer's own Delete button
  // (no id — defaults to whichever node the drawer has open) and from a
  // node's own "⋯" card menu (an explicit id, independent of selection).
  const deleteNode = (nodeId?: string) => {
    const targetId = nodeId ?? selectedNodeId;
    if (!targetId) return;
    const connectedEdges = edges.filter((e) => e.source === targetId || e.target === targetId);
    const doDelete = () => {
      const removedNode = nodes.find((n) => n.id === targetId);
      setNodes((nds) => nds.filter((n) => n.id !== targetId));
      setEdges((eds) => eds.filter((e) => e.source !== targetId && e.target !== targetId));
      if (selectedNodeId === targetId) setSelectedNodeId(undefined);
      if (removedNode) {
        lastDeletedRef.current = { node: removedNode, edges: connectedEdges };
        toast((t) => (
          <span className="flex items-center gap-3 text-sm">
            Node deleted
            <button
              onClick={() => {
                toast.dismiss(t.id);
                const restore = lastDeletedRef.current;
                if (!restore) return;
                setNodes((nds) => [...nds, restore.node]);
                setEdges((eds) => [...eds, ...restore.edges]);
                lastDeletedRef.current = null;
              }}
              className="font-semibold text-ryze-600 dark:text-ryze-400 hover:underline"
            >
              Undo
            </button>
          </span>
        ), { duration: 6000 });
      }
    };
    // A node with no connections is low-blast-radius — delete immediately,
    // same as today. One with connected edges gets a confirm first, since
    // removing it also silently removes those edges.
    if (connectedEdges.length > 0) {
      if (!window.confirm(`Delete this node and its ${connectedEdges.length} connection${connectedEdges.length === 1 ? '' : 's'}?`)) return;
    }
    doDelete();
  };

  const buildPayload = () => {
    const flowNodes: FlowNode[] = nodes.map((n) => (n.data as any).node as FlowNode);
    const flowEdges: FlowEdge[] = edges.map((e) => ({ from: e.source, to: e.target, fromPort: e.sourceHandle as any ?? undefined }));
    const canvasPositions = Object.fromEntries(nodes.map((n) => [n.id, n.position]));
    return { name: flowName.trim(), nodes: flowNodes, edges: flowEdges, canvasPositions };
  };

  // Unsaved-changes tracking — distinct from the existing "Draft —
  // unpublished changes" pill above, which is a SERVER-side fact (a draft
  // exists on the backend). This is a LOCAL-only fact: has anything changed
  // on this canvas since it was last loaded or last successfully saved. No
  // autosave exists anywhere in this builder, so this is the only thing
  // that can honestly answer "will I lose anything if I leave right now."
  const lastSavedPayloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialized) lastSavedPayloadRef.current = JSON.stringify(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);
  const isDirty = initialized && lastSavedPayloadRef.current !== null && JSON.stringify(buildPayload()) !== lastSavedPayloadRef.current;

  // Confirms before a genuinely destructive navigation (leaving this flow
  // entirely) only when there's something local to actually lose — tab
  // switches within the Studio never need this, since they don't unmount
  // the canvas state.
  const confirmIfDirty = (action: () => void, message = 'You have unsaved changes on this flow. Leave without saving?') => {
    if (isDirty && !window.confirm(message)) return;
    action();
  };

  // Native "leave site?" prompt for closing the tab / hard reload while
  // dirty — beforeunload can't show custom UI, so this is the browser's own
  // generic prompt, not a copy of confirmIfDirty's wording.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Most thrown structural-validation errors (assertValidFlowShape/
  // assertValidForkMergeShape/assertValidNodes, backend) embed the
  // offending node id right after the word "node" — but NOT with one
  // consistent casing/prefix: assertValidNodes uses `Node "${id}": ...`
  // (capitalized, colon), while assertValidFlowShape's own messages vary —
  // `Merge node "${id}" needs...`, `Condition node "${id}"'s...`,
  // `Edge references unknown node "${id}"`, `Cycle detected — node "${id}"
  // is reached...` (all lowercase "node", no colon). Every one of these
  // reliably quotes a real node id right after "node" though, so a single
  // case-insensitive match on `node "..."` (not anchored to "Node ":)
  // catches all of them, not just the assertValidNodes subset — extract it
  // and jump straight to that node instead of leaving the user to hunt for
  // it on the canvas. Still string-parsing-fragile by nature (a future
  // structured {nodeId, message} backend error shape would be more robust)
  // but a low-cost win in the meantime: on no match (e.g. "missing
  // trigger"/orphaned-node-list errors, which don't quote a single id),
  // this is a no-op and the banner still shows the raw message as before.
  const findNodeIdInMessage = (message: string): string | undefined => {
    const match = message.match(/node "([^"]+)"/i);
    return match && nodes.some((n) => n.id === match[1]) ? match[1] : undefined;
  };

  // `issues` is the rich, always-array shape — populated by both
  // validate.middleware.ts (a Zod-level rejection) and
  // automation-flow.controller.ts's sendFlowError (a FlowValidationError)
  // alike. `errors` is kept only as a last-resort fallback in case either
  // response ever omits `issues`.
  const extractIssues = (err: any): string[] | undefined => {
    const data = err?.response?.data;
    return data?.issues ?? (Array.isArray(data?.errors) ? data.errors : undefined);
  };

  // `issues`, when present, is the FULL accumulated list — from a
  // service-level FlowValidationError ("Cannot publish — N issues found")
  // or from validate.middleware.ts's own per-field Zod detail. With more
  // than one, `message` is just that count's summary line and the list
  // below it carries the real detail. With exactly one, there's no reason
  // to show the generic "Validation failed" wrapper AND the one real
  // issue separately — the issue's own text becomes the displayed message,
  // so a single-field rejection (the common case) reads as one specific,
  // actionable line instead of a dead-end banner.
  const setErrorAndHighlight = (message: string, issues?: string[]) => {
    const displayMessage = issues && issues.length === 1 ? issues[0] : message;
    setError({ message: displayMessage, issues: issues && issues.length > 1 ? issues : undefined });
    const firstId = issues?.length
      ? issues.map(findNodeIdInMessage).find((nid): nid is string => !!nid)
      : findNodeIdInMessage(displayMessage);
    if (firstId) { setSelectedNodeId(firstId); setTab('editor'); }
  };

  const highlightIssue = (issue: string) => {
    const nid = findNodeIdInMessage(issue);
    if (nid) { setSelectedNodeId(nid); setTab('editor'); }
  };

  // Returns whether the save actually succeeded — handlePublish needs this
  // to know whether it's safe to go on and call publishFlow next. Silently
  // swallowing a save failure used to let Publish try to promote a draft
  // that was never actually written, since `await handleSave()` alone
  // can't distinguish "saved" from "failed but didn't throw."
  const handleSave = async (opts?: { silent?: boolean; postSaveQuery?: string }): Promise<boolean> => {
    setError(null);
    if (!flowName.trim()) { setError({ message: 'Flow needs a name' }); return false; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const created = await createMut.mutateAsync(payload);
        navigate(`/native-crm/settings/automation-flows/${created._id}${opts?.postSaveQuery ?? ''}`, { replace: true });
      } else {
        await updateMut.mutateAsync({ id: id!, data: payload });
      }
      lastSavedPayloadRef.current = JSON.stringify(payload);
      if (!opts?.silent) toast.success('Draft saved');
      return true;
    } catch (err: any) {
      setErrorAndHighlight(err?.response?.data?.message ?? 'Failed to save', extractIssues(err));
      toast.error('Failed to save');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // One handler for both the header "Test" button and every node's "Test
  // this step" — matches n8n's "Execute step" being available even before
  // a workflow has ever been saved. The Dry Run endpoint only knows how to
  // run an already-persisted flow by its real id (automation-flow.service.
  // ts's dryRunFlow does its own DB lookup — it has no "run this ad-hoc
  // nodes/edges definition" mode), so on a never-saved flow this silently
  // saves a draft first, via the exact same handleSave already used by
  // "Save draft." The save triggers a real navigation (new -> a real id),
  // which remounts this component (see the `key` prop below) — the
  // showDryRun/dryRunFocusNodeId seeding above is what makes the modal
  // actually open once that fresh, now-saved instance mounts.
  const handleTest = (nodeId?: string) => {
    if (isNew) {
      const query = `?openTest=1${nodeId ? `&testNodeId=${nodeId}` : ''}`;
      handleSave({ silent: true, postSaveQuery: query }).then((saved) => {
        if (saved) toast.success('Saved as a draft so it can be tested');
      });
      return;
    }
    setDryRunFocusNodeId(nodeId);
    setShowDryRun(true);
  };

  const handlePublish = async () => {
    setError(null);
    setSaving(true);
    try {
      // A brand-new flow has nothing published yet — save (which creates it
      // live) instead of calling an endpoint that only promotes a draft.
      // Functionally equivalent to publishing (createFlow writes nodes/
      // edges directly, no draft stage), so the toast says so too.
      if (isNew) {
        const saved = await handleSave({ silent: true });
        if (saved) toast.success('Flow published');
        return;
      }
      const saved = await handleSave({ silent: true });
      if (!saved) return; // handleSave already surfaced the error — don't attempt to publish on top of a failed save
      await publishMut.mutateAsync(id!);
      toast.success('Flow published');
    } catch (err: any) {
      setErrorAndHighlight(err?.response?.data?.message ?? 'Failed to publish', extractIssues(err));
      toast.error('Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = () => {
    if (isNew || !flow) return;
    updateMut.mutate({ id: id!, data: { enabled: !flow.enabled } as any }, {
      onSuccess: () => toast.success(flow.enabled ? 'Flow disabled' : 'Flow enabled'),
      onError: () => toast.error('Failed to update'),
    });
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt('Save this flow as a reusable template. Name it:', flowName);
    if (!name?.trim()) return;
    setError(null);
    try {
      await saveAsTemplateMut.mutateAsync({ sourceFlowId: id!, name: name.trim() });
      toast.success('Saved as template');
    } catch (err: any) {
      setError({ message: err?.response?.data?.message ?? 'Failed to save as template' });
      toast.error('Failed to save as template');
    }
  };

  const [duplicatingFlow, setDuplicatingFlow] = useState(false);
  const handleDuplicateFlow = async () => {
    if (!flow) return;
    setDuplicatingFlow(true);
    try {
      const full = await fetchFlowForDuplicate(flow._id);
      if (!full) return;
      const created = await createMut.mutateAsync({
        name: `Copy of ${full.name}`, nodes: full.nodes, edges: full.edges, canvasPositions: full.canvasPositions,
      });
      // Duplicate always copies the last SAVED version from the server —
      // never the local canvas — so an unsaved in-progress edit here is
      // easy to misread as "included." Say so explicitly rather than let
      // it be assumed.
      if (isDirty) toast("Duplicated the last saved version — your current unsaved edits aren't included");
      navigate(`/native-crm/settings/automation-flows/${created._id}`);
    } finally {
      setDuplicatingFlow(false);
    }
  };

  const handleDeleteFlow = () => {
    if (!flow) return;
    if (!window.confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    deleteMut.mutate(flow._id, {
      onSuccess: () => { toast.success('Flow deleted'); navigate('/native-crm/settings/automation-flows'); },
      onError: () => toast.error('Failed to delete'),
    });
  };

  // Templates tab's "Use this template" — per the plan, this must never
  // silently discard in-progress work. Always opens a genuinely separate new
  // flow (never mutates the one currently open — BuilderInner is remounted
  // via its `key`, see the default export below, so this is always a true
  // fresh seed, not a same-instance state mutation). Only confirms first
  // when there's actually something local that would be left behind — a
  // still-empty new flow is never dirty, so this is a silent, instant
  // navigation for the common "pick a template to start" case.
  const handleUseTemplate = (templateId: string) => {
    confirmIfDirty(
      () => navigate(`/native-crm/settings/automation-flows/new?templateId=${templateId}`),
      `You have unsaved changes on "${flowName}". Using a template opens a new flow and won't affect this one — but your unsaved edits here aren't saved anywhere yet. Continue?`,
    );
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-3 text-sm text-text-muted">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
        Loading flow…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface border-b border-border px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => confirmIfDirty(() => navigate('/native-crm/settings/automation-flows'))}
          className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted shrink-0"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <input ref={flowNameInputRef} value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Flow name"
          className="text-sm font-semibold text-text-primary bg-transparent border-none focus:ring-2 focus:ring-ryze-300 rounded-lg px-2 py-1 min-w-0 flex-1 max-w-xs" />
        {!isNew && flow?.draft && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">Draft — unpublished changes</span>}
        {!isNew && !flow?.draft && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">Published v{flow?.version ?? 1}</span>}
        {isDirty && (
          <span title="Local edits on this canvas haven't been saved yet — no autosave, use Save draft" className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Unsaved changes
          </span>
        )}
        {!isNew && flow && (
          <button
            onClick={handleToggleEnabled}
            title={flow.enabled ? 'Click to disable this flow' : 'Click to enable this flow'}
            className={`text-[10px] font-medium px-2 py-1 rounded-full shrink-0 transition-colors ${flow.enabled ? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted hover:bg-black/[0.08] dark:hover:bg-white/[0.1]' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:opacity-80'}`}
          >
            {flow.enabled ? 'Enabled' : 'Disabled'}
          </button>
        )}

        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 shrink-0">
          <button onClick={() => handleTest()} disabled={!triggerModule} title={isNew ? 'Saves a draft, then tests it' : undefined} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40">
            <BeakerIcon className="h-3.5 w-3.5" /> Test
          </button>
          <button onClick={() => handleSave()} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-primary border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40">
            Save draft
          </button>
          <button onClick={handlePublish} disabled={saving || !hasTrigger} className="flex items-center gap-1.5 px-4 py-2 bg-ryze-600 text-white text-xs font-medium rounded-lg hover:bg-ryze-700 disabled:opacity-40">
            <PlayIcon className="h-3.5 w-3.5" /> Publish
          </button>
          {!isNew && flow && (
            <FlowMoreMenu
              flow={flow}
              onRename={() => { flowNameInputRef.current?.focus(); flowNameInputRef.current?.select(); }}
              onDuplicate={handleDuplicateFlow} duplicating={duplicatingFlow}
              onDelete={handleDeleteFlow}
              onSaveAsTemplate={handleSaveAsTemplate} saveAsTemplatePending={saveAsTemplateMut.isPending}
              onDiscardDraft={() => {
                if (!window.confirm("Discard your unpublished changes? This can't be undone — the published version stays live.")) return;
                discardMut.mutate(id!, {
                  onSuccess: () => toast.success('Draft discarded'),
                  onError: () => toast.error('Failed to discard draft'),
                });
              }}
              discardPending={discardMut.isPending}
            />
          )}
        </div>
      </div>

      {/* Editor / Executions / Templates — one Studio workspace. Executions
          needs a saved flow to have any runs; Templates is available from
          any flow (new or existing), per the plan. */}
      <div className="bg-surface border-b border-border px-4 flex items-center gap-1 shrink-0">
        <button
          onClick={() => setTab('editor')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === 'editor' ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Editor
        </button>
        {!isNew && (
          <button
            onClick={() => setTab('executions')}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === 'executions' ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'}`}
          >
            Executions
          </button>
        )}
        <button
          onClick={() => setTab('templates')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === 'templates' ? 'border-ryze-600 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Templates
        </button>
      </div>

      {tenantWidePaused && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-700 flex items-center gap-1.5">
          <PauseCircleIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">ALL AUTOMATIONS PAUSED tenant-wide</span> — this flow won't run until the kill switch is resumed from the automations hub, regardless of its own Published/Enabled state here.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-600">
          <p className="font-medium">{error.message}</p>
          {error.issues && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {error.issues.map((issue, i) => (
                <li key={i} className={findNodeIdInMessage(issue) ? 'cursor-pointer hover:underline' : ''} onClick={() => highlightIssue(issue)}>
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === 'editor' && incompleteCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-700 flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {incompleteCount} step{incompleteCount === 1 ? '' : 's'} look unconfigured — review before publishing (look for the amber dot on a node).
        </div>
      )}

      {tab === 'editor' && (
        <div className="flex-1 flex min-h-0 relative">
          <div className="w-52 shrink-0 bg-surface border-r border-border p-3 space-y-1.5 overflow-y-auto">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2 px-1">Add node</p>
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)}
                placeholder="Search nodes…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-ryze-300"
              />
            </div>
            {(() => {
              const query = paletteSearch.trim().toLowerCase();
              const renderButton = (t: FlowNodeType) => {
                const meta = NODE_META[t];
                const Icon = meta.icon;
                return (
                  <button key={t} onClick={() => addNode(t)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-lg border ${meta.ring} ${meta.bg} ${meta.color} hover:opacity-80`}>
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                  </button>
                );
              };
              if (query) {
                // Flat filtered list while searching — simpler than trying to
                // preserve empty-group headers for a partial match.
                const matches = NODE_PALETTE_GROUPS.flatMap((g) => g.types).filter((t) => NODE_META[t].label.toLowerCase().includes(query));
                return matches.length > 0
                  ? <div className="space-y-1.5">{matches.map(renderButton)}</div>
                  : <p className="text-[11px] text-text-muted px-1">No matching nodes</p>;
              }
              return NODE_PALETTE_GROUPS.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 px-1">{group.label}</p>
                  <div className="space-y-1.5">{group.types.map(renderButton)}</div>
                </div>
              ));
            })()}
          </div>

          <div className="flex-1 min-w-0">
            <RunOverlayContext.Provider value={runStatusMap}>
              <NodeActionsContext.Provider value={{
                onDuplicate: duplicateNode,
                onDelete: deleteNode,
                onTest: handleTest,
              }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={NODE_TYPES}
                  onNodeClick={(_e, n) => setSelectedNodeId(n.id)}
                  onPaneClick={() => setSelectedNodeId(undefined)}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap pannable zoomable />
                </ReactFlow>
              </NodeActionsContext.Provider>
            </RunOverlayContext.Provider>
          </div>

          {selectedNode && (
            <NodeConfigPanel
              node={(selectedNode.data as any).node}
              onChange={patchSelectedNode}
              onDelete={() => deleteNode()}
              onClose={() => setSelectedNodeId(undefined)}
              triggerModule={triggerModule}
              flowIdForSubFlowExclusion={isNew ? undefined : id}
              allFlows={allFlowsRaw}
              runStep={overlayRun?.steps.find((s) => s.nodeId === selectedNode.id)}
              onRunTest={handleTest}
            />
          )}
        </div>
      )}

      {tab === 'executions' && !isNew && (
        <FlowExecutionsPanel flowId={id!} flow={flow} initialRunId={initialRunId} onSelectRun={setOverlayRunId} />
      )}

      {tab === 'templates' && (
        <FlowTemplatesPanel onUseTemplate={handleUseTemplate} />
      )}

      {showDryRun && !isNew && (
        <DryRunModal
          flowId={id!} triggerModule={triggerModule} flow={flow} focusNodeId={dryRunFocusNodeId}
          onClose={() => { setShowDryRun(false); setDryRunFocusNodeId(undefined); }}
        />
      )}
    </div>
  );
}

export default function AutomationFlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // BuilderInner owns a whole lifetime of local canvas state (nodes, edges,
  // isDirty, undo buffer, tab). Navigating from inside it to a DIFFERENT
  // flow — e.g. the Templates tab's "Use this template" always opening a
  // separate new flow, or "Duplicate" landing on the new copy — changes the
  // URL but resolves to this same route element, so React wouldn't
  // otherwise remount it; stale local state (including, critically, which
  // flow it's about to save over) would carry over. Keying on the id (and
  // templateId, for new→new transitions where id stays 'new') forces a
  // clean remount whenever the identity of "which flow is open" changes.
  const key = `${id}:${searchParams.get('templateId') ?? ''}`;
  return (
    <ReactFlowProvider key={key}>
      <BuilderInner />
    </ReactFlowProvider>
  );
}
