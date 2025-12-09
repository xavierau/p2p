import api from '@/lib/api';

export interface IntegrationSettings {
  key?: string;
  enabled?: boolean;
  config?: string;
  // Config fields when parsed
  clientId?: string;
  clientSecret?: string;
}

export interface IntegrationResponse {
  key: string;
  enabled: boolean;
  config: string;
}

const getIntegrationSettings = async (integration: string): Promise<IntegrationResponse> => {
  const response = await api.get(`/settings/integration/${integration}`);
  return response.data;
};

const updateIntegrationSettings = async (integration: string, settings: { enabled?: boolean; config?: string }): Promise<void> => {
  await api.put(`/settings/integration/${integration}`, settings);
};

export const settingsService = {
  getIntegrationSettings,
  updateIntegrationSettings,
};
