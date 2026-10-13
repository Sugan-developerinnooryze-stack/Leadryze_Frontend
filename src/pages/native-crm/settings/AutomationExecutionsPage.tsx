import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchFlowRunById } from '../../../modules/native-crm/queries/automation-flows.queries';

/** The old standalone, cross-flow "Executions" page has been retired — runs
 * are now viewed per-flow, from inside that flow's own Studio Executions
 * tab (AutomationFlowBuilderPage.tsx), matching the n8n reference this was
 * redesigned around. This route is kept alive on purpose, as a
 * backward-compatible redirect rather than a dead link, for any bookmark or
 * notification that still points at the old URL: with a `runId`, it
 * resolves that run's owning flow and forwards straight into that run
 * inside the correct flow's Executions tab; otherwise (or if the run can't
 * be found — deleted, bad id) it falls back to the automations hub. */
export default function AutomationExecutionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId') ?? undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!runId) {
        navigate('/native-crm/settings/automations', { replace: true });
        return;
      }
      try {
        const run = await fetchFlowRunById(runId);
        if (cancelled) return;
        if (!run) throw new Error('not found');
        navigate(`/native-crm/settings/automation-flows/${run.flowId}?tab=executions&runId=${runId}`, { replace: true });
      } catch {
        if (cancelled) return;
        toast.error("That execution couldn't be found");
        navigate('/native-crm/settings/automations', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [runId, navigate]);

  return (
    <div className="flex flex-col justify-center items-center h-full gap-3 text-sm text-text-muted">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
      Redirecting…
    </div>
  );
}
