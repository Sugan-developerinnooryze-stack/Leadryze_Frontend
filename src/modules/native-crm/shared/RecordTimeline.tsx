import { ClockIcon } from '@heroicons/react/24/outline';
import { useEntityTimelineQuery } from '../queries/timeline.queries';
import { useUserNameMap } from './useUserNameMap';

/** Turns a raw snake_case/camelCase value like "closed_won" into "Closed
 * won" — a generic, safe readability pass (not the tenant's own customized
 * pipeline-stage label, which would need a per-module network lookup this
 * component deliberately avoids to stay a true drop-in for any module). */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Generalized from LeadsPage.tsx's own LeadDetailPanel timeline tab (the
// first, and until now only, consumer of useEntityTimelineQuery) — same
// visual language, now reusable across any module that writes to
// logTimeline() (backend/src/modules/native-crm/timeline/timeline.service.ts).
const ACTION_COLORS: Record<string, string> = {
  created:        'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  status_changed: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  stage_changed:  'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  updated:        'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted',
  note_added:     'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  assigned:       'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  reassigned:     'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  converted:      'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  uploaded:       'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
  locked:         'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400',
  unlocked:       'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400',
  deleted:        'bg-danger-500/15 text-danger-700 dark:text-danger-500',
};

/** A record's `metadata` object (see logTimeline's own doc comment) is
 * arbitrary per action type — rendered generically as "key: value" chips
 * rather than one bespoke formatter per module/action, so this stays a
 * true drop-in for any entityModule without per-module wiring here. */
function MetadataChips({ metadata }: { metadata?: Record<string, any> }) {
  if (!metadata || typeof metadata !== 'object') return null;
  const entries = Object.entries(metadata).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
          <span className="font-medium">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:</span>{' '}
          {typeof v === 'object' ? JSON.stringify(v) : typeof v === 'string' ? humanize(v) : String(v)}
        </span>
      ))}
    </div>
  );
}

/** Drop-in Timeline tab content for any module's detail panel — pass the
 * same `entityModule` string used server-side in that module's own
 * logTimeline() calls (e.g. 'deal', 'task', 'contract', 'customer', 'leads')
 * and the record's real `_id`. */
export default function RecordTimeline({ entityModule, entityId }: { entityModule: string; entityId: string }) {
  const { data: timelineEvents = [], isLoading } = useEntityTimelineQuery(entityModule, entityId);
  // LR-UI-002: timeline.model.ts already carries a separate, clean
  // `performedBy` (User._id) field alongside the free-text `description` —
  // this was never read before, even though `description` often bakes the
  // same raw id into its own sentence (e.g. "Reassigned ... by <id>").
  // Resolving the KNOWN exact value this way avoids a fragile blind regex
  // over arbitrary description text.
  const userNames = useUserNameMap();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
      {timelineEvents.map((ev: any, i: number) => (
        <div key={ev._id ?? i} className="relative">
          <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-surface border-2 border-ryze-400" />
          <div className="bg-background rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_COLORS[ev.action] ?? 'bg-black/[0.06] dark:bg-white/[0.08] text-text-muted'}`}>
                {(ev.action ?? '').replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-text-muted ml-auto">
                {ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <p className="text-xs text-text-primary">
              {ev.performedBy && ev.description?.includes(ev.performedBy) && userNames.has(ev.performedBy)
                ? ev.description.split(ev.performedBy).join(userNames.get(ev.performedBy))
                : ev.description}
            </p>
            <MetadataChips metadata={ev.metadata} />
          </div>
        </div>
      ))}
    </div>
  );
}
