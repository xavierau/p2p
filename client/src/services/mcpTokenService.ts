import api from '@/lib/api';

export interface McpToken {
  id: number;
  name: string;
  tokenPrefix: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
  isExpired: boolean;
}

export interface CreateTokenInput {
  name: string;
  expiryDays: number;
}

export interface CreateTokenResponse {
  message: string;
  token: string; // Raw token - only shown once!
  tokenPrefix: string;
  id: number;
  name: string;
  expiresAt: string;
  createdAt: string;
}

interface ListTokensResponse {
  data: McpToken[];
  count: number;
}

export const mcpTokenService = {
  async list(): Promise<McpToken[]> {
    const response = await api.get<ListTokensResponse>('/mcp-tokens');
    return response.data.data;
  },

  async create(input: CreateTokenInput): Promise<CreateTokenResponse> {
    const response = await api.post<CreateTokenResponse>('/mcp-tokens', input);
    return response.data;
  },

  async revoke(tokenId: number): Promise<void> {
    await api.delete(`/mcp-tokens/${tokenId}`);
  },
};
