import { useBranchesQuery } from '../../../modules/native-crm/queries/branch.queries';

/** Phase 6 branch scoping — shared by both engines' trigger config
 * (AutomationFlowBuilderPage's NodeConfigPanel, AutomationRulesPage's own
 * trigger section), so the picker and its warning copy stay identical
 * rather than drifting between the two builders. Absent/empty `branchIds`
 * (the `onChange` callback receives `undefined` when nothing is checked) is
 * the unscoped default — matches every branch, same as today's behavior for
 * every existing flow/rule. */
export default function BranchScopePicker({
  branchIds, onChange,
}: {
  branchIds: string[] | undefined;
  onChange: (branchIds: string[] | undefined) => void;
}) {
  const { data } = useBranchesQuery();
  const branches = (data?.items ?? []).filter((b) => b.status === 'active');
  if (branches.length === 0) return null; // this tenant has no branches at all — nothing to scope to

  const selected = new Set(branchIds ?? []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next.size === 0 ? undefined : Array.from(next));
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Scope to specific branches (optional)</label>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
        {branches.map((b) => (
          <label key={b._id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={selected.has(b._id)} onChange={() => toggle(b._id)} className="rounded border-gray-300" />
            {b.branchName}
          </label>
        ))}
      </div>
      {selected.size > 0 ? (
        <p className="text-[11px] text-amber-600 mt-1.5">Records with no branch assigned will not match this trigger.</p>
      ) : (
        <p className="text-[11px] text-gray-400 mt-1.5">Unscoped — matches records in any branch.</p>
      )}
    </div>
  );
}
