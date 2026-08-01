import { useNavigate } from 'react-router-dom';
import {
  Squares2X2Icon, AdjustmentsHorizontalIcon, TableCellsIcon, Cog6ToothIcon,
  BellAlertIcon, BoltIcon, ArrowsRightLeftIcon, ArrowRightIcon, ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface HubCard {
  key:         string;
  title:       string;
  description: string;
  icon:        typeof Squares2X2Icon;
  color:       string;
  path?:       string;   // present when available now
  eta?:        string;   // present when not yet built
}

const CARDS: HubCard[] = [
  {
    key: 'pipelines', title: 'Pipelines & Stages',
    description: 'Configure each module’s own stage list — Leads, Deals, Tasks, Tickets, Quotations, Work Orders, Contracts, Invoices.',
    icon: Squares2X2Icon, color: '#8b5cf6', path: '/native-crm/settings/pipelines',
  },
  {
    key: 'custom-fields', title: 'Custom Fields',
    description: 'Add extra fields to any built-in module without a code change.',
    icon: AdjustmentsHorizontalIcon, color: '#7c3aed', path: '/native-crm/custom-fields',
  },
  {
    key: 'custom-modules', title: 'Custom Modules',
    description: 'Build a brand-new tenant-defined object — its own fields, list page, and API.',
    icon: TableCellsIcon, color: '#0d9488', path: '/native-crm/custom-modules',
  },
  {
    key: 'fs-settings', title: 'Field Service Settings',
    description: 'Company info, document prefixes, branding, and the document-generation workflow.',
    icon: Cog6ToothIcon, color: '#64748b', path: '/native-crm/settings',
  },
  {
    key: 'notifications', title: 'Notifications',
    description: 'Reminder timing, on-create confirmations, and delivery channels.',
    icon: BellAlertIcon, color: '#0ea5e9', path: '/native-crm/settings/notifications',
  },
  {
    key: 'automations', title: 'Automations',
    description: '“When [module] status changes to [X] → send [email/SMS] using [template]”.',
    icon: BoltIcon, color: '#f59e0b', path: '/native-crm/settings/automations',
  },
  {
    key: 'import-export', title: 'Import / Export',
    description: 'CSV export for any module, plus validated CSV import for Leads and Deals.',
    icon: ArrowsRightLeftIcon, color: '#16a34a', path: '/native-crm/settings/import-export',
  },
  {
    key: 'ai-widget', title: 'AI Chatbot Widget',
    description: 'Embed a 24/7 AI sales agent on your own website — it captures and assigns leads automatically.',
    icon: ChatBubbleLeftRightIcon, color: '#2563eb', path: '/native-crm/settings/widget',
  },
];

export default function ConfigurationHubPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Cog6ToothIcon className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Configuration</h1>
          <p className="text-xs text-gray-500">Everything a tenant admin configures, in one place</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const available = !!card.path;
            return (
              <button
                key={card.key}
                type="button"
                disabled={!available}
                onClick={() => available && navigate(card.path!)}
                className={`text-left bg-white rounded-xl border border-gray-200 p-5 shadow-sm transition-all ${
                  available
                    ? 'hover:border-brand-300 hover:shadow-md cursor-pointer group'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${card.color}1a` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  {card.eta ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-2 py-1 shrink-0">
                      {card.eta}
                    </span>
                  ) : (
                    <ArrowRightIcon className="h-4 w-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-2.5" />
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-3">{card.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
