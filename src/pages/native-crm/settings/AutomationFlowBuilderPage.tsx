import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeProps, type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BoltIcon, TrashIcon, XMarkIcon, ArrowLeftIcon, PlayIcon, ClockIcon,
  ArrowPathIcon, FunnelIcon, PaperAirplaneIcon, Squares2X2Icon, ArrowsPointingOutIcon,
  UserGroupIcon, BeakerIcon, RectangleStackIcon, CheckCircleIcon, ExclamationTriangleIcon,
  MagnifyingGlassIcon, BookmarkIcon,
} from '@heroicons/react/24/outline';
import {
  useAutomationFlowQuery, useAutomationFlowsQuery, useCreateAutomationFlow, useUpdateAutomationFlow,
  usePublishFlow, useDiscardDraft, useDryRunFlow, useFlowRunsQuery, useFlowRunQuery, useDecideApproval,
  type FlowNode, type FlowEdge, type FlowNodeType, type FlowRecipientStrategy,
} from '../../../modules/native-crm/queries/automation-flows.queries';
import {
  useFieldCatalogQuery, useMessageTemplatesQuery,
  type AutomationModule, type FlowCondition,
} from '../../../modules/native-crm/queries/automation-rules.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useEveryModule, useStageCapableModules, CONDITION_OPERATORS } from './AutomationRulesPage';
import ActionNodeConfig from './ActionNodeConfig';
import BranchScopePicker from './BranchScopePicker';
import { useAutomationTemplateQuery, useCreateAutomationTemplate } from '../../../modules/native-crm/queries/automation-templates.queries';

/* ── Visual metadata per node type ────────────────────────────────────── */

const NODE_META: Record<FlowNodeType, { label: string; color: string; ring: string; bg: string; icon: typeof BoltIcon }> = {
  trigger:   { label: 'Trigger',   color: 'text-emerald-700', ring: 'border-emerald-300', bg: 'bg-emerald-50', icon: BoltIcon },
  condition: { label: 'Condition', color: 'text-blue-700',    ring: 'border-blue-300',    bg: 'bg-blue-50',    icon: FunnelIcon },
  action:    { label: 'Action',    color: 'text-purple-700',  ring: 'border-purple-300',  bg: 'bg-purple-50',  icon: PaperAirplaneIcon },
  delay:     { label: 'Delay',     color: 'text-amber-700',   ring: 'border-amber-300',   bg: 'bg-amber-50',   icon: ClockIcon },
  merge:     { label: 'Merge',     color: 'text-gray-700',    ring: 'border-gray-300',    bg: 'bg-gray-50',    icon: Squares2X2Icon },
  subFlow:   { label: 'Sub-Flow',  color: 'text-indigo-700',  ring: 'border-indigo-300',  bg: 'bg-indigo-50',  icon: ArrowPathIcon },
  loop:      { label: 'Loop',      color: 'text-pink-700',    ring: 'border-pink-300',    bg: 'bg-pink-50',    icon: ArrowsPointingOutIcon },
  approval:  { label: 'Approval',  color: 'text-teal-700',    ring: 'border-teal-300',    bg: 'bg-teal-50',    icon: UserGroupIcon },
};

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

/** Shared by both the existing-flow init path and the template-seeding
 * init path (Phase 4) — was previously inlined once, now factored out
 * rather than duplicated a second time. */
function edgeColorFor(fromPort: string | undefined): string {
  if (fromPort === 'false' || fromPort === 'failure' || fromPort === 'reject') return '#ef4444';
  if (fromPort === 'true' || fromPort === 'success' || fromPort === 'approve') return '#10b981';
  return '#9ca3af';
}

