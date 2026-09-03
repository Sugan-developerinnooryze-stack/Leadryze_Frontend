import { useRef } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { FlowNode, FlowRecipientStrategy } from '../../../modules/native-crm/queries/automation-flows.queries';
import { AutomationModule, TargetFieldDef } from '../../../modules/native-crm/queries/automation-rules.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import FieldMappingsEditor from './FieldMappingsEditor';
import VariablePicker from './VariablePicker';

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
              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
            <input
              value={h.value} onChange={(e) => patch(i, { value: e.target.value })}
              placeholder={sensitive ? 'Encrypted at rest' : 'Value'}
              type={sensitive ? 'password' : 'text'}
              title={sensitive ? `This header will be encrypted; leave as ${MASKED_PLACEHOLDER} to keep the existing value` : undefined}
              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
            />
            <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><TrashIcon className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}
      <button onClick={add} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">+ Add header</button>
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
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Target module</label>
          <select value={node.targetModule ?? ''} onChange={(e) => onChange({ targetModule: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
            <option value="">Select…</option>
            {everyModule.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Field mappings</label>
          <FieldMappingsEditor mappings={node.fieldMappings ?? []} onChange={(m) => onChange({ fieldMappings: m })} sourceFields={triggerFields} targetFields={targetFields} variableModule={triggerModule} />
        </div>
      </>
    );
  }

  if (node.actionType === 'update_record') {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Set fields on this {triggerModule || 'record'}</label>
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
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Assign to</label>
        <select
          value={current?.staticValue ?? ''}
          onChange={(e) => onChange({ fieldMappings: [{ targetField: assigneeField.key, sourceType: 'static', staticValue: e.target.value }] })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
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
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">New status</label>
        <select
          value={current?.staticValue ?? ''}
          onChange={(e) => onChange({ fieldMappings: [{ targetField: stageField.key, sourceType: 'static', staticValue: e.target.value }] })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
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
            <label className="label mb-0 text-xs font-semibold text-gray-600 uppercase tracking-wide">Note subject</label>
            <VariablePicker module={triggerModule} targetRef={noteSubjectRef} value={node.noteSubject ?? ''} onChange={(v) => onChange({ noteSubject: v })} />
          </div>
          <input ref={noteSubjectRef} value={node.noteSubject ?? ''} onChange={(e) => onChange({ noteSubject: e.target.value })} placeholder="e.g. Follow-up needed for {{record.company}}"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0 text-xs font-semibold text-gray-600 uppercase tracking-wide">Note body (optional)</label>
            <VariablePicker module={triggerModule} targetRef={noteBodyRef} value={node.noteBody ?? ''} onChange={(v) => onChange({ noteBody: v })} />
          </div>
          <textarea ref={noteBodyRef} value={node.noteBody ?? ''} onChange={(e) => onChange({ noteBody: e.target.value })} rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Assign note to (optional)</label>
          <select value={node.noteAssignedTo ?? ''} onChange={(e) => onChange({ noteAssignedTo: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Method</label>
            <select value={node.webhookMethod ?? 'POST'} onChange={(e) => onChange({ webhookMethod: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">URL</label>
            <input value={node.webhookUrl ?? ''} onChange={(e) => onChange({ webhookUrl: e.target.value })} placeholder="https://…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Headers</label>
          <WebhookHeadersEditor headers={node.webhookHeaders ?? []} onChange={(h) => onChange({ webhookHeaders: h })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Body</label>
          <FieldMappingsEditor
            mappings={node.fieldMappings ?? []} onChange={(m) => onChange({ fieldMappings: m })}
            sourceFields={triggerFields} targetFields={[]} allowFreeTextTarget variableModule={triggerModule}
          />
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-500">
          Delivery is at-least-once. If calling a payment or other critical API, verify it supports idempotency
          keys, or use the <code className="bg-white px-1 rounded border border-gray-200">X-LeadRyze-Idempotency-Key</code> header
          this action already sends on every attempt (including retries) to deduplicate on your side.
        </div>
      </>
    );
  }

  // send_email / send_sms / send_whatsapp
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0 text-xs font-semibold text-gray-600 uppercase tracking-wide">Template</label>
        </div>
        <select value={node.templateId ?? ''} onChange={(e) => onChange({ templateId: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
          <option value="">Select template…</option>
          {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Recipient</label>
        <select value={node.recipientStrategy ?? 'record_contact'} onChange={(e) => onChange({ recipientStrategy: e.target.value as any })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {Object.entries(RECIPIENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
    </>
  );
}
