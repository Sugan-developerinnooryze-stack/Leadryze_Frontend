import { useDecideApproval, type AutomationFlowRun } from '../../../modules/native-crm/queries/automation-flows.queries';

// Doubles as both a run-level status color map (completed/partial/failed/
// running/paused) AND a per-step status color map (success/failed/skipped/
// unknown, used by NodeConfigPanel's Data tab) — loosely typed since the two
// value sets overlap but aren't identical; the `?? fallback` at each call
// site covers any status this map doesn't explicitly list.
export const RUN_STATUS_COLOR: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700', partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700', running: 'bg-blue-100 text-blue-700', paused: 'bg-orange-100 text-orange-700',
  success: 'bg-emerald-100 text-emerald-700', skipped: 'bg-gray-100 text-gray-600',
  // Deliberately not red/emerald/gray — a step whose delivery outcome is
  // unconfirmed must never read as a definite failure or success at a glance.
  unknown: 'bg-purple-100 text-purple-700',
};

/** Approve/Reject buttons for a run paused on an Approval node — same real
 * decision endpoint the builder's History panel already uses. */
export function ApprovalDecisionButtons({ run }: { run: AutomationFlowRun }) {
  const decideMut = useDecideApproval();
  if (run.status !== 'paused' || run.pauseState?.kind !== 'approval') return null;
  return (
    <div className="flex gap-2 mb-4">
      <button onClick={() => decideMut.mutate({ runId: run._id, decision: 'approve' })}
        className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">Approve</button>
      <button onClick={() => decideMut.mutate({ runId: run._id, decision: 'reject' })}
        className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">Reject</button>
    </div>
  );
}
