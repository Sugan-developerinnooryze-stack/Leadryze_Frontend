import { create } from 'zustand';
import api from '../services/api';

export interface Tenant {
  _id: string;
  name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  settings: {
    crmOption: 'has_crm' | 'no_crm';
    channels: string[];
    aiConfig: { agentName: string; language: string; customInstructions: string };
  };
  branding: { primaryColor: string; logo?: string };
  isActive: boolean;
}

interface TenantState {
  tenant: Tenant | null;
  isLoading: boolean;
  fetchTenant: (id: string) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  isLoading: false,

  fetchTenant: async (id: string) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/api/v1/tenants/${id}`);
      set({ tenant: res.data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