function describeNode(node: FlowNode): string {
  if (node.type === 'trigger') return `${node.module ?? '—'} · ${node.triggerType ?? 'record_created'}`;
  if (node.type === 'condition') return (node.conditions ?? []).map((c) => `${c.field} ${c.operator} ${c.value ?? ''}`).join(' AND ') || 'No conditions set';
  if (node.type === 'action') {
    if (node.actionType === 'create_linked_record') return `Create ${node.targetModule ?? '—'} record`;
    if (node.actionType === 'update_record') return 'Update this record';
    if (node.actionType === 'assign_record') return 'Assign this record';
    if (node.actionType === 'change_status') return 'Change status';
    if (node.actionType === 'add_note') return node.noteSubject ? `Note: ${node.noteSubject}` : 'Add a note';
    if (node.actionType === 'webhook_call') return node.webhookUrl ? `${node.webhookMethod ?? 'POST'} ${node.webhookUrl}` : 'No URL set';
    if (node.actionType === 'send_whatsapp') return 'Send WhatsApp';
    if (node.actionType === 'send_sms') return 'Send SMS';
    return 'Send Email';
  }
  if (node.type === 'delay') return `${node.delayMinutes ?? 0} minute(s)`;
  if (node.type === 'subFlow') return node.targetFlowId ? 'Invokes another flow' : 'No target set';
  if (node.type === 'loop') return `Iterate ${node.loopSourceModule ?? '—'}`;
  if (node.type === 'approval') return `Notify: ${RECIPIENT_LABELS[node.approvalRecipientStrategy ?? 'manager']}`;
  return '';
}

/** True for an action node that's missing config a tenant almost certainly
 * needs to fill in before this flow is useful. Two different cases, not
 * both backend-enforced: a send_* node with no templateId WILL fail the
 * existing save-time Zod check (templateId is required there) — but an
 * assign_record node with an empty target is a template scaffold's
 * deliberately-left-blank staff picker (assign_record/staticValue is
 * optional in that same Zod schema, so the backend happily saves it empty).
 * This indicator flags both alike as "worth reviewing," not as "the save
 * will be blocked" — the banner/tooltip copy is worded to match. */
function needsConfiguration(node: FlowNode): boolean {
  if (node.type !== 'action') return false;
  if (node.actionType === 'send_email' || node.actionType === 'send_sms' || node.actionType === 'send_whatsapp') {
    return !node.templateId;
  }
  if (node.actionType === 'assign_record') {
    const mapping = node.fieldMappings?.[0];
    if (!mapping) return true;
    if (mapping.sourceType === 'static') return !mapping.staticValue;
    return !mapping.sourceField;
  }
  return false;
}

/* ── Custom node renderer — one component for all 8 types ────────────── */

