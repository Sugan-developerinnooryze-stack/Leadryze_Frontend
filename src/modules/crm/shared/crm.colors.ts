const NEUTRAL = { bg: 'bg-black/[0.06] dark:bg-white/[0.08]', text: 'text-text-muted' };
const SUCCESS = { bg: 'bg-success-500/15',                    text: 'text-success-700 dark:text-success-500' };
const DANGER  = { bg: 'bg-danger-500/15',                     text: 'text-danger-700 dark:text-danger-500' };

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // Contact status
  lead:                      { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  contact:                   { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  customer:                  SUCCESS,
  // Company status
  active:                    SUCCESS,
  inactive:                  NEUTRAL,
  // Deal stages
  prospect:                  { bg: 'bg-amber-100 dark:bg-amber-500/15',   text: 'text-amber-700 dark:text-amber-400' },
  qualified:                 { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  proposal:                  { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  negotiation:               { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400' },
  closed_won:                SUCCESS,
  closed_lost:               DANGER,
  // Task status
  todo:                      NEUTRAL,
  in_progress:               { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  done:                      SUCCESS,
  cancelled:                 NEUTRAL,
  // Ticket status
  open:                      DANGER,
  resolved:                  SUCCESS,
  closed:                    NEUTRAL,
  // Call / meeting status
  planned:                   { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  completed:                 SUCCESS,
  missed:                    DANGER,
  scheduled:                 { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  // Priority
  low:                       NEUTRAL,
  medium:                    { bg: 'bg-amber-100 dark:bg-amber-500/15',   text: 'text-amber-700 dark:text-amber-400' },
  high:                      DANGER,
  critical:                  { bg: 'bg-rose-100 dark:bg-rose-500/15',     text: 'text-rose-700 dark:text-rose-400' },
  // Lifecycle stage (HubSpot-style)
  subscriber:                NEUTRAL,
  marketing_qualified_lead:  { bg: 'bg-cyan-100 dark:bg-cyan-500/15',     text: 'text-cyan-700 dark:text-cyan-400' },
  sales_qualified_lead:      { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400' },
  opportunity:               { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  evangelist:                { bg: 'bg-pink-100 dark:bg-pink-500/15',     text: 'text-pink-700 dark:text-pink-400' },
  other:                     NEUTRAL,
  // Lead status
  new:                       { bg: 'bg-blue-100 dark:bg-blue-500/15',     text: 'text-blue-700 dark:text-blue-400' },
  open_deal:                 { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400' },
  unqualified:               NEUTRAL,
  attempted_to_contact:      { bg: 'bg-amber-100 dark:bg-amber-500/15',   text: 'text-amber-700 dark:text-amber-400' },
  connected:                 SUCCESS,
  bad_timing:                { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400' },
};

export function statusColor(value: string) {
  return STATUS_COLORS[value] ?? NEUTRAL;
}
