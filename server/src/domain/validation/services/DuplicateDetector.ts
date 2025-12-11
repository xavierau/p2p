import { ValidationResult } from '../value-objects/ValidationResult';
import { ValidationContext } from '../types/ValidationContext';
import { IInvoiceRepository } from '../repositories/IInvoiceRepository';
import { InvoiceWithRelations } from '../types/Invoice';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

export class DuplicateDetector {
  constructor(private invoiceRepository: IInvoiceRepository) {}

  async checkDuplicate(invoice: InvoiceWithRelations): Promise<ValidationResult> {
    // Skip if no invoice number or vendor ID
    if (!invoice.invoiceNumber || !invoice.vendorId) {
      return ValidationResult.passed(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
        ValidationSeverity.CRITICAL,
        { reason: 'No invoice number or vendor to check' }
      );
    }

    // Check for duplicate using repository
    const duplicate = await this.invoiceRepository.findDuplicateByNumberAndVendor(
      invoice.invoiceNumber,
      invoice.vendorId,
      invoice.id
    );

    if (duplicate) {
      return ValidationResult.failed(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
        ValidationSeverity.CRITICAL,
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
      ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
      ValidationSeverity.CRITICAL,
      { reason: 'No duplicate found' }
    );
  }
}
