import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';
import EntranceCard from './EntranceCard';
import EmptyState from './EmptyState';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

export interface KanbanRow {
  id: string;
  label: string;
  badge: string;
  badgeColorClass?: string; // e.g. 'text-blue-600 bg-blue-50 dark:bg-blue-500/10'
  to?: string;
}

interface KanbanColumnProps {
  title: string;
  icon: HeroIcon;
  count: number;
  rows: KanbanRow[];
  viewAllTo: string;
  viewAllLabel: string;
  emptyLabel: string;
  delayMs?: number;
}

/** One "Operations Overview" column — title/count header, 3-5 recent
 * record rows, "+ View all X" link. Generic over a small {id,label,badge}
 * shape so Leads/Deals/Tasks/Work Orders all reuse this one component. */
export default function KanbanColumn({
  title, icon: Icon, count, rows, viewAllTo, viewAllLabel, emptyLabel, delayMs = 0,
}: KanbanColumnProps) {
  return (
    <EntranceCard delayMs={delayMs} className="bg-surface rounded-2xl border border-border shadow-sm flex flex-col min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-ryze-600 dark:text-ryze-400 shrink-0" />
          <span className="text-[15px] font-semibold text-text-primary truncate">{title}</span>
        </div>
        <span className="text-xs font-semibold text-text-muted tabular-nums shrink-0">{count}</span>
      </div>

      <div className="flex-1 p-2">
        {rows.length === 0 ? (
          <EmptyState icon={Icon} title={emptyLabel} />
        ) : (
          <div className="space-y-0.5">
            {rows.map((row) => {
              const content = (
                <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                  <span className="text-sm text-text-primary truncate">{row.label}</span>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${row.badgeColorClass ?? 'text-text-muted bg-black/[0.04] dark:bg-white/[0.06]'}`}>
                    {row.badge}
                  </span>
                </div>
              );
              return row.to ? (
                <Link key={row.id} to={row.to} className="block">{content}</Link>
              ) : (
                <div key={row.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border shrink-0">
        <Link to={viewAllTo} className="text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:underline">
          + {viewAllLabel}
        </Link>
      </div>
    </EntranceCard>
  );
}
