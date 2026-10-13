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
  isLoading?: boolean;
  delayMs?: number;
}

/** One "Operations Overview" column — title/count header, 3-5 recent
 * record rows, "+ View all X" link. Generic over a small {id,label,badge}
 * shape so Leads/Deals/Tasks/Work Orders all reuse this one component. */
function getInitials(name: string): string {
  if (!name) return '•';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function KanbanColumn({
  title, icon: Icon, count, rows, viewAllTo, viewAllLabel, emptyLabel, isLoading = false, delayMs = 0,
}: KanbanColumnProps) {
  return (
    <EntranceCard delayMs={delayMs} className="bg-surface rounded-2xl border border-border shadow-sm flex flex-col min-w-0 transition-all hover:shadow-md">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/80 shrink-0 bg-black/[0.01] dark:bg-white/[0.01]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-ryze-500/10 dark:bg-ryze-400/15 text-ryze-600 dark:text-ryze-400 shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[14px] font-bold text-text-primary truncate">{title}</span>
        </div>
        {isLoading ? (
          <span className="h-4 w-6 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse shrink-0" />
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-primary tabular-nums shrink-0">
            {count}
          </span>
        )}
      </div>

      <div className="flex-1 p-2.5">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Icon} title={emptyLabel} />
        ) : (
          <div className="space-y-1">
            {rows.map((row) => {
              const initials = getInitials(row.label);
              const avatarColor = getAvatarColor(row.label);
              const content = (
                <div className="group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] border border-transparent hover:border-border/60 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor}`}>
                      {initials}
                    </span>
                    <span className="text-xs font-medium text-text-primary truncate group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors">
                      {row.label}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider whitespace-nowrap ${row.badgeColorClass ?? 'text-text-muted bg-black/[0.04] dark:bg-white/[0.06]'}`}>
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

      <div className="px-4 py-3 border-t border-border/80 shrink-0 bg-black/[0.01] dark:bg-white/[0.01]">
        <Link to={viewAllTo} className="text-xs font-semibold text-ryze-600 dark:text-ryze-400 hover:text-ryze-700 flex items-center gap-1 group">
          <span>{viewAllLabel}</span>
          <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
        </Link>
      </div>
    </EntranceCard>
  );
}
