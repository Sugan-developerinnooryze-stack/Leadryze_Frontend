import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

export type AttentionSeverity = 'warning' | 'critical' | 'info';

interface AttentionItemProps {
  icon: HeroIcon;
  label: string;
  severity: AttentionSeverity;
  /** Deep-link into the real filtered list view (e.g. `/native-crm/tasks?overdue=true`)
   * — no new list pages, just query params the list pages already support. */
  to?: string;
}

const SEVERITY_STYLE: Record<AttentionSeverity, { bar: string; icon: string }> = {
  critical: { bar: 'bg-danger-500', icon: 'text-danger-600 dark:text-danger-500' },
  warning:  { bar: 'bg-amber-500',  icon: 'text-amber-600 dark:text-amber-500' },
  info:     { bar: 'bg-ryze-500',   icon: 'text-ryze-600 dark:text-ryze-400' },
};

export default function AttentionItem({ icon: Icon, label, severity, to }: AttentionItemProps) {
  const style = SEVERITY_STYLE[severity];
  const content = (
    <div className="flex items-center gap-3 py-2.5 pl-3 pr-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
      <span className={`w-1 self-stretch rounded-full ${style.bar} shrink-0`} aria-hidden />
      <Icon className={`h-4 w-4 shrink-0 ${style.icon}`} />
      <span className="text-sm text-text-primary flex-1">{label}</span>
    </div>
  );

  if (to) {
    return <Link to={to} className="block -ml-1">{content}</Link>;
  }
  return <div className="-ml-1">{content}</div>;
}
