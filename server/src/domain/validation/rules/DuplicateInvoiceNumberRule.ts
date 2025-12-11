import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class DuplicateInvoiceNumberRule implements IValidationRule {
  ruleType = ValidationRuleType.DUPLICATE_INVOICE_NUMBER;
  severity: ValidationSeverity = ValidationSeverity.CRITICAL;
  enabled = true;

  constructor(
    private prisma: PrismaClient,
    private config: { enabled?: boolean; severity?: ValidationSeverity } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Skip if no invoice number or vendor ID
    if (!invoice.invoiceNumber || !invoice.vendorId) {
      return ValidationResult.passed(
        this.ruleType,
        this.severity,
        { reason: 'No invoice number or vendor to check' }
      );
    }

    // Check for duplicate
    const duplicate = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: invoice.invoiceNumber,
        vendorId: invoice.vendorId,
        deletedAt: null,
        id: { not: invoice.id }
      },
      select: {
        id: true,
        date: true,
        totalAmount: true,
        status: true
      }
    });

    if (duplicate) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `Duplicate invoice number '${invoice.invoiceNumber}' found for this vendor`,
          duplicateInvoiceId: duplicate.id,
          duplicateDate: duplicate.date,
          duplicateAmount: duplicate.totalAmount,
          duplicateStatus: duplicate.status
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'No duplicate found' }
    );
  }
}
