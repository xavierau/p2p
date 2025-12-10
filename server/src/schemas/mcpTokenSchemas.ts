import { z } from 'zod';
import { MCP_TOKEN_CONSTRAINTS } from '../domain/mcpToken/McpApiToken';
import { sanitizedString } from '../schemas';

/**
 * Schema for creating a new MCP API token.
 */
export const CreateMcpTokenSchema = z.object({
  name: sanitizedString(100).refine(
    (v) => v.length >= 1,
    'Token name is required'
  ),
  expiryDays: z
    .number()
    .int('Expiry days must be an integer')
    .min(
      MCP_TOKEN_CONSTRAINTS.MIN_EXPIRY_DAYS,
      `Expiry must be at least ${MCP_TOKEN_CONSTRAINTS.MIN_EXPIRY_DAYS} day`
    )
    .max(
      MCP_TOKEN_CONSTRAINTS.MAX_EXPIRY_DAYS,
      `Expiry cannot exceed ${MCP_TOKEN_CONSTRAINTS.MAX_EXPIRY_DAYS} days`
    )
    .default(MCP_TOKEN_CONSTRAINTS.DEFAULT_EXPIRY_DAYS),
});

export type CreateMcpTokenInput = z.infer<typeof CreateMcpTokenSchema>;

/**
 * Schema for validating token ID parameter in routes.
 */
export const McpTokenIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'Token ID must be a positive integer')
    .transform(Number),
});

export type McpTokenIdParam = z.infer<typeof McpTokenIdParamSchema>;
