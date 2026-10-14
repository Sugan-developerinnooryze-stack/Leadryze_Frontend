import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Handle, NodeToolbar, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import {
  BoltIcon, ClockIcon, ArrowPathIcon, FunnelIcon, PaperAirplaneIcon,
  Squares2X2Icon, ArrowsPointingOutIcon, UserGroupIcon,
  EllipsisHorizontalIcon, DocumentDuplicateIcon, TrashIcon, BeakerIcon, PowerIcon,
} from '@heroicons/react/24/outline';
import { type FlowNode, type FlowNodeType, type FlowRecipientStrategy } from '../../../modules/native-crm/queries/automation-flows.queries';

/** Shared node-rendering visuals — extracted from AutomationFlowBuilderPage.tsx
 * so the read-only execution/dry-run diagrams (FlowExecutionDiagram.tsx) can
 * render a node identically to the editable builder canvas, rather than a
 * second hand-maintained copy of the same card. The builder canvas (editable,
 * with onNodesChange/onConnect) and the execution diagrams (read-only,
 * click-to-inspect) both import from here. */

export const NODE_META: Record<FlowNodeType, { label: string; color: string; ring: string; bg: string; icon: typeof BoltIcon }> = {
  trigger:   { label: 'Trigger',   color: 'text-success-700 dark:text-success-500', ring: 'border-success-500/40', bg: 'bg-success-500/15', icon: BoltIcon },
  condition: { label: 'Condition', color: 'text-blue-700 dark:text-blue-400',    ring: 'border-blue-300 dark:border-blue-500/40',    bg: 'bg-blue-50 dark:bg-blue-500/15',    icon: FunnelIcon },
  action:    { label: 'Action',    color: 'text-purple-700 dark:text-purple-400',  ring: 'border-purple-300 dark:border-purple-500/40',  bg: 'bg-purple-50 dark:bg-purple-500/15',  icon: PaperAirplaneIcon },
  delay:     { label: 'Delay',     color: 'text-amber-700 dark:text-amber-400',   ring: 'border-amber-300 dark:border-amber-500/40',   bg: 'bg-amber-50 dark:bg-amber-500/15',   icon: ClockIcon },
  merge:     { label: 'Merge',     color: 'text-text-primary',    ring: 'border-border',    bg: 'bg-background',    icon: Squares2X2Icon },
  subFlow:   { label: 'Sub-Flow',  color: 'text-indigo-700 dark:text-indigo-400',  ring: 'border-indigo-300 dark:border-indigo-500/40',  bg: 'bg-indigo-50 dark:bg-indigo-500/15',  icon: ArrowPathIcon },
  loop:      { label: 'Loop',      color: 'text-pink-700 dark:text-pink-400',    ring: 'border-pink-300 dark:border-pink-500/40',    bg: 'bg-pink-50 dark:bg-pink-500/15',    icon: ArrowsPointingOutIcon },
  approval:  { label: 'Approval',  color: 'text-teal-700 dark:text-teal-400',    ring: 'border-teal-300 dark:border-teal-500/40',    bg: 'bg-teal-50 dark:bg-teal-500/15',    icon: UserGroupIcon },
};

const RECIPIENT_LABELS: Record<FlowRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
  tenant_admin:   'Tenant admin',
  manager:        'Manager',
};

export function edgeColorFor(fromPort: string | undefined): string {
  if (fromPort === 'false' || fromPort === 'failure' || fromPort === 'reject') return '#ef4444';
  if (fromPort === 'true' || fromPort === 'success' || fromPort === 'approve') return '#10b981';
  return '#9ca3af';
}

