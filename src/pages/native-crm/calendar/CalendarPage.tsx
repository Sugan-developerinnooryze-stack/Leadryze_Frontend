import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, FunnelIcon } from '@heroicons/react/24/outline';
import type { EventClickArg, EventHoveringArg, MoreLinkArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';

import { useCalendarData, ViewRange } from './useCalendarData';
import { BusinessEvent, CalendarFilters, DEFAULT_CALENDAR_FILTERS } from './calendar.types';
import CalendarFilterPanel from './components/CalendarFilterPanel';
import ActiveFilterChips from './components/ActiveFilterChips';
import CalendarKPI from './components/CalendarKPI';
import CalendarDrawer from './components/CalendarDrawer';
import CreateEventModal from './components/CreateEventModal';
import CreateMenu from './components/CreateMenu';
import SummaryDrawer from './components/SummaryDrawer';
import { DayCellSummary } from './components/DayCellSummary';
import EventHoverPopover, { useEventHoverIntent } from './components/EventHoverPopover';
import { CompanyFilterBar } from '../../../components/native-crm/CompanyFilterBar';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

function currentMonthRange(): ViewRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end:   new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export default function CalendarPage() {
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      // Small timeout ensures CSS transitions/flexbox have settled
      setTimeout(() => {
        calRef.current?.getApi().updateSize();
      }, 50);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filters state — one combined object, every dimension composes with
  // every other (see calendar.types.ts's CalendarFilters doc comment).
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);

  // UI State
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [currentDateTitle, setCurrentDateTitle] = useState('');
  // Seeded to the current month so the very first fetch (before FullCalendar's
  // own datesSet fires) is already date-range-scoped, not unbounded.
  const [viewRange, setViewRange] = useState<ViewRange>(currentMonthRange);
  const [selectedEvent, setSelectedEvent] = useState<BusinessEvent | null>(null);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [summaryData, setSummaryData] = useState<{ dateStr: string, module: string | null, events: BusinessEvent[] } | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false); // mobile/tablet overlay toggle — desktop ignores this (always visible via lg: classes)

  // Data fetching & processing hook
  const { allEvents, detailedEvents, isLoading, errors } = useCalendarData(filters, viewRange);

  // Resolve display names for the active-filter chips (lookups already
  // fetched by CalendarFilterPanel's own queries — cheap, cached re-fetch).
  const { data: teamsData } = useTeamsListQuery({ page: 1, limit: 200, status: 'active' });
  const { data: staffsData } = useStaffsListQuery({ page: 1, limit: 500, status: 'active' });
  const teamName = useMemo(() => teamsData?.items?.find((t: any) => t._id === filters.teamId)?.name, [teamsData, filters.teamId]);
  const staffName = useMemo(() => {
    const s = staffsData?.items?.find((x: any) => x._id === filters.staffId);
    return s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : undefined;
  }, [staffsData, filters.staffId]);

  // Hover popover — one shared instance, repositioned per event (see
  // EventHoverPopover.tsx's own doc comment for why this isn't headlessui's
  // click-driven Popover state).
  const hover = useEventHoverIntent();

  // Calendar Actions
  const handlePrev = () => calRef.current?.getApi().prev();
  const handleNext = () => calRef.current?.getApi().next();
  const handleToday = () => calRef.current?.getApi().today();

  const handleViewChange = (view: ViewType) => {
    calRef.current?.getApi().changeView(view);
    setCurrentView(view);
  };

  const handleDatesSet = (arg: any) => {
    setCurrentDateTitle(arg.view.title);
    setCurrentView(arg.view.type as ViewType);
    setViewRange({ start: arg.view.activeStart, end: arg.view.activeEnd });
  };

  const handleEventClick = useCallback((arg: EventClickArg) => {
    hover.cancelClose();
    setSelectedEvent(arg.event.extendedProps as BusinessEvent);
  }, [hover]);

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setCreateDate(arg.date);
  }, []);

  const handleEventMouseEnter = useCallback((arg: EventHoveringArg) => {
    hover.open(arg.event.extendedProps as BusinessEvent, arg.el);
  }, [hover]);

  const handleEventMouseLeave = useCallback(() => {
    hover.scheduleClose();
  }, [hover]);

  // "+N more" — open the existing SummaryDrawer with every event for that
  // day (not just the hidden ones, so the user sees the full picture),
  // instead of FullCalendar's own default list popover.
  const handleMoreLinkClick = useCallback((arg: MoreLinkArg) => {
    const dateStr = arg.date.toISOString().split('T')[0];
    const dayEvents = allEvents.filter(ev => new Date(ev.start).toISOString().split('T')[0] === dateStr);
    setSummaryData({ dateStr, module: null, events: dayEvents });
    return 'none' as const; // suppress FullCalendar's own popover
  }, [allEvents]);

  const anyErrors = Object.entries(errors).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="flex h-full bg-background -m-6 relative overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-ryze-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Filter Panel */}
      <CalendarFilterPanel filters={filters} setFilters={setFilters} open={filterPanelOpen} onClose={() => setFilterPanelOpen(false)} />

      {/* Main Operations Center — scrolls vertically if the window is too
          short for a full comfortable month grid, instead of silently
          clipping rows with no way to reach them. */}
      <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto h-full z-10 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 bg-surface/60 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm flex-wrap">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilterPanelOpen(true)}
              aria-label="Open filters"
              className="lg:hidden p-2.5 rounded-xl border border-border bg-surface/80 text-text-muted hover:text-text-primary shrink-0"
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
            <div className="p-3 bg-gradient-to-br from-ryze-500 to-ryze-700 rounded-xl text-white shadow-lg shadow-ryze-500/30 hidden sm:block">
              <CalendarDaysIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">Operations Center</h1>
              <p className="text-sm text-text-muted font-medium tracking-wide uppercase">{currentDateTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <CompanyFilterBar />

            {/* View Switcher */}
            <div className="flex bg-surface/80 backdrop-blur rounded-xl border border-border/60 p-1 shadow-sm">
              {[
                { id: 'dayGridMonth', label: 'Month' },
                { id: 'timeGridWeek', label: 'Week' },
                { id: 'timeGridDay', label: 'Day' },
                { id: 'listWeek', label: 'Agenda' }
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => handleViewChange(v.id as ViewType)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                    currentView === v.id ? 'bg-ryze-600 text-white shadow-md scale-105' : 'text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-border/60 bg-surface/80 backdrop-blur shadow-sm overflow-hidden">
                <button onClick={handlePrev} aria-label="Previous period" className="p-2.5 text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary border-r border-border/60 transition-colors">
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button onClick={handleNext} aria-label="Next period" className="p-2.5 text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary transition-colors">
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
              <button onClick={handleToday} className="px-5 py-2.5 bg-surface/80 backdrop-blur border border-border/60 rounded-xl text-sm font-bold text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-text-primary shadow-sm transition-all hover:shadow-md">
                Today
              </button>
              <CreateMenu />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <CalendarKPI events={allEvents} eventTypes={filters.eventTypes} viewStart={viewRange.start} viewEnd={viewRange.end} />

        {/* Calendar toolbar's active filter chips — sit immediately above the grid */}
        <ActiveFilterChips filters={filters} setFilters={setFilters} teamName={teamName} staffName={staffName} />

        {anyErrors.length > 0 && (
          <div className="mb-4 px-4 py-2 rounded-xl bg-danger-500/10 text-danger-700 dark:text-danger-500 text-xs font-medium">
            Unable to load {anyErrors.join(', ')} — showing the rest of the calendar. Try again shortly.
          </div>
        )}

        {/* FullCalendar Wrapper — a real floor height so a 6-week month never
            gets squeezed into illegible rows; the page scrolls (see the
            main area's overflow-y-auto above) instead of cramming. */}
        <div ref={containerRef} className="flex-1 min-h-[640px] bg-surface/80 backdrop-blur-xl rounded-2xl border border-border shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden p-6 relative flex flex-col gap-3">

          {isLoading && (
            <div className="absolute inset-0 bg-surface/60 backdrop-blur-md z-20 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-ryze-200 dark:border-ryze-800 border-t-ryze-600 rounded-full animate-spin shadow-lg" />
            </div>
          )}

          {!isLoading && allEvents.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 pointer-events-none">
              <p className="text-sm font-semibold text-text-primary">No scheduled operations</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs">
                There are no work orders, invoices, contracts or quotations for the selected filters and date range.
              </p>
            </div>
          )}

          <div className="[&_.fc-theme-standard_.fc-scrollgrid]:border-border [&_.fc-col-header-cell]:bg-background/50 [&_.fc-col-header-cell]:border-b-0 [&_.fc-col-header-cell]:py-4 [&_.fc-col-header-cell-cushion]:text-[11px] [&_.fc-col-header-cell-cushion]:font-black [&_.fc-col-header-cell-cushion]:text-text-muted [&_.fc-col-header-cell-cushion]:tracking-widest [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-daygrid-day-top]:opacity-80 [&_.fc-event]:border-none [&_.fc-event]:bg-transparent [&_.fc-event]:shadow-none [&_.fc-event:hover]:z-10 [&_.fc-daygrid-event-harness]:mb-0.5">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              events={detailedEvents}
              editable={false}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              eventContent={DayCellSummary}
              datesSet={handleDatesSet}
              moreLinkClick={handleMoreLinkClick}
              height="auto"
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: true }}
              dayMaxEvents={currentView === 'dayGridMonth' ? 3 : false}
            />
          </div>
        </div>
      </div>

      {/* Hover popover — one shared instance, repositioned per event */}
      {hover.event && hover.anchor && (
        <EventHoverPopover
          event={hover.event}
          anchor={hover.anchor}
          onCancelClose={hover.cancelClose}
          onScheduleClose={hover.scheduleClose}
          onOpen={() => { setSelectedEvent(hover.event); hover.scheduleClose(); }}
          onReassign={hover.event.module === 'workorder' ? () => { setSelectedEvent(hover.event); hover.scheduleClose(); } : undefined}
        />
      )}

      {/* Slide-out Drawer for specific events */}
      <CalendarDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Slide-out Drawer for event summaries */}
      <SummaryDrawer
        dateStr={summaryData?.dateStr || null}
        module={summaryData?.module || null}
        events={summaryData?.events || []}
        onClose={() => setSummaryData(null)}
      />

      {/* Modal for empty date click */}
      <CreateEventModal
        selectedDate={createDate}
        onClose={() => setCreateDate(null)}
      />
    </div>
  );
}
