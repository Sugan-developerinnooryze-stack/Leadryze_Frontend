import { useRef, useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin    from '@fullcalendar/daygrid';
import timeGridPlugin   from '@fullcalendar/timegrid';
import listPlugin       from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import { 
  CalendarDaysIcon, 
  WrenchScrewdriverIcon, 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  ClipboardDocumentListIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useWorkordersListQuery, useWorkorderUpdate } from '../../../modules/native-crm/queries/workorders.queries';
import { useInvoicesListQuery } from '../../../modules/native-crm/queries/invoices.queries';
import { useContractsListQuery } from '../../../modules/native-crm/queries/contracts.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';

const TYPE_CONFIG = {
  workorder: { 
    color: '#059669', bg: '#d1fae5', text: '#065f46', 
    icon: WrenchScrewdriverIcon, label: 'Work Orders' 
  },
  invoice: { 
    color: '#e11d48', bg: '#ffe4e6', text: '#9f1239', 
    icon: DocumentTextIcon, label: 'Invoices' 
  },
  contract: { 
    color: '#4f46e5', bg: '#e0e7ff', text: '#3730a3', 
    icon: DocumentCheckIcon, label: 'Contracts' 
  },
  quotation: { 
    color: '#d97706', bg: '#fef3c7', text: '#92400e', 
    icon: ClipboardDocumentListIcon, label: 'Quotations' 
  },
} as const;

type EventType = keyof typeof TYPE_CONFIG;
type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export default function CalendarPage() {
  const navigate = useNavigate();
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);
  const updateMutation = useWorkorderUpdate();

  // Custom header state
  const [currentView, setCurrentView] = useState<ViewType>('dayGridMonth');
  const [currentDateTitle, setCurrentDateTitle] = useState(
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())
  );

  // Filter state
  const [filters, setFilters] = useState<Record<EventType, boolean>>({
    workorder: true,
    invoice: true,
    contract: true,
    quotation: true,
  });

  const toggleFilter = (type: EventType) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Fetch all data
  const { data: woData } = useWorkordersListQuery({ page: 1, limit: 500 });
  const { data: invData } = useInvoicesListQuery({ page: 1, limit: 500 });
  const { data: conData } = useContractsListQuery({ page: 1, limit: 500 });
  const { data: quoData } = useQuotationsListQuery({ page: 1, limit: 500 });

  const events = useMemo(() => {
    const allEvents: any[] = [];

    if (filters.workorder && woData?.items) {
      woData.items.filter((item: any) => item.scheduledDate).forEach((wo: any) => {
        allEvents.push({
          id: `wo-${wo._id}`,
          title: `WO: ${wo.title ?? wo.workOrderId}`,
          start: wo.scheduledDate,
          // Omitting end date so it doesn't span massive vertical blocks if completed days later.
          // FullCalendar will use default duration (e.g., 1-2 hours) for timed events.
          backgroundColor: TYPE_CONFIG.workorder.bg,
          borderColor: TYPE_CONFIG.workorder.color,
          textColor: TYPE_CONFIG.workorder.text,
          extendedProps: { type: 'workorder', status: wo.status, rawId: wo._id },
        });
      });
    }

    if (filters.invoice && invData?.items) {
      invData.items.filter((item: any) => item.createdAt).forEach((inv: any) => {
        const targetDate = inv.dueDate || inv.createdAt;
        allEvents.push({
          id: `inv-${inv._id}`,
          title: `Invoice Due: ${inv.invoiceNumber}`,
          start: targetDate,
          allDay: true,
          backgroundColor: TYPE_CONFIG.invoice.bg,
          borderColor: TYPE_CONFIG.invoice.color,
          textColor: TYPE_CONFIG.invoice.text,
          extendedProps: { type: 'invoice', status: inv.status, rawId: inv._id },
        });
      });
    }

    if (filters.contract && conData?.items) {
      conData.items.filter((item: any) => item.startDate).forEach((con: any) => {
        const title = con.title ?? con.contractId;
        // 1. Contract Start Event
        allEvents.push({
          id: `con-start-${con._id}`,
          title: `Contract Starts: ${title}`,
          start: con.startDate,
          allDay: true,
          backgroundColor: TYPE_CONFIG.contract.bg,
          borderColor: TYPE_CONFIG.contract.color,
          textColor: TYPE_CONFIG.contract.text,
          extendedProps: { type: 'contract', status: con.status, rawId: con._id },
        });

        // 2. Contract Expiry Event (if different)
        if (con.endDate && con.endDate !== con.startDate) {
          allEvents.push({
            id: `con-end-${con._id}`,
            title: `Contract Expires: ${title}`,
            start: con.endDate,
            allDay: true,
            backgroundColor: TYPE_CONFIG.contract.bg,
            borderColor: TYPE_CONFIG.contract.color,
            textColor: TYPE_CONFIG.contract.text,
            extendedProps: { type: 'contract', status: con.status, rawId: con._id },
          });
        }
      });
    }

    if (filters.quotation && quoData?.items) {
      quoData.items.filter((item: any) => item.createdAt).forEach((quo: any) => {
        const targetDate = quo.validUntil || quo.createdAt;
        allEvents.push({
          id: `quo-${quo._id}`,
          title: `Quote Expires: ${quo.title ?? quo.quotationId}`,
          start: targetDate,
          allDay: true,
          backgroundColor: TYPE_CONFIG.quotation.bg,
          borderColor: TYPE_CONFIG.quotation.color,
          textColor: TYPE_CONFIG.quotation.text,
          extendedProps: { type: 'quotation', status: quo.status, rawId: quo._id },
        });
      });
    }

    return allEvents;
  }, [filters, woData, invData, conData, quoData]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const { type, rawId } = info.event.extendedProps;
    if (type === 'workorder') navigate(`/native-crm/workorders/${rawId}/print`);
    else if (type === 'invoice') navigate(`/native-crm/invoices/${rawId}/print`);
    else if (type === 'contract') navigate(`/native-crm/contracts/${rawId}/print`);
    else if (type === 'quotation') navigate(`/native-crm/quotations/${rawId}/print`);
  }, [navigate]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const { type, rawId } = info.event.extendedProps;
    const newDate = info.event.start;
    if (!newDate) return;
    
    if (type === 'workorder') {
      updateMutation.mutate({ id: rawId, data: { scheduledDate: newDate.toISOString() } });
    } else {
      info.revert();
    }
  }, [updateMutation]);

  // Update title on dates set
  const handleDatesSet = (arg: any) => {
    setCurrentDateTitle(arg.view.title);
  };

  // Custom Navigation
  const changeView = (view: ViewType) => {
    setCurrentView(view);
    calRef.current?.getApi().changeView(view);
  };
  const goPrev = () => calRef.current?.getApi().prev();
  const goNext = () => calRef.current?.getApi().next();
  const goToday = () => calRef.current?.getApi().today();

  const renderEventContent = (eventInfo: any) => {
    const { event } = eventInfo;
    const { type, status } = event.extendedProps;
    const conf = TYPE_CONFIG[type as EventType];
    const Icon = conf?.icon ?? CalendarDaysIcon;

    return (
      <div className="flex items-center gap-1.5 px-1.5 py-[2px] w-full overflow-hidden" style={{ fontSize: '11px', lineHeight: '14px' }}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="font-bold truncate">{event.title}</span>
        {status && (
          <span className="ml-auto shrink-0 opacity-70 text-[9px] uppercase tracking-widest font-extrabold hidden sm:inline-block">
            {String(status).replace(/_/g, ' ')}
          </span>
        )}
      </div>
    );
  };

  const calendarClasses = `
    h-full w-full
    [&_.fc]:h-full
    [&_.fc]:font-sans
    
    /* Grid Styling */
    [&_.fc-theme-standard_.fc-scrollgrid]:border-gray-200
    [&_.fc-theme-standard_td]:border-gray-200
    [&_.fc-theme-standard_th]:border-gray-200
    
    /* Header Cells */
    [&_.fc-col-header-cell]:bg-gray-50/50
    [&_.fc-col-header-cell]:py-3
    [&_.fc-col-header-cell-cushion]:text-xs
    [&_.fc-col-header-cell-cushion]:font-bold
    [&_.fc-col-header-cell-cushion]:text-gray-500
    [&_.fc-col-header-cell-cushion]:uppercase
    [&_.fc-col-header-cell-cushion]:tracking-widest
    
    /* Day Numbers */
    [&_.fc-daygrid-day-number]:text-sm
    [&_.fc-daygrid-day-number]:font-semibold
    [&_.fc-daygrid-day-number]:text-gray-600
    [&_.fc-daygrid-day-number]:p-2
    [&_.fc-day-today]:bg-sky-50/30
    
    /* Events */
    [&_.fc-event]:border-y-0
    [&_.fc-event]:border-r-0
    [&_.fc-event]:border-l-4
    [&_.fc-event]:rounded
    [&_.fc-event]:shadow-sm
    [&_.fc-event]:mb-[2px]
    [&_.fc-event]:mx-1
    [&_.fc-event]:transition-all
    [&_.fc-event:hover]:shadow-md
    [&_.fc-event:hover]:brightness-95
    
    /* Hide Default Header Toolbar */
    [&_.fc-header-toolbar]:hidden
    
    /* Popover (+X more) Styling - Premium Design & Compact */
    [&_.fc-popover]:bg-white
    [&_.fc-popover]:border-gray-200
    [&_.fc-popover]:shadow-2xl
    [&_.fc-popover]:rounded-xl
    [&_.fc-popover-header]:bg-gray-50
    [&_.fc-popover-header]:px-3
    [&_.fc-popover-header]:py-2
    [&_.fc-popover-header]:rounded-t-xl
    [&_.fc-popover-title]:font-bold
    [&_.fc-popover-title]:text-gray-800
    [&_.fc-popover-title]:tracking-tight
    [&_.fc-popover-body]:p-1
    [&_.fc-popover-body]:max-h-[350px]
    [&_.fc-popover-body]:overflow-y-auto
    [&_.fc-more-link]:text-xs
    [&_.fc-more-link]:font-bold
    [&_.fc-more-link]:text-brand-600
    [&_.fc-more-link:hover]:text-brand-700
  `;

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 shrink-0 shadow-sm relative z-10">
        
        {/* Title & Date Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
              <CalendarDaysIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">{currentDateTitle}</h1>
              <p className="text-sm text-gray-500">Monitor all your field service operations and documents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggles */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
              {(['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'] as ViewType[]).map((view) => (
                <button
                  key={view}
                  onClick={() => changeView(view)}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-semibold transition-all
                    ${currentView === view 
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                  `}
                >
                  {view === 'dayGridMonth' ? 'Month' : view === 'timeGridWeek' ? 'Week' : view === 'timeGridDay' ? 'Day' : 'Agenda'}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

            {/* Date Navigation */}
            <div className="flex items-center gap-1">
              <button onClick={goPrev} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors border border-transparent hover:border-gray-200">
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button onClick={goToday} className="px-3 py-1.5 rounded-md text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors border border-transparent hover:border-gray-200">
                Today
              </button>
              <button onClick={goNext} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors border border-transparent hover:border-gray-200">
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-400 mr-2 uppercase tracking-wider text-xs">Filters:</span>
            {(Object.keys(TYPE_CONFIG) as EventType[]).map((type) => {
              const conf = TYPE_CONFIG[type];
              const Icon = conf.icon;
              const isActive = filters[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border
                    ${isActive 
                      ? 'border-transparent shadow-sm' 
                      : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'}
                  `}
                  style={isActive ? { backgroundColor: conf.bg, color: conf.text } : {}}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? '' : 'opacity-50'}`} style={{ color: isActive ? conf.color : undefined }} />
                  <span>{conf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-2 sm:p-4 ${calendarClasses}`}>
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            events={events}
            editable={true}
            droppable={true}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventContent={renderEventContent}
            datesSet={handleDatesSet}
            height="100%"
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
            dayMaxEvents={4}
          />
        </div>
      </div>
    </div>
  );
}
