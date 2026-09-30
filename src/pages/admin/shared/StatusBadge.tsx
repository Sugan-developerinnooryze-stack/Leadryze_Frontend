export type StatusTone = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

const TONE_CLS: Record<StatusTone, string> = {
  success: 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20',
  danger:  'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20',
  warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  neutral: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border',
  info:    'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
};

const DOT_CLS: Record<StatusTone, string> = {
  success: 'bg-success-500',
  danger:  'bg-danger-500',
  warning: 'bg-amber-500',
  neutral: 'bg-text-muted',
  info:    'bg-blue-500',
};

export function StatusBadge({ label, tone, dot = true }: { label: string; tone: StatusTone; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${TONE_CLS[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT_CLS[tone]}`} />}
      {label}
    </span>
  );
}

/** Tenant / client-level active-inactive — the "kill switch" status. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge label={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'danger'} />;
}

/** Whether a Controls-tab toggle actually changes any backend behavior today
 * — see the plan's authoritative inventory. Never hide a toggle; always say
 * plainly whether it does anything yet. */
export function EnforcedBadge({ enforced }: { enforced: boolean }) {
  return <StatusBadge label={enforced ? 'Enforced' : 'Not enforced yet'} tone={enforced ? 'success' : 'warning'} />;
}

export function HealthBadge({ status }: { status: 'healthy' | 'failed' | 'pending' | 'unknown' }) {
  const map: Record<typeof status, { label: string; tone: StatusTone }> = {
    healthy: { label: 'Healthy', tone: 'success' },
    failed:  { label: 'Failed',  tone: 'danger'  },
    pending: { label: 'Pending', tone: 'neutral' },
    unknown: { label: 'Unknown', tone: 'neutral' },
  };
  const { label, tone } = map[status];
  return <StatusBadge label={label} tone={tone} />;
}
