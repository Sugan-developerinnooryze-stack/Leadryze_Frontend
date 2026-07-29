import { useMemo } from 'react';
import { useWorkordersListQuery } from '../../../modules/native-crm/queries/workorders.queries';
import { useInvoicesListQuery } from '../../../modules/native-crm/queries/invoices.queries';
import { useContractsListQuery } from '../../../modules/native-crm/queries/contracts.queries';
import { useQuotationsListQuery } from '../../../modules/native-crm/queries/quotations.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { 
  mapWorkOrdersToEvents, 
  mapInvoicesToEvents, 
  mapContractsToEvents, 
  mapQuotationsToEvents 
} from './calendar-event.mapper';
import { BusinessEvent } from './calendar.types';
import { WrenchScrewdriverIcon, DocumentTextIcon, DocumentCheckIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

export function useCalendarData(filters: Record<string, boolean>) {
  const { data: woData, isLoading: woLoading } = useWorkordersListQuery({ page: 1, limit: 500 });
  const { data: invData, isLoading: invLoading } = useInvoicesListQuery({ page: 1, limit: 500 });
  const { data: conData, isLoading: conLoading } = useContractsListQuery({ page: 1, limit: 500 });
  const { data: quoData, isLoading: quoLoading } = useQuotationsListQuery({ page: 1, limit: 500 });
  const { data: custList, isLoading: custLoading } = useCustomersListQuery({ page: 1, limit: 500 });

  const customers = custList?.items || [];
  const isLoading = woLoading || invLoading || conLoading || quoLoading || custLoading;

  const allEvents = useMemo(() => {
    let events: BusinessEvent[] = [];
    
    if (filters.workorder && woData?.items) {
      events = [...events, ...mapWorkOrdersToEvents(woData.items, customers)];
    }
    if (filters.invoice && invData?.items) {
      events = [...events, ...mapInvoicesToEvents(invData.items, customers)];
    }
    if (filters.contract && conData?.items) {
      events = [...events, ...mapContractsToEvents(conData.items, customers)];
    }
    if (filters.quotation && quoData?.items) {
      events = [...events, ...mapQuotationsToEvents(quoData.items, customers)];
    }
    
    return events;
  }, [woData, invData, conData, quoData, customers, filters]);

  // Group events by date for Month View Summaries
  const groupedSummaryEvents = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    
    allEvents.forEach(ev => {
      const dateStr = new Date(ev.start).toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = { workorder: 0, invoice: 0, contract: 0, quotation: 0 };
      }
      if (grouped[dateStr][ev.module] !== undefined) {
        grouped[dateStr][ev.module]++;
      }
    });

    const summaries: any[] = [];
    
    Object.keys(grouped).forEach(date => {
      const counts = grouped[date];
      
      if (counts.workorder > 0) {
        summaries.push({
          id: `sum-wo-${date}`,
          title: `Work Orders (${counts.workorder})`,
          start: date,
          allDay: true,
          backgroundColor: '#d1fae5',
          borderColor: '#059669',
          textColor: '#065f46',
          extendedProps: { type: 'summary', module: 'workorder', date, count: counts.workorder, icon: WrenchScrewdriverIcon }
        });
      }
      if (counts.invoice > 0) {
        summaries.push({
          id: `sum-inv-${date}`,
          title: `Invoices Due (${counts.invoice})`,
          start: date,
          allDay: true,
          backgroundColor: '#ffe4e6',
          borderColor: '#e11d48',
          textColor: '#9f1239',
          extendedProps: { type: 'summary', module: 'invoice', date, count: counts.invoice, icon: DocumentTextIcon }
        });
      }
      if (counts.contract > 0) {
        summaries.push({
          id: `sum-con-${date}`,
          title: `Contracts (${counts.contract})`,
          start: date,
          allDay: true,
          backgroundColor: '#e0e7ff',
          borderColor: '#4f46e5',
          textColor: '#3730a3',
          extendedProps: { type: 'summary', module: 'contract', date, count: counts.contract, icon: DocumentCheckIcon }
        });
      }
      if (counts.quotation > 0) {
        summaries.push({
          id: `sum-quo-${date}`,
          title: `Quotations (${counts.quotation})`,
          start: date,
          allDay: true,
          backgroundColor: '#fef3c7',
          borderColor: '#d97706',
          textColor: '#92400e',
          extendedProps: { type: 'summary', module: 'quotation', date, count: counts.quotation, icon: ClipboardDocumentListIcon }
        });
      }
    });

    return summaries;
  }, [allEvents]);

  // FullCalendar format for detailed views (Week/Day)
  const detailedEvents = useMemo(() => {
    return allEvents.map(ev => ({
      id: ev.id,
      title: `${ev.title}${ev.customerName ? ` - ${ev.customerName}` : ''}`,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      backgroundColor: ev.bgColor,
      borderColor: ev.color,
      textColor: ev.textColor,
      extendedProps: { ...ev },
    }));
  }, [allEvents]);

  return { isLoading, allEvents, groupedSummaryEvents, detailedEvents };
}
