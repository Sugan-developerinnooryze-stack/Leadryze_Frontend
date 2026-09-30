import { BusinessEvent } from '../calendar.types';
import { 
  WrenchScrewdriverIcon, 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  BanknotesIcon 
} from '@heroicons/react/24/outline';
import { useMemo } from 'react';

interface Props {
  events: BusinessEvent[];
}

export default function CalendarKPI({ events }: Props) {
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    let visitsToday = 0;
    let overdueInvoices = 0;
    let renewalsUpcoming = 0;
    let revenueToday = 0;

    events.forEach(ev => {
      const evDate = new Date(ev.start).toISOString().split('T')[0];
      
      if (ev.module === 'workorder' && evDate === today) {
        visitsToday++;
      }
      if (ev.module === 'invoice' && ev.status === 'overdue') {
        overdueInvoices++;
      }
      if (ev.module === 'contract' && ev.eventType === 'renewal' && new Date(ev.start) > new Date()) {
        renewalsUpcoming++;
      }
      if (ev.module === 'invoice' && evDate === today && ev.raw?.totalAmount) {
        revenueToday += ev.raw.totalAmount;
      }
    });

    return { visitsToday, overdueInvoices, renewalsUpcoming, revenueToday };
  }, [events]);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-success-500/15 text-success-700 dark:text-success-500 rounded-lg">
          <WrenchScrewdriverIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase">Today's Visits</p>
          <p className="text-2xl font-bold text-text-primary">{metrics.visitsToday}</p>
        </div>
      </div>
      
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-lg">
          <DocumentTextIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase">Overdue Invoices</p>
          <p className="text-2xl font-bold text-text-primary">{metrics.overdueInvoices}</p>
        </div>
      </div>
      
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-lg">
          <DocumentCheckIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase">Upcoming Renewals</p>
          <p className="text-2xl font-bold text-text-primary">{metrics.renewalsUpcoming}</p>
        </div>
      </div>
      
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-lg">
          <BanknotesIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase">Invoice Due Today</p>
          <p className="text-2xl font-bold text-text-primary">₹{metrics.revenueToday.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
