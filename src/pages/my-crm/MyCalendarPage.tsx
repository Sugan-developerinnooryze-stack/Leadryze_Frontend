import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg, EventApi } from '@fullcalendar/core';
import {
  format, isSameDay, isSameMonth, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval,
} from 'date-fns';
import {
  XMarkIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon,
  SparklesIcon, BoltIcon, ExclamationCircleIcon, ClockIcon,
  MagnifyingGlassIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import ActivityModal, { type ActivityDTO, type ActivityType } from './ActivityModal';

/* ── Color maps ─────────────────────────────────────────────────────────────── */
const CHANNEL_COLORS: Record<string, string> = {
  zoho:       '#ef4444',
  hubspot:    '#f97316',
  salesforce: '#3b82f6',
  mysql:      '#10b981',
  postgresql: '#8b5cf6',
  mongodb:    '#22c55e',
  manual:     '#6366f1',
};
const CHANNEL_LABELS: Record<string, string> = {
  zoho: 'Zoho', hubspot: 'HubSpot', salesforce: 'Salesforce',
  mysql: 'MySQL', postgresql: 'PostgreSQL', mongodb: 'MongoDB', manual: 'My Bookings',
};
const PRIORITY_MODULES = new Set(['Leads', 'Deals', 'Potentials', 'Opportunities', 'Accounts']);

/* ── CalEvent type ───────────────────────────────────────────────────────────── */
interface CalEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color: string;
  extendedProps: {
    sourceType: 'crm' | 'manual' | 'activity';
    channel?: string;
    module?: string;
    externalId?: string;
    displayName?: string;
    data?: Record<string, unknown>;
    description?: string;
    location?: string;
    createdBy?: string;
    linkedRecord?: { channel: string; module: string; externalId: string; displayName: string };
  };
}

