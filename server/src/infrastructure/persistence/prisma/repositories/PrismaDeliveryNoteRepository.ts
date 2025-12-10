import prisma from '../../../../prisma';
import { IDeliveryNoteRepository } from '../../../../domain/delivery/repositories/IDeliveryNoteRepository';
import { DeliveryNote } from '../../../../domain/delivery/entities/DeliveryNote';
import { DeliveryNoteStatus } from '../../../../domain/delivery/value-objects/DeliveryNoteStatus';
import { DeliveryNoteMapper } from '../mappers/DeliveryNoteMapper';

/**
 * Prisma implementation of IDeliveryNoteRepository.
 * Handles all persistence operations for DeliveryNote aggregate.
 */
export class PrismaDeliveryNoteRepository implements IDeliveryNoteRepository {
  /**
   * Persists a new delivery note with its items.
   * @throws Error if delivery note with same ID already exists
   */
  async save(deliveryNote: DeliveryNote): Promise<void> {
    try {
      const data = DeliveryNoteMapper.toPersistenceCreate(deliveryNote);

      await prisma.deliveryNote.create({
        data: {
          ...data,
          status: data.status as any,
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new Error(`Delivery note with ID ${deliveryNote.id} already exists`);
      }
      throw new Error(`Failed to save delivery note: ${(error as Error).message}`);
    }
  }

  /**
   * Updates an existing delivery note.
   * @throws Error if delivery note not found
   */
  async update(deliveryNote: DeliveryNote): Promise<void> {
    try {
      const data = DeliveryNoteMapper.toPersistenceUpdate(deliveryNote);
      const id = parseInt(deliveryNote.id);

      const updated = await prisma.deliveryNote.update({
        where: { id },
        data: {
          ...data,
          status: data.status as any,
        },
      });

      if (!updated) {
        throw new Error(`Delivery note with ID ${deliveryNote.id} not found`);
      }

      // Update items - delete all and recreate for simplicity
      await prisma.deliveryNoteItem.deleteMany({
        where: { deliveryNoteId: id },
      });

      const items = deliveryNote.getItems().map(item =>
        DeliveryNoteMapper.itemToPersistenceCreate(item)
      );

      await prisma.deliveryNoteItem.createMany({
        data: items.map(item => ({
          ...item,
          deliveryNoteId: id,
          condition: item.condition as any,
        })),
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new Error(`Delivery note with ID ${deliveryNote.id} not found`);
      }
      throw new Error(`Failed to update delivery note: ${(error as Error).message}`);
    }
  }

  /**
   * Finds a delivery note by its ID.
   * @returns DeliveryNote if found, null otherwise
   */
  async findById(id: string): Promise<DeliveryNote | null> {
    try {
      const deliveryNote = await prisma.deliveryNote.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });

      if (!deliveryNote) {
        return null;
      }

      return DeliveryNoteMapper.toDomain(deliveryNote);
    } catch (error) {
      throw new Error(`Failed to find delivery note by ID: ${(error as Error).message}`);
    }
  }

  /**
   * Finds a delivery note by its unique delivery note number.
   * @returns DeliveryNote if found, null otherwise
   */
  async findByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<DeliveryNote | null> {
    try {
      // Using ID as delivery note number for now
      const deliveryNote = await prisma.deliveryNote.findUnique({
        where: { id: parseInt(deliveryNoteNumber) },
        include: { items: true },
      });

      if (!deliveryNote) {
        return null;
      }

      return DeliveryNoteMapper.toDomain(deliveryNote);
    } catch (error) {
      throw new Error(`Failed to find delivery note by number: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all delivery notes for a specific purchase order.
   * @returns Array of delivery notes (empty if none found)
   */
  async findByPurchaseOrderId(purchaseOrderId: string): Promise<DeliveryNote[]> {
    try {
      const deliveryNotes = await prisma.deliveryNote.findMany({
        where: { purchaseOrderId: parseInt(purchaseOrderId) },
        include: { items: true },
        orderBy: { deliveryDate: 'desc' },
      });

      return deliveryNotes.map(DeliveryNoteMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find delivery notes by PO ID: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all delivery notes for a specific vendor.
   * @returns Array of delivery notes (empty if none found)
   */
  async findByVendorId(vendorId: string): Promise<DeliveryNote[]> {
    try {
      const deliveryNotes = await prisma.deliveryNote.findMany({
        where: { vendorId: parseInt(vendorId) },
        include: { items: true },
        orderBy: { deliveryDate: 'desc' },
      });

      return deliveryNotes.map(DeliveryNoteMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find delivery notes by vendor ID: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all delivery notes with a specific status.
   * @returns Array of delivery notes (empty if none found)
   */
  async findByStatus(status: DeliveryNoteStatus): Promise<DeliveryNote[]> {
    try {
      const deliveryNotes = await prisma.deliveryNote.findMany({
        where: { status: status.toString() as any },
        include: { items: true },
        orderBy: { deliveryDate: 'desc' },
      });

      return deliveryNotes.map(DeliveryNoteMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find delivery notes by status: ${(error as Error).message}`);
    }
  }

  /**
   * Finds delivery notes within a date range.
   * @returns Array of delivery notes (empty if none found)
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<DeliveryNote[]> {
    try {
      const deliveryNotes = await prisma.deliveryNote.findMany({
        where: {
          deliveryDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { items: true },
        orderBy: { deliveryDate: 'desc' },
      });

      return deliveryNotes.map(DeliveryNoteMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find delivery notes by date range: ${(error as Error).message}`);
    }
  }

  /**
   * Finds delivery notes with issues (damaged, partial, rejected items, or quantity discrepancies).
   * @returns Array of delivery notes with issues (empty if none found)
   */
  async findWithIssues(): Promise<DeliveryNote[]> {
    try {
      const deliveryNotes = await prisma.deliveryNote.findMany({
        where: {
          items: {
            some: {
              OR: [
                { condition: { not: 'GOOD' } },
                {
                  NOT: {
                    quantityOrdered: {
                      equals: prisma.deliveryNoteItem.fields.quantityDelivered,
                    },
                  },
                },
              ],
            },
          },
        },
        include: { items: true },
        orderBy: { deliveryDate: 'desc' },
      });

      return deliveryNotes.map(DeliveryNoteMapper.toDomain);
    } catch (error) {
      throw new Error(`Failed to find delivery notes with issues: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if a delivery note number is already in use.
   * @returns true if the number exists, false otherwise
   */
  async existsByDeliveryNoteNumber(deliveryNoteNumber: string): Promise<boolean> {
    try {
      const count = await prisma.deliveryNote.count({
        where: { id: parseInt(deliveryNoteNumber) },
      });

      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check delivery note number existence: ${(error as Error).message}`);
    }
  }

  /**
   * Deletes a delivery note by ID.
   * Cascade deletion will remove associated items.
   * @throws Error if delivery note not found
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.deliveryNote.delete({
        where: { id: parseInt(id) },
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new Error(`Delivery note with ID ${id} not found`);
      }
      throw new Error(`Failed to delete delivery note: ${(error as Error).message}`);
    }
  }
}
