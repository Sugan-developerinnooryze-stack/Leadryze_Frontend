import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Tasks',
  labelSingular: 'Task',
  apiBase:       '/api/v1/native-crm/tasks',
  statusField:   'taskStatus',
  fields: [
    { key: 'title',      label: 'Task Title',  type: 'text',   required: true },
    { key: 'dueDate',    label: 'Due Date',    type: 'date',   required: true, tableCol: true },
    { key: 'priority',   label: 'Priority',    type: 'select', tableCol: true,
      options: ['low', 'medium', 'high'] },
    { key: 'taskStatus', label: 'Status',      type: 'select', tableCol: true,
      options: ['todo', 'in_progress', 'done', 'cancelled'] },
    { key: 'assignedTo', label: 'Assigned To', type: 'text',   tableCol: true },
    { key: 'notes',      label: 'Notes',       type: 'textarea' },
  ],
};

export default function TasksPage() {
  return <CrmLayout config={config} iconColor="#f97316" Icon={ClipboardDocumentListIcon} />;
}
