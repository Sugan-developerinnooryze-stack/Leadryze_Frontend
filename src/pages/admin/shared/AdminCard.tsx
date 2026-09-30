import type { ComponentType, ReactNode } from 'react';
import { ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const CARD_BORDER = { default: 'border-border', danger: 'border-danger-500/30' } as const;

export function AdminCard({ children, className = '', tone = 'default' }: { children: ReactNode; className?: string; tone?: keyof typeof CARD_BORDER }) {
  return <div className={`bg-surface rounded-xl border ${CARD_BORDER[tone]} shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

/** Same header shape as WidgetSettingsPage.tsx's SectionHeader (icon chip +
 * title + optional description + optional right-side slot) — reused here so
 * the admin panel and tenant settings pages share one visual language. */
export function AdminCardHeader({
  icon: Icon, iconClassName = 'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400', title, description, right,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && <p className="text-xs text-text-muted mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function AdminEmptyState({ icon: Icon, title, description }: { icon: ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-12 w-12 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-text-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function AdminLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <ArrowPathIcon className="h-5 w-5 animate-spin mb-2" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

export function AdminErrorState({ title = 'Something went wrong', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-12 w-12 rounded-full bg-danger-500/10 text-danger-600 flex items-center justify-center mb-3 text-lg font-bold">!</div>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1 max-w-sm">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-xs font-medium text-ryze-600 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300">
          Try again
        </button>
      )}
    </div>
  );
}

export function AdminPermissionDenied() {
  return (
    <AdminEmptyState
      icon={LockClosedIcon}
      title="You don't have access to this section"
      description="This area is restricted. If you believe this is a mistake, contact another Super Admin."
    />
  );
}
