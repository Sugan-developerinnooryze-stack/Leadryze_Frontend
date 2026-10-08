export interface StatusClasses {
  bg:       string;
  text:     string;
  dot:      string;
  // Full literal class, not computed at runtime from `dot` — Tailwind's
  // build-time scanner only picks up classes that appear as complete
  // string literals somewhere in source; a `.replace('bg-','border-l-')`
  // trick at runtime produces a class with no generated CSS behind it.
  borderL4: string;
}

const SUCCESS: StatusClasses = { bg: 'bg-success-500/15', text: 'text-success-700 dark:text-success-500', dot: 'bg-success-500', borderL4: 'border-l-success-500' };
const DANGER:  StatusClasses = { bg: 'bg-danger-500/15',  text: 'text-danger-700 dark:text-danger-500',   dot: 'bg-danger-500',  borderL4: 'border-l-danger-500' };
const INFO:    StatusClasses = { bg: 'bg-ryze-500/15',    text: 'text-ryze-700 dark:text-ryze-400',       dot: 'bg-ryze-500',    borderL4: 'border-l-ryze-500' };
const NEUTRAL: StatusClasses = { bg: 'bg-black/[0.06] dark:bg-white/[0.08]', text: 'text-text-muted',     dot: 'bg-text-muted',  borderL4: 'border-l-border' };
const WARNING: StatusClasses = { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', borderL4: 'border-l-amber-500' };

/** Per-module identity color — explicit, fixed per-module palette (Work
 * Order green / Invoice red / Contract purple / Quotation yellow), the same
 * 4 classes used everywhere a module's identity is shown: the filter panel,
 * the Legend, the Create menu, and — critically — the event cards drawn
 * inside the calendar grid itself (calendar-event.mapper.ts), so a card's
 * color always means "which module this is", never "what status it's in".
 * Status still drives the small Status badge in the hover popover/drawer
 * and the overdue-icon indicator — just not the card's own background. */
export const MODULE_COLORS: Record<'workorder' | 'invoice' | 'contract' | 'quotation', StatusClasses> = {
  workorder: SUCCESS,
  invoice:   { bg: 'bg-red-100 dark:bg-red-500/15',       text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500',    borderL4: 'border-l-red-500' },
  contract:  { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500', borderL4: 'border-l-purple-500' },
  quotation: { bg: 'bg-yellow-100 dark:bg-yellow-500/15', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', borderL4: 'border-l-yellow-500' },
};

/** Default-only fallback heuristic, not a source of truth — a tenant's real
 * stage keys/labels are configurable per pipeline-config.service.ts, so this
 * keyword match exists purely to give an otherwise-unrecognized status a
 * sensible default color. Callers that already know a status's real
 * semantic outcome (e.g. via PipelineStage.outcome) should resolve color
 * from that instead of this heuristic when possible. Returns Tailwind token
 * classes (ryze/success/danger/neutral/amber) so dark mode works
 * automatically, same as every other page in this app — never raw hex. */
export function getEventStatusClasses(status: string | undefined | null): StatusClasses {
  const s = (status ?? '').toLowerCase();
  if (s.includes('completed') || s.includes('paid') || s.includes('approved')) return SUCCESS;
  if (s.includes('overdue')) return DANGER;
  if (s.includes('cancelled') || s.includes('rejected') || s.includes('draft')) return NEUTRAL;
  if (s.includes('scheduled') || s.includes('active') || s.includes('in_progress')) return INFO;
  return WARNING; // pending/upcoming/sent/unrecognized
}
