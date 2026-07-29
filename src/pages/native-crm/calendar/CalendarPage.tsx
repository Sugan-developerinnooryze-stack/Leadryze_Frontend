import { useRef, useState, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import type { EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';

import { useCalendarData } from './useCalendarData';
import { BusinessEvent } from './calendar.types';
import CalendarSidebar from './components/CalendarSidebar';
import CalendarKPI from './components/CalendarKPI';
import CalendarDrawer from './components/CalendarDrawer';
import CreateEventModal from './components/CreateEventModal';
import SummaryDrawer from './components/SummaryDrawer';
import { DayCellSummary } from './components/DayCellSummary';

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

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

  // Filters state
  const [filters, setFilters] = useState<Record<string, boolean>>({
    workorder: true,
    invoice: true,
    contract: true,
    quotation: true,
  });

  // UI State
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [currentDateTitle, setCurrentDateTitle] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<BusinessEvent | null>(null);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [summaryData, setSummaryData] = useState<{ dateStr: string, module: string, events: BusinessEvent[] } | null>(null);

  // Data fetching & processing hook
  const { allEvents, groupedSummaryEvents, detailedEvents, isLoading } = useCalendarData(filters);

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
  };

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const isSummary = arg.event.extendedProps?.type === 'summary';
    
    if (isSummary) {
      const module = arg.event.extendedProps.module;
      const date = arg.event.extendedProps.date;
      
      const relatedEvents = allEvents.filter(ev => {
        const evDate = new Date(ev.start).toISOString().split('T')[0];
        return ev.module === module && evDate === date;
      });
      
      setSummaryData({ dateStr: date, module, events: relatedEvents });
    } else {
      setSelectedEvent(arg.event.extendedProps as BusinessEvent);
    }
  }, [detailedEvents]);

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setCreateDate(arg.date);
  }, []);

  const activeEvents = currentView === 'dayGridMonth' ? groupedSummaryEvents : detailedEvents;

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-gray-100 -m-6 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Sidebar Filters */}
      <CalendarSidebar filters={filters} setFilters={setFilters} />

      {/* Main Operations Center */}
      <div className="flex-1 flex flex-col p-8 overflow-hidden h-full z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl text-white shadow-lg shadow-brand-500/30">
              <CalendarDaysIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Operations Center</h1>
              <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">{currentDateTitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* View Switcher */}
            <div className="flex bg-white/80 backdrop-blur rounded-xl border border-gray-200/60 p-1 shadow-sm">
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
                    currentView === v.id ? 'bg-gray-900 text-white shadow-md scale-105' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
                <button onClick={handlePrev} className="p-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-900 border-r border-gray-200/60 transition-colors">
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button onClick={handleNext} className="p-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
              <button onClick={handleToday} className="px-5 py-2.5 bg-white/80 backdrop-blur border border-gray-200/60 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all hover:shadow-md">
                Today
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <CalendarKPI events={allEvents} />

        {/* FullCalendar Wrapper */}
        <div ref={containerRef} className="flex-1 bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-gray-200/50 overflow-hidden p-6 relative">
          
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-20 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin shadow-lg" />
            </div>
          )}

          <div className="h-full [&_.fc-theme-standard_.fc-scrollgrid]:border-gray-100 [&_.fc-col-header-cell]:bg-gray-50/50 [&_.fc-col-header-cell]:border-b-0 [&_.fc-col-header-cell]:py-4 [&_.fc-col-header-cell-cushion]:text-[11px] [&_.fc-col-header-cell-cushion]:font-black [&_.fc-col-header-cell-cushion]:text-gray-400 [&_.fc-col-header-cell-cushion]:tracking-widest [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-daygrid-day-number]:text-sm [&_.fc-daygrid-day-number]:font-bold [&_.fc-daygrid-day-number]:text-gray-700 [&_.fc-daygrid-day-number]:p-3 [&_.fc-daygrid-day-top]:opacity-80 [&_.fc-day-today]:bg-brand-50/30 [&_.fc-event]:border-none [&_.fc-event]:bg-transparent [&_.fc-event]:shadow-none [&_.fc-event:hover]:z-10">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              events={activeEvents}
              editable={false}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventContent={DayCellSummary}
              datesSet={handleDatesSet}
              height="100%"
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: true }}
              dayMaxEvents={currentView === 'dayGridMonth' ? 5 : false}
            />
          </div>
        </div>
      </div>

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
