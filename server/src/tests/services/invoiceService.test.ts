import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestInvoice,
  createTestInvoiceItem,
  createTestUser,
  createTestItem,
  createTestVendor,
} from '../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import services after mocking
import * as invoiceService from '../../services/invoiceService';

describe('invoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // createInvoice
  // ==========================================================================
  describe('createInvoice', () => {
    it('should create an invoice with calculated total from items', async () => {
      // Arrange
      const userId = 1;
      const invoiceData = {
        items: [
          { itemId: 1, quantity: 2, price: 100.0 },
          { itemId: 2, quantity: 3, price: 50.0 },
        ],
        project: 'Test Project',
      };
      const expectedTotal = 2 * 100 + 3 * 50; // 350

      const createdInvoice = createTestInvoice({
        id: 1,
        userId,
        totalAmount: expectedTotal,
        project: 'Test Project',
        items: [
          createTestInvoiceItem({ id: 1, invoiceId: 1, itemId: 1, quantity: 2, price: 100 }),
          createTestInvoiceItem({ id: 2, invoiceId: 1, itemId: 2, quantity: 3, price: 50 }),
        ],
      });

      prismaMock.invoice.create.mockResolvedValue(createdInvoice as any);

      // Act
      const result = await invoiceService.createInvoice(invoiceData, userId);

      // Assert
      expect(result.totalAmount).toBe(expectedTotal);
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: expectedTotal,
            userId,
            project: 'Test Project',
          }),
        })
      );
    });

    it('should create an invoice with optional branchId, departmentId, costCenterId', async () => {
      // Arrange
      const userId = 1;
      const invoiceData = {
        items: [{ itemId: 1, quantity: 1, price: 100.0 }],
        branchId: 1,
        departmentId: 2,
        costCenterId: 3,
      };

      const createdInvoice = createTestInvoice({
        id: 1,
        userId,
        totalAmount: 100,
        branchId: 1,
        departmentId: 2,
        costCenterId: 3,
      });

      prismaMock.invoice.create.mockResolvedValue(createdInvoice as any);

      // Act
      const result = await invoiceService.createInvoice(invoiceData, userId);

      // Assert
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            branchId: 1,
            departmentId: 2,
            costCenterId: 3,
          }),
        })
      );
    });

    it('should create invoice items with correct mapping', async () => {
      // Arrange
      const userId = 1;
      const invoiceData = {
        items: [
          { itemId: 10, quantity: 5, price: 25.0 },
        ],
      };

      const createdInvoice = createTestInvoice({ id: 1, totalAmount: 125 });
      prismaMock.invoice.create.mockResolvedValue(createdInvoice as any);

      // Act
      await invoiceService.createInvoice(invoiceData, userId);

      // Assert
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                { itemId: 10, quantity: 5, price: 25.0 },
              ],
            },
          }),
        })
      );
    });
  });

  // ==========================================================================
  // approveInvoice
  // ==========================================================================
  describe('approveInvoice', () => {
    it('should update invoice status to APPROVED', async () => {
      // Arrange
      const invoiceId = 1;
      const vendor = createTestVendor({ id: 1 });
      const item = createTestItem({ id: 1, vendorId: 1, vendor });
      const approvedInvoice = createTestInvoice({
        id: invoiceId,
        status: 'APPROVED',
        items: [
          {
            ...createTestInvoiceItem({ invoiceId, itemId: 1 }),
            item: { ...item, vendor } as any,
          },
        ],
      });

      prismaMock.invoice.update.mockResolvedValue(approvedInvoice as any);

      // Act
      const result = await invoiceService.approveInvoice(invoiceId);

      // Assert
      expect(result.status).toBe('APPROVED');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: invoiceId },
          data: { status: 'APPROVED' },
        })
      );
    });

    it('should include items with vendor information for accounting sync', async () => {
      // Arrange
      const invoiceId = 1;
      const approvedInvoice = createTestInvoice({ id: invoiceId, status: 'APPROVED' });
      prismaMock.invoice.update.mockResolvedValue(approvedInvoice as any);

      // Act
      await invoiceService.approveInvoice(invoiceId);

      // Assert
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            items: expect.objectContaining({
              include: expect.objectContaining({
                item: expect.objectContaining({
                  include: { vendor: true },
                }),
              }),
            }),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // rejectInvoice
  // ==========================================================================
  describe('rejectInvoice', () => {
    it('should update invoice status to REJECTED', async () => {
      // Arrange
      const invoiceId = 1;
      const rejectedInvoice = createTestInvoice({ id: invoiceId, status: 'REJECTED' });
      prismaMock.invoice.update.mockResolvedValue(rejectedInvoice as any);

      // Act
      const result = await invoiceService.rejectInvoice(invoiceId);

      // Assert
      expect(result.status).toBe('REJECTED');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: invoiceId },
        data: { status: 'REJECTED' },
      });
    });
  });

  // ==========================================================================
  // updateInvoice
  // ==========================================================================
  describe('updateInvoice', () => {
    it('should update invoice when status is PENDING', async () => {
      // Arrange
      const invoiceId = 1;
      const existingInvoice = createTestInvoice({ id: invoiceId, status: 'PENDING' });
      const updateData = { project: 'Updated Project' };

      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);
      prismaMock.invoice.update.mockResolvedValue({
        ...existingInvoice,
        project: 'Updated Project',
      } as any);

      // Act
      const result = await invoiceService.updateInvoice(invoiceId, updateData);

      // Assert
      expect(result?.project).toBe('Updated Project');
    });

    it('should throw error when trying to update non-PENDING invoice', async () => {
      // Arrange
      const invoiceId = 1;
      const existingInvoice = createTestInvoice({ id: invoiceId, status: 'APPROVED' });
      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);

      // Act & Assert
      await expect(
        invoiceService.updateInvoice(invoiceId, { project: 'New Project' })
      ).rejects.toThrow('Can only update invoices in PENDING status');
    });

    it('should throw error when trying to update REJECTED invoice', async () => {
      // Arrange
      const invoiceId = 1;
      const existingInvoice = createTestInvoice({ id: invoiceId, status: 'REJECTED' });
      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);

      // Act & Assert
      await expect(
        invoiceService.updateInvoice(invoiceId, { project: 'New Project' })
      ).rejects.toThrow('Can only update invoices in PENDING status');
    });

    it('should return null when invoice not found', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const result = await invoiceService.updateInvoice(999, { project: 'Test' });

      // Assert
      expect(result).toBeNull();
    });

    it('should recalculate total when items are updated', async () => {
      // Arrange
      const invoiceId = 1;
      const existingInvoice = createTestInvoice({ id: invoiceId, status: 'PENDING' });
      const newItems = [
        { itemId: 1, quantity: 10, price: 50.0 },
      ];
      const expectedTotal = 10 * 50; // 500

      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);

      // Mock transaction
      const txMock = {
        invoiceItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        invoice: {
          update: vi.fn().mockResolvedValue({
            ...existingInvoice,
            totalAmount: expectedTotal,
          }),
        },
      };
      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      const result = await invoiceService.updateInvoice(invoiceId, { items: newItems });

      // Assert
      expect(txMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: expectedTotal,
          }),
        })
      );
    });

    it('should use transaction when updating items for atomicity', async () => {
      // Arrange
      const invoiceId = 1;
      const existingInvoice = createTestInvoice({ id: invoiceId, status: 'PENDING' });
      const newItems = [{ itemId: 1, quantity: 1, price: 100.0 }];

      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);

      const txMock = {
        invoiceItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        invoice: { update: vi.fn().mockResolvedValue(existingInvoice) },
      };
      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      await invoiceService.updateInvoice(invoiceId, { items: newItems });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(txMock.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId },
      });
    });
  });

  // ==========================================================================
  // getInvoices
  // ==========================================================================
  describe('getInvoices', () => {
    it('should return paginated invoices', async () => {
      // Arrange
      const invoices = [
        createTestInvoice({ id: 1 }),
        createTestInvoice({ id: 2 }),
      ];

      prismaMock.invoice.count.mockResolvedValue(2);
      prismaMock.invoice.findMany.mockResolvedValue(invoices as any);

      // Act
      const result = await invoiceService.getInvoices({}, { page: '1', limit: '10' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by status', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(1);
      prismaMock.invoice.findMany.mockResolvedValue([createTestInvoice({ status: 'APPROVED' })] as any);

      // Act
      await invoiceService.getInvoices({ status: 'APPROVED' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices({ startDate, endDate }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        })
      );
    });

    it('should filter by vendorId through items', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices({ vendorId: '5' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            items: {
              some: {
                item: { vendorId: 5 },
              },
            },
          }),
        })
      );
    });

    it('should filter by syncStatus', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices({ syncStatus: 'SYNCED' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            syncStatus: 'SYNCED',
          }),
        })
      );
    });

    it('should filter by project (case insensitive)', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices({ project: 'test' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter by branchId, departmentId, costCenterId', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices(
        { branchId: '1', departmentId: '2', costCenterId: '3' },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 1,
            departmentId: 2,
            costCenterId: 3,
          }),
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(25);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      const result = await invoiceService.getInvoices({}, { page: '2', limit: '10' });

      // Assert
      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });

    it('should exclude soft-deleted invoices', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoices({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // getInvoiceById
  // ==========================================================================
  describe('getInvoiceById', () => {
    it('should return invoice with all relations', async () => {
      // Arrange
      const invoice = createTestInvoice({ id: 1 });
      prismaMock.invoice.findFirst.mockResolvedValue(invoice as any);

      // Act
      const result = await invoiceService.getInvoiceById(1);

      // Assert
      expect(result).toEqual(invoice);
      expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deletedAt: null },
          include: expect.objectContaining({
            items: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                quantity: true,
                price: true,
                item: expect.any(Object),
              }),
            }),
            user: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true, email: true }),
            }),
            branch: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true }),
            }),
            department: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true }),
            }),
            costCenter: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true }),
            }),
            purchaseOrder: expect.objectContaining({
              select: expect.objectContaining({ id: true, status: true, date: true }),
            }),
          }),
        })
      );
    });

    it('should return null for non-existent invoice', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const result = await invoiceService.getInvoiceById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // deleteInvoice
  // ==========================================================================
  describe('deleteInvoice', () => {
    it('should soft delete invoice by setting deletedAt', async () => {
      // Arrange
      const invoice = createTestInvoice({ id: 1 });
      prismaMock.invoice.findFirst.mockResolvedValue(invoice as any);
      prismaMock.invoice.update.mockResolvedValue({
        ...invoice,
        deletedAt: new Date(),
      } as any);

      // Act
      const result = await invoiceService.deleteInvoice(1);

      // Assert
      expect(result?.deletedAt).not.toBeNull();
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { deletedAt: expect.any(Date) },
        })
      );
    });

    it('should return null when invoice not found', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const result = await invoiceService.deleteInvoice(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should not delete already deleted invoice', async () => {
      // Arrange - findFirst with deletedAt: null returns null for deleted invoices
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const result = await invoiceService.deleteInvoice(1);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    });
  });
});
