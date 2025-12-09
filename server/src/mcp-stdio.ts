#!/usr/bin/env node
import 'dotenv/config';
import { startStdioServer } from './mcp/transports/stdio';

/**
 * Standalone entry point for MCP stdio server.
 *
 * This script starts the MCP server with stdio transport,
 * enabling direct communication via stdin/stdout.
 *
 * Usage:
 *   npx ts-node src/mcp-stdio.ts
 *   node dist/mcp-stdio.js
 *
 * For Claude Desktop integration, add to claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "payment-management": {
 *       "command": "node",
 *       "args": ["/path/to/dist/mcp-stdio.js"]
 *     }
 *   }
 * }
 */
startStdioServer().catch((error: Error) => {
  console.error('[MCP] Failed to start stdio server:', error.message);
  process.exit(1);
});
