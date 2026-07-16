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
  // Customers page tabs
  customers_tabLeads:    boolean;
  customers_tabContacts: boolean;
  customers_tabDirect:   boolean;
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
  customers_tabLeads:    true,
  customers_tabContacts: true,
  customers_tabDirect:   true,
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
