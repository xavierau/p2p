import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer, SessionContext } from '../index';
import { verifyToken, AuthenticationError } from '../auth';

interface SessionStore {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createMcpServer>;
  context: SessionContext;
  lastActivity: Date;
}

// In-memory session store
const sessions = new Map<string, SessionStore>();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      session.transport.close();
      console.log(`[MCP] Session expired: ${sessionId} (user: ${session.context.user.email})`);
      sessions.delete(sessionId);
    }
  }
}, 60_000);

const sendJsonRpcError = (
  res: Response,
  status: number,
  code: number,
  message: string,
  id: string | number | null = null
): void => {
  res.status(status).json({
    jsonrpc: '2.0',
    error: { code, message },
    id,
  });
};

export const createMcpRouter = (): Router => {
  const router = Router();

  // POST: Handle MCP requests (initialize new sessions or process tool calls)
  router.post('/mcp', async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      // Existing session - reuse it
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        session.lastActivity = new Date();
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      // New session initialization - requires authentication
      if (!sessionId && isInitializeRequest(req.body)) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          sendJsonRpcError(res, 401, -32001, 'Authorization header with Bearer token required');
          return;
        }

        const token = authHeader.slice(7);
        let user;
        try {
          user = await verifyToken(token);
        } catch (error) {
          const message =
            error instanceof AuthenticationError ? error.message : 'Authentication failed';
          sendJsonRpcError(res, 401, -32001, message);
          return;
        }

        const newSessionId = randomUUID();
        const sessionContext: SessionContext = {
          user,
          sessionId: newSessionId,
          createdAt: new Date(),
        };

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          onsessioninitialized: (id) => {
            console.log(`[MCP] Session initialized: ${id} (user: ${user.email}, role: ${user.role})`);
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            console.log(`[MCP] Session closed: ${transport.sessionId}`);
          }
        };

        // Create MCP server bound to authenticated session
        const server = createMcpServer(sessionContext);
        await server.connect(transport);

        sessions.set(newSessionId, {
          transport,
          server,
          context: sessionContext,
          lastActivity: new Date(),
        });

        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Invalid session ID provided
      if (sessionId && !sessions.has(sessionId)) {
        sendJsonRpcError(res, 401, -32001, 'Invalid or expired session');
        return;
      }

      // Not an initialization request and no session
      sendJsonRpcError(res, 400, -32000, 'Session required. Send initialization request with Authorization header.');
    } catch (error) {
      // Sanitize error - don't leak internal details
      console.error('[MCP] HTTP transport error:', error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, 'Internal server error');
      }
    }
  });

  // GET: Handle SSE streams for existing sessions
  router.get('/mcp', async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const session = sessions.get(sessionId);

    if (!session) {
      sendJsonRpcError(res, 401, -32001, 'Invalid or expired session');
      return;
    }

    session.lastActivity = new Date();
    await session.transport.handleRequest(req, res);
  });

  // DELETE: Explicitly close a session
  router.delete('/mcp', async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const session = sessions.get(sessionId);

    if (!session) {
      sendJsonRpcError(res, 400, -32000, 'Invalid session');
      return;
    }

    await session.transport.handleRequest(req, res);
    session.transport.close();
    sessions.delete(sessionId);
    console.log(`[MCP] Session explicitly closed: ${sessionId}`);
  });

  return router;
};

// Export for testing
export const getActiveSessions = (): Map<string, SessionStore> => sessions;
export const clearAllSessions = (): void => {
  for (const session of sessions.values()) {
    session.transport.close();
  }
  sessions.clear();
};
