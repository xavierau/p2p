/**
 * Prisma Invoice Repository Implementation
 *
 * Infrastructure layer implementation of IInvoiceRepository using Prisma.
 */

import {
  IInvoiceRepository,
  Invoice,
  InvoiceQueryOptions,
  ItemPriceHistory,
} from '../../../../domain/validation/repositories/IInvoiceRepository';

export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private prisma: any) {}

  async findById(id: number, options: InvoiceQueryOptions = {}): Promise<Invoice | null> {
    const {
      includeItems = false,
      includePurchaseOrder = false,
      includeDeliveryNotes = false,
    } = options;

    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: includeItems
          ? {
              include: {
                item: true,
              },
            }
          : false,
        purchaseOrder: includePurchaseOrder
          ? {
              include: {
                items: true,
              },
            }
          : false,
        deliveryNotes: includeDeliveryNotes
          ? {
              include: {
                deliveryNote: {
                  include: {
                    items: true,
                  },
                },
              },
            }
          : false,
      },
    });

    return invoice as Invoice | null;
  }

  async findDuplicateByNumberAndVendor(
    invoiceNumber: string,
    vendorId: number,
    excludeInvoiceId?: number
  ): Promise<Invoice | null> {
    const duplicate = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber,
        vendorId,
        deletedAt: null,
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        vendorId: true,
        totalAmount: true,
        date: true,
        status: true,
        userId: true,
        deletedAt: true,
      },
    });

    return duplicate as Invoice | null;
  }

  async findPriceHistoryForItems(
    itemIds: number[],
    limit: number = 50
  ): Promise<ItemPriceHistory[]> {
    if (itemIds.length === 0) {
      return [];
    }

    const priceHistory = await this.prisma.itemPriceHistory.findMany({
      where: {
        itemId: { in: itemIds },
      },
      orderBy: {
        date: 'desc',
      },
      take: limit,
      select: {
        id: true,
        itemId: true,
        price: true,
        date: true,
      },
    });

    return priceHistory as ItemPriceHistory[];
  }
}
