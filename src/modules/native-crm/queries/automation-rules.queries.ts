import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/automation-rules';
const KEY  = ['native-crm', 'automation-rules'] as const;

export type BuiltInAutomationModule = 'lead' | 'deal' | 'task' | 'ticket' | 'quotation' | 'workorder' | 'contract' | 'invoice';
/** Tenant-built Custom Modules share this same automation engine via a
 * `custom:<slug>` module value. */
export type AutomationModule = BuiltInAutomationModule | `custom:${string}`;
// 'assign_staff'/'assign_team' are dead — Simple Mode's own UI (below)
// still references them, but the backend's real AutomationActionType
// (automation-rule.model.ts) has never included them, so submitting either
// fails server-side Zod validation. Left as-is (not a foundation for
// Advanced Mode's real 'assign_record' below) — fixing Simple Mode's own
// dead UI is a separate, out-of-scope cleanup.
export type AutomationActionType =
  | 'send_email' | 'send_sms' | 'send_whatsapp' | 'create_linked_record' | 'assign_staff' | 'assign_team'
  // Advanced Mode only (automation-flow.model.ts) — Simple Mode's own
  // backend Zod/Mongoose enums stay hardcoded at the 4 real values above,
  // so these are inert if a Simple Mode rule somehow carried one.
  | 'update_record' | 'assign_record' | 'change_status' | 'add_note' | 'webhook_call';
export type AutomationRecipientStrategy = 'record_contact' | 'assigned_user';
// 'webhook' isn't exposed in this UI yet (a separate, unrelated trigger type
// — no form built for it either) — only 'scheduled' is added here.
export type AutomationTriggerType = 'status_changed' | 'record_created' | 'record_updated' | 'record_deleted' | 'scheduled';

export interface FieldMapping {
  targetField:  string;
  sourceType:   'field' | 'static';
  sourceField?: string;
  staticValue?: string;
}

export type ConditionOperator =
  | '=' | '!=' | '>' | '<' | '>=' | '<='
  | 'contains' | 'startsWith' | 'endsWith'
  | 'is_empty' | 'is_not_empty' | 'between' | 'in_list' | 'not_in_list';

export interface FlowCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
  value2?: string;
}

export interface AutomationRule {
  _id:               string;
  module:            AutomationModule;
  name:              string;
  enabled:           boolean;
  /** Defaults to 'status_changed' server-side when omitted — every rule
   * created before this trigger type existed keeps behaving the same way. */
  triggerType?:      AutomationTriggerType;
  /** Required when triggerType is 'status_changed'; for 'record_updated' this
   * doubles as an optional "changed to this exact value" filter. */
  triggerStage?:     string;
  /** Which field to watch — required only when triggerType is 'record_updated'. */
  triggerField?:     string;
  /** Only meaningful when triggerType is 'scheduled' — a real cron
   * expression, the module whose records get queried (independent of the
   * rule's own top-level `module`, which stays required by the schema but is
   * otherwise unused for firing logic on a scheduled rule), an optional
   * AND-combined filter, and an idempotency stamp field (see
   * scheduleStampField's own note below). */
  scheduleCron?:       string;
  scheduleModule?:     AutomationModule;
  scheduleFilter?:     FlowCondition[];
  /** After this rule fires for a matched record, that record's own field of
   * this name gets set to "now" — so it naturally stops matching on the next
   * tick once the filter above includes an "is empty" condition on it.
   * Without this, a still-matching record (e.g. one whose fields a
   * notify-only rule never changes) re-fires every single tick forever. */
  scheduleStampField?: string;
  /** Phase 6 branch scoping — Branch document ids (this tenant's own).
   * Absent/empty = unscoped, matches every branch (default, unchanged
   * behavior). Not valid on a webhook trigger (rejected at save time). */
  branchIds?: string[];
  actionType:        AutomationActionType;
  /** Required only for send_email/send_sms. */
  templateId?:        string;
  /** Only meaningful for send_email/send_sms. */
  recipientStrategy?: AutomationRecipientStrategy;
  /** Populated only when actionType === 'create_linked_record'. */
  targetModule?:       AutomationModule;
  fieldMappings?:      FieldMapping[];
  backReferenceField?: string;
  /** actionType === 'assign_staff': OPTIONAL round-robin scope (a NativeTeam
   * _id) — rotates across every active tenant staff when omitted.
   * actionType === 'assign_team': REQUIRED — the fixed target team. */
  assignTeamId?: string;
  /** Node position on the visual automation canvas — absent until a rule's
   * node has been dragged at least once, in which case the canvas falls
   * back to an auto-layout grid position for that render only. */
  canvasPosition?:     { x: number; y: number };
  createdAt:         string;
  updatedAt:         string;
}

export interface TargetFieldDef {
  key:   string;
  label: string;
  type:  'text' | 'number' | 'date' | 'boolean' | 'select';
  /** Present for select-type fields — lets a "Fixed value" mapping show a
   * real dropdown of valid choices instead of a free-text box. */
  options?: { value: string; label: string }[];
  /** True for the one field per module that IS its pipeline stage — drives
   * the Change Status action's stage-picker. */
  isStageField?: boolean;
  /** True for the one field per module that is its real owner/assignee FK
   * — drives the Assign Record action's staff-picker. Absent for a module
   * with no assignee concept (Ticket/Quotation/Invoice). */
  isAssigneeField?: boolean;
}

/** Serves both the "copy from" (source module) and "write to" (target
 * module) field pickers in the rule builder — same endpoint either way. */
export function useFieldCatalogQuery(module: AutomationModule | '') {
  return useQuery({
    queryKey: [...KEY, 'target-fields', module],
    queryFn: () => api.get(`${BASE}/target-fields`, { params: { module } }).then((r) => r.data.data as TargetFieldDef[]),
    enabled: !!module,
  });
}

export function useAutomationRulesQuery(module?: AutomationModule) {
  return useQuery({
    queryKey: [...KEY, module],
    queryFn: () => api.get(BASE, { params: module ? { module } : undefined }).then((r) => r.data.data as AutomationRule[]),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AutomationRule>) => api.post(BASE, data).then((r) => r.data.data as AutomationRule),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AutomationRule> }) =>
      api.put(`${BASE}/${id}`, data).then((r) => r.data.data as AutomationRule),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Message templates (the picker's "using template Y") ──────────────────────
export interface MessageTemplate {
  _id:      string;
  name:     string;
  type:     'email' | 'whatsapp' | 'sms';
  subject?: string;
  body:     string;
  isActive: boolean;
}

export function useMessageTemplatesQuery(type: 'email' | 'sms' | 'whatsapp') {
  return useQuery({
    queryKey: ['templates', type],
    queryFn: () => api.get('/api/v1/templates', { params: { type } }).then((r) => r.data.data as MessageTemplate[]),
  });
}

/** Same `/api/v1/templates` endpoint and payload shape as the standalone
 * Templates page (`pages/templates/TemplatesPage.tsx`) — reused here so a
 * template can be created inline, mid-rule-building, without navigating
 * away. Both surfaces edit the exact same underlying records. */
export interface CreateMessageTemplateInput {
  name:      string;
  type:      'email' | 'sms' | 'whatsapp';
  category:  string;
  subject?:  string;
  body:      string;
  language:  string;
}

export function useCreateMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMessageTemplateInput) =>
      api.post('/api/v1/templates', data).then((r) => r.data.data as MessageTemplate),
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['templates', variables.type] }),
  });
}
