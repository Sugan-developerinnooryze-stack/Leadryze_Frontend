import { BusinessEvent, CalendarEventStatus } from './calendar.types';
import { 
  WrenchScrewdriverIcon, 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const getStatusColor = (status: string): { bg: string; color: string; text: string } => {
  const s = status.toLowerCase();
  if (s.includes('completed') || s.includes('paid')) return { color: '#059669', bg: '#d1fae5', text: '#065f46' }; // Green
  if (s.includes('scheduled') || s.includes('active')) return { color: '#2563eb', bg: '#dbeafe', text: '#1e40af' }; // Blue
  if (s.includes('overdue')) return { color: '#e11d48', bg: '#ffe4e6', text: '#9f1239' }; // Red
  if (s.includes('cancelled') || s.includes('draft')) return { color: '#6b7280', bg: '#f3f4f6', text: '#374151' }; // Gray
  return { color: '#d97706', bg: '#fef3c7', text: '#92400e' }; // Orange (Upcoming/Pending)
};

export const mapWorkOrdersToEvents = (workorders: any[], customers: any[] = []): BusinessEvent[] => {
  if (!workorders) return [];
  return workorders
    .filter(wo => wo.scheduledDate)
    .map(wo => {
      const colors = getStatusColor(wo.status || 'upcoming');
      const customer = customers.find(c => c.customerId === wo.customerId || c._id === wo.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${wo.customerId})` : wo.customerId;

      return {
        id: `wo-${wo._id}`,
        title: `Technician Visit`, // Business meaning instead of generic "Work Order"
        module: 'workorder',
        moduleId: wo._id,
        customerId: wo.customerId,
        customerName,
        teamId: wo.teamId,
        staffIds: wo.staffId ? [wo.staffId] : [],
        eventType: 'visit',
        status: (wo.status || 'upcoming') as CalendarEventStatus,
        start: wo.scheduledDate,
        end: wo.completedDate, // Only use completedDate for the actual end
        allDay: false,
        color: colors.color,
        bgColor: colors.bg,
        textColor: colors.text,
        icon: WrenchScrewdriverIcon,
        raw: wo,
      };
    });
};

export const mapInvoicesToEvents = (invoices: any[], customers: any[] = []): BusinessEvent[] => {
  if (!invoices) return [];
  return invoices
    .filter(inv => inv.dueDate || inv.createdAt)
    .map(inv => {
      const isOverdue = new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
      const status = isOverdue ? 'overdue' : (inv.status || 'upcoming');
      const colors = getStatusColor(status);
      const customer = customers.find(c => c.customerId === inv.customerId || c._id === inv.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${inv.customerId})` : inv.customerId;
      
      return {
        id: `inv-${inv._id}`,
        title: `Invoice Due`,
        module: 'invoice',
        moduleId: inv._id,
        customerId: inv.customerId,
        customerName,
        eventType: 'due_date',
        status: status as CalendarEventStatus,
        start: inv.dueDate || inv.createdAt,
        allDay: true,
        color: colors.color,
        bgColor: colors.bg,
        textColor: colors.text,
        icon: DocumentTextIcon,
        raw: inv,
      };
    });
};

export const mapContractsToEvents = (contracts: any[], customers: any[] = []): BusinessEvent[] => {
  if (!contracts) return [];
  const events: BusinessEvent[] = [];
  
  contracts.forEach(con => {
    const colors = getStatusColor(con.status || 'active');
    const customer = customers.find(c => c.customerId === con.customerId || c._id === con.customerId);
    const namePart = customer ? (customer.name || customer.fullName || '') : '';
    const customerName = namePart ? `${namePart} (${con.customerId})` : con.customerId;

    if (con.startDate) {
      events.push({
        id: `con-start-${con._id}`,
        title: `Contract Starts`,
        module: 'contract',
        moduleId: con._id,
        customerId: con.customerId,
        customerName,
        eventType: 'renewal',
        status: (con.status || 'active') as CalendarEventStatus,
        start: con.startDate,
        allDay: true,
        color: colors.color,
        bgColor: colors.bg,
        textColor: colors.text,
        icon: DocumentCheckIcon,
        raw: con,
      });
    }

    if (con.endDate && con.endDate !== con.startDate) {
      events.push({
        id: `con-end-${con._id}`,
        title: `Contract Expiry`,
        module: 'contract',
        moduleId: con._id,
        customerId: con.customerId,
        customerName,
        eventType: 'expiry',
        status: (con.status || 'active') as CalendarEventStatus,
        start: con.endDate,
        allDay: true,
        color: colors.color,
        bgColor: colors.bg,
        textColor: colors.text,
        icon: DocumentCheckIcon,
        raw: con,
      });
    }
  });
  
  return events;
};

export const mapQuotationsToEvents = (quotations: any[], customers: any[] = []): BusinessEvent[] => {
  if (!quotations) return [];
  return quotations
    .filter(quo => quo.validUntil || quo.createdAt)
    .map(quo => {
      const colors = getStatusColor(quo.status || 'upcoming');
      const customer = customers.find(c => c.customerId === quo.customerId || c._id === quo.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${quo.customerId})` : quo.customerId;

      return {
        id: `quo-${quo._id}`,
        title: `Quotation Expiry`,
        module: 'quotation',
        moduleId: quo._id,
        customerId: quo.customerId,
        customerName,
        eventType: 'expiry',
        status: (quo.status || 'upcoming') as CalendarEventStatus,
        start: quo.validUntil || quo.createdAt,
        allDay: true,
        color: colors.color,
        bgColor: colors.bg,
        textColor: colors.text,
        icon: ClipboardDocumentListIcon,
        raw: quo,
      };
    });
};
