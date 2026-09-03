import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import type {
  AutomationModule, AutomationActionType, AutomationTriggerType,
  FieldMapping, FlowCondition,
} from './automation-rules.queries';

/** Wider than automation-rules.queries.ts's own AutomationRecipientStrategy
 * (which only exposes 'record_contact'/'assigned_user' — a Simple Mode UI
 * choice, not a backend restriction). The backend's shared
 * AutomationRecipientStrategy type (automation-rule.model.ts) always had all
 * four; Advanced Mode's Approval node specifically needs 'manager' as its
 * real default, so this file declares the full union rather than importing
 * the narrower one. */
export type FlowRecipientStrategy = 'record_contact' | 'assigned_user' | 'tenant_admin' | 'manager';

const BASE = '/api/v1/native-crm/automation-flows';
const KEY  = ['native-crm', 'automation-flows'] as const;

/** "Advanced Mode" — see automation-flow.model.ts's own top comment (backend)
 * for the full rationale. Mirrors the backend's IFlowNode/IFlowEdge/
 * IAutomationFlow shape one-for-one, not automation-rules.queries.ts's
 * AutomationRule shape — a flow is a graph of these, not one flat
 * trigger+action pair. */
export type FlowNodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'merge' | 'subFlow' | 'loop' | 'approval';
export type LoopSourceModule = AutomationModule | 'customer';

export interface FlowNode {
  id: string;
  type: FlowNodeType;

  // Trigger
  module?: AutomationModule;
  triggerType?: AutomationTriggerType | 'webhook';
  triggerStage?: string;
  triggerField?: string;
  scheduleCron?: string;
  scheduleModule?: AutomationModule;
  scheduleFilter?: FlowCondition[];
  webhookToken?: string;
  /** Phase 6 branch scoping — Branch document ids (this tenant's own).
   * Absent/empty = unscoped, matches every branch (default, unchanged
   * behavior). Not valid on a webhook trigger (rejected at save time). */
  branchIds?: string[];

  // Action
  actionType?: AutomationActionType;
  templateId?: string;
  recipientStrategy?: FlowRecipientStrategy;
  targetModule?: string;
  fieldMappings?: FieldMapping[];
  backReferenceField?: string;
  retryCount?: 0 | 1 | 2 | 3;
  retryBackoffMs?: 1000 | 5000 | 30000 | 60000;

  // Add Note (actionType === 'add_note' only)
  noteSubject?: string;
  noteBody?: string;
  noteAssignedTo?: string;

  // Webhook (actionType === 'webhook_call' only). A sensitive header's
  // `value` comes back from the API as a fixed masked placeholder
  // ('••••••••') — never the real value, see webhook-secret.util.ts
  // (backend). Leaving it as the placeholder on save keeps the existing
  // stored value; typing a new value replaces it.
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'PUT' | 'PATCH';
  webhookHeaders?: { key: string; value: string }[];

  // Condition
  conditions?: FlowCondition[];

  // Delay
  delayMinutes?: number;

  // Sub-Flow
  targetFlowId?: string;

  // Loop
  loopSourceModule?: LoopSourceModule;
  loopFilter?: FlowCondition[];
  loopSubFlowId?: string;
  loopMaxItems?: number;
  loopBatchSize?: number;
  loopConcurrency?: number;

  // Approval
  approvalRecipientStrategy?: FlowRecipientStrategy;
}

export interface FlowEdge {
  from: string;
  to: string;
  fromPort?: 'true' | 'false' | 'success' | 'failure' | 'approve' | 'reject';
}

export interface FlowDraft {
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasPositions?: Record<string, { x: number; y: number }>;
  updatedAt: string;
}

export interface AutomationFlow {
  _id: string;
  name: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasPositions?: Record<string, { x: number; y: number }>;
  version: number;
  publishedAt?: string;
  /** Present only while there's an unpublished edit staged — the whole
   * "editing a published workflow creates a draft" mechanism (see
   * publishFlow()'s own doc comment, backend). Absent for a brand-new flow
   * and for a published one with nothing pending. */
  draft?: FlowDraft;
  createdAt: string;
  updatedAt: string;
}

export type FlowRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'paused';
export type FlowRunStepStatus = 'success' | 'failed' | 'skipped';

