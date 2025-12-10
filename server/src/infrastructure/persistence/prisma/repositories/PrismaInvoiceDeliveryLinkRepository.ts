import prisma from '../../../../prisma';
import {
  IInvoiceDeliveryLinkRepository,
  InvoiceDeliveryLink,
} from '../../../../domain/delivery/repositories/IInvoiceDeliveryLinkRepository';

/**
 * Prisma implementation of IInvoiceDeliveryLinkRepository.
 * Manages the many-to-many relationship between invoices and delivery notes.
 */
export class PrismaInvoiceDeliveryLinkRepository implements IInvoiceDeliveryLinkRepository {
  /**
   * Creates a link between an invoice and a delivery note.
   * @throws Error if link already exists
   */
  async link(invoiceId: string, deliveryNoteId: string): Promise<void> {
    try {
      await prisma.invoiceDeliveryLink.create({
        data: {
          invoiceId: parseInt(invoiceId),
          deliveryNoteId: parseInt(deliveryNoteId),
          linkedBy: 1, // TODO: Get from context/session
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        throw new Error(
          `Link already exists between invoice ${invoiceId} and delivery note ${deliveryNoteId}`
        );
      }
      throw new Error(`Failed to create invoice-delivery link: ${(error as Error).message}`);
    }
  }

  /**
   * Removes the link between an invoice and a delivery note.
   * @throws Error if link does not exist
   */
  async unlink(invoiceId: string, deliveryNoteId: string): Promise<void> {
    try {
      const result = await prisma.invoiceDeliveryLink.deleteMany({
        where: {
          invoiceId: parseInt(invoiceId),
          deliveryNoteId: parseInt(deliveryNoteId),
        },
      });

      if (result.count === 0) {
        throw new Error(
          `Link does not exist between invoice ${invoiceId} and delivery note ${deliveryNoteId}`
        );
      }
    } catch (error) {
      throw new Error(`Failed to remove invoice-delivery link: ${(error as Error).message}`);
    }
  }

  /**
   * Finds all delivery note IDs linked to a specific invoice.
   * @returns Array of delivery note IDs (empty if none found)
   */
  async findDeliveryNoteIdsByInvoiceId(invoiceId: string): Promise<string[]> {
    try {
      const links = await prisma.invoiceDeliveryLink.findMany({
        where: { invoiceId: parseInt(invoiceId) },
        select: { deliveryNoteId: true },
      });

      return links.map(link => link.deliveryNoteId.toString());
    } catch (error) {
      throw new Error(
        `Failed to find delivery notes by invoice ID: ${(error as Error).message}`
      );
    }
  }

  /**
   * Finds all invoice IDs linked to a specific delivery note.
   * @returns Array of invoice IDs (empty if none found)
   */
  async findInvoiceIdsByDeliveryNoteId(deliveryNoteId: string): Promise<string[]> {
    try {
      const links = await prisma.invoiceDeliveryLink.findMany({
        where: { deliveryNoteId: parseInt(deliveryNoteId) },
        select: { invoiceId: true },
      });

      return links.map(link => link.invoiceId.toString());
    } catch (error) {
      throw new Error(
        `Failed to find invoices by delivery note ID: ${(error as Error).message}`
      );
    }
  }

  /**
   * Checks if a link exists between an invoice and a delivery note.
   * @returns true if link exists, false otherwise
   */
  async exists(invoiceId: string, deliveryNoteId: string): Promise<boolean> {
    try {
      const count = await prisma.invoiceDeliveryLink.count({
        where: {
          invoiceId: parseInt(invoiceId),
          deliveryNoteId: parseInt(deliveryNoteId),
        },
      });

      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check invoice-delivery link existence: ${(error as Error).message}`);
    }
  }

  /**
   * Gets all links for a specific invoice.
   * @returns Array of InvoiceDeliveryLink (empty if none found)
   */
  async findLinksByInvoiceId(invoiceId: string): Promise<InvoiceDeliveryLink[]> {
    try {
      const links = await prisma.invoiceDeliveryLink.findMany({
        where: { invoiceId: parseInt(invoiceId) },
        orderBy: { linkedAt: 'desc' },
      });

      return links.map(link => ({
        invoiceId: link.invoiceId.toString(),
        deliveryNoteId: link.deliveryNoteId.toString(),
        linkedAt: link.linkedAt,
      }));
    } catch (error) {
      throw new Error(`Failed to find links by invoice ID: ${(error as Error).message}`);
    }
  }

  /**
   * Gets all links for a specific delivery note.
   * @returns Array of InvoiceDeliveryLink (empty if none found)
   */
  async findLinksByDeliveryNoteId(deliveryNoteId: string): Promise<InvoiceDeliveryLink[]> {
    try {
      const links = await prisma.invoiceDeliveryLink.findMany({
        where: { deliveryNoteId: parseInt(deliveryNoteId) },
        orderBy: { linkedAt: 'desc' },
      });

      return links.map(link => ({
        invoiceId: link.invoiceId.toString(),
        deliveryNoteId: link.deliveryNoteId.toString(),
        linkedAt: link.linkedAt,
      }));
    } catch (error) {
      throw new Error(`Failed to find links by delivery note ID: ${(error as Error).message}`);
    }
  }

  /**
   * Removes all links for a specific invoice.
   * Useful when deleting an invoice.
   */
  async deleteByInvoiceId(invoiceId: string): Promise<void> {
    try {
      await prisma.invoiceDeliveryLink.deleteMany({
        where: { invoiceId: parseInt(invoiceId) },
      });
    } catch (error) {
      throw new Error(`Failed to delete links by invoice ID: ${(error as Error).message}`);
    }
  }

  /**
   * Removes all links for a specific delivery note.
   * Useful when deleting a delivery note.
   */
  async deleteByDeliveryNoteId(deliveryNoteId: string): Promise<void> {
    try {
      await prisma.invoiceDeliveryLink.deleteMany({
        where: { deliveryNoteId: parseInt(deliveryNoteId) },
      });
    } catch (error) {
      throw new Error(`Failed to delete links by delivery note ID: ${(error as Error).message}`);
    }
  }
}
