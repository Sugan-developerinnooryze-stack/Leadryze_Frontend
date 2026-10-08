import { UserGroupIcon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

export const config: ModulePageConfig = {
  label:         'Contacts',
  labelSingular: 'Contact',
  apiBase:       '/api/v1/native-crm/contacts',
  statusField:   'status',
  detailRoute:   (id) => `/crm/contacts/${id}`,
  fields: [
    /* ── Identity ── */
    { key: 'email',         label: 'Email',           type: 'email',   required: true,  tableCol: true },
    { key: 'firstName',     label: 'First name',      type: 'text',    required: true },
    // LR-CONTACT-002: required server-side (contact.schema.ts) but never
    // marked required here, so the browser let the form submit and the
    // user only found out from a raw Zod validation error.
    { key: 'lastName',      label: 'Last name',       type: 'text',    required: true },
    /* ── Ownership / contact info ── */
    // LR-CONTACT-001/LR-RULE-003: real link to a platform CRM/sales User,
    // not free text — stores User._id, resolved for display via
    // useUserNameMap (same mechanism as Lead/Deal's own Owner field).
    { key: 'contactOwner',  label: 'Contact owner',   type: 'userSelect', tableCol: true },
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
    // LR-CONTACT-001: real link to a native-crm Company record (stores
    // Company._id), replacing the free-text `company` field as the primary
    // column — `company` is kept below, unmarked as a table column, purely
    // so pre-existing typed values stay visible/editable.
    { key: 'companyId',     label: 'Primary company', type: 'companySelect', tableCol: true },
    { key: 'company',       label: 'Company (legacy text)', type: 'text' },
    /* ── Classification ── */
    { key: 'status',        label: 'Status',          type: 'select',
      options: ['lead','contact','customer'] },
    { key: 'source',        label: 'Lead source',     type: 'select',
      options: ['website','referral','social','email','cold','other'] },
    /* ── Notes ── */
    { key: 'notes',         label: 'Notes',           type: 'textarea' },
    { key: 'createdAt',     label: 'Created Date',    type: 'date' },
  ],
};

export default function ContactsPage() {
  return <CrmLayout config={config} iconColor="#6366f1" Icon={UserGroupIcon} />;
}