export interface FlowRunStep {
  nodeId: string;
  nodeType: FlowNodeType;
  label: string;
  status: FlowRunStepStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  result?: string;
  variables?: Record<string, string>;
  createdRecordModule?: string;
  createdRecordId?: string;
  attempt?: number;
  forkId?: string;
  branchIndex?: number;
  subFlowNodeId?: string;
  loopIterationIndex?: number;
}

export interface AutomationFlowRun {
  _id: string;
  flowId: string;
  flowName: string;
  flowVersion?: number;
  status: FlowRunStatus;
  triggerModule: string;
  triggerRecordId?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  steps: FlowRunStep[];
}

export interface DryRunStep {
  nodeId: string;
  nodeType: string;
  label: string;
  result: string;
}

export interface DryRunResult {
  flowName: string;
  usingDraft: boolean;
  steps: DryRunStep[];
}

// ── Flow CRUD ─────────────────────────────────────────────────────────────

export function useAutomationFlowsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get(BASE).then((r) => r.data.data as AutomationFlow[]),
  });
}

export function useAutomationFlowQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data as AutomationFlow),
    enabled: !!id,
  });
}

export interface FlowSavePayload {
  name: string;
  enabled?: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasPositions?: Record<string, { x: number; y: number }>;
}

export function useCreateAutomationFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FlowSavePayload) => api.post(BASE, data).then((r) => r.data.data as AutomationFlow),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAutomationFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FlowSavePayload> }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data as AutomationFlow),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: [...KEY, vars.id] }); },
  });
}

export function useDeleteAutomationFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Versioning: publish / discard draft ──────────────────────────────────

export function usePublishFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/publish`).then((r) => r.data.data as AutomationFlow),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: [...KEY, id] }); },
  });
}

export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/discard-draft`).then((r) => r.data.data as AutomationFlow),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: [...KEY, id] }); },
  });
}

// ── Dry-run ───────────────────────────────────────────────────────────────

export function useDryRunFlow() {
  return useMutation({
    mutationFn: ({ id, sampleModule, sampleRecordId }: { id: string; sampleModule: string; sampleRecordId: string }) =>
      api.post(`${BASE}/${id}/dry-run`, { sampleModule, sampleRecordId }).then((r) => r.data.data as DryRunResult),
  });
}

// ── Execution history ─────────────────────────────────────────────────────

export function useFlowRunsQuery(flowId?: string, status?: string) {
  return useQuery({
    queryKey: [...KEY, 'runs', flowId, status],
    queryFn: () => api.get(`${BASE}/runs`, { params: { flowId, status, limit: 50 } }).then((r) => r.data.data as AutomationFlowRun[]),
    enabled: !!flowId,
  });
}

export function useFlowRunQuery(runId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'run', runId],
    queryFn: () => api.get(`${BASE}/runs/${runId}`).then((r) => r.data.data as AutomationFlowRun),
    enabled: !!runId,
    // A running/paused run's step log grows over time — poll while it's
    // still in flight, stop once it reaches a terminal status.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 2000 : false;
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, decision }: { runId: string; decision: 'approve' | 'reject' }) =>
      api.patch(`${BASE}/runs/${runId}/decision`, { decision }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: [...KEY, 'run', vars.runId] }),
  });
}

// ── Operations Dashboard run-stats (Phase 5) ─────────────────────────────

export interface FlowRunStatsRow {
  _id: string; // flowId
  totalRuns: number;
  completedCount: number;
  failedCount: number;
  partialCount: number;
  pausedCount: number;
  lastRunAt: string;
  lastStatus: FlowRunStatus;
}

export interface FlowRunStats {
  perFlow: FlowRunStatsRow[];
  /** Exact tenant-wide counts for today — NOT derived from any perFlow row's
   * own lastRunAt (a flow that ran 5 times today and one that ran once
   * today look identical by lastRunAt alone). */
  summary: { runsToday: number; failedToday: number; completedToday: number };
}

export function useFlowRunStatsQuery() {
  return useQuery({
    queryKey: [...KEY, 'runs', 'stats'],
    queryFn: () => api.get(`${BASE}/runs/stats`).then((r) => r.data.data as FlowRunStats),
  });
}
