import { useRef } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { FieldMapping, AutomationModule } from '../../../modules/native-crm/queries/automation-rules.queries';
import VariablePicker from './VariablePicker';

/** Extracted from AutomationFlowBuilderPage.tsx (was previously local to
 * that file) so ActionNodeConfig.tsx can reuse it too without a circular
 * import between the two. Pure controlled-array-of-objects editor — no
 * internal state, every keystroke propagates straight back to the caller. */
export default function FieldMappingsEditor({ mappings, onChange, sourceFields, targetFields, allowFreeTextTarget, variableModule }: {
  mappings: FieldMapping[]; onChange: (m: FieldMapping[]) => void;
  sourceFields: { key: string; label: string }[]; targetFields: { key: string; label: string }[];
  /** Webhook body mappings write into an arbitrary JSON key, not a catalog
   * field — lets the target be free-text instead of a catalog `<select>`. */
  allowFreeTextTarget?: boolean;
  /** When supplied, each row's "Fixed value" input gets a VariablePicker
   * scoped to this module's field catalog (record.* variables come from the
   * SOURCE record at execution time, which is this module in every caller
   * of this component today). Omitted = no picker (e.g. a context with no
   * single well-defined module). */
  variableModule?: AutomationModule | '';
}) {
  const add = () => onChange([...mappings, { targetField: '', sourceType: 'field', sourceField: '' }]);
  const remove = (i: number) => onChange(mappings.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<FieldMapping>) => onChange(mappings.map((m, idx) => (idx === i ? { ...m, ...p } : m)));
  // One ref per row, keyed by index — VariablePicker needs the actual
  // <input> DOM node to insert {{token}} at the current cursor position.
  const staticValueRefs = useRef<Record<number, HTMLInputElement | null>>({});

  return (
    <div className="space-y-2">
      {mappings.map((m, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {allowFreeTextTarget ? (
            <input value={m.targetField} onChange={(e) => patch(i, { targetField: e.target.value })} placeholder="JSON key…"
              className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg" />
          ) : (
            <select value={m.targetField} onChange={(e) => patch(i, { targetField: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
              <option value="">Set field…</option>
              {targetFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          )}
          <span className="text-[10px] text-gray-400">=</span>
          <select value={m.sourceType} onChange={(e) => patch(i, { sourceType: e.target.value as any })} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
            <option value="field">From field</option>
            <option value="static">Fixed value</option>
          </select>
          {m.sourceType === 'field' ? (
            <select value={m.sourceField ?? ''} onChange={(e) => patch(i, { sourceField: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg">
              <option value="">Source field…</option>
              {sourceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          ) : (
            <>
              <input
                ref={(el) => { staticValueRefs.current[i] = el; }}
                value={m.staticValue ?? ''} onChange={(e) => patch(i, { staticValue: e.target.value })} placeholder="Value"
                className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg"
              />
              {variableModule !== undefined && (
                <VariablePicker
                  module={variableModule} targetRef={{ current: staticValueRefs.current[i] }}
                  value={m.staticValue ?? ''} onChange={(v) => patch(i, { staticValue: v })}
                  className="shrink-0 text-[10px] text-brand-600 hover:text-brand-700 px-1.5 py-1 border border-brand-200 rounded bg-brand-50 hover:bg-brand-100"
                />
              )}
            </>
          )}
          <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><TrashIcon className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={add} className="text-[11px] font-medium text-brand-600 hover:text-brand-700">+ Add field mapping</button>
    </div>
  );
}
