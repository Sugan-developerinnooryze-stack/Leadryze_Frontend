import { Link } from 'react-router-dom';
import type { FC, SVGProps } from 'react';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

interface EmptyStateProps {
  icon: HeroIcon;
  title: string;
  ctaLabel?: string;
  ctaTo?: string;
}

/** The generic "No X yet — Create your first X" block, reused by every
 * dashboard widget instead of each one hand-rolling its own empty state. */
export default function EmptyState({ icon: Icon, title, ctaLabel, ctaTo }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-10 w-10 mb-2 text-text-muted/50" />
      <p className="text-sm text-text-muted">{title}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="mt-3 text-xs font-medium text-ryze-600 dark:text-ryze-400 hover:underline"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
