import { UserRole } from '@prisma/client';

export interface McpApiTokenProps {
  id: number;
  name: string;
  tokenHash: string;
  lookupHash: string | null; // SHA-256 hash for O(1) lookup - null for legacy tokens
  tokenPrefix: string;
  userId: number;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface McpApiTokenWithUser extends McpApiTokenProps {
  user: {
    id: number;
    email: string;
    role: UserRole;
  };
}

export interface CreateMcpTokenInput {
  name: string;
  expiryDays: number;
}

export interface McpTokenCreationResult {
  token: string; // Raw token - shown only once
  tokenPrefix: string;
  id: number;
  name: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface McpTokenListItem {
  id: number;
  name: string;
  tokenPrefix: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  createdAt: Date;
  isExpired: boolean;
}

export const MCP_TOKEN_CONSTRAINTS = {
  MAX_TOKENS_PER_USER: 10,
  MIN_EXPIRY_DAYS: 1,
  MAX_EXPIRY_DAYS: 90,
  DEFAULT_EXPIRY_DAYS: 30,
  TOKEN_PREFIX: 'mcp_',
  TOKEN_LENGTH: 64,
  PREFIX_DISPLAY_LENGTH: 8,
} as const;
