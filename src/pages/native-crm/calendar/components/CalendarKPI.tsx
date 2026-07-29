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
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
          <WrenchScrewdriverIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Today's Visits</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.visitsToday}</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-rose-100 text-rose-600 rounded-lg">
          <DocumentTextIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Overdue Invoices</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.overdueInvoices}</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
          <DocumentCheckIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Upcoming Renewals</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.renewalsUpcoming}</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
          <BanknotesIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Invoice Due Today</p>
          <p className="text-2xl font-bold text-gray-900">₹{metrics.revenueToday.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
