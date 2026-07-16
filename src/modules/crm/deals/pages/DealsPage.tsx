import { BriefcaseIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Deals',
  labelSingular: 'Deal',
  apiBase:       '/api/v1/native-crm/deals',
  statusField:   'stage',
  fields: [
    { key: 'title',       label: 'Deal Title',  type: 'text',    required: true },
    { key: 'amount',      label: 'Amount',      type: 'currency', tableCol: true },
    { key: 'currency',    label: 'Currency',    type: 'select',
      options: ['USD', 'EUR', 'INR', 'GBP', 'AED', 'SGD'] },
    { key: 'stage',       label: 'Stage',       type: 'select',  required: true, tableCol: true,
      options: ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
    { key: 'closeDate',   label: 'Close Date',  type: 'date',    tableCol: true },
    { key: 'contactName', label: 'Contact',     type: 'text',    tableCol: true },
    { key: 'companyName', label: 'Company',     type: 'text' },
    { key: 'notes',       label: 'Notes',       type: 'textarea' },
  ],
};

export default function DealsPage() {
  return <CrmLayout config={config} iconColor="#10b981" Icon={BriefcaseIcon} />;
}
