

export type CalendarModule = 'workorder' | 'invoice' | 'contract' | 'quotation' | 'meeting' | 'reminder';
export type CalendarEventType = 'visit' | 'due_date' | 'renewal' | 'expiry' | 'meeting' | 'general';
export type CalendarEventStatus = 'completed' | 'scheduled' | 'upcoming' | 'overdue' | 'cancelled' | 'draft' | 'active';

export interface BusinessEvent {
  id: string;             // Unique identifier for the calendar event (e.g., 'wo-123')
  title: string;          // Business title (e.g., 'Technician Visit')
  
  // Relations
  module: CalendarModule;
  moduleId: string;       // Original record ID
  customerId?: string;    // Related Customer ID or Name
  customerName?: string;
  teamId?: string;
  staffIds?: string[];
  
  // Categorization
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  
  // Timing
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  
  // UI Display
  color: string;          // Derived from business meaning (e.g., green for completed)
  bgColor?: string;
  textColor?: string;
  icon?: any;             // React component or string

  // Raw data for Drawer
  raw: any;
}
