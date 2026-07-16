import { UserGroupIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Contacts',
  labelSingular: 'Contact',
  apiBase:       '/api/v1/native-crm/contacts',
  statusField:   'status',
  fields: [
    /* ── Identity ── */
    { key: 'email',         label: 'Email',           type: 'email',   required: true,  tableCol: true },
    { key: 'firstName',     label: 'First name',      type: 'text',    required: true },
    { key: 'lastName',      label: 'Last name',       type: 'text' },
    /* ── Ownership / contact info ── */
    { key: 'contactOwner',  label: 'Contact owner',   type: 'text',    tableCol: true },
    { key: 'jobTitle',      label: 'Job title',       type: 'text' },
    { key: 'phone',         label: 'Phone number',    type: 'phone',   tableCol: true },
    /* ── Lifecycle ── */
    {
      key: 'lifecycleStage', label: 'Lifecycle stage', type: 'select', tableCol: true, searchable: true,
      options: ['subscriber','lead','marketing_qualified_lead','sales_qualified_lead','opportunity','customer','evangelist','other'],
    },
    {
      key: 'leadStatus', label: 'Lead status', type: 'select', tableCol: true,
      options: ['new','open','in_progress','open_deal','unqualified','attempted_to_contact','connected','bad_timing'],
    },
    /* ── Company ── */
    { key: 'company',       label: 'Primary company', type: 'text',    tableCol: true },
    /* ── Classification ── */
    { key: 'status',        label: 'Status',          type: 'select',
      options: ['lead','contact','customer'] },
    { key: 'source',        label: 'Lead source',     type: 'select',
      options: ['website','referral','social','email','cold','other'] },
    /* ── Notes ── */
    { key: 'notes',         label: 'Notes',           type: 'textarea' },
  ],
};

export default function ContactsPage() {
  return <CrmLayout config={config} iconColor="#6366f1" Icon={UserGroupIcon} />;
}