/* ── Mini Calendar ───────────────────────────────────────────────────────────── */
function MiniCalendar({ month, events, selectedDate, onDateClick, onMonthChange }: {
  month: Date;
  events: CalEvent[];
  selectedDate: Date;
  onDateClick: (d: Date) => void;
  onMonthChange: (d: Date) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const weeks      = eachWeekOfInterval({ start: gridStart, end: gridEnd }, { weekStartsOn: 0 });

  const eventDates = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => { try { s.add(format(new Date(e.start), 'yyyy-MM-dd')); } catch {} });
    return s;
  }, [events]);

  const today = new Date();

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => onMonthChange(subMonths(month, 1))}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-gray-700">{format(month, 'MMMM yyyy')}</span>
        <button onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      {weeks.map(weekStart => {
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          days.push(d);
        }
        return (
          <div key={weekStart.toISOString()} className="grid grid-cols-7">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, month);
              const hasEvent = eventDates.has(key);

              return (
                <button
                  key={key}
                  onClick={() => onDateClick(day)}
                  className={`relative flex flex-col items-center justify-center py-0.5 rounded-full transition-colors text-[11px] font-medium w-7 h-7 mx-auto
                    ${isToday ? 'bg-brand-600 text-white' : ''}
                    ${isSelected && !isToday ? 'bg-brand-100 text-brand-700' : ''}
                    ${!isToday && !isSelected && isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : ''}
                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ── Event Detail Popup ──────────────────────────────────────────────────────── */
function EventDetailPopup({ event, onClose, onEdit, onDelete }: {
  event: EventApi;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const props = event.extendedProps as CalEvent['extendedProps'];
  const isCRM = props.sourceType === 'crm';
  const data  = props.data || {};
  const displayFields = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
    .slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: event.backgroundColor || '#6366f1' }} />
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {props.module && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: event.backgroundColor || '#6366f1' }}>
                    {props.module}
                  </span>
                )}
                {props.channel && (
                  <span className="text-xs text-gray-400">{CHANNEL_LABELS[props.channel] || props.channel}</span>
                )}
              </div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{event.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {event.start?.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {event.start && event.end && !event.allDay && (
                  <> · {event.start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}{event.end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                )}
                {event.allDay && ' · All day'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {props.description && (
            <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-lg px-3 py-2">{props.description}</p>
          )}
          {props.location && (
            <p className="text-xs text-gray-500 mb-3">📍 {props.location}</p>
          )}
          {isCRM && displayFields.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {displayFields.map(([k, v]) => (
                <div key={k} className="flex gap-2 text-sm">
                  <span className="text-gray-400 shrink-0 w-36 truncate capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-700 flex-1 min-w-0 truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {props.linkedRecord && (
            <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Linked: <span className="font-medium text-gray-700">{props.linkedRecord.displayName}</span>
              {' · '}{props.linkedRecord.module}
            </div>
          )}
          {!isCRM && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              {props.sourceType === 'activity' && (
                <button onClick={onEdit}
                  className="flex-1 text-sm font-medium text-brand-600 hover:text-brand-700 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">
                  Edit
                </button>
              )}
              <button onClick={onDelete}
                className="flex-1 text-sm font-medium text-red-600 hover:text-red-700 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const VIEW_LABELS: Record<string, string> = {
  timeGridWeek: 'Week',
  dayGridMonth: 'Month',
  timeGridDay:  'Day',
  listWeek:     'List',
};

function relativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (isSameDay(d, today)) return `Today ${format(d, 'h:mma')}`;
    if (isSameDay(d, tomorrow)) return `Tomorrow ${format(d, 'h:mma')}`;
    return format(d, 'MMM d, h:mma');
  } catch { return ''; }
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function MyCalendarPage() {
  const calendarRef  = useRef<FullCalendar>(null);
  const currentRange = useRef<{ start: Date; end: Date } | null>(null);

  const [events,          setEvents]          = useState<CalEvent[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [selectedEvent,   setSelectedEvent]   = useState<EventApi | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [prefillDate,        setPrefillDate]       = useState<string | undefined>();
  const [editActivityData,   setEditActivityData]  = useState<ActivityDTO | undefined>();

  // Toolbar / view state
  const [activeView,  setActiveView]  = useState('timeGridWeek');
  const [viewTitle,   setViewTitle]   = useState('');
  const [searchQ,     setSearchQ]     = useState('');

  // Left panel state
  const [miniMonth,     setMiniMonth]     = useState(new Date());
  const [selectedDate,  setSelectedDate]  = useState(new Date());
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());

  /* ── Derived values ─────────────────────────────────────────────────────── */
  const uniqueModules = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => {
      const label = e.extendedProps.module || (e.extendedProps.sourceType === 'manual' ? 'My Bookings' : null);
      if (label) s.add(label);
    });
    return [...s].sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (activeModules.size > 0) {
      list = list.filter(e => {
        const label = e.extendedProps.module || (e.extendedProps.sourceType === 'manual' ? 'My Bookings' : null);
        return label && activeModules.has(label);
      });
    }
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    return list;
  }, [events, activeModules, searchQ]);

  const now = new Date();

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => { try { return new Date(e.start) >= now; } catch { return false; } })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 6),
  [events]);

  const todayEvents = useMemo(() =>
    events.filter(e => { try { return isSameDay(new Date(e.start), now); } catch { return false; } }),
  [events]);

  const priorityEvents = useMemo(() =>
    events.filter(e => e.extendedProps.module && PRIORITY_MODULES.has(e.extendedProps.module)).slice(0, 4),
  [events]);

  const followUpEvents = useMemo(() =>
    events
      .filter(e => { try { return new Date(e.start) < now && e.extendedProps.sourceType === 'crm'; } catch { return false; } })
      .slice(-4)
      .reverse(),
  [events]);

  const manualCount = useMemo(() => events.filter(e => e.extendedProps.sourceType === 'manual').length, [events]);
  const channels    = useMemo(() => [...new Set(events.map(e => e.extendedProps.channel || (e.extendedProps.sourceType === 'manual' ? 'manual' : '')).filter(Boolean))], [events]);

  /* ── Data fetching ──────────────────────────────────────────────────────── */
  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/calendar/events', {
        params: { start: start.toISOString(), end: end.toISOString() },
      });
      setEvents(res.data.data || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function refreshCurrent() {
    if (currentRange.current) fetchEvents(currentRange.current.start, currentRange.current.end);
  }

  // Refresh when AI schedules/updates a meeting via chat
  useEffect(() => {
    window.addEventListener('leadryze:activity-updated', refreshCurrent);
    return () => window.removeEventListener('leadryze:activity-updated', refreshCurrent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── FullCalendar callbacks ─────────────────────────────────────────────── */
  function handleDatesSet(info: DatesSetArg) {
    currentRange.current = { start: info.start, end: info.end };
    setActiveView(info.view.type);
    setViewTitle(info.view.title);
    fetchEvents(info.start, info.end);
  }

  function handleDateSelect(info: DateSelectArg) {
    const d = info.start;
    const pad = (n: number) => String(n).padStart(2, '0');
    setPrefillDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setEditActivityData(undefined);
    setActivityModalOpen(true);
  }

  function handleEventClick(info: EventClickArg) {
    setSelectedEvent(info.event);
  }

  async function handleEventDrop(info: EventDropArg) {
    const ev = info.event;
    if (ev.extendedProps.sourceType !== 'manual') { info.revert(); return; }
    try {
      await api.put(`/api/v1/calendar/events/${ev.id.replace('evt_', '')}`, {
        startDate: ev.start?.toISOString(),
        endDate:   ev.end?.toISOString(),
      });
      refreshCurrent();
    } catch { info.revert(); }
  }

  /* ── Toolbar imperative API ─────────────────────────────────────────────── */
  const calApi = () => calendarRef.current?.getApi();

  /* ── Edit / delete ──────────────────────────────────────────────────────── */
  function handleEditSelected() {
    if (!selectedEvent) return;
    const props = selectedEvent.extendedProps as CalEvent['extendedProps'];
    if (props.sourceType !== 'activity') return;
    const data = (props.data || {}) as Record<string, unknown>;
    const pad  = (n: number) => String(n).padStart(2, '0');
    const fmt  = (d: Date | null): string | undefined =>
      d ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : undefined;
    const typeVal = (data.type as string) || 'event';
    const knownTypes: ActivityType[] = ['task','event','booking','appointment','schedule','followup','custom'];
    setEditActivityData({
      _id:        selectedEvent.id.replace('act_', ''),
      type:       knownTypes.includes(typeVal as ActivityType) ? (typeVal as ActivityType) : 'custom',
      customType: !knownTypes.includes(typeVal as ActivityType) ? props.module : undefined,
      title:      selectedEvent.title,
      status:     (data.status as string) || 'pending',
      priority:   data.priority as string | undefined,
      startDate:  fmt(selectedEvent.start),
      endDate:    fmt(selectedEvent.end),
      color:      selectedEvent.backgroundColor || '#6366f1',
      notes:      props.description,
      location:   props.location,
      linkedPerson: data.person ? {
        externalId:  '',
        displayName: data.person as string,
        module:      '',
        channel:     (data.channel as string) || '',
      } : undefined,
    });
    setSelectedEvent(null);
    setActivityModalOpen(true);
  }

  async function handleDeleteSelected() {
    if (!selectedEvent) return;
    const props = selectedEvent.extendedProps as CalEvent['extendedProps'];
    if (!confirm('Delete this event?')) return;
    try {
      if (props.sourceType === 'activity') {
        await api.delete(`/api/v1/activities/${selectedEvent.id.replace('act_', '')}`);
      } else {
        await api.delete(`/api/v1/calendar/events/${selectedEvent.id.replace('evt_', '')}`);
      }
      setSelectedEvent(null);
      refreshCurrent();
    } catch {}
  }

  /* ── Mini calendar date click ───────────────────────────────────────────── */
  function handleMiniDateClick(d: Date) {
    setSelectedDate(d);
    calApi()?.gotoDate(d);
    if (activeView === 'dayGridMonth') {
      // stay in month; if week/day, go there
    } else if (activeView !== 'timeGridDay') {
      calApi()?.changeView('timeGridDay');
      setActiveView('timeGridDay');
    }
  }

  /* ── Toggle module filter ───────────────────────────────────────────────── */
  function toggleModule(mod: string) {
    setActiveModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
            <CalendarDaysIcon className="h-4.5 w-4.5 text-brand-600" style={{ height: '1.1rem', width: '1.1rem' }} />
          </div>
          <span className="text-base font-bold text-gray-900">My Calendar</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search events…"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
          )}
          {/* Channel legend dots */}
          <div className="hidden sm:flex items-center gap-3">
            {channels.map(ch => (
              <div key={ch} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ch] || '#64748b' }} />
                {CHANNEL_LABELS[ch] || ch}
              </div>
            ))}
          </div>
          <button
            onClick={() => { setEditActivityData(undefined); setPrefillDate(undefined); setActivityModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add New
          </button>
        </div>
      </div>

      {/* ── 3-column body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT PANEL */}
        <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <MiniCalendar
              month={miniMonth}
              events={events}
              selectedDate={selectedDate}
              onDateClick={handleMiniDateClick}
              onMonthChange={setMiniMonth}
            />
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Filter by module</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveModules(new Set())}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border ${
                  activeModules.size === 0
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                All
              </button>
              {uniqueModules.map(mod => (
                <button
                  key={mod}
                  onClick={() => toggleModule(mod)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border ${
                    activeModules.has(mod)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="px-4 py-3 border-t border-gray-100 flex-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
            {upcomingEvents.length === 0 && (
              <p className="text-xs text-gray-400 italic">No upcoming events</p>
            )}
            <div className="space-y-1.5">
              {upcomingEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => { calApi()?.gotoDate(new Date(ev.start)); setSelectedDate(new Date(ev.start)); }}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color || '#64748b' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate group-hover:text-brand-700">{truncate(ev.title, 18)}</p>
                    <p className="text-[10px] text-gray-400">{relativeTime(ev.start)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — Calendar */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Custom toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => calApi()?.prev()}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => { calApi()?.today(); setSelectedDate(new Date()); setMiniMonth(new Date()); }}
                className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => calApi()?.next()}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              <h2 className="ml-3 text-base font-bold text-gray-900">{viewTitle}</h2>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {Object.entries(VIEW_LABELS).map(([view, label]) => (
                <button
                  key={view}
                  onClick={() => { calApi()?.changeView(view); setActiveView(view); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    activeView === view
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* FullCalendar */}
          <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={false}
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              allDaySlot={true}
              nowIndicator={true}
              height="100%"
              events={filteredEvents}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={4}
              datesSet={handleDatesSet}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventDisplay="block"
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
              slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
            />
          </div>
        </main>

        {/* RIGHT PANEL — AI Assistant */}
        <aside className="w-[268px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-100 flex items-center justify-center">
              <SparklesIcon className="h-3.5 w-3.5 text-brand-600" />
            </div>
            <span className="text-sm font-bold text-gray-900">AI Assistant</span>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Total', value: events.length },
              { label: 'Bookings', value: manualCount },
              { label: 'Sources', value: channels.length },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center py-2.5">
                <span className="text-lg font-bold text-gray-900">{s.value}</span>
                <span className="text-[10px] text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Today's Events */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <ClockIcon className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Today</p>
              <span className="ml-auto text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">{todayEvents.length}</span>
            </div>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No events today</p>
            ) : (
              <div className="space-y-1.5">
                {todayEvents.slice(0, 4).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => { calApi()?.gotoDate(new Date(ev.start)); calApi()?.changeView('timeGridDay'); setActiveView('timeGridDay'); }}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 group transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate group-hover:text-brand-700">{truncate(ev.title, 20)}</p>
                      <p className="text-[10px] text-gray-400">
                        {ev.start ? format(new Date(ev.start), 'h:mm a') : ''}
                        {ev.extendedProps.module ? ` · ${ev.extendedProps.module}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* High Priority */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <BoltIcon className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">High Priority</p>
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{priorityEvents.length}</span>
            </div>
            {priorityEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No high-priority records</p>
            ) : (
              <div className="space-y-1.5">
                {priorityEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => calApi()?.gotoDate(new Date(ev.start))}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-amber-50 group transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate group-hover:text-amber-700">{truncate(ev.title, 20)}</p>
                      <p className="text-[10px] text-gray-400">{ev.extendedProps.module} · {relativeTime(ev.start)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups Needed */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ExclamationCircleIcon className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Follow-ups</p>
              <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">{followUpEvents.length}</span>
            </div>
            {followUpEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">All caught up!</p>
            ) : (
              <div className="space-y-1.5">
                {followUpEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      const d = new Date(ev.start);
                      setPrefillDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T09:00`);
                      setEditActivityData(undefined);
                      setActivityModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-red-50 group transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate group-hover:text-red-700">{truncate(ev.title, 20)}</p>
                      <p className="text-[10px] text-gray-400">{ev.extendedProps.module} · {format(new Date(ev.start), 'MMM d')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Event detail popup ───────────────────────────────────────────── */}
      {selectedEvent && (
        <EventDetailPopup
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEditSelected}
          onDelete={handleDeleteSelected}
        />
      )}

      {/* ── Activity modal ────────────────────────────────────────────────── */}
      <ActivityModal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        onSaved={refreshCurrent}
        prefillDate={prefillDate}
        editActivity={editActivityData}
      />
    </div>
  );
}
