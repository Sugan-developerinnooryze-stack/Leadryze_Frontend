import {
  UserGroupIcon, BuildingOffice2Icon, BriefcaseIcon,
  ClipboardDocumentListIcon, LifebuoyIcon, PhoneIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type { FC, SVGProps } from 'react';

export type NativeModule = 'contacts' | 'companies' | 'deals' | 'tasks' | 'tickets' | 'calls' | 'meetings';

export interface FieldDef {
  key:          string;
  label:        string;
  type:         'text' | 'email' | 'phone' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'currency';
  required?:    boolean;
  options?:     string[];
  placeholder?: string;
}

export interface ModuleConfig {
  label:         string;
  labelSingular: string;
  icon:          FC<SVGProps<SVGSVGElement> & { className?: string }>;
  color:         string;
  statusField?:  string;
  defaultStatus: string;
  fields:        FieldDef[];
  listColumns:   string[];
}

export const NATIVE_MODULES: { key: NativeModule; label: string; icon: ModuleConfig['icon']; color: string }[] = [
  { key: 'contacts',  label: 'Contacts',  icon: UserGroupIcon,              color: '#6366f1' },
  { key: 'companies', label: 'Companies', icon: BuildingOffice2Icon,        color: '#3b82f6' },
  { key: 'deals',     label: 'Deals',     icon: BriefcaseIcon,              color: '#10b981' },
  { key: 'tasks',     label: 'Tasks',     icon: ClipboardDocumentListIcon,  color: '#f97316' },
  { key: 'tickets',   label: 'Tickets',   icon: LifebuoyIcon,               color: '#ef4444' },
  { key: 'calls',     label: 'Calls',     icon: PhoneIcon,                  color: '#8b5cf6' },
  { key: 'meetings',  label: 'Meetings',  icon: CalendarDaysIcon,           color: '#0ea5e9' },
];

export const MODULE_CONFIGS: Record<NativeModule, ModuleConfig> = {
  contacts: {
    label: 'Contacts', labelSingular: 'Contact',
    icon: UserGroupIcon, color: '#6366f1',
    statusField: 'status', defaultStatus: 'lead',
    listColumns: ['email', 'phone', 'company', 'status'],
    fields: [
      { key: 'firstName',  label: 'First Name',  type: 'text',    required: true },
      { key: 'lastName',   label: 'Last Name',   type: 'text',    required: true },
      { key: 'email',      label: 'Email',       type: 'email',   required: true },
      { key: 'phone',      label: 'Phone',       type: 'phone' },
      { key: 'company',    label: 'Company',     type: 'text' },
      { key: 'jobTitle',   label: 'Job Title',   type: 'text' },
      { key: 'status',     label: 'Status',      type: 'select',  options: ['lead', 'contact', 'customer'] },
      { key: 'source',     label: 'Lead Source', type: 'select',  options: ['website', 'referral', 'social', 'email', 'cold', 'other'] },
      { key: 'notes',      label: 'Notes',       type: 'textarea' },
    ],
  },
  companies: {
    label: 'Companies', labelSingular: 'Company',
    icon: BuildingOffice2Icon, color: '#3b82f6',
    statusField: 'companyStatus', defaultStatus: 'active',
    listColumns: ['domain', 'industry', 'city', 'companyStatus'],
    fields: [
      { key: 'name',          label: 'Company Name',     type: 'text',    required: true },
      { key: 'domain',        label: 'Website / Domain', type: 'text',    placeholder: 'company.com' },
      { key: 'industry',      label: 'Industry',         type: 'select',  options: ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Real Estate', 'Media', 'Consulting', 'Other'] },
      { key: 'employeeCount', label: 'Employees',        type: 'number' },
      { key: 'phone',         label: 'Phone',            type: 'phone' },
      { key: 'city',          label: 'City',             type: 'text' },
      { key: 'country',       label: 'Country',          type: 'text' },
      { key: 'companyStatus', label: 'Status',           type: 'select',  options: ['active', 'inactive', 'prospect'] },
      { key: 'notes',         label: 'Notes',            type: 'textarea' },
    ],
  },
  deals: {
    label: 'Deals', labelSingular: 'Deal',
    icon: BriefcaseIcon, color: '#10b981',
    statusField: 'stage', defaultStatus: 'prospect',
    listColumns: ['amount', 'stage', 'closeDate', 'contactName'],
    fields: [
      { key: 'title',       label: 'Deal Title',    type: 'text',    required: true },
      { key: 'amount',      label: 'Amount',        type: 'currency' },
      { key: 'currency',    label: 'Currency',      type: 'select',  options: ['USD', 'EUR', 'INR', 'GBP', 'AED', 'SGD'] },
      { key: 'stage',       label: 'Stage',         type: 'select',  required: true, options: ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      { key: 'closeDate',   label: 'Close Date',    type: 'date' },
      { key: 'contactName', label: 'Contact',       type: 'text',    placeholder: 'Linked contact name' },
      { key: 'notes',       label: 'Notes',         type: 'textarea' },
    ],
  },
  tasks: {
    label: 'Tasks', labelSingular: 'Task',
    icon: ClipboardDocumentListIcon, color: '#f97316',
    statusField: 'taskStatus', defaultStatus: 'todo',
    listColumns: ['dueDate', 'priority', 'taskStatus', 'assignedTo'],
    fields: [
      { key: 'title',      label: 'Task Title',   type: 'text',    required: true },
      { key: 'dueDate',    label: 'Due Date',     type: 'date',    required: true },
      { key: 'priority',   label: 'Priority',     type: 'select',  options: ['low', 'medium', 'high'] },
      { key: 'taskStatus', label: 'Status',       type: 'select',  options: ['todo', 'in_progress', 'done', 'cancelled'] },
      { key: 'assignedTo', label: 'Assigned To',  type: 'text' },
      { key: 'notes',      label: 'Notes',        type: 'textarea' },
    ],
  },
  tickets: {
    label: 'Tickets', labelSingular: 'Ticket',
    icon: LifebuoyIcon, color: '#ef4444',
    statusField: 'ticketStatus', defaultStatus: 'open',
    listColumns: ['priority', 'ticketStatus'],
    fields: [
      { key: 'subject',      label: 'Subject',     type: 'text',    required: true },
      { key: 'priority',     label: 'Priority',    type: 'select',  options: ['low', 'medium', 'high', 'critical'] },
      { key: 'ticketStatus', label: 'Status',      type: 'select',  options: ['open', 'in_progress', 'resolved', 'closed'] },
      { key: 'description',  label: 'Description', type: 'textarea' },
    ],
  },
  calls: {
    label: 'Calls', labelSingular: 'Call',
    icon: PhoneIcon, color: '#8b5cf6',
    statusField: 'callStatus', defaultStatus: 'planned',
    listColumns: ['direction', 'duration', 'callStatus', 'date'],
    fields: [
      { key: 'contactName', label: 'Contact Name',   type: 'text',    required: true },
      { key: 'direction',   label: 'Direction',      type: 'select',  options: ['inbound', 'outbound'] },
      { key: 'duration',    label: 'Duration (min)', type: 'number' },
      { key: 'callStatus',  label: 'Status',         type: 'select',  options: ['planned', 'completed', 'missed', 'cancelled'] },
      { key: 'date',        label: 'Date & Time',    type: 'datetime' },
      { key: 'notes',       label: 'Notes',          type: 'textarea' },
    ],
  },
  meetings: {
    label: 'Meetings', labelSingular: 'Meeting',
    icon: CalendarDaysIcon, color: '#0ea5e9',
    statusField: 'meetingStatus', defaultStatus: 'scheduled',
    listColumns: ['startDate', 'endDate', 'location', 'meetingStatus'],
    fields: [
      { key: 'title',         label: 'Meeting Title', type: 'text',    required: true },
      { key: 'startDate',     label: 'Start',         type: 'datetime' },
      { key: 'endDate',       label: 'End',           type: 'datetime' },
      { key: 'location',      label: 'Location',      type: 'text' },
      { key: 'attendees',     label: 'Attendees',     type: 'text',    placeholder: 'Comma-separated names or emails' },
      { key: 'meetingStatus', label: 'Status',        type: 'select',  options: ['scheduled', 'completed', 'cancelled'] },
      { key: 'notes',         label: 'Notes',         type: 'textarea' },
    ],
  },
};

/* ── Status badge colors ──────────────────────────────────────────────────── */
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // contacts
  lead:        { bg: 'bg-blue-100',   text: 'text-blue-700' },
  contact:     { bg: 'bg-purple-100', text: 'text-purple-700' },
  customer:    { bg: 'bg-green-100',  text: 'text-green-700' },
  // companies
  active:      { bg: 'bg-green-100',  text: 'text-green-700' },
  inactive:    { bg: 'bg-gray-100',   text: 'text-gray-500' },
  prospect:    { bg: 'bg-amber-100',  text: 'text-amber-700' },
  // deals
  qualified:   { bg: 'bg-blue-100',   text: 'text-blue-700' },
  proposal:    { bg: 'bg-purple-100', text: 'text-purple-700' },
  negotiation: { bg: 'bg-orange-100', text: 'text-orange-700' },
  closed_won:  { bg: 'bg-green-100',  text: 'text-green-700' },
  closed_lost: { bg: 'bg-red-100',    text: 'text-red-700' },
  // tasks
  todo:        { bg: 'bg-gray-100',   text: 'text-gray-600' },
  in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  done:        { bg: 'bg-green-100',  text: 'text-green-700' },
  cancelled:   { bg: 'bg-gray-100',   text: 'text-gray-400' },
  // tickets/calls/meetings
  open:        { bg: 'bg-red-100',    text: 'text-red-700' },
  resolved:    { bg: 'bg-green-100',  text: 'text-green-700' },
  closed:      { bg: 'bg-gray-100',   text: 'text-gray-500' },
  planned:     { bg: 'bg-blue-100',   text: 'text-blue-700' },
  completed:   { bg: 'bg-green-100',  text: 'text-green-700' },
  missed:      { bg: 'bg-red-100',    text: 'text-red-700' },
  scheduled:   { bg: 'bg-blue-100',   text: 'text-blue-700' },
  // priority
  low:         { bg: 'bg-gray-100',   text: 'text-gray-500' },
  medium:      { bg: 'bg-amber-100',  text: 'text-amber-700' },
  high:        { bg: 'bg-red-100',    text: 'text-red-700' },
  critical:    { bg: 'bg-rose-100',   text: 'text-rose-700' },
};
