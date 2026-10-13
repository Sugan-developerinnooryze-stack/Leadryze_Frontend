import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

interface QuickActionButtonProps {
  icon: HeroIcon;
  label: string;
  to: string;
  description?: string;
  accent?: 'teal' | 'blue' | 'indigo' | 'amber' | 'emerald' | 'purple' | 'rose';
}

const ACCENTS = {
  teal: 'bg-ryze-500/10 text-ryze-600 dark:text-ryze-400 group-hover:bg-ryze-500 group-hover:text-white',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white',
};

export default function QuickActionButton({ icon: Icon, label, to, description, accent = 'teal' }: QuickActionButtonProps) {
  const accentClass = ACCENTS[accent] ?? ACCENTS.teal;
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl hover:-translate-y-0.5 hover:shadow-md hover:border-ryze-400/40 transition-all duration-200"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2.5 rounded-xl shrink-0 transition-all duration-200 ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-semibold text-text-primary block truncate group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors">
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-text-muted block truncate mt-0.5">
              {description}
            </span>
          )}
        </div>
      </div>
      <span className="p-1 rounded-md text-text-muted group-hover:text-ryze-600 dark:group-hover:text-ryze-400 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <PlusIcon className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