export function describeNode(node: FlowNode): string {
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

const ACTION_LABEL: Partial<Record<NonNullable<FlowNode['actionType']>, string>> = {
  send_email: 'Send Email', send_whatsapp: 'Send WhatsApp', send_sms: 'Send SMS',
};

/** Names the specific thing missing on this node, for the small set of
 * requirements checkable purely from the node's own fields — no field
 * catalog, no live-record lookup, no {{token}} resolution. Those deeper
 * checks (a stale field reference, an unresolvable variable, a deleted
 * pipeline stage) stay exclusively the backend's job (assertValidNodes,
 * automation-flow.service.ts) and surface through the existing Publish/Save
 * error banner — duplicating them here would mean a second, driftable copy
 * of validation rules this builder deliberately avoids (same reasoning as
 * never building a second execution engine). This function exists so the
 * *obvious*, structural cases — an empty required field — are visible
 * directly on the node, before a save round-trip is even attempted, rather
 * than only a generic "review before publishing." Returns undefined when
 * nothing checkable here is missing (not a guarantee the node will save —
 * only that this cheap local check found nothing). */
export function configurationIssue(node: FlowNode): string | undefined {
  // Deactivated nodes are fully exempt — the whole point of turning a node
  // off instead of deleting it is not having to finish configuring it yet.
  // assertValidNodes (backend) applies the identical exemption at Publish
  // time, so this is never a case of the UI promising more than the server
  // will actually allow.
  if (node.disabled) return undefined;
  if (node.type === 'trigger') {
    if (node.triggerType === 'scheduled') {
      if (!node.scheduleModule) return 'Pick which records to watch';
      return undefined;
    }
    if (!node.module) return 'Trigger needs a module selected';
    if (node.triggerType === 'status_changed' && !node.triggerStage) return 'Pick which pipeline stage fires this';
    if (node.triggerType === 'record_updated' && !node.triggerField) return 'Pick which field change fires this';
    return undefined;
  }
  if (node.type === 'delay') {
    return node.delayMinutes === undefined ? 'Set how long to wait' : undefined;
  }
  if (node.type === 'loop') {
    if (!node.loopSourceModule) return 'Pick what to loop over';
    if (!node.loopSubFlowId) return 'Pick which flow to run per item';
    if (node.loopMaxItems === undefined || node.loopBatchSize === undefined || node.loopConcurrency === undefined) return 'Loop settings are incomplete';
    return undefined;
  }
  if (node.type !== 'action') return undefined;
  if (node.actionType === 'send_email' || node.actionType === 'send_sms' || node.actionType === 'send_whatsapp') {
    if (node.templateId || node.emailBody || node.whatsappBody || node.smsBody) return undefined;
    return `${ACTION_LABEL[node.actionType]} needs a template or inline message content`;
  }
  if (node.actionType === 'assign_record') {
    const mapping = node.fieldMappings?.[0];
    if (!mapping) return 'Needs at least one field mapping';
    if (mapping.sourceType === 'static' && !mapping.staticValue) return 'Fixed value is empty';
    if (mapping.sourceType !== 'static' && !mapping.sourceField) return 'No source field selected';
    return undefined;
  }
  return undefined;
}

/** True for a node that's missing config a tenant almost certainly needs to
 * fill in before this flow is useful — see configurationIssue above for
 * what's actually checked and why. */
export function needsConfiguration(node: FlowNode): boolean {
  return !!configurationIssue(node);
}

/** Wider than FlowRunStepStatus ('success'|'failed'|'skipped') — the two
 * execution-diagram-only states have no backend enum of their own:
 * 'would-skip' is Dry Run's own outcome (IDryRunStep.status, backend) for a
 * step that would NOT have fired for real (no template, no recipient).
 * 'waiting' is derived client-side for a real PAUSED run's own delay/
 * approval node (see FlowExecutionDiagram.tsx) — the backend logs that
 * node's step as plain 'success' ("paused until ...") since from the
 * engine's own point of view pausing succeeded; the UI distinguishes
 * "paused here, waiting to resume" from "ran to completion" for the viewer.
 * 'unknown' — a real send whose outcome couldn't be confirmed (the
 * provider's response was lost or timed out) — mirrors the backend's
 * FlowRunStepStatus; see classifySendError() in automation-flow.service.ts. */
export type DiagramNodeStatus = 'success' | 'failed' | 'skipped' | 'would-skip' | 'waiting' | 'unknown';

// Keyed by node id. The builder canvas sets this only while a specific past
// run is selected in the History panel (Phase 1); the read-only execution/
// dry-run diagrams (FlowExecutionDiagram.tsx) set it for every node they
// render. Either way this lets FlowNodeCard overlay a run's real per-node
// outcome without threading it through React Flow's own `nodes` state.
export const RunOverlayContext = createContext<Record<string, DiagramNodeStatus> | null>(null);

// Per-node "⋯" actions — only provided by the editable builder canvas
// (BuilderInner), never by the read-only execution/dry-run diagrams, so
// FlowNodeCard's menu button simply doesn't render there (context stays
// null) rather than needing a separate "readOnly" flag threaded through.
// Modeled directly on RunOverlayContext above: one context instead of
// threading callbacks through every node-mutation call site.
export interface NodeActions {
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onTest?: (nodeId: string) => void;
  /** Toggles FlowNode.disabled for this node. Never offered for a trigger
   * (can't be disabled) or a merge node (no effect of its own to skip —
   * see automation-flow.service.ts's processOneNode doc comment). */
  onToggleDisabled?: (nodeId: string) => void;
}
export const NodeActionsContext = createContext<NodeActions | null>(null);

export const RUN_OVERLAY_RING: Record<DiagramNodeStatus, string> = {
  success:      'ring-2 ring-emerald-500',
  failed:       'ring-2 ring-red-500',
  skipped:      'ring-2 ring-gray-400',
  'would-skip': 'ring-2 ring-amber-500',
  waiting:      'ring-2 ring-blue-500',
  unknown:      'ring-2 ring-purple-500',
};
export const RUN_OVERLAY_BADGE: Record<DiagramNodeStatus, { icon: string; className: string }> = {
  success:      { icon: '✓', className: 'bg-emerald-500 text-white' },
  failed:       { icon: '✕', className: 'bg-red-500 text-white' },
  skipped:      { icon: '–', className: 'bg-gray-400 text-white' },
  'would-skip': { icon: '!', className: 'bg-amber-500 text-white' },
  waiting:      { icon: '⏱', className: 'bg-blue-500 text-white' },
  // Deliberately NOT red/emerald — this must never read as a confirmed
  // failure or a confirmed success at a glance.
  unknown:      { icon: '?', className: 'bg-purple-500 text-white' },
};

/** "···" menu — Duplicate only. Test moved to the toolbar's own Play button
 * and Delete to its own Trash button (both promoted to top-level icons,
 * matching n8n's layout), so this menu only ever has one thing to offer. */
function NodeMoreMenu({ nodeId, actions }: { nodeId: string; actions: NodeActions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="nodrag nopan relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
        aria-expanded={open}
        title="More actions"
      >
        <EllipsisHorizontalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1 z-20 w-36 bg-surface border border-border rounded-lg shadow-lg py-1"
        >
          <button onClick={() => { setOpen(false); actions.onDuplicate(nodeId); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
            <DocumentDuplicateIcon className="h-3.5 w-3.5 text-text-muted" /> Duplicate
          </button>
        </div>
      )}
    </div>
  );
}

/** n8n-style floating toolbar above a node: Play (Test) / Power (Deactivate)
 * / Trash (Delete), with Duplicate tucked into "···". Built on React Flow's
 * own NodeToolbar primitive rather than hand-rolled absolute positioning —
 * it's screen-space (doesn't shrink with canvas zoom) and portaled, so it's
 * never clipped by a node's own box or covered by a neighboring node. Visible
 * on hover or whenever this node is selected — the latter is also how a
 * keyboard-focused-and-activated node reaches it, since selecting a node is
 * already keyboard-reachable elsewhere in this same canvas. */
function NodeHoverToolbar({ nodeId, node, actions, hovered, selected }: {
  nodeId: string; node: FlowNode; actions: NodeActions; hovered: boolean; selected: boolean;
}) {
  const isTrigger = node.type === 'trigger';
  // A merge node has no effect of its own to skip — it's a pure
  // synchronization point, never dispatched through the backend code path
  // that checks `disabled` (see processOneNode's own doc comment). Offering
  // a Deactivate toggle there would do nothing, so it's left out entirely
  // rather than shipping a control with no effect.
  const canToggleDisabled = !isTrigger && node.type !== 'merge' && !!actions.onToggleDisabled;
  const canDeleteOrDuplicate = !isTrigger;

  return (
    <NodeToolbar nodeId={nodeId} isVisible={hovered || selected} position={Position.Top} offset={8} className="nodrag nopan">
      <div className="flex items-center gap-0.5 bg-surface border border-border rounded-lg shadow-lg px-1 py-1">
        {actions.onTest && (
          <button onClick={(e) => { e.stopPropagation(); actions.onTest!(nodeId); }} className="p-1.5 rounded text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]" title="Test this step">
            <BeakerIcon className="h-4 w-4" />
          </button>
        )}
        {canToggleDisabled && (
          <button
            onClick={(e) => { e.stopPropagation(); actions.onToggleDisabled!(nodeId); }}
            className={`p-1.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.1] ${node.disabled ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted hover:text-text-primary'}`}
            title={node.disabled ? 'Activate this node' : 'Deactivate this node'}
          >
            <PowerIcon className="h-4 w-4" />
          </button>
        )}
        {canDeleteOrDuplicate && (
          <button onClick={(e) => { e.stopPropagation(); actions.onDelete(nodeId); }} className="p-1.5 rounded text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
        {canDeleteOrDuplicate && <NodeMoreMenu nodeId={nodeId} actions={actions} />}
      </div>
    </NodeToolbar>
  );
}

export function FlowNodeCard({ id, data, selected }: NodeProps) {
  const node = (data as any).node as FlowNode;
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const configIssue = configurationIssue(node);
  const runStatusMap = useContext(RunOverlayContext);
  const runStatus = runStatusMap?.[id];
  const nodeActions = useContext(NodeActionsContext);
  const [hovered, setHovered] = useState(false);
  // Whenever an overlay IS active (a run/dry-run is selected — the map is
  // non-null) but this particular node has no entry, it means that
  // run/dry-run never reached this node — e.g. the untaken side of a
  // condition, or a node downstream of where a run stopped. Dimmed, never
  // styled as a failure, per "do not misrepresent them as failures."
  const notReached = runStatusMap !== null && !runStatus;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative rounded-xl border-2 ${selected ? 'border-ryze-500 shadow-lg' : meta.ring} ${meta.bg} px-3 py-2.5 min-w-[190px] max-w-[240px] ${runStatus ? RUN_OVERLAY_RING[runStatus] : ''} ${notReached ? 'opacity-45' : ''} ${node.disabled ? 'opacity-50 !border-dashed' : ''}`}
    >
      {nodeActions && <NodeHoverToolbar nodeId={id} node={node} actions={nodeActions} hovered={hovered} selected={!!selected} />}
      {runStatus && (
        <span
          title={`This run: ${runStatus}`}
          className={`absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full border-2 border-surface flex items-center justify-center text-[9px] font-bold ${RUN_OVERLAY_BADGE[runStatus].className}`}
        >
          {RUN_OVERLAY_BADGE[runStatus].icon}
        </span>
      )}
      {configIssue && (
        <span
          title={configIssue}
          className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-surface flex items-center justify-center text-[9px] font-bold text-white"
        >
          !
        </span>
      )}
      {node.type !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-gray-500 !w-2.5 !h-2.5" />}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
        {node.disabled && <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wide ml-auto">Deactivated</span>}
      </div>
      <p className="text-xs text-text-primary font-medium truncate">{(data as any).label as string}</p>
      <p className="text-[11px] text-text-muted truncate mt-0.5">{describeNode(node)}</p>

      {node.type === 'condition' && (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-text-muted mt-1 px-1">
            <span>True</span><span>False</span>
          </div>
        </>
      )}
      {node.type === 'action' && (
        <>
          <Handle type="source" position={Position.Bottom} id="success" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="failure" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-text-muted mt-1 px-1">
            <span>Success</span><span>Failure</span>
          </div>
        </>
      )}
      {node.type === 'approval' && (
        <>
          <Handle type="source" position={Position.Bottom} id="approve" style={{ left: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5" />
          <Handle type="source" position={Position.Bottom} id="reject" style={{ left: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5" />
          <div className="flex justify-between text-[9px] text-text-muted mt-1 px-1">
            <span>Approve</span><span>Reject</span>
          </div>
        </>
      )}
      {(node.type === 'trigger' || node.type === 'delay' || node.type === 'merge' || node.type === 'subFlow' || node.type === 'loop') && (
        <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-gray-500 !w-2.5 !h-2.5" />
      )}
    </div>
  );
}

export const NODE_TYPES: NodeTypes = {
  trigger: FlowNodeCard, condition: FlowNodeCard, action: FlowNodeCard, delay: FlowNodeCard,
  merge: FlowNodeCard, subFlow: FlowNodeCard, loop: FlowNodeCard, approval: FlowNodeCard,
};
