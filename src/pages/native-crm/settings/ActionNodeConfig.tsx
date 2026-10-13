import { useRef, type ReactNode } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { FlowNode, FlowRecipientStrategy } from '../../../modules/native-crm/queries/automation-flows.queries';
import { AutomationModule, TargetFieldDef, FieldMapping } from '../../../modules/native-crm/queries/automation-rules.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import FieldMappingsEditor from './FieldMappingsEditor';
import VariablePicker from './VariablePicker';
import GroupedSearchableSelect from '../../../modules/native-crm/shared/GroupedSearchableSelect';
import { groupModules } from './automation-module-groups';

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'x-api-key', 'api-key', 'x-auth-token', 'proxy-authorization']);
const MASKED_PLACEHOLDER = '••••••••';

const RECIPIENT_LABELS: Record<FlowRecipientStrategy, string> = {
  record_contact: 'Record’s own contact',
  assigned_user:  'Assigned staff',
  tenant_admin:   'Tenant admin',
  manager:        'Manager',
};

function WebhookHeadersEditor({ headers, onChange }: {
  headers: { key: string; value: string }[]; onChange: (h: { key: string; value: string }[]) => void;
}) {
  const add = () => onChange([...headers, { key: '', value: '' }]);
  const remove = (i: number) => onChange(headers.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<{ key: string; value: string }>) => onChange(headers.map((h, idx) => (idx === i ? { ...h, ...p } : h)));

  return (
    <div className="space-y-2">
      {headers.map((h, i) => {
        const sensitive = SENSITIVE_HEADER_KEYS.has(h.key.trim().toLowerCase());
        return (
          <div key={i} className="flex items-center gap-1.5">
            <input value={h.key} onChange={(e) => patch(i, { key: e.target.value })} placeholder="Header name (e.g. Authorization)"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
            <input
              value={h.value} onChange={(e) => patch(i, { value: e.target.value })}
              placeholder={sensitive ? 'Encrypted at rest' : 'Value'}
              type={sensitive ? 'password' : 'text'}
              title={sensitive ? `This header will be encrypted; leave as ${MASKED_PLACEHOLDER} to keep the existing value` : undefined}
              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary"
            />
            <button onClick={() => remove(i)} className="p-1 text-text-muted hover:text-red-500 shrink-0"><TrashIcon className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}
      <button onClick={add} className="text-[11px] font-medium text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">+ Add header</button>
    </div>
  );
}

/** Single-mapping recipient override for send_email/send_whatsapp/send_sms's
 * emailTo/whatsappTo/smsTo — same FieldMapping shape assign_record/
 * change_status already use for one mapped value, but those two always
 * write a static staff id/stage, never "from a field." This is the fuller
 * version: pick a source field (e.g. Lead.Email) OR type a fixed value/
 * variable, OR leave it unset to fall back to the simpler recipientStrategy
 * dropdown shown above it. `targetField` is set to a fixed placeholder —
 * the engine only reads sourceType/sourceField/staticValue off this one
 * (automation-flow.service.ts), never targetField, so its value is
 * never actually consulted; it's set purely to satisfy the schema's
 * `targetField: non-empty string` requirement. */
function RecipientMappingField({ mapping, onChange, sourceFields, variableModule, placeholder }: {
  mapping: FieldMapping | undefined;
  onChange: (m: FieldMapping | undefined) => void;
  sourceFields: { key: string; label: string }[];
  variableModule: AutomationModule | '';
  placeholder: string;
}) {
  const staticRef = useRef<HTMLInputElement>(null);
  const mode: 'default' | 'field' | 'static' = !mapping ? 'default' : mapping.sourceType;

  return (
    <div className="space-y-1.5">
      <select
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'default') onChange(undefined);
          else if (v === 'field') onChange({ targetField: 'to', sourceType: 'field', sourceField: '' });
          else onChange({ targetField: 'to', sourceType: 'static', staticValue: '' });
        }}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary"
      >
        <option value="default">Use default recipient (above)</option>
        <option value="field">From a field…</option>
        <option value="static">Fixed value / variable…</option>
      </select>
      {mode === 'field' && (
        <select
          value={mapping?.sourceField ?? ''}
          onChange={(e) => onChange({ targetField: 'to', sourceType: 'field', sourceField: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary"
        >
          <option value="">Source field…</option>
          {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      )}
      {mode === 'static' && (
        <div className="flex items-center gap-1.5">
          <input
            ref={staticRef} value={mapping?.staticValue ?? ''} placeholder={placeholder}
            onChange={(e) => onChange({ targetField: 'to', sourceType: 'static', staticValue: e.target.value })}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary"
          />
          <VariablePicker
            module={variableModule} targetRef={staticRef} value={mapping?.staticValue ?? ''}
            onChange={(v) => onChange({ targetField: 'to', sourceType: 'static', staticValue: v })}
            className="shrink-0 text-[10px] text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 px-1.5 py-1 border border-ryze-200 dark:border-ryze-800 rounded bg-ryze-600/10 hover:bg-ryze-600/15"
          />
        </div>
      )}
    </div>
  );
}

/** Single-line text field + VariablePicker header, mirrors the existing
 * add_note Subject pattern (below) factored out — now reused across Send
 * Email/WhatsApp/SMS's own Subject/CC-free fields instead of repeating the
 * header-row boilerplate three more times. */
function TextVariableField({ label, value, onChange, module, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; module: AutomationModule | ''; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label mb-0 text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</label>
        <VariablePicker module={module} targetRef={ref} value={value} onChange={onChange} />
      </div>
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" />
    </div>
  );
}

/** Multi-line counterpart of TextVariableField — mirrors add_note's own
 * Note body pattern, reused for Email/WhatsApp/SMS body composition. */
function TextareaVariableField({ label, value, onChange, module, placeholder, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; module: AutomationModule | ''; placeholder?: string; rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label mb-0 text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</label>
        <VariablePicker module={module} targetRef={ref} value={value} onChange={onChange} />
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg font-mono bg-background text-text-primary" />
    </div>
  );
}

/** Groups a block of fields under a visible heading — Recipient / Message /
 * Options, per the usability review: the send_* drawers previously read as
 * one undifferentiated list of controls with no indication of which ones
 * relate to each other. `required` marks a section where leaving its
 * field(s) empty is a real, save-blocking error (not just a style choice),
 * mirroring how the backend actually validates it. */
function SectionHeader({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center gap-1 pt-1 first:pt-0">
      <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{children}</h4>
      {required && <span className="text-red-500 text-xs leading-none" title="Required">*</span>}
    </div>
  );
}

/** Forward-compat placeholder for the deferred per-tenant Connections
 * project (see automation-flow.model.ts's own comment on connectionId) —
 * shown so the node's own architecture visibly has a slot for it, without
 * building real multi-account support now. Always disabled; every flow
 * sends from this platform's one shared Brevo/Meta/Twilio account today. */
function ConnectionPlaceholder() {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Connection</label>
      <select disabled value="" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-muted opacity-60 cursor-not-allowed">
        <option>Default platform account</option>
      </select>
      <p className="text-[11px] text-text-muted mt-1">Per-tenant connections are coming soon — every flow currently sends from this platform's shared account.</p>
    </div>
  );
}

interface ActionNodeConfigProps {
  node: FlowNode;
  onChange: (patch: Partial<FlowNode>) => void;
  /** The flow's own trigger module — used as both source AND target field
   * catalog for update_record/assign_record/change_status, since those
   * always act on the record already in flow context. There's no static
   * way to know the TRUE "current" module at an arbitrary point in the
   * graph (it depends on the execution path — e.g. after a
   * create_linked_record node it would actually be that node's own target
   * module), so this mirrors create_linked_record's own existing
   * "configured at save time, not dynamically inferred" precedent. */
  triggerModule: AutomationModule | '';
  triggerFields: TargetFieldDef[];
  targetFields: TargetFieldDef[];
  everyModule: { key: AutomationModule; label: string }[];
  templates: { _id: string; name: string }[];
}

/** Extracted from AutomationFlowBuilderPage.tsx's NodeConfigPanel — the
 * per-action-type config block, previously a 2-shape ternary (create_linked_
 * record vs. send_*), now covering 7 shapes. Everything else in the builder
 * (canvas, palette, ConditionsEditor, DryRunModal, HistoryPanel) stays
 * exactly where it was; this is a scoped extraction of one block that was
 * about to grow too large to stay readable inline, not a rewrite of the
 * builder's architecture. */
export default function ActionNodeConfig({ node, onChange, triggerModule, triggerFields, targetFields, everyModule, templates }: ActionNodeConfigProps) {
  const { data: staffData } = useStaffsListQuery({ limit: 200 });
  const staffOptions = staffData?.items ?? [];
  const assigneeField = triggerFields.find((f) => f.isAssigneeField);
  const stageField = triggerFields.find((f) => f.isStageField);
  const noteSubjectRef = useRef<HTMLInputElement>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);

  if (node.actionType === 'create_linked_record') {
    return (
      <>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Target module</label>
          <GroupedSearchableSelect groups={groupModules(everyModule)} value={node.targetModule ?? ''} onChange={(key) => onChange({ targetModule: key })} placeholder="Select a module…" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Field mappings</label>
          <FieldMappingsEditor mappings={node.fieldMappings ?? []} onChange={(m) => onChange({ fieldMappings: m })} sourceFields={triggerFields} targetFields={targetFields} variableModule={triggerModule} />
        </div>
      </>
    );
  }

  if (node.actionType === 'update_record') {
    return (
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Set fields on this {triggerModule || 'record'}</label>
        <FieldMappingsEditor mappings={node.fieldMappings ?? []} onChange={(m) => onChange({ fieldMappings: m })} sourceFields={triggerFields} targetFields={triggerFields} variableModule={triggerModule} />
      </div>
    );
  }

  if (node.actionType === 'assign_record') {
    if (!assigneeField) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          This module has no assignable owner field — Assign Record isn't available here.
        </div>
      );
    }
    const current = node.fieldMappings?.[0];
    return (
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Assign to</label>
        <select
          value={current?.staticValue ?? ''}
          onChange={(e) => onChange({ fieldMappings: [{ targetField: assigneeField.key, sourceType: 'static', staticValue: e.target.value }] })}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary"
        >
          <option value="">Select staff…</option>
          {staffOptions.map((s: any) => (
            <option key={s.staffId} value={s.staffId}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.staffId}</option>
          ))}
        </select>
      </div>
    );
  }

  if (node.actionType === 'change_status') {
    if (!stageField) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          This module has no stage field configured — Change Status isn't available here.
        </div>
      );
    }
    const current = node.fieldMappings?.[0];
    return (
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">New status</label>
        <select
          value={current?.staticValue ?? ''}
          onChange={(e) => onChange({ fieldMappings: [{ targetField: stageField.key, sourceType: 'static', staticValue: e.target.value }] })}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary"
        >
          <option value="">Select status…</option>
          {(stageField.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (node.actionType === 'add_note') {
    return (
      <>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0 text-xs font-semibold text-text-muted uppercase tracking-wide">Note subject</label>
            <VariablePicker module={triggerModule} targetRef={noteSubjectRef} value={node.noteSubject ?? ''} onChange={(v) => onChange({ noteSubject: v })} />
          </div>
          <input ref={noteSubjectRef} value={node.noteSubject ?? ''} onChange={(e) => onChange({ noteSubject: e.target.value })} placeholder="e.g. Follow-up needed for {{record.company}}"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0 text-xs font-semibold text-text-muted uppercase tracking-wide">Note body (optional)</label>
            <VariablePicker module={triggerModule} targetRef={noteBodyRef} value={node.noteBody ?? ''} onChange={(v) => onChange({ noteBody: v })} />
          </div>
          <textarea ref={noteBodyRef} value={node.noteBody ?? ''} onChange={(e) => onChange({ noteBody: e.target.value })} rows={3}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg font-mono bg-background text-text-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Assign note to (optional)</label>
          <select value={node.noteAssignedTo ?? ''} onChange={(e) => onChange({ noteAssignedTo: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
            <option value="">Unassigned</option>
            {staffOptions.map((s: any) => (
              <option key={s.staffId} value={s.staffId}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.staffId}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (node.actionType === 'webhook_call') {
    return (
      <>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Method</label>
            <select value={node.webhookMethod ?? 'POST'} onChange={(e) => onChange({ webhookMethod: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">URL</label>
            <input value={node.webhookUrl ?? ''} onChange={(e) => onChange({ webhookUrl: e.target.value })} placeholder="https://…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Headers</label>
          <WebhookHeadersEditor headers={node.webhookHeaders ?? []} onChange={(h) => onChange({ webhookHeaders: h })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Body</label>
          <FieldMappingsEditor
            mappings={node.fieldMappings ?? []} onChange={(m) => onChange({ fieldMappings: m })}
            sourceFields={triggerFields} targetFields={[]} allowFreeTextTarget variableModule={triggerModule}
          />
        </div>
        <div className="bg-background border border-border rounded-lg p-3 text-[11px] text-text-muted">
          Delivery is at-least-once. If calling a payment or other critical API, verify it supports idempotency
          keys, or use the <code className="bg-surface px-1 rounded border border-border">X-LeadRyze-Idempotency-Key</code> header
          this action already sends on every attempt (including retries) to deduplicate on your side.
        </div>
      </>
    );
  }

  if (node.actionType === 'send_email') {
    const hasOverride = !!node.emailTo;
    return (
      <>
        <ConnectionPlaceholder />

        <SectionHeader>Recipient</SectionHeader>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Default strategy</label>
          <select
            value={node.recipientStrategy ?? 'record_contact'} onChange={(e) => onChange({ recipientStrategy: e.target.value as any })}
            disabled={hasOverride}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {hasOverride && <p className="text-[11px] text-text-muted mt-1">Ignored — the override below takes priority whenever it's set.</p>}
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Override (optional)</label>
          <RecipientMappingField mapping={node.emailTo} onChange={(m) => onChange({ emailTo: m })} sourceFields={triggerFields} variableModule={triggerModule} placeholder="e.g. customer@example.com" />
        </div>

        <SectionHeader required>Message</SectionHeader>
        <p className="text-[11px] text-text-muted -mt-1">Required: write the email below, or pick a saved template at the bottom of this section — whichever is filled in is used, inline always wins if both are.</p>
        <TextVariableField label="Subject" value={node.emailSubject ?? ''} onChange={(v) => onChange({ emailSubject: v })} module={triggerModule} placeholder="e.g. Welcome, {{record.firstName}}!" />
        <TextareaVariableField label="Body" value={node.emailBody ?? ''} onChange={(v) => onChange({ emailBody: v })} module={triggerModule} placeholder="Write the email here, or leave blank to use a saved template below" rows={5} />
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Or use a saved template instead</label>
          <select value={node.templateId ?? ''} onChange={(e) => onChange({ templateId: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
            <option value="">No template — use Subject/Body above</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>

        <SectionHeader>Options</SectionHeader>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">CC</label>
            <input value={node.emailCc ?? ''} onChange={(e) => onChange({ emailCc: e.target.value })} placeholder="comma-separated"
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">BCC</label>
            <input value={node.emailBcc ?? ''} onChange={(e) => onChange({ emailBcc: e.target.value })} placeholder="comma-separated"
              className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Reply-To</label>
          <input value={node.emailReplyTo ?? ''} onChange={(e) => onChange({ emailReplyTo: e.target.value })} placeholder="e.g. support@yourcompany.com"
            className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary" />
        </div>
        <label className="flex items-center gap-2 text-xs text-text-primary">
          <input type="checkbox" checked={!!node.emailAttachPdf} onChange={(e) => onChange({ emailAttachPdf: e.target.checked })} className="rounded border-border" />
          Attach this record's PDF (Quotation / Invoice / Work Order / Contract)
        </label>
      </>
    );
  }

  if (node.actionType === 'send_whatsapp') {
    const hasOverride = !!node.whatsappTo;
    return (
      <>
        <ConnectionPlaceholder />

        <SectionHeader>Recipient</SectionHeader>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Default strategy</label>
          <select
            value={node.recipientStrategy ?? 'record_contact'} onChange={(e) => onChange({ recipientStrategy: e.target.value as any })}
            disabled={hasOverride}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {hasOverride && <p className="text-[11px] text-text-muted mt-1">Ignored — the override below takes priority whenever it's set.</p>}
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Override (optional)</label>
          <RecipientMappingField mapping={node.whatsappTo} onChange={(m) => onChange({ whatsappTo: m })} sourceFields={triggerFields} variableModule={triggerModule} placeholder="e.g. +1 555 0100" />
        </div>

        <SectionHeader required>Message</SectionHeader>
        <div>
          <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Message type</label>
          <select value={node.whatsappMessageType ?? 'text'} onChange={(e) => onChange({ whatsappMessageType: e.target.value as any })}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
            <option value="text">Text message</option>
            <option value="template" disabled>Template message — coming soon, not yet operational</option>
            <option value="image" disabled>Image — coming soon, not yet operational</option>
            <option value="document" disabled>Document — coming soon, not yet operational</option>
          </select>
        </div>
        <p className="text-[11px] text-text-muted">Required: write the message below, or pick a saved template at the bottom of this section — whichever is filled in is used, inline always wins if both are.</p>
        <TextareaVariableField label="Message" value={node.whatsappBody ?? ''} onChange={(v) => onChange({ whatsappBody: v })} module={triggerModule} placeholder="e.g. Hi {{record.firstName}}, thanks for reaching out!" rows={4} />
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Or use a saved template instead</label>
          <select value={node.templateId ?? ''} onChange={(e) => onChange({ templateId: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
            <option value="">No template — use the message above</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
      </>
    );
  }

  // send_sms
  const hasOverride = !!node.smsTo;
  return (
    <>
      <ConnectionPlaceholder />

      <SectionHeader>Recipient</SectionHeader>
      <div>
        <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Default strategy</label>
        <select
          value={node.recipientStrategy ?? 'record_contact'} onChange={(e) => onChange({ recipientStrategy: e.target.value as any })}
          disabled={hasOverride}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {hasOverride && <p className="text-[11px] text-text-muted mt-1">Ignored — the override below takes priority whenever it's set.</p>}
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-text-muted mb-1 uppercase">Override (optional)</label>
        <RecipientMappingField mapping={node.smsTo} onChange={(m) => onChange({ smsTo: m })} sourceFields={triggerFields} variableModule={triggerModule} placeholder="e.g. +1 555 0100" />
      </div>

      <SectionHeader required>Message</SectionHeader>
      <p className="text-[11px] text-text-muted -mt-1">Required: write the message below, or pick a saved template at the bottom of this section — whichever is filled in is used, inline always wins if both are.</p>
      <TextareaVariableField label="Message" value={node.smsBody ?? ''} onChange={(v) => onChange({ smsBody: v })} module={triggerModule} placeholder="e.g. Hi {{record.firstName}}, your appointment is confirmed." rows={3} />
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Or use a saved template instead</label>
        <select value={node.templateId ?? ''} onChange={(e) => onChange({ templateId: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text-primary">
          <option value="">No template — use the message above</option>
          {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
    </>
  );
}
