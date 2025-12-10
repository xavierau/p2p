import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import logger from '../utils/logger';
import {
  MCP_TOKEN_CONSTRAINTS,
  McpTokenCreationResult,
  McpTokenListItem,
  CreateMcpTokenInput,
} from '../domain/mcpToken/McpApiToken';
import {
  McpTokenNotFoundError,
  McpTokenLimitExceededError,
  McpTokenExpiredError,
  McpTokenInvalidError,
  McpTokenUnauthorizedError,
} from '../domain/mcpToken/mcpTokenErrors';
import { VerifiedUser } from '../mcp/auth';

const BCRYPT_ROUNDS = 10;

/**
 * Generates a cryptographically secure random token with the MCP prefix.
 */
function generateRawToken(): string {
  const randomBytes = crypto.randomBytes(MCP_TOKEN_CONSTRAINTS.TOKEN_LENGTH);
  const tokenBody = randomBytes.toString('base64url');
  return `${MCP_TOKEN_CONSTRAINTS.TOKEN_PREFIX}${tokenBody}`;
}

/**
 * Generates a SHA-256 hash for O(1) database lookup.
 * Unlike bcrypt, SHA-256 is deterministic and fast for lookups.
 */
function generateLookupHash(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Extracts the display prefix from a raw token.
 * Returns clean prefix without ellipsis - UI layer adds display formatting.
 * Example: "mcp_a3f2b1c4..." -> "mcp_a3f2b1c4"
 */
function extractTokenPrefix(rawToken: string): string {
  const prefixLength =
    MCP_TOKEN_CONSTRAINTS.TOKEN_PREFIX.length + MCP_TOKEN_CONSTRAINTS.PREFIX_DISPLAY_LENGTH;
  return rawToken.substring(0, prefixLength);
}

/**
 * Creates a new MCP API token for a user.
 * The raw token is returned only once and should be displayed to the user immediately.
 */
export async function createMcpToken(
  userId: number,
  input: CreateMcpTokenInput
): Promise<McpTokenCreationResult> {
  // Check token limit
  const existingTokenCount = await prisma.mcpApiToken.count({
    where: {
      userId,
      revokedAt: null,
    },
  });

  if (existingTokenCount >= MCP_TOKEN_CONSTRAINTS.MAX_TOKENS_PER_USER) {
    throw new McpTokenLimitExceededError(existingTokenCount);
  }

  // Generate token
  const rawToken = generateRawToken();
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  const lookupHash = generateLookupHash(rawToken);
  const tokenPrefix = extractTokenPrefix(rawToken);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiryDays);

  // Store in database
  const token = await prisma.mcpApiToken.create({
    data: {
      name: input.name,
      tokenHash,
      lookupHash,
      tokenPrefix,
      userId,
      expiresAt,
    },
  });

  logger.info({ userId, tokenId: token.id, name: input.name }, 'MCP token created');

  return {
    token: rawToken,
    tokenPrefix,
    id: token.id,
    name: token.name,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
  };
}

/**
 * Lists all non-revoked MCP tokens for a user.
 */
export async function listMcpTokens(userId: number): Promise<McpTokenListItem[]> {
  const tokens = await prisma.mcpApiToken.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  const now = new Date();

  return tokens.map((token) => ({
    ...token,
    isExpired: token.expiresAt < now,
  }));
}

/**
 * Revokes an MCP token (soft delete).
 * Sets the revokedAt timestamp but preserves the record.
 */
export async function revokeMcpToken(userId: number, tokenId: number): Promise<void> {
  const token = await prisma.mcpApiToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    throw new McpTokenNotFoundError(tokenId);
  }

  if (token.userId !== userId) {
    throw new McpTokenUnauthorizedError();
  }

  if (token.revokedAt !== null) {
    // Already revoked, no action needed
    return;
  }

  await prisma.mcpApiToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  logger.info({ userId, tokenId }, 'MCP token revoked');
}

/**
 * Permanently deletes an MCP token (hard delete).
 */
export async function deleteMcpToken(userId: number, tokenId: number): Promise<void> {
  const token = await prisma.mcpApiToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    throw new McpTokenNotFoundError(tokenId);
  }

  if (token.userId !== userId) {
    throw new McpTokenUnauthorizedError();
  }

  await prisma.mcpApiToken.delete({
    where: { id: tokenId },
  });

  logger.info({ userId, tokenId }, 'MCP token permanently deleted');
}

/**
 * Verifies an MCP token and returns the associated user information.
 * Uses O(1) lookup via lookupHash for new tokens, with O(n) fallback for legacy tokens.
 * Updates the lastUsedAt timestamp on successful verification.
 */
export async function verifyMcpToken(rawToken: string): Promise<VerifiedUser> {
  // Validate token format
  if (!rawToken.startsWith(MCP_TOKEN_CONSTRAINTS.TOKEN_PREFIX)) {
    logger.warn({ tokenPrefix: rawToken.substring(0, 10) }, 'Invalid MCP token format');
    throw new McpTokenInvalidError();
  }

  const lookupHash = generateLookupHash(rawToken);

  // O(1) lookup via lookupHash (new tokens)
  let matchedToken = await prisma.mcpApiToken.findFirst({
    where: {
      lookupHash,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // O(n) fallback for legacy tokens without lookupHash
  if (!matchedToken) {
    const legacyTokens = await prisma.mcpApiToken.findMany({
      where: {
        lookupHash: null,
        revokedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    for (const token of legacyTokens) {
      const isMatch = await bcrypt.compare(rawToken, token.tokenHash);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }
  }

  if (!matchedToken) {
    logger.warn({ tokenPrefix: rawToken.substring(0, 12) }, 'MCP token not found');
    throw new McpTokenInvalidError();
  }

  // Always verify with bcrypt (defense in depth)
  const isValidHash = await bcrypt.compare(rawToken, matchedToken.tokenHash);
  if (!isValidHash) {
    logger.warn({ tokenId: matchedToken.id }, 'MCP token hash mismatch (possible collision)');
    throw new McpTokenInvalidError();
  }

  // Check if expired
  if (matchedToken.expiresAt < new Date()) {
    logger.warn({ tokenId: matchedToken.id }, 'MCP token expired');
    throw new McpTokenExpiredError();
  }

  // Update lastUsedAt asynchronously (fire-and-forget to not block the request)
  prisma.mcpApiToken
    .update({
      where: { id: matchedToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err) => {
      logger.warn({ err, tokenId: matchedToken.id }, 'Failed to update lastUsedAt for MCP token');
    });

  logger.debug({ userId: matchedToken.user.id, tokenId: matchedToken.id }, 'MCP token verified');

  return {
    userId: matchedToken.user.id,
    email: matchedToken.user.email,
    role: matchedToken.user.role,
  };
}

/**
 * Checks if a token string looks like an MCP token based on its prefix.
 */
export function isMcpToken(token: string): boolean {
  return token.startsWith(MCP_TOKEN_CONSTRAINTS.TOKEN_PREFIX);
}
