export type CampaignType = 'broadcast' | 'drip' | 'reengagement' | 'followup';
export type CampaignChannel = 'email' | 'whatsapp' | 'sms' | 'instagram';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface CampaignAudience {
  type?: 'all_customers' | 'filtered' | 'manual';
  filter?: Record<string, unknown>;
  customerIds?: string[];
  estimatedCount?: number;
}

export interface CampaignSchedule {
  startAt?: string;
  endAt?: string;
  timezone?: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  failed: number;
}

export interface Campaign {
  _id: string;
  tenantId: string;
  name: string;
  type: CampaignType;
  channel: CampaignChannel;
  status: CampaignStatus;
  templateId?: string;
  audience: CampaignAudience;
  schedule?: CampaignSchedule;
  stats: CampaignStats;
  activatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignRecipientStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'skipped';

export interface CampaignRecipient {
  _id: string;
  campaignId: string;
  customerId: string;
  name?: string;
  email?: string;
  phone?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  status: CampaignRecipientStatus;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
  failedAt?: string;
}

export interface AudiencePreview {
  count: number;
  withContact: number;
  missingContact: number;
  sample: { name: string; email?: string; phone?: string }[];
}
