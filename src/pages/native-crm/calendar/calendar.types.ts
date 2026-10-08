

export type CalendarModule = 'workorder' | 'invoice' | 'contract' | 'quotation' | 'meeting' | 'reminder';
export type CalendarEventType = 'visit' | 'due_date' | 'renewal' | 'expiry' | 'meeting' | 'general';
export type CalendarEventStatus = 'completed' | 'scheduled' | 'upcoming' | 'overdue' | 'cancelled' | 'draft' | 'active';

export interface BusinessEvent {
  id: string;             // Unique identifier for the calendar event (e.g., 'wo-123')
  title: string;          // The record's own real title/subject field where one exists
                           // (Work Order/Contract/Quotation all have one); Invoice has
                           // none, so it keeps a generic descriptive label.
  recordCode: string;     // Human-readable business code (e.g. 'WO-1048', 'INV-2034')

  // Relations
  module: CalendarModule;
  moduleId: string;       // Original record ID
  customerId?: string;    // Related Customer ID or Name
  customerName?: string;
  teamId?: string;
  staffIds?: string[];
  staffName?: string;     // Resolved display name for staffIds[0] — resolved in
                           // useCalendarData.ts (a hook context), not inside
                           // DayCellSummary (a FullCalendar eventContent render
                           // function, not a safe place to call React hooks).
  siteId?: string;
  priority?: string;

  // Categorization
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  
  // Timing
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  
  // UI Display — Tailwind token classes (ryze/success/danger/neutral), NOT
  // raw hex, so dark mode resolves automatically like every other page in
  // this app. See calendar-status.ts's getEventStatusClasses().
  color: string;          // dot/accent class, derived from business meaning (e.g. success dot for completed)
  bgColor?: string;       // background class
  textColor?: string;     // text class
  icon?: any;             // React component or string

  // Raw data for Drawer
  raw: any;
}

export type WorkOrderAssignment = 'all' | 'assigned' | 'unassigned' | 'my';
export type CalendarEventTypeKey = 'workorder' | 'invoice' | 'contract' | 'quotation';

/** Single combined filter-state object — every filter composes with every
 * other (search + team + staff + event types + assignment all apply as one
 * AND, never independently overwriting each other). */
export interface CalendarFilters {
  search: string;
  teamId: string;       // '' = no team filter; NativeTeam._id when set
  staffId: string;      // '' = no staff filter; NativeStaff._id when set
  eventTypes: Record<CalendarEventTypeKey, boolean>;
  assignment: WorkOrderAssignment;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  search: '',
  teamId: '',
  staffId: '',
  eventTypes: { workorder: true, invoice: true, contract: true, quotation: true },
  assignment: 'all',
};
