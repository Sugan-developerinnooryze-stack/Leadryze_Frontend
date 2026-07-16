import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Meetings',
  labelSingular: 'Meeting',
  apiBase:       '/api/v1/native-crm/meetings',
  statusField:   'meetingStatus',
  fields: [
    { key: 'title',         label: 'Meeting Title', type: 'text',     required: true },
    { key: 'startDate',     label: 'Start',         type: 'datetime', tableCol: true },
    { key: 'endDate',       label: 'End',           type: 'datetime', tableCol: true },
    { key: 'location',      label: 'Location',      type: 'text',     tableCol: true },
    { key: 'meetingStatus', label: 'Status',        type: 'select',   tableCol: true,
      options: ['scheduled', 'completed', 'cancelled'] },
    { key: 'attendees',     label: 'Attendees',     type: 'text',     placeholder: 'Comma-separated names' },
    { key: 'notes',         label: 'Notes',         type: 'textarea' },
  ],
};

export default function MeetingsPage() {
  return <CrmLayout config={config} iconColor="#0ea5e9" Icon={CalendarDaysIcon} />;
}
