import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { mcpTokenLimiter } from '../middleware/rateLimiter';
import { validateParams } from '../middleware/validateParams';
import { CreateMcpTokenSchema, McpTokenIdParamSchema } from '../schemas/mcpTokenSchemas';
import * as mcpTokenService from '../services/mcpTokenService';
import { AuthRequest } from '../types/auth';
import { ValidationError } from '../errors/AppError';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/mcp-tokens
 * Create a new MCP API token.
 * Rate limited to prevent abuse.
 */
router.post('/', mcpTokenLimiter, async (req: AuthRequest, res, next) => {
  try {
    const parsed = CreateMcpTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const userId = req.user!.userId;
    const result = await mcpTokenService.createMcpToken(userId, parsed.data);

    // Return token info with the raw token (shown only once)
    res.status(201).json({
      message: 'Token created successfully. Save this token - it will not be shown again.',
      token: result.token,
      id: result.id,
      name: result.name,
      tokenPrefix: result.tokenPrefix,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mcp-tokens
 * List all non-revoked MCP tokens for the authenticated user.
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const tokens = await mcpTokenService.listMcpTokens(userId);

    res.json({
      data: tokens,
      count: tokens.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/mcp-tokens/:id
 * Revoke an MCP token (soft delete).
 */
router.delete(
  '/:id',
  validateParams(McpTokenIdParamSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.user!.userId;
      const tokenId = Number(req.params.id);

      await mcpTokenService.revokeMcpToken(userId, tokenId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/mcp-tokens/:id/permanent
 * Permanently delete an MCP token (hard delete).
 */
router.delete(
  '/:id/permanent',
  validateParams(McpTokenIdParamSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.user!.userId;
      const tokenId = Number(req.params.id);

      await mcpTokenService.deleteMcpToken(userId, tokenId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
