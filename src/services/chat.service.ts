import api from './api';

export interface ChatPayload {
  tenantId: string;
  sessionId: string;
  message: string;
  companyName?: string;
  customInstructions?: string;
}

export interface FollowupPayload {
  tenantId: string;
  customerId: string;
  customerName: string;
  lastInteraction: string;
  channel: string;
  companyName: string;
  daysSinceContact: number;
}

export const chatService = {
  sendMessage: (data: ChatPayload) => api.post('/api/v1/ai/chat', data),
  generateFollowup: (data: FollowupPayload) => api.post('/api/v1/ai/followup', data),
  generateMarketing: (data: Record<string, unknown>) => api.post('/api/v1/ai/marketing', data),
  escalate: (data: Record<string, unknown>) => api.post('/api/v1/ai/escalate', data),
};
