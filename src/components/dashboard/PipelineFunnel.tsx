import { ChartBarIcon } from '@heroicons/react/24/outline';
import ProgressBar from './ProgressBar';
import EmptyState from './EmptyState';

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  colorClass?: string;
}

interface PipelineFunnelProps {
  stages: PipelineStage[];
  emptyLabel: string;
}

/** Stage list built from ProgressBar — used for both the Sales Pipeline
 * funnel and the Task/Work-Order status breakdown. Built-in empty state. */
export default function PipelineFunnel({ stages, emptyLabel }: PipelineFunnelProps) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const max = Math.max(1, ...stages.map((s) => s.count));

  if (stages.length === 0 || total === 0) {
    return <EmptyState icon={ChartBarIcon} title={emptyLabel} />;
  }

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span className="text-sm text-text-muted flex-1 truncate">{s.label}</span>
          <div className="flex items-center gap-2 w-36">
            <div className="flex-1">
              <ProgressBar value={(s.count / max) * 100} colorClass={s.colorClass} />
            </div>
            <span className="text-sm font-semibold text-text-primary tabular-nums w-8 text-right">{s.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
