import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'node:crypto';
import { createMcpServer, createUnauthenticatedMcpServer, SessionContext } from '../index';
import { verifyToken } from '../auth';

/**
 * Starts the MCP server over stdio transport.
 *
 * Authentication is handled via the MCP_AUTH_TOKEN environment variable.
 * The token is verified once at startup, and the session is bound to that user.
 *
 * Usage:
 *   MCP_AUTH_TOKEN=<jwt-token> npx ts-node src/mcp/transports/stdio.ts
 *
 * If no token is provided, the server starts in unauthenticated mode
 * where all tool calls will fail with an authentication error.
 */
export const startStdioServer = async (): Promise<void> => {
  const token = process.env.MCP_AUTH_TOKEN;

  if (!token) {
    console.error('[MCP] Warning: MCP_AUTH_TOKEN not set. Starting in unauthenticated mode.');
    console.error('[MCP] All tool calls will fail. Set MCP_AUTH_TOKEN environment variable.');
    const server = createUnauthenticatedMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] Stdio server started (unauthenticated)');
    return;
  }

  try {
    const user = await verifyToken(token);
    const sessionContext: SessionContext = {
      user,
      sessionId: randomUUID(),
      createdAt: new Date(),
    };

    const server = createMcpServer(sessionContext);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error(`[MCP] Stdio server started (user: ${user.email}, role: ${user.role})`);
  } catch (error) {
    console.error('[MCP] Authentication failed:', error instanceof Error ? error.message : error);
    console.error('[MCP] Starting in unauthenticated mode. All tool calls will fail.');
    const server = createUnauthenticatedMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
};
