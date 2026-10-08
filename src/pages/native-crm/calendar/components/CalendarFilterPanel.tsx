import { Dispatch, SetStateAction } from 'react';
import {
  WrenchScrewdriverIcon, DocumentTextIcon, DocumentCheckIcon,
  ClipboardDocumentListIcon, MagnifyingGlassIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTeamsListQuery } from '../../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery } from '../../../../modules/native-crm/queries/staffs.queries';
import { useModuleAccess } from '../calendar-access';
import { MODULE_COLORS } from '../calendar-status';
import type { CalendarFilters, CalendarEventTypeKey, WorkOrderAssignment } from '../calendar.types';
import { DEFAULT_CALENDAR_FILTERS } from '../calendar.types';
import CalendarLegend from './CalendarLegend';

const EVENT_TYPE_CONFIG: { key: CalendarEventTypeKey; label: string; icon: any }[] = [
  { key: 'workorder', label: 'Work Orders', icon: WrenchScrewdriverIcon },
  { key: 'invoice',   label: 'Invoices',    icon: DocumentTextIcon },
  { key: 'contract',  label: 'Contracts',   icon: DocumentCheckIcon },
  { key: 'quotation', label: 'Quotations',  icon: ClipboardDocumentListIcon },
];

const ASSIGNMENT_OPTIONS: { key: WorkOrderAssignment; label: string }[] = [
  { key: 'all',        label: 'All Work Orders' },
  { key: 'assigned',   label: 'Assigned to Staff' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'my',         label: 'My Work Orders' },
];

interface Props {
  filters: CalendarFilters;
  setFilters: Dispatch<SetStateAction<CalendarFilters>>;
  /** Below the lg breakpoint this renders as a slide-in overlay instead of
   * a static column (desktop: always visible; tablet/mobile: a toggle
   * button in the header opens it) — the calendar grid otherwise has no
   * usable width left at phone/tablet sizes. */
  open: boolean;
  onClose: () => void;
}

export default function CalendarFilterPanel({ filters, setFilters, open, onClose }: Props) {
  const { canView } = useModuleAccess();
  const { data: teamsData } = useTeamsListQuery({ page: 1, limit: 200, status: 'active' });
  const { data: staffsData } = useStaffsListQuery({ page: 1, limit: 500, status: 'active', teamId: filters.teamId || undefined });
  const teams = teamsData?.items ?? [];
  const staffs = staffsData?.items ?? [];

  const toggleType = (key: CalendarEventTypeKey) =>
    setFilters((p) => ({ ...p, eventTypes: { ...p.eventTypes, [key]: !p.eventTypes[key] } }));

  const setTeam = (teamId: string) =>
    // Changing team invalidates a staff pick from a different team.
    setFilters((p) => ({ ...p, teamId, staffId: '' }));

  const visibleTypes = EVENT_TYPE_CONFIG.filter((t) => canView(t.key));

  return (
    <>
      {/* Backdrop — mobile/tablet only, while the panel is open */}
      {open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />
      )}
      <div
        className={`w-72 flex-shrink-0 bg-surface/95 lg:bg-surface/60 backdrop-blur-xl border-r border-border h-full flex flex-col p-6 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-y-auto
          fixed inset-y-0 left-0 z-40 transition-transform duration-200
          lg:static lg:z-20 lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
      <div className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Calendar</h2>
          <p className="text-xs text-text-muted mt-0.5">Plan and manage all your field operations in one place.</p>
        </div>
        <button onClick={onClose} aria-label="Close filters" className="lg:hidden p-1.5 -mt-1 -mr-1 rounded-lg text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] shrink-0">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          placeholder="Search events, customers..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        />
      </div>

      {/* Team */}
      <div className="mb-5">
        <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-2">Team</label>
        <select
          value={filters.teamId}
          onChange={(e) => setTeam(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        >
          <option value="">All Teams</option>
          {teams.map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>

      {/* Staff */}
      <div className="mb-6">
        <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-2">Staff Member</label>
        <select
          value={filters.staffId}
          onChange={(e) => setFilters((p) => ({ ...p, staffId: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400"
        >
          <option value="">All Staff Members</option>
          {staffs.map((s: any) => <option key={s._id} value={s._id}>{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</option>)}
        </select>
      </div>

      {/* Event Types */}
      {visibleTypes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Event Types</h3>
          <div className="space-y-2">
            {visibleTypes.map(({ key, label, icon: Icon }) => {
              const active = filters.eventTypes[key];
              const classes = MODULE_COLORS[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleType(key)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    active ? 'bg-surface shadow-sm border-border text-text-primary' : 'bg-transparent border-transparent text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${active ? classes.bg : 'bg-black/[0.04] dark:bg-white/[0.06]'} ${active ? classes.text : 'text-text-muted'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-left">{label}</span>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${active ? 'border-ryze-500 bg-ryze-600' : 'border-border'}`}>
                    {active && <div className="w-1.5 h-1.5 bg-surface rounded-sm" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Work Order Assignment */}
      {canView('workorder') && (
        <div className="mb-6">
          <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Work Order Assignment</h3>
          <div className="space-y-1.5">
            {ASSIGNMENT_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 px-1 py-1 cursor-pointer text-sm text-text-primary">
                <input
                  type="radio"
                  name="wo-assignment"
                  checked={filters.assignment === key}
                  onChange={() => setFilters((p) => ({ ...p, assignment: key }))}
                  className="h-3.5 w-3.5 accent-ryze-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="pt-1">
        <button
          onClick={() => setFilters({ ...DEFAULT_CALENDAR_FILTERS, eventTypes: { ...DEFAULT_CALENDAR_FILTERS.eventTypes } })}
          className="w-full py-2 text-xs font-semibold text-text-muted hover:text-text-primary border border-border rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          Clear Filters
        </button>
      </div>

      <div className="mt-auto pt-6 border-t border-border/60">
        <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Legend</h3>
        <CalendarLegend />
      </div>
      </div>
    </>
  );
}
