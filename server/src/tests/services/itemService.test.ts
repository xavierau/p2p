import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestItem,
  createTestVendor,
  createTestItemPriceHistory,
} from '../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import services after mocking
import * as itemService from '../../services/itemService';

describe('itemService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // createItem
  // ==========================================================================
  describe('createItem', () => {
    it('should create an item and initial price history entry', async () => {
      // Arrange
      const itemData = { name: 'Test Item', price: 100.0, vendorId: 1 };
      const createdItem = createTestItem({
        id: 1,
        name: 'Test Item',
        price: 100.0,
        vendorId: 1,
      });

      const txMock = {
        item: {
          create: vi.fn().mockResolvedValue(createdItem),
        },
        itemPriceHistory: {
          create: vi.fn().mockResolvedValue(createTestItemPriceHistory({
            id: 1,
            itemId: 1,
            price: 100.0,
          })),
        },
      };

      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      const result = await itemService.createItem(itemData);

      // Assert
      expect(result.name).toBe('Test Item');
      expect(result.price).toBe(100.0);
      expect(txMock.item.create).toHaveBeenCalledWith({
        data: { name: 'Test Item', price: 100.0, vendorId: 1 },
      });
      expect(txMock.itemPriceHistory.create).toHaveBeenCalledWith({
        data: {
          itemId: 1,
          price: 100.0,
        },
      });
    });

    it('should use transaction for atomicity', async () => {
      // Arrange
      const itemData = { name: 'Test Item', price: 50.0, vendorId: 1 };
      const createdItem = createTestItem({ id: 1, ...itemData });

      const txMock = {
        item: { create: vi.fn().mockResolvedValue(createdItem) },
        itemPriceHistory: {
          create: vi.fn().mockResolvedValue(createTestItemPriceHistory({ itemId: 1, price: 50.0 })),
        },
      };

      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      await itemService.createItem(itemData);

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // updateItem
  // ==========================================================================
  describe('updateItem', () => {
    it('should create price history entry when price changes', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, price: 100.0 });
      const updatedItem = { ...existingItem, price: 150.0 };

      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);

      const txMock = {
        itemPriceHistory: {
          create: vi.fn().mockResolvedValue(createTestItemPriceHistory({
            itemId: 1,
            price: 100.0, // Old price recorded
          })),
        },
        item: {
          update: vi.fn().mockResolvedValue(updatedItem),
        },
      };

      prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      // Act
      const result = await itemService.updateItem(1, { price: 150.0 });

      // Assert
      expect(result?.price).toBe(150.0);
      expect(txMock.itemPriceHistory.create).toHaveBeenCalledWith({
        data: {
          itemId: 1,
          price: 100.0, // Records the OLD price
        },
      });
    });

    it('should not create price history when price remains unchanged', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, price: 100.0 });
      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);
      prismaMock.item.update.mockResolvedValue({ ...existingItem, name: 'Updated Name' } as any);

      // Act
      await itemService.updateItem(1, { name: 'Updated Name' });

      // Assert
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.item.update).toHaveBeenCalled();
    });

    it('should not create price history when price is same as current', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, price: 100.0 });
      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);
      prismaMock.item.update.mockResolvedValue(existingItem as any);

      // Act
      await itemService.updateItem(1, { price: 100.0 });

      // Assert
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should return null when item not found', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act
      const result = await itemService.updateItem(999, { name: 'New Name' });

      // Assert
      expect(result).toBeNull();
    });

    it('should update item name without affecting price history', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, name: 'Old Name' });
      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);
      prismaMock.item.update.mockResolvedValue({ ...existingItem, name: 'New Name' } as any);

      // Act
      const result = await itemService.updateItem(1, { name: 'New Name' });

      // Assert
      expect(result?.name).toBe('New Name');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should update item_code', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, item_code: 'OLD-CODE' });
      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);
      prismaMock.item.update.mockResolvedValue({ ...existingItem, item_code: 'NEW-CODE' } as any);

      // Act
      const result = await itemService.updateItem(1, { item_code: 'NEW-CODE' });

      // Assert
      expect(result?.item_code).toBe('NEW-CODE');
    });

    it('should update vendorId', async () => {
      // Arrange
      const existingItem = createTestItem({ id: 1, vendorId: 1 });
      prismaMock.item.findFirst.mockResolvedValue(existingItem as any);
      prismaMock.item.update.mockResolvedValue({ ...existingItem, vendorId: 2 } as any);

      // Act
      const result = await itemService.updateItem(1, { vendorId: 2 });

      // Assert
      expect(result?.vendorId).toBe(2);
    });
  });

  // ==========================================================================
  // getItems
  // ==========================================================================
  describe('getItems', () => {
    it('should return paginated items', async () => {
      // Arrange
      const items = [
        createTestItem({ id: 1 }),
        createTestItem({ id: 2 }),
      ];

      prismaMock.item.count.mockResolvedValue(2);
      prismaMock.item.findMany.mockResolvedValue(items as any);

      // Act
      const result = await itemService.getItems({}, { page: '1', limit: '10' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by vendorId', async () => {
      // Arrange
      prismaMock.item.count.mockResolvedValue(1);
      prismaMock.item.findMany.mockResolvedValue([createTestItem({ vendorId: 5 })] as any);

      // Act
      await itemService.getItems({ vendorId: '5', vendorIdOperator: '=' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: 5,
          }),
        })
      );
    });

    it('should filter by vendor name with equals operator', async () => {
      // Arrange
      prismaMock.item.count.mockResolvedValue(0);
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItems(
        { vendorName: 'Exact Vendor', vendorNameOperator: '=' },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendor: { name: 'Exact Vendor' },
          }),
        })
      );
    });

    it('should filter by vendor name with contains operator (case insensitive)', async () => {
      // Arrange
      prismaMock.item.count.mockResolvedValue(0);
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItems(
        { vendorName: 'partial', vendorNameOperator: 'contains' },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendor: { name: { contains: 'partial', mode: 'insensitive' } },
          }),
        })
      );
    });

    it('should exclude soft-deleted items', async () => {
      // Arrange
      prismaMock.item.count.mockResolvedValue(0);
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItems({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('should include vendor relation', async () => {
      // Arrange
      prismaMock.item.count.mockResolvedValue(0);
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItems({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { vendor: true },
        })
      );
    });
  });

  // ==========================================================================
  // getItemById
  // ==========================================================================
  describe('getItemById', () => {
    it('should return item with vendor and price history', async () => {
      // Arrange
      const item = createTestItem({ id: 1 });
      prismaMock.item.findFirst.mockResolvedValue(item as any);

      // Act
      const result = await itemService.getItemById(1);

      // Assert
      expect(result).toEqual(item);
      expect(prismaMock.item.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          vendor: true,
          priceHistory: { orderBy: { date: 'desc' }, take: 10 },
        },
      });
    });

    it('should return null for non-existent item', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act
      const result = await itemService.getItemById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // deleteItem
  // ==========================================================================
  describe('deleteItem', () => {
    it('should soft delete item by setting deletedAt', async () => {
      // Arrange
      const item = createTestItem({ id: 1 });
      prismaMock.item.findFirst.mockResolvedValue(item as any);
      prismaMock.item.update.mockResolvedValue({
        ...item,
        deletedAt: new Date(),
      } as any);

      // Act
      const result = await itemService.deleteItem(1);

      // Assert
      expect(result?.deletedAt).not.toBeNull();
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should return null when item not found', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act
      const result = await itemService.deleteItem(999);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.item.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getItemPriceHistory
  // ==========================================================================
  describe('getItemPriceHistory', () => {
    it('should return paginated price history', async () => {
      // Arrange
      const history = [
        createTestItemPriceHistory({ id: 1, itemId: 1, price: 100.0 }),
        createTestItemPriceHistory({ id: 2, itemId: 1, price: 90.0 }),
      ];

      prismaMock.itemPriceHistory.count.mockResolvedValue(2);
      prismaMock.itemPriceHistory.findMany.mockResolvedValue(history as any);

      // Act
      const result = await itemService.getItemPriceHistory(1, { page: '1', limit: '10' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should order by date descending', async () => {
      // Arrange
      prismaMock.itemPriceHistory.count.mockResolvedValue(0);
      prismaMock.itemPriceHistory.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItemPriceHistory(1, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.itemPriceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        })
      );
    });

    it('should filter by itemId', async () => {
      // Arrange
      prismaMock.itemPriceHistory.count.mockResolvedValue(0);
      prismaMock.itemPriceHistory.findMany.mockResolvedValue([]);

      // Act
      await itemService.getItemPriceHistory(5, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.itemPriceHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { itemId: 5 },
        })
      );
    });
  });
});
