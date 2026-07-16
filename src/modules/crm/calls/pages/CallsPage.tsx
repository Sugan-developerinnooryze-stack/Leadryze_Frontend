import { PhoneIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Calls',
  labelSingular: 'Call',
  apiBase:       '/api/v1/native-crm/calls',
  statusField:   'callStatus',
  fields: [
    { key: 'contactName', label: 'Contact Name',    type: 'text',    required: true },
    { key: 'direction',   label: 'Direction',       type: 'select',  tableCol: true,
      options: ['inbound', 'outbound'] },
    { key: 'duration',    label: 'Duration (min)',  type: 'number',  tableCol: true },
    { key: 'callStatus',  label: 'Status',          type: 'select',  tableCol: true,
      options: ['planned', 'completed', 'missed', 'cancelled'] },
    { key: 'date',        label: 'Date & Time',     type: 'datetime', tableCol: true },
    { key: 'notes',       label: 'Notes',           type: 'textarea' },
  ],
};

export default function CallsPage() {
  return <CrmLayout config={config} iconColor="#8b5cf6" Icon={PhoneIcon} />;
}
