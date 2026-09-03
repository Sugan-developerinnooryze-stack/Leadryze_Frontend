import { ClockIcon } from '@heroicons/react/24/outline';
import { useEntityTimelineQuery } from '../queries/timeline.queries';

// Generalized from LeadsPage.tsx's own LeadDetailPanel timeline tab (the
// first, and until now only, consumer of useEntityTimelineQuery) — same
// visual language, now reusable across any module that writes to
// logTimeline() (backend/src/modules/native-crm/timeline/timeline.service.ts).
const ACTION_COLORS: Record<string, string> = {
  created:        'bg-emerald-100 text-emerald-700',
  status_changed: 'bg-blue-100 text-blue-700',
  stage_changed:  'bg-blue-100 text-blue-700',
  updated:        'bg-gray-100 text-gray-600',
  note_added:     'bg-yellow-100 text-yellow-700',
  assigned:       'bg-purple-100 text-purple-700',
  reassigned:     'bg-indigo-100 text-indigo-700',
  converted:      'bg-emerald-100 text-emerald-700',
  uploaded:       'bg-pink-100 text-pink-700',
  locked:         'bg-orange-100 text-orange-700',
  unlocked:       'bg-teal-100 text-teal-700',
  deleted:        'bg-red-100 text-red-700',
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
        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          <span className="font-medium">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:</span>{' '}
          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    );
  }

  if (timelineEvents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      {timelineEvents.map((ev: any, i: number) => (
        <div key={ev._id ?? i} className="relative">
          <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-white dark:bg-gray-900 border-2 border-brand-400" />
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_COLORS[ev.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {(ev.action ?? '').replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">{ev.description}</p>
            <MetadataChips metadata={ev.metadata} />
          </div>
        </div>
      ))}
    </div>
  );
}
