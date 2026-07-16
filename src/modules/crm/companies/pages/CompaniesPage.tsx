import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import CrmLayout from '../../shared/CrmLayout';
import type { ModulePageConfig } from '../../shared/types/crm.types';

const config: ModulePageConfig = {
  label:         'Companies',
  labelSingular: 'Company',
  apiBase:       '/api/v1/native-crm/companies',
  statusField:   'companyStatus',
  fields: [
    { key: 'name',          label: 'Company Name',     type: 'text',   required: true },
    { key: 'domain',        label: 'Website / Domain', type: 'text',   tableCol: true, placeholder: 'company.com' },
    { key: 'industry',      label: 'Industry',         type: 'select', tableCol: true,
      options: ['Technology','Finance','Healthcare','Education','Manufacturing','Retail','Real Estate','Media','Consulting','Other'] },
    { key: 'employeeCount', label: 'Employees',        type: 'number' },
    { key: 'phone',         label: 'Phone',            type: 'phone',  tableCol: true },
    { key: 'city',          label: 'City',             type: 'text' },
    { key: 'country',       label: 'Country',          type: 'text' },
    { key: 'companyStatus', label: 'Status',           type: 'select', tableCol: true,
      options: ['active', 'inactive', 'prospect'] },
    { key: 'notes',         label: 'Notes',            type: 'textarea' },
  ],
};

export default function CompaniesPage() {
  return <CrmLayout config={config} iconColor="#3b82f6" Icon={BuildingOffice2Icon} />;
}
