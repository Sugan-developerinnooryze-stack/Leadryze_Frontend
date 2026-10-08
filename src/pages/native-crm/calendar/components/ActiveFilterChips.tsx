import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CalendarFilters } from '../calendar.types';
import { DEFAULT_CALENDAR_FILTERS } from '../calendar.types';

interface Props {
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
  teamName?: string;
  staffName?: string;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium bg-ryze-600/10 text-ryze-700 dark:text-ryze-400 border border-ryze-600/20">
      {label}
      <button onClick={onRemove} aria-label={`Remove filter: ${label}`} className="p-0.5 rounded-full hover:bg-ryze-600/20 transition-colors">
        <XMarkIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

/** One chip per active filter DIMENSION (not per event-type — toggling a
 * module off is already visible/undoable directly in the filter panel
 * itself, so it isn't re-surfaced here as a redundant chip). */
export default function ActiveFilterChips({ filters, setFilters, teamName, staffName }: Props) {
  const chips: { label: string; clear: () => void }[] = [];

  if (filters.search) chips.push({ label: `Search: "${filters.search}"`, clear: () => setFilters({ ...filters, search: '' }) });
  if (filters.teamId) chips.push({ label: `Team: ${teamName ?? '…'}`, clear: () => setFilters({ ...filters, teamId: '', staffId: '' }) });
  if (filters.staffId) chips.push({ label: `Staff: ${staffName ?? '…'}`, clear: () => setFilters({ ...filters, staffId: '' }) });
  if (filters.assignment !== 'all') {
    const label = { assigned: 'Assigned to Staff', unassigned: 'Unassigned', my: 'My Work Orders' }[filters.assignment];
    chips.push({ label: `Assignment: ${label}`, clear: () => setFilters({ ...filters, assignment: 'all' }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {chips.map((c, i) => <Chip key={i} label={c.label} onRemove={c.clear} />)}
      <button
        onClick={() => setFilters({ ...DEFAULT_CALENDAR_FILTERS, eventTypes: { ...filters.eventTypes } })}
        className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors px-1"
      >
        Clear All
      </button>
    </div>
  );
}
