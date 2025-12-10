import { AppError } from '../../errors/AppError';
import { MCP_TOKEN_CONSTRAINTS } from './McpApiToken';

/**
 * Error thrown when an MCP token is not found.
 */
export class McpTokenNotFoundError extends AppError {
  constructor(tokenId?: number) {
    const message = tokenId
      ? `MCP token with id ${tokenId} not found`
      : 'MCP token not found';
    super(message, 404, 'MCP_TOKEN_NOT_FOUND');
  }
}

/**
 * Error thrown when a user exceeds the maximum number of MCP tokens.
 */
export class McpTokenLimitExceededError extends AppError {
  public readonly maxTokens: number;
  public readonly currentCount: number;

  constructor(currentCount: number) {
    const maxTokens = MCP_TOKEN_CONSTRAINTS.MAX_TOKENS_PER_USER;
    super(
      `Maximum number of MCP tokens (${maxTokens}) exceeded. You currently have ${currentCount} active tokens.`,
      400,
      'MCP_TOKEN_LIMIT_EXCEEDED'
    );
    this.maxTokens = maxTokens;
    this.currentCount = currentCount;
  }
}

/**
 * Error thrown when an MCP token has expired.
 */
export class McpTokenExpiredError extends AppError {
  constructor() {
    super('MCP token has expired', 401, 'MCP_TOKEN_EXPIRED');
  }
}

/**
 * Error thrown when an MCP token has been revoked.
 */
export class McpTokenRevokedError extends AppError {
  constructor() {
    super('MCP token has been revoked', 401, 'MCP_TOKEN_REVOKED');
  }
}

/**
 * Error thrown when an MCP token is invalid (malformed or not found).
 */
export class McpTokenInvalidError extends AppError {
  constructor() {
    super('Invalid MCP token', 401, 'MCP_TOKEN_INVALID');
  }
}

/**
 * Error thrown when a user attempts to access or modify a token they do not own.
 */
export class McpTokenUnauthorizedError extends AppError {
  constructor() {
    super('You do not have permission to access this token', 403, 'MCP_TOKEN_UNAUTHORIZED');
  }
}
