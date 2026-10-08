import { BusinessEvent, CalendarEventStatus } from './calendar.types';
import { MODULE_COLORS } from './calendar-status';
import {
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

// Event card color is the record's MODULE identity (Work Order green /
// Invoice red / Contract purple / Quotation yellow) — fixed, not derived
// from status. It was previously derived from getEventStatusClasses(status),
// which meant two records in the same module showed different card colors
// (or the SAME washed-out gray/amber) depending on their status string,
// while the filter panel/Legend already correctly used module color — the
// actual grid never matched what the Legend promised. Status still drives
// the small Status badge text/color in the hover popover and drawer, and
// the overdue-icon indicator — just not the card's own background here.
const getModuleColor = (module: 'workorder' | 'invoice' | 'contract' | 'quotation') => {
  const c = MODULE_COLORS[module];
  return { color: c.dot, bg: c.bg, text: c.text };
};

export const mapWorkOrdersToEvents = (workorders: any[], customers: any[] = [], staffNames?: Map<string, string>): BusinessEvent[] => {
  if (!workorders) return [];
  return workorders
    .filter(wo => wo.scheduledDate)
    .map(wo => {
      const colors = getModuleColor('workorder');
      const customer = customers.find(c => c.customerId === wo.customerId || c._id === wo.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${wo.customerId})` : wo.customerId;

      return {
        id: `wo-${wo._id}`,
        // Work Order's own real title field — was hardcoded to the generic
        // "Technician Visit" for every record regardless of what the record
        // actually says, which is why the calendar read as a demo rather
        // than real operational data.
        title: wo.title || 'Technician Visit',
        recordCode: wo.workOrderId ?? '',
        module: 'workorder',
        moduleId: wo._id,
        customerId: wo.customerId,
        customerName,
        teamId: wo.teamId,
        staffIds: wo.staffId ? [wo.staffId] : [],
        staffName: wo.staffId ? staffNames?.get(wo.staffId) : undefined,
        siteId: wo.siteId,
        priority: wo.priority,
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

/**
 * `paidStageKeys`: the tenant's REAL paid-equivalent pipeline stage key(s)
 * (resolved via usePipelineStages('invoice', ...)'s PipelineStage.outcome
 * === 'paid', same mechanism getWorkorderStats uses server-side for its own
 * overdue count), not the literal string 'PAID'. Invoice status is a free,
 * tenant-renameable string (invoice.model.ts has no fixed enum) — the
 * previous `inv.status !== 'PAID'` comparison could never match a real
 * tenant's actual lowercase status key, so every unpaid-but-not-yet-due
 * invoice as well as every genuinely paid one was misclassified as overdue
 * the moment its due date passed. This is a Calendar-only display fix:
 * Invoice's own status model, service and CRUD are untouched. */
export const mapInvoicesToEvents = (invoices: any[], customers: any[] = [], paidStageKeys: string[] = ['paid']): BusinessEvent[] => {
  if (!invoices) return [];
  return invoices
    .filter(inv => inv.dueDate || inv.createdAt)
    .map(inv => {
      const isPaid = paidStageKeys.includes(String(inv.status ?? '').toLowerCase());
      const isOverdue = !isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
      const status = isOverdue ? 'overdue' : (inv.status || 'upcoming');
      const colors = getModuleColor('invoice');
      const customer = customers.find(c => c.customerId === inv.customerId || c._id === inv.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${inv.customerId})` : inv.customerId;
      
      return {
        id: `inv-${inv._id}`,
        title: `Invoice Due`, // Invoice has no title-equivalent field to borrow a real one from
        recordCode: inv.invoiceId ?? '',
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
    const colors = getModuleColor('contract');
    const customer = customers.find(c => c.customerId === con.customerId || c._id === con.customerId);
    const namePart = customer ? (customer.name || customer.fullName || '') : '';
    const customerName = namePart ? `${namePart} (${con.customerId})` : con.customerId;

    if (con.startDate) {
      events.push({
        id: `con-start-${con._id}`,
        title: con.title || 'Contract Starts',
        recordCode: con.contractId ?? '',
        module: 'contract',
        moduleId: con._id,
        customerId: con.customerId,
        customerName,
        teamId: con.teamId,
        staffIds: con.staffIds ?? (con.staffId ? [con.staffId] : []),
        siteId: con.siteId,
        priority: con.priority,
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
        title: con.title || 'Contract Expiry',
        recordCode: con.contractId ?? '',
        module: 'contract',
        moduleId: con._id,
        customerId: con.customerId,
        customerName,
        teamId: con.teamId,
        staffIds: con.staffIds ?? (con.staffId ? [con.staffId] : []),
        siteId: con.siteId,
        priority: con.priority,
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
      const colors = getModuleColor('quotation');
      const customer = customers.find(c => c.customerId === quo.customerId || c._id === quo.customerId);
      const namePart = customer ? (customer.name || customer.fullName || '') : '';
      const customerName = namePart ? `${namePart} (${quo.customerId})` : quo.customerId;

      return {
        id: `quo-${quo._id}`,
        title: quo.title || 'Quotation Expiry',
        recordCode: quo.quotationId ?? '',
        module: 'quotation',
        moduleId: quo._id,
        customerId: quo.customerId,
        customerName,
        teamId: quo.teamId,
        staffIds: quo.staffId ? [quo.staffId] : [],
        siteId: quo.siteId,
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
