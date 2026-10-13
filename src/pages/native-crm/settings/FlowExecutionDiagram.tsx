import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { FlowNode, FlowEdge } from '../../../modules/native-crm/queries/automation-flows.queries';
import { NODE_META, NODE_TYPES, edgeColorFor, RunOverlayContext, type DiagramNodeStatus } from './flow-node-visuals';

export interface DiagramStep {
  nodeId: string;
  status: DiagramNodeStatus;
  /** Only meaningful on a condition node — which port was actually taken,
   * so the executed edge can be highlighted instead of re-derived from
   * free-text. */
  branch?: 'true' | 'false';
  label?: string;
  result?: string;
  error?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  startedAt?: string;
}

const STATUS_LABEL: Record<DiagramNodeStatus, string> = {
  success: 'Success', failed: 'Failed', skipped: 'Skipped', 'would-skip': 'Would be skipped', waiting: 'Waiting',
  unknown: 'Delivery unknown',
};
const STATUS_BADGE_CLASS: Record<DiagramNodeStatus, string> = {
  success: 'bg-emerald-100 text-emerald-700', failed: 'bg-red-100 text-red-700', skipped: 'bg-gray-100 text-gray-600',
  'would-skip': 'bg-amber-100 text-amber-700', waiting: 'bg-blue-100 text-blue-700',
  // Deliberately not red/emerald/gray — must read as neither a confirmed
  // failure nor a confirmed success.
  unknown: 'bg-purple-100 text-purple-700',
};

function fmtDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

/** Flat, diagram-free fallback — used only when there's truly no graph to
 * draw (a run old enough to predate flowSnapshot, whose flow has since
 * been deleted or otherwise can't be loaded). The one thing this must
 * never do is hide the real recorded data along with the diagram: every
 * step's status/timestamps/input/output/error that got this far is shown
 * exactly as captured, never fabricated or silently dropped. */
