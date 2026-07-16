import { LifebuoyIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Tickets',
  labelSingular: 'Ticket',
  apiBase:       '/api/v1/native-crm/tickets',
  statusField:   'ticketStatus',
  fields: [
    { key: 'subject',      label: 'Subject',     type: 'text',    required: true },
    { key: 'priority',     label: 'Priority',    type: 'select',  tableCol: true,
      options: ['low', 'medium', 'high', 'critical'] },
    { key: 'ticketStatus', label: 'Status',      type: 'select',  tableCol: true,
      options: ['open', 'in_progress', 'resolved', 'closed'] },
    { key: 'contactName',  label: 'Contact',     type: 'text',    tableCol: true },
    { key: 'description',  label: 'Description', type: 'textarea' },
  ],
};

export default function TicketsPage() {
  return <CrmLayout config={config} iconColor="#ef4444" Icon={LifebuoyIcon} />;
}
