import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { VerifiedUser, AuthenticationError, AuthorizationError } from './auth';
import { Permission, hasPermission } from '../constants/permissions';
import * as vendorService from '../services/vendorService';
import * as itemService from '../services/itemService';
import * as invoiceService from '../services/invoiceService';
import * as purchaseOrderService from '../services/purchaseOrderService';

// Session context - bound once at connection time
export interface SessionContext {
  user: VerifiedUser;
  sessionId: string;
  createdAt: Date;
}

// Input validation schemas
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const vendorFilterSchema = paginationSchema.extend({
  name: z.string().max(255).optional(),
  nameOperator: z.enum(['=', 'contains']).optional(),
});

const itemFilterSchema = paginationSchema.extend({
  vendorId: z.string().regex(/^\d+$/).optional(),
  vendorName: z.string().max(255).optional(),
  vendorNameOperator: z.enum(['=', 'contains']).optional(),
});

const itemCreateSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().nonnegative(),
  vendorId: z.number().int().positive(),
});

const itemUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  price: z.number().nonnegative().optional(),
  vendorId: z.number().int().positive().optional(),
});

const invoiceItemSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const invoiceCreateSchema = z.object({
  items: z.array(invoiceItemSchema).min(1),
  project: z.string().max(255).optional(),
  branchId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  costCenterId: z.number().int().positive().optional(),
});

const invoiceUpdateSchema = z.object({
  id: z.number().int().positive(),
  items: z.array(invoiceItemSchema).optional(),
  project: z.string().max(255).optional(),
  branchId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  costCenterId: z.number().int().positive().optional(),
  purchaseOrderId: z.number().int().positive().optional(),
});

const poFilterSchema = paginationSchema.extend({
  vendorId: z.string().regex(/^\d+$/).optional(),
  status: z.enum(['DRAFT', 'SENT', 'FULFILLED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const formatResult = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

const formatError = (error: unknown): CallToolResult => {
  if (error instanceof AuthenticationError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'AUTH_ERROR' }) }],
      isError: true,
    };
  }
  if (error instanceof AuthorizationError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'FORBIDDEN' }) }],
      isError: true,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Validation failed', details: error.errors, code: 'VALIDATION_ERROR' }) }],
      isError: true,
    };
  }
  // Sanitize error - don't leak internal details
  const message = error instanceof Error ? error.message : 'Unknown error';
  const sanitizedMessage = message.includes('prisma') || message.includes('database')
    ? 'Database operation failed'
    : message;
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: sanitizedMessage }) }],
    isError: true,
  };
};

// Authorization helper
const requirePermission = (session: SessionContext, permission: Permission): void => {
  if (!hasPermission(session.user.role, permission)) {
    throw new AuthorizationError(`Permission denied: ${permission}`);
  }
};

// Tool definitions - NO TOKEN PARAMETER
const tools = [
  {
    name: 'get_vendors',
    description: 'List vendors with optional filters and pagination',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Filter by vendor name' },
        nameOperator: { type: 'string', enum: ['=', 'contains'], description: 'Name match operator' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
    },
  },
  {
    name: 'get_vendor',
    description: 'Get a single vendor by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Vendor ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_items',
    description: 'List items with optional filters (vendorId, fuzzy vendor name search)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vendorId: { type: 'string', description: 'Filter by vendor ID' },
        vendorName: { type: 'string', description: 'Fuzzy search by vendor name' },
        vendorNameOperator: { type: 'string', enum: ['=', 'contains'], description: 'Vendor name match operator' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
    },
  },
  {
    name: 'get_item',
    description: 'Get a single item by ID with vendor info and price history',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Item ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_item',
    description: 'Create a new item',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Item name' },
        price: { type: 'number', description: 'Item price' },
        vendorId: { type: 'number', description: 'Vendor ID' },
      },
      required: ['name', 'price', 'vendorId'],
    },
  },
  {
    name: 'update_item',
    description: 'Update an existing item',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Item ID' },
        name: { type: 'string', description: 'New item name' },
        price: { type: 'number', description: 'New price' },
        vendorId: { type: 'number', description: 'New vendor ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice with line items',
    inputSchema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'number' },
              quantity: { type: 'number' },
              price: { type: 'number' },
            },
            required: ['itemId', 'quantity', 'price'],
          },
          description: 'Invoice line items',
        },
        project: { type: 'string', description: 'Project name' },
        branchId: { type: 'number', description: 'Branch ID' },
        departmentId: { type: 'number', description: 'Department ID' },
        costCenterId: { type: 'number', description: 'Cost center ID' },
      },
      required: ['items'],
    },
  },
  {
    name: 'update_invoice',
    description: 'Update an existing invoice (only PENDING status)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Invoice ID' },
        items: { type: 'array', description: 'New invoice line items' },
        project: { type: 'string', description: 'Project name' },
        branchId: { type: 'number', description: 'Branch ID' },
        departmentId: { type: 'number', description: 'Department ID' },
        costCenterId: { type: 'number', description: 'Cost center ID' },
        purchaseOrderId: { type: 'number', description: 'Purchase order ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_purchase_orders',
    description: 'List purchase orders with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        vendorId: { type: 'string', description: 'Filter by vendor ID' },
        status: { type: 'string', enum: ['DRAFT', 'SENT', 'FULFILLED'], description: 'Filter by status' },
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
    },
  },
  {
    name: 'get_purchase_order',
    description: 'Get a single purchase order by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Purchase order ID' },
      },
      required: ['id'],
    },
  },
];