export function RunStepFallbackList({ steps, reason }: { steps: DiagramStep[]; reason: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
        <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>Can't draw the flow diagram for this run — {reason} The recorded steps below are still real and complete.</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-text-muted">No steps were recorded for this run.</p>
      ) : (
        steps.map((s, i) => (
          <div key={i} className="bg-background border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-text-primary">{s.label ?? s.nodeId}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
              {s.durationMs !== undefined && <span className="text-[11px] text-text-muted">{fmtDuration(s.durationMs)}</span>}
            </div>
            {s.result && <p className="text-xs text-text-primary mb-1">{s.result}</p>}
            {s.error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 mb-1">{s.error}</p>}
            {(s.input || s.output) && (
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {s.input && (
                  <div>
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1">Input</p>
                    <pre className="text-[10.5px] bg-surface border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{JSON.stringify(s.input, null, 2)}</pre>
                  </div>
                )}
                {s.output && (
                  <div>
                    <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1">Output</p>
                    <pre className="text-[10.5px] bg-surface border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{JSON.stringify(s.output, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** One edge is "on the executed path" when both ends were reached AND — for
 * a port-tagged edge — the port it's tagged with matches what that node
 * actually did (a condition's real branch, or a success/failure outcome).
 * Best-effort from the data already captured, not a re-simulation: approve/
 * reject can't be distinguished from a step's own status alone (the
 * decision lives on the RUN, not the step), so both of an Approval node's
 * edges count as "reached" once the node itself was reached. */
function isEdgeExecuted(edge: FlowEdge, byNode: Map<string, DiagramStep>): boolean {
  const from = byNode.get(edge.from);
  const to = byNode.get(edge.to);
  if (!from || !to) return false;
  if (edge.fromPort === undefined) return true;
  if (edge.fromPort === 'true' || edge.fromPort === 'false') return from.branch === edge.fromPort;
  if (edge.fromPort === 'success') return from.status === 'success' || from.status === 'waiting';
  if (edge.fromPort === 'failure') return from.status === 'failed';
  return true; // approve/reject — see comment above
}

/** Lives INSIDE ReactFlowProvider so it can call useReactFlow() — needed
 * only for the focusNodeId → fitView behavior ("Test this step" scrolling
 * to the right node), which the outer component can't do itself since that
 * hook requires provider context. */
function DiagramCanvas({ rfNodes, rfEdges, selectedId, setSelectedId, focusNodeId }: {
  rfNodes: Node[]; rfEdges: Edge[]; selectedId: string | undefined;
  setSelectedId: (id: string | undefined) => void; focusNodeId?: string;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!focusNodeId) return;
    const t = setTimeout(() => fitView({ nodes: [{ id: focusNodeId }], duration: 400, maxZoom: 1.2 }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable
      onNodeClick={(_e, n) => setSelectedId(n.id === selectedId ? undefined : n.id)}
      onPaneClick={() => setSelectedId(undefined)}
      fitView
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}

/** Read-only flow canvas + click-to-inspect detail panel, shared by the
 * in-builder History panel, the standalone Executions page, and Dry Run —
 * reuses the exact same node-rendering (flow-node-visuals.tsx) the editable
 * builder canvas uses, fed with this run/dry-run's real per-node outcome.
 * Deliberately does NOT re-simulate or fabricate anything: a node with no
 * entry in `steps` renders dimmed as "not reached," never as a failure. */
export default function FlowExecutionDiagram({
  nodes, edges, canvasPositions, steps, heightClassName = 'h-80', focusNodeId,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasPositions?: Record<string, { x: number; y: number }>;
  steps: DiagramStep[];
  heightClassName?: string;
  /** "Test This Step" (plan item #7's per-node shortcut) — select, scroll
   * to, and highlight this node's own result as soon as it's available.
   * Re-applied every time it changes (e.g. a fresh dry-run result keyed by
   * the node the drawer's own "Test this step" button was clicked from). */
  focusNodeId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(focusNodeId);
  // Re-select whenever a NEW focusNodeId arrives (e.g. "Test this step"
  // clicked for a different node, producing a fresh dry-run result) —
  // intentionally not reacting to selectedId itself, only to the external
  // focus request, so a manual click elsewhere on the canvas isn't fought.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusNodeId) setSelectedId(focusNodeId); }, [focusNodeId]);

  const byNode = useMemo(() => {
    const m = new Map<string, DiagramStep>();
    // Earlier occurrences win on a purpose — a Loop/Parallel re-visit of the
    // same node id would otherwise have its LAST outcome silently overwrite
    // an earlier failure; keeping the first keeps the diagram's single badge
    // per node from hiding a real failure behind a later retry's success.
    for (const s of steps) if (!m.has(s.nodeId)) m.set(s.nodeId, s);
    return m;
  }, [steps]);

  const statusMap = useMemo(() => {
    const m: Record<string, DiagramNodeStatus> = {};
    for (const [nodeId, s] of byNode) m[nodeId] = s.status;
    return m;
  }, [byNode]);

  const presentNodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  // Steps referencing a node id that no longer exists in the flow's CURRENT
  // layout — e.g. the node was deleted/renamed since this run happened.
  // There's no per-run snapshot of nodes/edges stored (only flowVersion), so
  // rendering the current layout is the best available canvas; these are
  // surfaced separately rather than silently dropped.
  const orphanSteps = useMemo(() => steps.filter((s) => !presentNodeIds.has(s.nodeId)), [steps, presentNodeIds]);

  const rfNodes: Node[] = useMemo(() => nodes.map((n, i) => ({
    id: n.id, type: n.type,
    position: canvasPositions?.[n.id] ?? { x: 250 + (i % 3) * 260, y: 60 + Math.floor(i / 3) * 180 },
    data: { node: n, label: NODE_META[n.type].label },
    selected: n.id === selectedId,
  })), [nodes, canvasPositions, selectedId]);

  const rfEdges: Edge[] = useMemo(() => edges.map((e, i) => {
    const executed = isEdgeExecuted(e, byNode);
    return {
      id: `e${i}_${e.from}_${e.to}_${e.fromPort ?? ''}`, source: e.from, target: e.to, sourceHandle: e.fromPort,
      animated: executed,
      style: executed ? { stroke: edgeColorFor(e.fromPort), strokeWidth: 2.5 } : { stroke: '#d1d5db', strokeWidth: 1, opacity: 0.5 },
    };
  }), [edges, byNode]);

  const selectedStep = selectedId ? byNode.get(selectedId) : undefined;
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : undefined;

  return (
    <div className="space-y-3">
      {orphanSteps.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{orphanSteps.length} step(s) reference a node that's no longer in this flow's current layout (likely deleted/edited since this ran) — not shown on the diagram below.</span>
        </div>
      )}
      <div className={`${heightClassName} border border-border rounded-xl overflow-hidden`}>
        <ReactFlowProvider>
          <RunOverlayContext.Provider value={statusMap}>
            <DiagramCanvas
              rfNodes={rfNodes} rfEdges={rfEdges} selectedId={selectedId} setSelectedId={setSelectedId} focusNodeId={focusNodeId}
            />
          </RunOverlayContext.Provider>
        </ReactFlowProvider>
      </div>

      {selectedId && (
        <div className="bg-background border border-border rounded-xl p-3">
          {!selectedStep && !selectedNode ? null : (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-sm font-semibold text-text-primary">{selectedStep?.label ?? selectedNode?.id}</p>
                {selectedStep && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE_CLASS[selectedStep.status]}`}>{STATUS_LABEL[selectedStep.status]}</span>}
                {selectedStep?.durationMs !== undefined && <span className="text-[11px] text-text-muted">{fmtDuration(selectedStep.durationMs)}</span>}
              </div>
              {!selectedStep ? (
                <p className="text-xs text-text-muted">Not reached by this run — this branch/path wasn't taken.</p>
              ) : (
                <>
                  {selectedStep.result && <p className="text-xs text-text-primary mb-1.5">{selectedStep.result}</p>}
                  {selectedStep.error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 mb-1.5">{selectedStep.error}</p>}
                  {(selectedStep.input || selectedStep.output) && (
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div>
                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1">Input</p>
                        <pre className="text-[10.5px] bg-surface border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                          {selectedStep.input ? JSON.stringify(selectedStep.input, null, 2) : '—'}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1">Output</p>
                        <pre className="text-[10.5px] bg-surface border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                          {selectedStep.output ? JSON.stringify(selectedStep.output, null, 2) : '—'}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
