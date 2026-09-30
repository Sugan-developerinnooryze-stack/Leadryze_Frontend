export interface Stats {
  totalClients: number; totalCustomers: number; activeConnectors: number;
  totalUsers: number; totalMessages: number; totalCampaigns: number;
}
export interface AdminUser { _id: string; firstName: string; lastName: string; email: string; emailVerified?: boolean; createdAt: string }
export interface Client {
  _id: string; name: string; slug: string; clientId?: string; plan: string; isActive: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  userCount: number; customerCount: number; connectorCount: number;
  connectorTypes: string[];
  messageCount: number; campaignCount: number;
  adminUser: AdminUser | null; createdAt: string;
}
// password is present only when a Super Admin issued/regenerated this
// credential (never for a self-chosen one) — see backend's passwordEnc.
export interface TenantUser { _id: string; firstName: string; lastName: string; email: string; role: string; emailVerified: boolean; createdAt: string; password?: string | null; loginId?: string }
export interface RecentCustomer { _id: string; name: string; email: string; phone: string; channel: string; createdAt: string }
export interface ConnectorItem { _id: string; type: string; isActive: boolean; createdAt: string }
export interface Campaign { _id: string; name: string; type: string; status: string; stats: { sent: number; delivered: number; opened: number }; createdAt: string }
export interface AdminLog {
  _id: string; service: 'ai' | 'backend'; level: 'info' | 'warn' | 'error' | 'debug';
  event: string; message: string; metadata: Record<string, unknown>;
  sessionId?: string; createdAt: string;
  tenantId?: { name: string; slug: string };
}
export interface TenantDetail {
  tenant: Client; users: TenantUser[]; recentCustomers: RecentCustomer[];
  recentMessages: { _id: string; content: string; channel: string; direction: string; aiGenerated: boolean; status: string; createdAt: string; customerId?: { name: string; email: string } }[];
  connectors: ConnectorItem[]; campaigns: Campaign[];
}
