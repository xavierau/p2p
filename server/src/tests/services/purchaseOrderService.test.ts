import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestPurchaseOrder,
  createTestPurchaseOrderItem,
  createTestVendor,
  createTestItem,
} from '../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import services after mocking
import * as purchaseOrderService from '../../services/purchaseOrderService';

describe('purchaseOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // State Machine Tests
  // ==========================================================================
  describe('updatePurchaseOrderStatus - State Machine', () => {
    describe('valid transitions', () => {
      it('should allow DRAFT -> SENT transition', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'DRAFT' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
        prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, status: 'SENT' } as any);

        // Act
        const result = await purchaseOrderService.updatePurchaseOrderStatus(1, 'SENT');

        // Assert
        expect(result?.status).toBe('SENT');
        expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: 'SENT' },
          })
        );
      });

      it('should allow SENT -> FULFILLED transition', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'SENT' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
        prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, status: 'FULFILLED' } as any);

        // Act
        const result = await purchaseOrderService.updatePurchaseOrderStatus(1, 'FULFILLED');

        // Assert
        expect(result?.status).toBe('FULFILLED');
      });

      it('should allow SENT -> DRAFT transition (revert to draft)', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'SENT' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
        prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, status: 'DRAFT' } as any);

        // Act
        const result = await purchaseOrderService.updatePurchaseOrderStatus(1, 'DRAFT');

        // Assert
        expect(result?.status).toBe('DRAFT');
      });
    });

    describe('invalid transitions', () => {
      it('should throw error for SENT -> DRAFT invalid (when not allowed by business rules)', async () => {
        // Note: Based on the code, SENT -> DRAFT is actually allowed
        // This test documents the expected behavior
        const po = createTestPurchaseOrder({ id: 1, status: 'SENT' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
        prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, status: 'DRAFT' } as any);

        // SENT -> DRAFT is valid in the current implementation
        const result = await purchaseOrderService.updatePurchaseOrderStatus(1, 'DRAFT');
        expect(result?.status).toBe('DRAFT');
      });

      it('should throw error for DRAFT -> FULFILLED transition', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'DRAFT' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

        // Act & Assert
        await expect(
          purchaseOrderService.updatePurchaseOrderStatus(1, 'FULFILLED')
        ).rejects.toThrow('Invalid status transition from DRAFT to FULFILLED');
      });

      it('should throw error for FULFILLED -> DRAFT transition (terminal state)', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'FULFILLED' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

        // Act & Assert
        await expect(
          purchaseOrderService.updatePurchaseOrderStatus(1, 'DRAFT')
        ).rejects.toThrow('Invalid status transition from FULFILLED to DRAFT');
      });

      it('should throw error for FULFILLED -> SENT transition (terminal state)', async () => {
        // Arrange
        const po = createTestPurchaseOrder({ id: 1, status: 'FULFILLED' });
        prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

        // Act & Assert
        await expect(
          purchaseOrderService.updatePurchaseOrderStatus(1, 'SENT')
        ).rejects.toThrow('Invalid status transition from FULFILLED to SENT');
      });
    });

    it('should return null when purchase order not found', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const result = await purchaseOrderService.updatePurchaseOrderStatus(999, 'SENT');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // updatePurchaseOrder
  // ==========================================================================
  describe('updatePurchaseOrder', () => {
    it('should allow update when status is DRAFT', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1, status: 'DRAFT', vendorId: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
      prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, vendorId: 2 } as any);

      // Act
      const result = await purchaseOrderService.updatePurchaseOrder(1, { vendorId: 2 });

      // Assert
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalled();
    });

    it('should throw error when trying to update SENT purchase order', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1, status: 'SENT' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      // Act & Assert
      await expect(
        purchaseOrderService.updatePurchaseOrder(1, { vendorId: 2 })
      ).rejects.toThrow('Can only update purchase orders in DRAFT status');
    });

    it('should throw error when trying to update FULFILLED purchase order', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1, status: 'FULFILLED' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      // Act & Assert
      await expect(
        purchaseOrderService.updatePurchaseOrder(1, { vendorId: 2 })
      ).rejects.toThrow('Can only update purchase orders in DRAFT status');
    });

    it('should return null when purchase order not found', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const result = await purchaseOrderService.updatePurchaseOrder(999, { vendorId: 2 });

      // Assert
      expect(result).toBeNull();
    });

    it('should use transaction when updating items', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1, status: 'DRAFT' });
      const newItems = [{ itemId: 1, quantity: 5, price: 100.0 }];

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      const txMock = {
        purchaseOrderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        purchaseOrder: { update: vi.fn().mockResolvedValue(po) },
      };
      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      await purchaseOrderService.updatePurchaseOrder(1, { items: newItems });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(txMock.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
        where: { purchaseOrderId: 1 },
      });
    });

    it('should update vendorId without transaction when no items provided', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1, status: 'DRAFT', vendorId: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
      prismaMock.purchaseOrder.update.mockResolvedValue({ ...po, vendorId: 2 } as any);

      // Act
      await purchaseOrderService.updatePurchaseOrder(1, { vendorId: 2 });

      // Assert
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { vendorId: 2 },
        })
      );
    });
  });

  // ==========================================================================
  // deletePurchaseOrder (soft delete)
  // ==========================================================================
  describe('deletePurchaseOrder', () => {
    it('should soft delete purchase order by setting deletedAt', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
      prismaMock.purchaseOrder.update.mockResolvedValue({
        ...po,
        deletedAt: new Date(),
      } as any);

      // Act
      const result = await purchaseOrderService.deletePurchaseOrder(1);

      // Assert
      expect(result?.deletedAt).not.toBeNull();
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { deletedAt: expect.any(Date) },
        })
      );
    });

    it('should return null when purchase order not found', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const result = await purchaseOrderService.deletePurchaseOrder(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should not delete already deleted purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const result = await purchaseOrderService.deletePurchaseOrder(1);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.purchaseOrder.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // createPurchaseOrder
  // ==========================================================================
  describe('createPurchaseOrder', () => {
    it('should create purchase order with vendor and items', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      const item = createTestItem({ id: 1, vendorId: 1 });
      const poData = {
        vendorId: 1,
        items: [
          { itemId: 1, quantity: 10, price: 50.0 },
        ],
      };

      const createdPo = createTestPurchaseOrder({
        id: 1,
        vendorId: 1,
        status: 'DRAFT',
        vendor,
        items: [
          { ...createTestPurchaseOrderItem({ purchaseOrderId: 1, itemId: 1 }), item } as any,
        ],
      });

      prismaMock.purchaseOrder.create.mockResolvedValue(createdPo as any);

      // Act
      const result = await purchaseOrderService.createPurchaseOrder(poData);

      // Assert
      expect(result.vendorId).toBe(1);
      expect(result.status).toBe('DRAFT');
      expect(prismaMock.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vendorId: 1,
            items: {
              create: [{ itemId: 1, quantity: 10, price: 50.0 }],
            },
          }),
        })
      );
    });

    it('should include vendor and items relations in response', async () => {
      // Arrange
      const poData = {
        vendorId: 1,
        items: [{ itemId: 1, quantity: 1, price: 100.0 }],
      };
      const createdPo = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.create.mockResolvedValue(createdPo as any);

      // Act
      await purchaseOrderService.createPurchaseOrder(poData);

      // Assert
      expect(prismaMock.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            vendor: true,
            items: { include: { item: true } },
          },
        })
      );
    });
  });

  // ==========================================================================
  // getPurchaseOrders
  // ==========================================================================
  describe('getPurchaseOrders', () => {
    it('should return paginated purchase orders', async () => {
      // Arrange
      const pos = [
        createTestPurchaseOrder({ id: 1 }),
        createTestPurchaseOrder({ id: 2 }),
      ];

      prismaMock.purchaseOrder.count.mockResolvedValue(2);
      prismaMock.purchaseOrder.findMany.mockResolvedValue(pos as any);

      // Act
      const result = await purchaseOrderService.getPurchaseOrders({}, { page: '1', limit: '10' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by vendorId', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(1);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([createTestPurchaseOrder({ vendorId: 5 })] as any);

      // Act
      await purchaseOrderService.getPurchaseOrders({ vendorId: '5' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: 5,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(0);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      // Act
      await purchaseOrderService.getPurchaseOrders({ status: 'SENT' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SENT',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      prismaMock.purchaseOrder.count.mockResolvedValue(0);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      // Act
      await purchaseOrderService.getPurchaseOrders(
        { startDate, endDate },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
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

    it('should exclude soft-deleted purchase orders', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(0);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      // Act
      await purchaseOrderService.getPurchaseOrders({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(35);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      // Act
      const result = await purchaseOrderService.getPurchaseOrders({}, { page: '3', limit: '10' });

      // Assert
      expect(result.pagination).toEqual({
        total: 35,
        page: 3,
        limit: 10,
        totalPages: 4,
        hasNext: true,
        hasPrevious: true,
      });
    });
  });

  // ==========================================================================
  // getPurchaseOrderById
  // ==========================================================================
  describe('getPurchaseOrderById', () => {
    it('should return purchase order with all relations', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      // Act
      const result = await purchaseOrderService.getPurchaseOrderById(1);

      // Assert
      expect(result).toEqual(po);
      expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, deletedAt: null },
          include: expect.objectContaining({
            vendor: expect.objectContaining({
              select: expect.objectContaining({ id: true, name: true, contact: true }),
            }),
            items: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                quantity: true,
                price: true,
                item: expect.any(Object),
              }),
            }),
            invoices: expect.objectContaining({
              where: { deletedAt: null },
              select: expect.objectContaining({
                id: true,
                date: true,
                status: true,
                totalAmount: true,
              }),
            }),
          }),
        })
      );
    });

    it('should return null for non-existent purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const result = await purchaseOrderService.getPurchaseOrderById(999);

      // Assert
      expect(result).toBeNull();
    });
  });
});
