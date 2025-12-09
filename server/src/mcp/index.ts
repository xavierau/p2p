import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { verifyToken, AuthenticationError } from './auth';
import * as vendorService from '../services/vendorService';
import * as itemService from '../services/itemService';
import * as invoiceService from '../services/invoiceService';
import * as purchaseOrderService from '../services/purchaseOrderService';

const formatResult = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

const formatError = (error: unknown): CallToolResult => {
  if (error instanceof AuthenticationError) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: 'AUTH_ERROR' }) }], isError: true };
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
};

const tools = [
  {
    name: 'get_vendors',
    description: 'List vendors with optional filters and pagination',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        name: { type: 'string', description: 'Filter by vendor name' },
        nameOperator: { type: 'string', enum: ['=', 'contains'], description: 'Name match operator' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
      required: ['token'],
    },
  },
  {
    name: 'get_vendor',
    description: 'Get a single vendor by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        id: { type: 'number', description: 'Vendor ID' },
      },
      required: ['token', 'id'],
    },
  },
  {
    name: 'get_items',
    description: 'List items with optional filters (vendorId, fuzzy vendor name search)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        vendorId: { type: 'string', description: 'Filter by vendor ID' },
        vendorName: { type: 'string', description: 'Fuzzy search by vendor name' },
        vendorNameOperator: { type: 'string', enum: ['=', 'contains'], description: 'Vendor name match operator' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
      required: ['token'],
    },
  },
  {
    name: 'get_item',
    description: 'Get a single item by ID with vendor info and price history',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        id: { type: 'number', description: 'Item ID' },
      },
      required: ['token', 'id'],
    },
  },
  {
    name: 'create_item',
    description: 'Create a new item',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        name: { type: 'string', description: 'Item name' },
        price: { type: 'number', description: 'Item price' },
        vendorId: { type: 'number', description: 'Vendor ID' },
      },
      required: ['token', 'name', 'price', 'vendorId'],
    },
  },
  {
    name: 'update_item',
    description: 'Update an existing item',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        id: { type: 'number', description: 'Item ID' },
        name: { type: 'string', description: 'New item name' },
        price: { type: 'number', description: 'New price' },
        vendorId: { type: 'number', description: 'New vendor ID' },
      },
      required: ['token', 'id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice with line items',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
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
      required: ['token', 'items'],
    },
  },
  {
    name: 'update_invoice',
    description: 'Update an existing invoice (only PENDING status)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        id: { type: 'number', description: 'Invoice ID' },
        items: { type: 'array', description: 'New invoice line items' },
        project: { type: 'string', description: 'Project name' },
        branchId: { type: 'number', description: 'Branch ID' },
        departmentId: { type: 'number', description: 'Department ID' },
        costCenterId: { type: 'number', description: 'Cost center ID' },
        purchaseOrderId: { type: 'number', description: 'Purchase order ID' },
      },
      required: ['token', 'id'],
    },
  },
  {
    name: 'get_purchase_orders',
    description: 'List purchase orders with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        vendorId: { type: 'string', description: 'Filter by vendor ID' },
        status: { type: 'string', enum: ['DRAFT', 'SENT', 'FULFILLED'], description: 'Filter by status' },
        startDate: { type: 'string', description: 'Start date (ISO format)' },
        endDate: { type: 'string', description: 'End date (ISO format)' },
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
      },
      required: ['token'],
    },
  },
  {
    name: 'get_purchase_order',
    description: 'Get a single purchase order by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        id: { type: 'number', description: 'Purchase order ID' },
      },
      required: ['token', 'id'],
    },
  },
];

type ToolArgs = Record<string, unknown>;

async function handleToolCall(name: string, args: ToolArgs): Promise<CallToolResult> {
  try {
    const token = args.token as string;
    const user = await verifyToken(token);

    switch (name) {
      case 'get_vendors': {
        const result = await vendorService.getVendors(
          { name: args.name as string, nameOperator: args.nameOperator as '=' | 'contains' },
          { page: (args.page as string) ?? '1', limit: (args.limit as string) ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_vendor': {
        const vendor = await vendorService.getVendorById(args.id as number);
        if (!vendor) return formatResult({ error: 'Vendor not found', id: args.id });
        return formatResult(vendor);
      }

      case 'get_items': {
        const result = await itemService.getItems(
          {
            vendorId: args.vendorId as string,
            vendorName: args.vendorName as string,
            vendorIdOperator: '=',
            vendorNameOperator: (args.vendorNameOperator as '=' | 'contains') ?? 'contains',
          },
          { page: (args.page as string) ?? '1', limit: (args.limit as string) ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_item': {
        const item = await itemService.getItemById(args.id as number);
        if (!item) return formatResult({ error: 'Item not found', id: args.id });
        return formatResult(item);
      }

      case 'create_item': {
        const item = await itemService.createItem({
          name: args.name as string,
          price: args.price as number,
          vendorId: args.vendorId as number,
        });
        return formatResult({ success: true, item });
      }

      case 'update_item': {
        const updateData: { name?: string; price?: number; vendorId?: number } = {};
        if (args.name !== undefined) updateData.name = args.name as string;
        if (args.price !== undefined) updateData.price = args.price as number;
        if (args.vendorId !== undefined) updateData.vendorId = args.vendorId as number;
        const item = await itemService.updateItem(args.id as number, updateData);
        if (!item) return formatResult({ error: 'Item not found', id: args.id });
        return formatResult({ success: true, item });
      }

      case 'create_invoice': {
        const invoice = await invoiceService.createInvoice(
          {
            items: args.items as Array<{ itemId: number; quantity: number; price: number }>,
            project: args.project as string,
            branchId: args.branchId as number,
            departmentId: args.departmentId as number,
            costCenterId: args.costCenterId as number,
          },
          user.userId
        );
        return formatResult({ success: true, invoice: { id: invoice.id, totalAmount: invoice.totalAmount, status: invoice.status } });
      }

      case 'update_invoice': {
        const invoice = await invoiceService.updateInvoice(args.id as number, {
          items: args.items as Array<{ itemId: number; quantity: number; price: number }>,
          project: args.project as string,
          branchId: args.branchId as number,
          departmentId: args.departmentId as number,
          costCenterId: args.costCenterId as number,
          purchaseOrderId: args.purchaseOrderId as number,
        });
        if (!invoice) return formatResult({ error: 'Invoice not found', id: args.id });
        return formatResult({ success: true, invoice: { id: invoice.id, totalAmount: invoice.totalAmount, status: invoice.status } });
      }

      case 'get_purchase_orders': {
        const result = await purchaseOrderService.getPurchaseOrders(
          {
            vendorId: args.vendorId as string,
            status: args.status as 'DRAFT' | 'SENT' | 'FULFILLED',
            startDate: args.startDate as string,
            endDate: args.endDate as string,
          },
          { page: (args.page as string) ?? '1', limit: (args.limit as string) ?? '10' }
        );
        return formatResult(result);
      }

      case 'get_purchase_order': {
        const po = await purchaseOrderService.getPurchaseOrderById(args.id as number);
        if (!po) return formatResult({ error: 'Purchase order not found', id: args.id });
        return formatResult(po);
      }

      default:
        return formatError(new Error(`Unknown tool: ${name}`));
    }
  } catch (error) {
    return formatError(error);
  }
}

export const createMcpServer = (): Server => {
  const server = new Server(
    { name: 'payment-management-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args ?? {}) as ToolArgs);
  });

  return server;
};
