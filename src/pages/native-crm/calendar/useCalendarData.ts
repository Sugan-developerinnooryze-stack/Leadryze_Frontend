import { useMemo } from 'react';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';
import { useInvoicesListQuery } from '../../../modules/native-crm/queries/invoices.queries';
import { useContractsListQuery } from '../../../modules/native-crm/queries/contracts.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { usePipelineStages } from '../../../modules/native-crm/queries/pipeline-config.queries';
import { useStaffNameMap } from '../../../modules/native-crm/shared/useStaffNameMap';
import { useModuleAccess } from './calendar-access';
import {
  mapWorkOrdersToEvents,
  mapInvoicesToEvents,
  mapContractsToEvents,
  mapQuotationsToEvents
} from './calendar-event.mapper';
import { BusinessEvent, CalendarFilters } from './calendar.types';

export interface ViewRange { start: Date; end: Date; }

const WO_OWNER: Record<CalendarFilters['assignment'], 'my' | 'unassigned' | 'assigned' | undefined> = {
  all: undefined, assigned: 'assigned', unassigned: 'unassigned', my: 'my',
};

export function useCalendarData(filters: CalendarFilters, viewRange: ViewRange | null) {
  const { canView } = useModuleAccess();

  // Date-range-aware requests — each module targets its own real
  // operational date field (never createdAt), scoped to the grid's
  // currently-visible window instead of an unbounded limit:500 fetch.
  const range = viewRange ? 'custom' as const : undefined;
  const dateFrom = viewRange?.start.toISOString();
  const dateTo = viewRange?.end.toISOString();

  const woEnabled = canView('workorder');
  const invEnabled = canView('invoice');
  const conEnabled = canView('contract');
  const quoEnabled = canView('quotation');

  const { data: woData, isLoading: woLoading, isError: woError } = useWorkordersListQuery({
    page: 1, limit: 500, search: filters.search || undefined,
    dateField: 'scheduledDate', range, dateFrom, dateTo,
    teamId: filters.teamId || undefined, staffId: filters.staffId || undefined,
    owner: WO_OWNER[filters.assignment],
  });
  const { data: invData, isLoading: invLoading, isError: invError } = useInvoicesListQuery({
    page: 1, limit: 500, search: filters.search || undefined,
    dateField: 'dueDate', range, dateFrom, dateTo,
  });
  const { data: conData, isLoading: conLoading, isError: conError } = useContractsListQuery({
    page: 1, limit: 500, search: filters.search || undefined,
    dateField: 'overlap', range, dateFrom, dateTo,
    teamId: filters.teamId || undefined, staffId: filters.staffId || undefined,
  });
  const { data: quoData, isLoading: quoLoading, isError: quoError } = useQuotationsListQuery({
    page: 1, limit: 500, search: filters.search || undefined,
    dateField: 'validUntil', range, dateFrom, dateTo,
    teamId: filters.teamId || undefined, staffId: filters.staffId || undefined,
  });
  const { data: custList, isLoading: custLoading } = useCustomersListQuery({ page: 1, limit: 500 });

  // Real paid-equivalent stage key(s) for this tenant's Invoice pipeline
  // (PipelineStage.outcome === 'paid'), resolved the same way
  // getWorkorderStats resolves its own overdue definition server-side —
  // not the literal string 'PAID'. Falls back to 'paid' while loading.
  const { stages: invoiceStages } = usePipelineStages('invoice', []);
  const paidStageKeys = useMemo(() => {
    const keys = invoiceStages.filter((s) => s.outcome === 'paid').map((s) => s.key.toLowerCase());
    return keys.length > 0 ? keys : ['paid'];
  }, [invoiceStages]);

  // Resolved here (a real hook context) rather than inside DayCellSummary
  // (a FullCalendar eventContent render function, not a safe place to call
  // React hooks) — attached onto each event as a plain staffName string.
  const staffNames = useStaffNameMap();

  const customers = custList?.items || [];
  const isLoading = (woEnabled && woLoading) || (invEnabled && invLoading) || (conEnabled && conLoading) || (quoEnabled && quoLoading) || custLoading;
  const errors = {
    workorder: woEnabled && woError,
    invoice:   invEnabled && invError,
    contract:  conEnabled && conError,
    quotation: quoEnabled && quoError,
  };

  const allEvents = useMemo(() => {
    let events: BusinessEvent[] = [];

    if (filters.eventTypes.workorder && woEnabled && woData?.items) {
      events = [...events, ...mapWorkOrdersToEvents(woData.items, customers, staffNames)];
    }
    if (filters.eventTypes.invoice && invEnabled && invData?.items) {
      events = [...events, ...mapInvoicesToEvents(invData.items, customers, paidStageKeys)];
    }
    if (filters.eventTypes.contract && conEnabled && conData?.items) {
      events = [...events, ...mapContractsToEvents(conData.items, customers)];
    }
    if (filters.eventTypes.quotation && quoEnabled && quoData?.items) {
      events = [...events, ...mapQuotationsToEvents(quoData.items, customers)];
    }

    return events;
  }, [woData, invData, conData, quoData, customers, staffNames, filters.eventTypes, paidStageKeys, woEnabled, invEnabled, conEnabled, quoEnabled]);

  // FullCalendar format — every event (Month/Week/Day/Agenda alike) renders
  // as a real business-record card via DayCellSummary, never a grouped
  // count chip. `title` stays the record's own clean title (no customer
  // suffix) since DayCellSummary already has customerName available on
  // extendedProps if a future card layout wants it. Color is NOT passed via
  // FullCalendar's own backgroundColor/borderColor/textColor props — those
  // apply as inline style and only accept real CSS colors, but
  // ev.bgColor/color/textColor are Tailwind token classes (calendar-status.ts).
  // DayCellSummary reads them off extendedProps and applies them as
  // className instead — the wrapping .fc-event box itself is forced
  // transparent in CalendarPage.tsx's own CSS overrides either way.
  const detailedEvents = useMemo(() => {
    return allEvents.map(ev => ({
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      extendedProps: { ...ev },
    }));
  }, [allEvents]);

  return { isLoading, errors, allEvents, detailedEvents };
}
