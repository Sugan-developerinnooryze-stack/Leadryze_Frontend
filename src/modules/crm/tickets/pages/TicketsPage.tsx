import { LifebuoyIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

export const config: ModulePageConfig = {
  label:         'Tickets',
  labelSingular: 'Ticket',
  apiBase:       '/api/v1/native-crm/tickets',
  statusField:   'ticketStatus',
  pipelineModule: 'ticket',
  altView:       'kanban',
  altViewLabel:  'Kanban board',
  // Opts into the dedicated detail page (TicketViewPage) instead of the
  // generic RecordDrawer on row click — same mechanism Contacts/Companies/
  // WorkOrders already use.
  detailRoute: (id) => `/crm/tickets/${id}`,
  fields: [
    // System-managed — populated server-side by the ticketSchema pre-save
    // hook, never editable.
    { key: 'ticketNumber', label: 'Ticket #',    type: 'text',    tableCol: true, hideInForm: true },
    { key: 'subject',      label: 'Subject',     type: 'text',    required: true, tableCol: true },
    { key: 'priority',     label: 'Priority',    type: 'select',  tableCol: true,
      options: ['low', 'medium', 'high', 'critical'] },
    { key: 'ticketStatus', label: 'Status',      type: 'select',  tableCol: true,
      options: ['open', 'in_progress', 'resolved', 'closed'] },
    { key: 'contactName',  label: 'Contact',     type: 'text',    tableCol: true },
    // Assignment intentionally stays on the generic create/edit form (a
    // starting pick is fine here) — REASSIGNING after creation goes through
    // the dedicated .assign-permission-gated flow on the detail page
    // instead, not this form (see ticket.validation.ts's updateTicketSchema,
    // which excludes staffId/teamId from the general edit path).
    { key: 'staffId',      label: 'Assigned Staff', type: 'staffSelect' },
    { key: 'teamId',       label: 'Team',           type: 'teamSelect' },
    { key: 'categoryId',   label: 'Category',       type: 'categorySelect', tableCol: true },
    { key: 'description',  label: 'Description', type: 'textarea' },
    // System-managed — see attachmentCount's own listTickets() comment
    // (batch-counted, table-level "view flow").
    { key: 'attachmentCount', label: 'Files', type: 'number', tableCol: true, hideInForm: true },
    // Derived server-side (deriveSlaStatus(), never stored) — same emoji
    // convention the SLA-status filter below uses, so the table badge and
    // the filter dropdown read as the same concept at a glance.
    { key: 'slaStatus', label: 'SLA', type: 'text', tableCol: true, hideInForm: true },
  ],
  // Server-side filter bar — every param here is sent straight through to
  // GET /tickets (ticket.controller.ts's list()), not a client-side
  // re-filter of the current page, so it stays correct past 1,000+ tickets.
  filterFields: [
    { key: 'priority', label: 'Priority', kind: 'select', options: [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
    ] },
    { key: 'categoryId', label: 'Category', kind: 'categorySelect' },
    { key: 'teamId', label: 'Team', kind: 'teamSelect' },
    { key: 'staffId', label: 'Staff', kind: 'staffSelect' },
    { key: 'source', label: 'Source', kind: 'select', options: [
      { value: 'manual', label: 'Manual' }, { value: 'web', label: 'Web' },
      { value: 'ai_chatbot', label: 'AI Chatbot' }, { value: 'api', label: 'API' },
      { value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' },
    ] },
    { key: 'slaStatus', label: 'SLA Status', kind: 'select', options: [
      { value: 'on_track', label: '🟢 On Track' }, { value: 'warning', label: '🟡 Warning' },
      { value: 'breached', label: '🔴 Breached' }, { value: 'no_sla', label: '⚪ No SLA' },
    ] },
    { key: 'tags', label: 'Tags', kind: 'text', placeholder: 'tag1, tag2…' },
    { key: 'createdFrom', toKey: 'createdTo', label: 'Created', kind: 'dateRange' },
    { key: 'dueFrom', toKey: 'dueTo', label: 'Due', kind: 'dateRange' },
  ],
  // Opt-in bulk-action bar — reuses the exact single-ticket business logic
  // (SLA recompute, timeline logging, automation firing) via POST
  // /tickets/bulk, capped at 200 ids per call.
  bulkActions: [
    { action: 'assign_staff', label: 'Assign Staff', input: 'staffSelect', valueField: 'staffId' },
    { action: 'assign_team',  label: 'Assign Team',  input: 'teamSelect',  valueField: 'teamId' },
    { action: 'set_status',   label: 'Change Status', input: 'select', valueField: 'status', options: [
      { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' },
      { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
    ] },
    { action: 'set_priority', label: 'Change Priority', input: 'select', valueField: 'priority', options: [
      { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
    ] },
    { action: 'add_tag', label: 'Add Tag', input: 'text', valueField: 'tag', placeholder: 'Tag name' },
  ],
};

export default function TicketsPage() {
  return <CrmLayout config={config} iconColor="#ef4444" Icon={LifebuoyIcon} />;
}
