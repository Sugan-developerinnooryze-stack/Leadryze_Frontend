import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface ConnectorStatusPillProps {
  name: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed';
  lastSyncAt?: string | null;
  syncError?: string | null;
}

const STATUS_CONFIG: Record<ConnectorStatusPillProps['syncStatus'], { dot: string; label: string }> = {
  idle:    { dot: 'bg-text-muted/40', label: 'Idle' },
  syncing: { dot: 'bg-ryze-500',      label: 'Syncing' },
  success: { dot: 'bg-success-500',   label: 'Connected' },
  failed:  { dot: 'bg-danger-500',    label: 'Error' },
};

function relativeTime(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ConnectorStatusPill({ name, syncStatus, lastSyncAt, syncError }: ConnectorStatusPillProps) {
  const prefersReduced = usePrefersReducedMotion();
  const cfg = STATUS_CONFIG[syncStatus];
  const synced = relativeTime(lastSyncAt);

  return (
    <div
      className="flex items-center justify-between gap-3 py-2"
      title={syncStatus === 'failed' && syncError ? syncError : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot} ${syncStatus === 'syncing' && !prefersReduced ? 'animate-pulse' : ''}`} />
        <span className="text-sm text-text-primary truncate">{name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-muted">{cfg.label}</span>
        {synced && syncStatus === 'success' && <span className="text-xs text-text-muted">· {synced}</span>}
      </div>
    </div>
  );
}
