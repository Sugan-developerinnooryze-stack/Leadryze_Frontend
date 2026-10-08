import { create } from 'zustand';
import api from '../services/api';

export interface FeatureFlags {
  // Sidebar navigation
  nav_dashboard:   boolean;
  nav_aiChat:      boolean;
  nav_customers:   boolean;
  nav_campaigns:   boolean;
  nav_templates:   boolean;
  nav_analytics:   boolean;
  nav_knowledge:   boolean;
  nav_logs:        boolean;
  nav_connectors:  boolean;
  nav_settings:    boolean;
  nav_crmData:     boolean;
  nav_myCrm:       boolean;
  nav_nativeCrm:   boolean;
  nav_fieldService: boolean;
  nav_configuration: boolean;
  // Customers page tabs
  customers_tabLeads:    boolean;
  customers_tabContacts: boolean;
  customers_tabDirect:   boolean;
  // Native CRM sub-items
  native_contacts:  boolean;
  native_companies: boolean;
  native_deals:     boolean;
  native_tasks:     boolean;
  native_tickets:   boolean;
  native_calls:     boolean;
  native_meetings:  boolean;
  native_conversations: boolean;
  // Field Service sub-items
  fs_leads:      boolean;
  fs_categories: boolean;
  fs_services:   boolean;
  fs_teams:      boolean;
  fs_supervisors: boolean;
  fs_staffs:     boolean;
  fs_customers:  boolean;
  fs_sites:      boolean;
  fs_parts:      boolean;
  fs_quotations: boolean;
  fs_workorders: boolean;
  fs_contracts:  boolean;
  fs_invoices:   boolean;
  fs_receipts:   boolean;
  fs_expenses:   boolean;
  fs_activities: boolean;
  fs_products:   boolean;
  fs_assets:     boolean;
  fs_vehicles:   boolean;
  // Configuration sub-items
  config_hub:          boolean;
  config_customFields: boolean;
  config_customModules: boolean;
  config_fsSettings:   boolean;
  // Connector visibility — each type can be hidden per tenant
  connector_zoho:        boolean;
  connector_hubspot:     boolean;
  connector_salesforce:  boolean;
  connector_rest:        boolean;
  connector_mysql:       boolean;
  connector_postgresql:  boolean;
  connector_mongodb:     boolean;
  // Bot / AI controls
  bot_enabled:      boolean;
  bot_leadCapture:  boolean;
  bot_escalation:   boolean;
  bot_ragSearch:    boolean;
  bot_piiMasking:   boolean;
  bot_contentGuard: boolean;
  // Automation
  auto_followup:  boolean;
  auto_booking:   boolean;
  auto_reminder:  boolean;
  auto_feedback:  boolean;
}

export const ALL_FLAGS_TRUE: FeatureFlags = {
  nav_dashboard:   true,
  nav_aiChat:      true,
  nav_customers:   true,
  nav_campaigns:   true,
  nav_templates:   true,
  nav_analytics:   true,
  nav_knowledge:   true,
  nav_logs:        true,
  nav_connectors:  true,
  nav_settings:    true,
  nav_crmData:     true,
  nav_myCrm:       true,
  nav_nativeCrm:   true,
  nav_fieldService: true,
  nav_configuration: true,
  customers_tabLeads:    true,
  customers_tabContacts: true,
  customers_tabDirect:   true,
  native_contacts:  true,
  native_companies: true,
  native_deals:     true,
  native_tasks:     true,
  native_tickets:   true,
  native_calls:     true,
  native_meetings:  true,
  native_conversations: true,
  fs_leads:      true,
  fs_categories: true,
  fs_services:   true,
  fs_teams:      true,
  fs_supervisors: true,
  fs_staffs:     true,
  fs_customers:  true,
  fs_sites:      true,
  fs_parts:      true,
  fs_quotations: true,
  fs_workorders: true,
  fs_contracts:  true,
  fs_invoices:   true,
  fs_receipts:   true,
  fs_expenses:   true,
  fs_activities: true,
  fs_products:   true,
  fs_assets:     true,
  fs_vehicles:   true,
  config_hub:          true,
  config_customFields: true,
  config_customModules: true,
  config_fsSettings:   true,
  connector_zoho:        true,
  connector_hubspot:     true,
  connector_salesforce:  true,
  connector_rest:        true,
  connector_mysql:       true,
  connector_postgresql:  true,
  connector_mongodb:     true,
  bot_enabled:      true,
  bot_leadCapture:  true,
  bot_escalation:   true,
  bot_ragSearch:    true,
  bot_piiMasking:   true,
  bot_contentGuard: true,
  auto_followup:  false,
  auto_booking:   false,
  auto_reminder:  false,
  auto_feedback:  false,
};

const REFETCH_INTERVAL_MS = 30_000; // re-fetch at most once every 30 s

interface FlagStore {
  flags: FeatureFlags;
  loaded: boolean;
  lastFetched: number;
  loadFlags: (force?: boolean) => Promise<void>;
  reset: () => void;
}

export const useFeatureFlagsStore = create<FlagStore>((set, get) => ({
  flags:       ALL_FLAGS_TRUE,
  loaded:      false,
  lastFetched: 0,

  loadFlags: async (force = false) => {
    const now = Date.now();
    if (!force && now - get().lastFetched < REFETCH_INTERVAL_MS) return;
    try {
      const res = await api.get('/api/v1/tenants/features');
      set({ flags: { ...ALL_FLAGS_TRUE, ...(res.data.data ?? {}) }, loaded: true, lastFetched: now });
    } catch {
      set({ flags: ALL_FLAGS_TRUE, loaded: true, lastFetched: now });
    }
  },

  reset: () => set({ flags: ALL_FLAGS_TRUE, loaded: false, lastFetched: 0 }),
}));