function FlowNodeCard({ data, selected }: NodeProps) {
  const node = (data as any).node as FlowNode;
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const incomplete = needsConfiguration(node);

  return (
    <div className={`relative rounded-xl border-2 ${selected ? 'border-brand-500 shadow-lg' : meta.ring} ${meta.bg} px-3 py-2.5 min-w-[190px] max-w-[240px]`}>
      {incomplete && (
        <span
          title="Looks unconfigured — review before publishing"
          className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white"
        />
      )}
      {node.type !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2.5 !h-2.5" />}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
      </div>
      <p className="text-xs text-gray-800 font-medium truncate">{(data as any).label as string}</p>
      <p className="text-[11px] text-gray-500 truncate mt-0.5">{describeNode(node)}</p>

      {node.type === 'condition' && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
            <span>True</span><span>False</span>
          </div>
        </>
      )}
      {node.type === 'action' && (
        <>
          <Handle type="source" position={Position.Bottom} id="success" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="failure" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
            <span>Success</span><span>Failure</span>
          </div>
        </>
      )}
      {node.type === 'approval' && (
        <>
          <Handle type="source" position={Position.Bottom} id="approve" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="reject" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
            <span>Approve</span><span>Reject</span>
          </div>
        </>
      )}
      {(node.type === 'trigger' || node.type === 'delay' || node.type === 'merge' || node.type === 'subFlow' || node.type === 'loop') && (
        <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2.5 !h-2.5" />
      )}
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  trigger: FlowNodeCard, condition: FlowNodeCard, action: FlowNodeCard, delay: FlowNodeCard,
  merge: FlowNodeCard, subFlow: FlowNodeCard, loop: FlowNodeCard, approval: FlowNodeCard,
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
          <select value={c.field} onChange={(e) => patch(i, { field: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
            <option value="">Field…</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={c.operator} onChange={(e) => patch(i, { operator: e.target.value as any })} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
            {CONDITION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {c.operator !== 'is_empty' && c.operator !== 'is_not_empty' && (
            <input value={c.value ?? ''} onChange={(e) => patch(i, { value: e.target.value })} placeholder="Value"
              className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
          )}
          {c.operator === 'between' && (
            <input value={c.value2 ?? ''} onChange={(e) => patch(i, { value2: e.target.value })} placeholder="and…"
              className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
          )}
          <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><TrashIcon className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={add} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">+ Add condition</button>
    </div>
  );
}

/* ── Node config side panel ───────────────────────────────────────────── */

function NodeConfigPanel({
  node, onChange, onDelete, onClose, triggerModule, flowIdForSubFlowExclusion, allFlows,
}: {
  node: FlowNode;
  onChange: (patch: Partial<FlowNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  triggerModule: AutomationModule | '';
  flowIdForSubFlowExclusion?: string;
  allFlows: { _id: string; name: string }[];
}) {
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

  return (
    <div className="w-96 shrink-0 bg-white border-l border-gray-200 h-full overflow-y-auto flex flex-col">
      <div className={`px-4 py-3.5 border-b border-gray-100 flex items-center gap-2.5 ${meta.bg}`}>
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label} node</span>
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-white/60 text-gray-500"><XMarkIcon className="h-4 w-4" /></button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {node.type === 'trigger' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Fires when</label>
              <select value={node.triggerType ?? 'record_created'} onChange={(e) => onChange({ triggerType: e.target.value as any, triggerStage: '', triggerField: '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
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
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Module</label>
                <select value={node.module ?? ''} onChange={(e) => onChange({ module: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value="">Select…</option>
                  {(node.triggerType === 'status_changed' ? STAGE_CAPABLE : EVERY_MODULE).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
            )}
            {node.triggerType === 'status_changed' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Stage</label>
                <select value={node.triggerStage ?? ''} onChange={(e) => onChange({ triggerStage: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value="">Select stage…</option>
                  {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            )}
            {node.triggerType === 'record_updated' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Watch field</label>
                <select value={node.triggerField ?? ''} onChange={(e) => onChange({ triggerField: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value="">Select field…</option>
                  {triggerFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            )}
            {node.triggerType === 'scheduled' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Watch which records</label>
                  <select value={node.scheduleModule ?? ''} onChange={(e) => onChange({ scheduleModule: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option value="">Select module…</option>
                    {EVERY_MODULE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Check every</label>
                  <select value={node.scheduleCron ?? '*/15 * * * *'} onChange={(e) => onChange({ scheduleCron: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                    <option value="*/15 * * * *">15 minutes</option>
                    <option value="0 * * * *">Hour</option>
                    <option value="0 */6 * * *">6 hours</option>
                    <option value="0 0 * * *">Day (midnight)</option>
                  </select>
                </div>
              </>
            )}
            {node.triggerType === 'webhook' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">All of these must match</label>
            <ConditionsEditor conditions={node.conditions ?? []} onChange={(c) => onChange({ conditions: c })} fields={triggerFields} />
          </div>
        )}

        {node.type === 'action' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Action</label>
              <select value={node.actionType ?? 'send_email'} onChange={(e) => onChange({ actionType: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Retry on failure</label>
              <div className="flex gap-2">
                <select value={node.retryCount ?? 0} onChange={(e) => onChange({ retryCount: Number(e.target.value) as any })} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option value={0}>No retry</option>
                  <option value={1}>1 retry</option>
                  <option value={2}>2 retries</option>
                  <option value={3}>3 retries</option>
                </select>
                {(node.retryCount ?? 0) > 0 && (
                  <select value={node.retryBackoffMs ?? 5000} onChange={(e) => onChange({ retryBackoffMs: Number(e.target.value) as any })} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Pause for (minutes)</label>
            <input type="number" min={1} max={129600} value={node.delayMinutes ?? 5} onChange={(e) => onChange({ delayMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            <p className="text-[11px] text-gray-400 mt-1">Up to 129,600 minutes (90 days).</p>
          </div>
        )}

        {node.type === 'merge' && (
          <p className="text-xs text-gray-500">Merge nodes have no settings — they simply wait for every incoming branch to arrive before continuing.</p>
        )}

        {node.type === 'subFlow' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Flow to invoke</label>
            <select value={node.targetFlowId ?? ''} onChange={(e) => onChange({ targetFlowId: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">Select flow…</option>
              {allFlows.filter((f) => f._id !== flowIdForSubFlowExclusion).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">The target flow can't itself contain a Sub-Flow, Loop, Delay, or Approval node.</p>
          </div>
        )}

        {node.type === 'loop' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Iterate over</label>
              <select value={node.loopSourceModule ?? ''} onChange={(e) => onChange({ loopSourceModule: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="">Select module…</option>
                <option value="customer">Customers</option>
                {EVERY_MODULE.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Only matching (optional)</label>
              <ConditionsEditor conditions={node.loopFilter ?? []} onChange={(c) => onChange({ loopFilter: c })} fields={loopFields} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Flow to run per item</label>
              <select value={node.loopSubFlowId ?? ''} onChange={(e) => onChange({ loopSubFlowId: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="">Select flow…</option>
                {allFlows.filter((f) => f._id !== flowIdForSubFlowExclusion).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1 uppercase">Max items</label>
                <input type="number" min={1} max={2000} value={node.loopMaxItems ?? 50} onChange={(e) => onChange({ loopMaxItems: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1 uppercase">Batch size</label>
                <input type="number" min={1} value={node.loopBatchSize ?? 10} onChange={(e) => onChange({ loopBatchSize: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1 uppercase">Concurrency</label>
                <input type="number" min={1} value={node.loopConcurrency ?? 1} onChange={(e) => onChange({ loopConcurrency: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
              </div>
            </div>
          </>
        )}

        {node.type === 'approval' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notify</label>
            <select value={node.approvalRecipientStrategy ?? 'manager'} onChange={(e) => onChange({ approvalRecipientStrategy: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Both the Approve and Reject paths below must be connected.</p>
          </div>
        )}
      </div>

      {node.type !== 'trigger' && (
        <div className="p-4 border-t border-gray-100">
          <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <TrashIcon className="h-3.5 w-3.5" /> Delete node
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Dry-run modal ─────────────────────────────────────────────────────── */

function DryRunModal({ flowId, triggerModule, onClose }: { flowId: string; triggerModule: AutomationModule | ''; onClose: () => void }) {
  const [sampleRecordId, setSampleRecordId] = useState('');
  const dryRunMut = useDryRunFlow();

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><BeakerIcon className="h-5 w-5 text-brand-600" /> Test this flow</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Simulates every node against one real {triggerModule || 'record'} — nothing is sent, created, or saved.</p>
          <div className="flex gap-2 mb-4">
            <input value={sampleRecordId} onChange={(e) => setSampleRecordId(e.target.value)} placeholder={`${triggerModule || 'Record'} ID (from its list/detail page)`}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            <button
              disabled={!sampleRecordId.trim() || !triggerModule || dryRunMut.isPending}
              onClick={() => dryRunMut.mutate({ id: flowId, sampleModule: triggerModule, sampleRecordId: sampleRecordId.trim() })}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40"
            >
              {dryRunMut.isPending ? 'Running…' : 'Run'}
            </button>
          </div>

          {dryRunMut.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5">{(dryRunMut.error as any)?.response?.data?.message ?? 'Dry-run failed'}</p>
          )}

          {dryRunMut.data && (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400">{dryRunMut.data.usingDraft ? 'Simulated against your unpublished draft.' : 'Simulated against the live published flow.'}</p>
              {dryRunMut.data.steps.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">{s.nodeType} · {s.label}</p>
                  <p className="text-xs text-gray-700 mt-0.5">{s.result}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Execution history panel ──────────────────────────────────────────── */

function RunStepRow({ step }: { step: any }) {
  const ok = step.status === 'success';
  // These fields existed on every IFlowRunStep already (Parallel+Merge,
  // Sub-Flow, Loop) but were silently dropped by this row before Phase 5 —
  // additive rendering only, no backend change.
  const hasCreatedRecord = !!step.createdRecordModule && !!step.createdRecordId;
  const hasMeta = step.forkId !== undefined || step.branchIndex !== undefined
    || step.loopIterationIndex !== undefined || step.subFlowNodeId !== undefined;
  return (
    <div className="flex items-start gap-2 py-1.5">
      {ok ? <CheckCircleIcon className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <ExclamationTriangleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
      <div className="min-w-0">
        <p className="text-xs text-gray-700"><span className="font-medium">{step.label}</span>{step.attempt ? ` (attempt ${step.attempt})` : ''}</p>
        {hasCreatedRecord ? (
          <p className="text-[11px] text-gray-500">Created {step.createdRecordModule}: {step.createdRecordId}</p>
        ) : step.result && <p className="text-[11px] text-gray-500">{step.result}</p>}
        {step.error && <p className="text-[11px] text-red-500">{step.error}</p>}
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {step.forkId !== undefined && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[9px] font-medium">Fork: {step.forkId}</span>}
            {step.branchIndex !== undefined && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[9px] font-medium">Branch {step.branchIndex}</span>}
            {step.loopIterationIndex !== undefined && <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 text-[9px] font-medium">Loop item {step.loopIterationIndex}</span>}
            {step.subFlowNodeId !== undefined && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-medium">via Sub-Flow</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPanel({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const { data: runs = [], isLoading } = useFlowRunsQuery(flowId);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const { data: run } = useFlowRunQuery(selectedRunId);
  const decideMut = useDecideApproval();

  const STATUS_COLOR: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700', partial: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700', running: 'bg-blue-100 text-blue-700', paused: 'bg-orange-100 text-orange-700',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex">
        <div className="w-72 border-r border-gray-100 flex flex-col">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <RectangleStackIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">Execution history</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-gray-400 p-4">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-xs text-gray-400 p-4">No runs yet.</p>
            ) : runs.map((r) => (
              <button key={r._id} onClick={() => setSelectedRunId(r._id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${selectedRunId === r._id ? 'bg-brand-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                  {r.flowVersion && <span className="text-[10px] text-gray-400">v{r.flowVersion}</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{new Date(r.startedAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{run ? `Run detail` : 'Select a run'}</span>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {run && (
              <>
                {run.status === 'paused' && (run as any).pauseState?.kind === 'approval' && (
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => decideMut.mutate({ runId: run._id, decision: 'approve' })}
                      className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">Approve</button>
                    <button onClick={() => decideMut.mutate({ runId: run._id, decision: 'reject' })}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">Reject</button>
                  </div>
                )}
                {run.steps.map((s, i) => <RunStepRow key={i} step={s} />)}
              </>
            )}
          </div>
        </div>
      </div>
    </>
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

function BuilderInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId') ?? undefined;
  const isNew = id === 'new';
  const { data: flow, isLoading } = useAutomationFlowQuery(isNew ? undefined : id);
  const { data: template } = useAutomationTemplateQuery(isNew ? templateId : undefined);
  const createMut = useCreateAutomationFlow();
  const updateMut = useUpdateAutomationFlow();
  const publishMut = usePublishFlow();
  const discardMut = useDiscardDraft();
  const saveAsTemplateMut = useCreateAutomationTemplate();
  const { data: allFlowsRaw = [] } = useAutomationFlowsQuery();

  const [flowName, setFlowName] = useState('New Flow');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const incompleteCount = useMemo(
    () => nodes.filter((n) => needsConfiguration((n.data as any).node as FlowNode)).length,
    [nodes],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showDryRun, setShowDryRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
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
  }, [flow, isNew, initialized, setNodes, setEdges, template, templateId]);

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

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(undefined);
  };

  const buildPayload = () => {
    const flowNodes: FlowNode[] = nodes.map((n) => (n.data as any).node as FlowNode);
    const flowEdges: FlowEdge[] = edges.map((e) => ({ from: e.source, to: e.target, fromPort: e.sourceHandle as any ?? undefined }));
    const canvasPositions = Object.fromEntries(nodes.map((n) => [n.id, n.position]));
    return { name: flowName.trim(), nodes: flowNodes, edges: flowEdges, canvasPositions };
  };

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
  const setErrorAndHighlight = (message: string) => {
    setError(message);
    const match = message.match(/node "([^"]+)"/i);
    if (match && nodes.some((n) => n.id === match[1])) {
      setSelectedNodeId(match[1]);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!flowName.trim()) { setError('Flow needs a name'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const created = await createMut.mutateAsync(payload);
        navigate(`/native-crm/settings/automation-flows/${created._id}`, { replace: true });
      } else {
        await updateMut.mutateAsync({ id: id!, data: payload });
      }
    } catch (err: any) {
      setErrorAndHighlight(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setError('');
    setSaving(true);
    try {
      // A brand-new flow has nothing published yet — save (which creates it
      // live) instead of calling an endpoint that only promotes a draft.
      if (isNew) { await handleSave(); return; }
      await handleSave();
      await publishMut.mutateAsync(id!);
    } catch (err: any) {
      setErrorAndHighlight(err?.response?.data?.message ?? 'Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt('Save this flow as a reusable template. Name it:', flowName);
    if (!name?.trim()) return;
    setError('');
    try {
      await saveAsTemplateMut.mutateAsync({ sourceFlowId: id!, name: name.trim() });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save as template');
    }
  };

  if (!isNew && isLoading) {
    return <div className="flex justify-center items-center h-full text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/native-crm/settings/automation-flows')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0">
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Flow name"
          className="text-sm font-semibold text-gray-900 border-none focus:ring-2 focus:ring-brand-300 rounded-lg px-2 py-1 min-w-0 flex-1 max-w-xs" />
        {!isNew && flow?.draft && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">Unpublished changes</span>}
        {!isNew && !flow?.draft && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">Published v{flow?.version ?? 1}</span>}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!isNew && (
            <>
              <button onClick={() => setShowHistory(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                <RectangleStackIcon className="h-3.5 w-3.5" /> History
              </button>
              <button onClick={() => setShowDryRun(true)} disabled={!triggerModule} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                <BeakerIcon className="h-3.5 w-3.5" /> Test
              </button>
              {flow?.draft && (
                <button onClick={() => discardMut.mutate(id!)} className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-600">
                  Discard draft
                </button>
              )}
              <button
                onClick={handleSaveAsTemplate}
                disabled={saveAsTemplateMut.isPending || !!flow?.draft}
                title={flow?.draft ? 'Publish your unpublished changes first — Save as Template only copies the last published version' : undefined}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                <BookmarkIcon className="h-3.5 w-3.5" /> Save as template
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Save draft
          </button>
          <button onClick={handlePublish} disabled={saving || !hasTrigger} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40">
            <PlayIcon className="h-3.5 w-3.5" /> Publish
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs text-red-600">{error}</div>}
      {incompleteCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-700 flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {incompleteCount} step{incompleteCount === 1 ? '' : 's'} look unconfigured — review before publishing (look for the amber dot on a node).
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-52 shrink-0 bg-white border-r border-gray-200 p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Add node</p>
          <div className="relative mb-2">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="Search nodes…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-300"
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
                : <p className="text-[11px] text-gray-400 px-1">No matching nodes</p>;
            }
            return NODE_PALETTE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{group.label}</p>
                <div className="space-y-1.5">{group.types.map(renderButton)}</div>
              </div>
            ));
          })()}
        </div>

        <div className="flex-1 min-w-0">
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
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={(selectedNode.data as any).node}
            onChange={patchSelectedNode}
            onDelete={deleteSelectedNode}
            onClose={() => setSelectedNodeId(undefined)}
            triggerModule={triggerModule}
            flowIdForSubFlowExclusion={isNew ? undefined : id}
            allFlows={allFlowsRaw}
          />
        )}
      </div>

      {showDryRun && !isNew && <DryRunModal flowId={id!} triggerModule={triggerModule} onClose={() => setShowDryRun(false)} />}
      {showHistory && !isNew && <HistoryPanel flowId={id!} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

export default function AutomationFlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}
