/**
 * Prisma Invoice Validation Repository Implementation
 *
 * Infrastructure layer implementation of IInvoiceValidationRepository using Prisma.
 */

import {
  IInvoiceValidationRepository,
  InvoiceValidation,
  CreateInvoiceValidationData,
} from '../../../../domain/validation/repositories/IInvoiceValidationRepository';

export class PrismaInvoiceValidationRepository implements IInvoiceValidationRepository {
  constructor(private prisma: any) {}

  async createMany(data: CreateInvoiceValidationData[]): Promise<void> {
    if (data.length === 0) {
      return;
    }

    await this.prisma.invoiceValidation.createMany({
      data,
    });
  }

  async findByInvoiceId(invoiceId: number): Promise<InvoiceValidation[]> {
    const validations = await this.prisma.invoiceValidation.findMany({
      where: { invoiceId },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    return validations as InvoiceValidation[];
  }

  async deleteByInvoiceId(invoiceId: number): Promise<void> {
    await this.prisma.invoiceValidation.deleteMany({
      where: { invoiceId },
    });
  }
}
