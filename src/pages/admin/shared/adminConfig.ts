export const PLAN_CONFIG: Record<string, { label: string; cls: string }> = {
  starter:      { label: 'Starter',      cls: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border' },
  growth:       { label: 'Growth',       cls: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20' },
  professional: { label: 'Professional', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' },
  enterprise:   { label: 'Enterprise',   cls: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20' },
};

export const CONNECTOR_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  zoho:       { dot: 'bg-blue-500',   label: 'Zoho',       bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400' },
  hubspot:    { dot: 'bg-orange-500', label: 'HubSpot',    bg: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-400' },
  salesforce: { dot: 'bg-sky-500',    label: 'Salesforce', bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20 text-sky-700 dark:text-sky-400' },
  mysql:      { dot: 'bg-teal-500',   label: 'MySQL',      bg: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-400' },
  postgresql: { dot: 'bg-indigo-500', label: 'PostgreSQL', bg: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400' },
  mongodb:    { dot: 'bg-green-500',  label: 'MongoDB',    bg: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400' },
  rest:       { dot: 'bg-purple-500', label: 'REST API',   bg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400' },
};

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
