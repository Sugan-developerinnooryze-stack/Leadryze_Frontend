import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

interface QuickActionButtonProps {
  icon: HeroIcon;
  label: string;
  to: string;
}

/** Plain link to each module's existing list page (no new create routes/
 * modals) — the target page already owns its own "+ New" affordance. */
export default function QuickActionButton({ icon: Icon, label, to }: QuickActionButtonProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-4 py-3 bg-surface border border-border rounded-xl hover:-translate-y-0.5 hover:shadow-md transition-all duration-150"
    >
      <div className="p-1.5 bg-ryze-600/10 rounded-lg shrink-0">
        <Icon className="h-4 w-4 text-ryze-600 dark:text-ryze-400" />
      </div>
      <span className="text-sm font-medium text-text-primary truncate">{label}</span>
    </Link>
  );
}
