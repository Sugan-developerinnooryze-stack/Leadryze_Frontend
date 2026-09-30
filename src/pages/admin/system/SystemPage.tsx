import { CpuChipIcon, ServerIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function SystemPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-bold text-text-primary">System Settings</h1>
        <p className="text-sm text-text-muted mt-0.5">Global configuration and environment variables for this deployment.</p>
      </div>

      {[
        { icon: CpuChipIcon,     label: 'Environment', value: import.meta.env.MODE ?? 'production', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-500/10' },
        { icon: ServerIcon,      label: 'Platform',    value: 'Node.js / TypeScript',                color: 'text-success-600 dark:text-success-500', bg: 'bg-success-500/10' },
        { icon: ShieldCheckIcon, label: 'Auth',        value: 'JWT + Role-based access control',      color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
      ].map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border shadow-sm">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg} ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide font-semibold">{label}</p>
            <p className="text-sm text-text-primary font-medium mt-0.5">{value}</p>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Environment variables are set on the server</p>
          <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1">
            Update credentials via your <code className="bg-amber-100 dark:bg-amber-500/20 px-1 rounded">.env</code> file or deployment secrets manager. Restart the backend service after changes.
          </p>
        </div>
      </div>
    </div>
  );
}