type ToolArgs = Record<string, unknown>;

async function handleToolCall(
  name: string,
  args: ToolArgs,
  session: SessionContext
): Promise<CallToolResult> {
  try {
    switch (name) {
      case 'get_vendors': {
        requirePermission(session, Permission.VENDOR_READ);
        const validated = vendorFilterSchema.parse(args);
        const result = await vendorService.getVendors(
          { name: validated.name, nameOperator: validated.nameOperator },
          { page: validated.page ?? '1', limit: validated.limit ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_vendor': {
        requirePermission(session, Permission.VENDOR_READ);
        const id = z.number().int().positive().parse(args.id);
        const vendor = await vendorService.getVendorById(id);
        if (!vendor) return formatResult({ error: 'Vendor not found', id });
        return formatResult(vendor);
      }

      case 'get_items': {
        requirePermission(session, Permission.ITEM_READ);
        const validated = itemFilterSchema.parse(args);
        const result = await itemService.getItems(
          {
            vendorId: validated.vendorId,
            vendorName: validated.vendorName,
            vendorIdOperator: '=',
            vendorNameOperator: validated.vendorNameOperator ?? 'contains',
          },
          { page: validated.page ?? '1', limit: validated.limit ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_item': {
        requirePermission(session, Permission.ITEM_READ);
        const id = z.number().int().positive().parse(args.id);
        const item = await itemService.getItemById(id);
        if (!item) return formatResult({ error: 'Item not found', id });
        return formatResult(item);
      }

      case 'create_item': {
        requirePermission(session, Permission.ITEM_CREATE);
        const validated = itemCreateSchema.parse(args);
        const item = await itemService.createItem(validated);
        return formatResult({ success: true, item });
      }

      case 'update_item': {
        requirePermission(session, Permission.ITEM_UPDATE);
        const validated = itemUpdateSchema.parse(args);
        const { id, ...updateData } = validated;
        const item = await itemService.updateItem(id, updateData);
        if (!item) return formatResult({ error: 'Item not found', id });
        return formatResult({ success: true, item });
      }

      case 'create_invoice': {
        requirePermission(session, Permission.INVOICE_CREATE);
        const validated = invoiceCreateSchema.parse(args);
        const invoice = await invoiceService.createInvoice(validated, session.user.userId);
        return formatResult({
          success: true,
          invoice: { id: invoice.id, totalAmount: invoice.totalAmount, status: invoice.status },
        });
      }

      case 'update_invoice': {
        requirePermission(session, Permission.INVOICE_UPDATE);
        const validated = invoiceUpdateSchema.parse(args);
        const { id, ...updateData } = validated;
        const invoice = await invoiceService.updateInvoice(id, updateData);
        if (!invoice) return formatResult({ error: 'Invoice not found', id });
        return formatResult({
          success: true,
          invoice: { id: invoice.id, totalAmount: invoice.totalAmount, status: invoice.status },
        });
      }

      case 'get_purchase_orders': {
        requirePermission(session, Permission.PO_READ);
        const validated = poFilterSchema.parse(args);
        const result = await purchaseOrderService.getPurchaseOrders(
          {
            vendorId: validated.vendorId,
            status: validated.status,
            startDate: validated.startDate,
            endDate: validated.endDate,
          },
          { page: validated.page ?? '1', limit: validated.limit ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_purchase_order': {
        requirePermission(session, Permission.PO_READ);
        const id = z.number().int().positive().parse(args.id);
        const po = await purchaseOrderService.getPurchaseOrderById(id);
        if (!po) return formatResult({ error: 'Purchase order not found', id });
        return formatResult(po);
      }

      default:
        return formatError(new Error(`Unknown tool: ${name}`));
    }
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Creates an MCP server bound to an authenticated session.
 * All tool calls will use the session's user context for authorization.
 */
export const createMcpServer = (session: SessionContext): Server => {
  const server = new Server(
    { name: 'payment-management-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args ?? {}) as ToolArgs, session);
  });

  return server;
};

/**
 * @deprecated Use createMcpServer(session) instead.
 * This factory is only for backward compatibility during migration.
 */
export const createUnauthenticatedMcpServer = (): Server => {
  const server = new Server(
    { name: 'payment-management-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async () => {
    return formatError(new AuthenticationError('Session not authenticated. Use HTTP transport with Authorization header.'));
  });

  return server;
};
