import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

export type AttentionSeverity = 'warning' | 'critical' | 'info';

interface AttentionItemProps {
  icon: HeroIcon;
  label: string;
  severity: AttentionSeverity;
  count?: number;
  to?: string;
}

const SEVERITY_STYLE: Record<AttentionSeverity, { bg: string; border: string; badge: string; icon: string; dot: string }> = {
  critical: {
    bg: 'bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-950/30',
    border: 'border-rose-200/70 dark:border-rose-900/50',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    icon: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500 animate-pulse',
  },
  warning: {
    bg: 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/30',
    border: 'border-amber-200/70 dark:border-amber-900/50',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    icon: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-sky-50/70 dark:bg-sky-950/20 hover:bg-sky-100/70 dark:hover:bg-sky-950/30',
    border: 'border-sky-200/70 dark:border-sky-900/50',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    icon: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
};

export default function AttentionItem({ icon: Icon, label, severity, count, to }: AttentionItemProps) {
  const style = SEVERITY_STYLE[severity];
  const content = (
    <div className={`group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${style.border} ${style.bg} transition-all duration-200`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-2 w-2 rounded-full ${style.dot} shrink-0`} />
        <div className={`p-1.5 rounded-lg bg-surface/80 dark:bg-surface/40 shadow-xs shrink-0 ${style.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-text-primary truncate">{label}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {count !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${style.badge}`}>
            {count}
          </span>
        )}
        <span className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all">
          <ChevronRightIcon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }
  return content;
}
