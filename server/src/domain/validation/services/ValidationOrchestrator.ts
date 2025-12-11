import { ValidationSeverity, ValidationStatus } from '@prisma/client';
import { DuplicateDetector } from './DuplicateDetector';
import { SuspiciousDetector } from './SuspiciousDetector';
import { InvoiceValidationSummary, ValidationResult } from '../value-objects/ValidationResult';
import { ValidationContext } from '../types/ValidationContext';
import { InvoiceWithRelations } from '../types/Invoice';
import { IInvoiceRepository } from '../repositories/IInvoiceRepository';
import { IInvoiceValidationRepository } from '../repositories/IInvoiceValidationRepository';

export class ValidationOrchestrator {
  constructor(
    private duplicateDetector: DuplicateDetector,
    private suspiciousDetector: SuspiciousDetector,
    private invoiceRepository: IInvoiceRepository,
    private validationRepository: IInvoiceValidationRepository
  ) {}

  async validateInvoice(invoiceId: number): Promise<InvoiceValidationSummary> {
    // 1. Fetch invoice with all relations using repository
    const invoiceFromRepo = await this.invoiceRepository.findById(invoiceId, {
      includeItems: true,
      includePurchaseOrder: true,
      includeDeliveryNotes: true
    });

    if (!invoiceFromRepo) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // Transform repository Invoice to InvoiceWithRelations for domain validation
    // This mapping ensures type compatibility between repository and domain types
    const invoice: InvoiceWithRelations = {
      id: invoiceFromRepo.id,
      invoiceNumber: invoiceFromRepo.invoiceNumber,
      vendorId: invoiceFromRepo.vendorId,
      date: invoiceFromRepo.date,
      status: invoiceFromRepo.status,
      totalAmount: invoiceFromRepo.totalAmount,
      userId: invoiceFromRepo.userId,
      project: null,
      accountingId: null,
      syncStatus: 'PENDING',
      syncError: null,
      deletedAt: invoiceFromRepo.deletedAt,
      purchaseOrderId: invoiceFromRepo.purchaseOrder?.id || null,
      branchId: null,
      departmentId: null,
      costCenterId: null,
      items: (invoiceFromRepo.items || []).map(item => ({
        id: item.id,
        invoiceId: item.invoiceId,
        itemId: item.itemId,
        quantity: item.quantity,
        price: item.price,
        item: {
          id: item.item?.id || item.itemId,
          name: item.item?.name || '',
          item_code: null,
          price: item.price,
          vendorId: item.item?.vendorId || invoiceFromRepo.vendorId,
          deletedAt: null
        }
      })),
      purchaseOrder: invoiceFromRepo.purchaseOrder ? {
        id: invoiceFromRepo.purchaseOrder.id,
        vendorId: invoiceFromRepo.vendorId,
        date: invoiceFromRepo.date,
        status: 'SENT',
        deletedAt: null,
        items: (invoiceFromRepo.purchaseOrder.items || []).map(poItem => ({
          id: poItem.id,
          purchaseOrderId: invoiceFromRepo.purchaseOrder!.id,
          itemId: poItem.itemId,
          quantity: poItem.quantity,
          price: poItem.price
        }))
      } : undefined,
      deliveryNotes: (invoiceFromRepo.deliveryNotes || []).map(link => ({
        id: link.deliveryNote.id,
        invoiceId,
        deliveryNoteId: link.deliveryNote.id,
        linkedAt: new Date(),
        linkedBy: invoiceFromRepo.userId,
        deliveryNote: {
          id: link.deliveryNote.id,
          deliveryDate: new Date(),
          receivedBy: 'system',
          notes: null,
          status: 'CONFIRMED' as const,
          purchaseOrderId: invoiceFromRepo.purchaseOrder?.id || 0,
          vendorId: invoiceFromRepo.vendorId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: invoiceFromRepo.userId,
          items: (link.deliveryNote.items || []).map(dnItem => ({
            id: dnItem.id,
            deliveryNoteId: link.deliveryNote.id,
            itemId: dnItem.itemId,
            quantityOrdered: dnItem.quantity,
            quantityDelivered: dnItem.quantity,
            condition: 'GOOD' as const,
            discrepancyReason: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        }
      }))
    };

    // 2. Build validation context
    const context: ValidationContext = {
      purchaseOrder: invoice.purchaseOrder || undefined,
      deliveryNotes: invoice.deliveryNotes?.map(link => link.deliveryNote) || [],
      priceHistory: [],
      historicalInvoices: []
    };

    // Load price history for all items in the invoice using repository
    if (invoice.items && invoice.items.length > 0) {
      const itemIds = invoice.items.map(item => item.itemId);
      context.priceHistory = await this.invoiceRepository.findPriceHistoryForItems(itemIds, 50);
    }

    // 3. Run duplicate detection (critical, blocking)
    const duplicateResult = await this.duplicateDetector.checkDuplicate(invoice);

    // 4. Run suspicious detection (warnings/info)
    const suspiciousResults = await this.suspiciousDetector.detectAnomalies(invoice, context);

    // 5. Combine all results
    const allResults = [duplicateResult, ...suspiciousResults];

    // Filter only failed validations
    const failedResults = allResults.filter(r => !r.passed);

    // 6. Persist failed validations to database using repository
    if (failedResults.length > 0) {
      await this.validationRepository.createMany(
        failedResults.map(result => ({
          invoiceId,
          ruleType: result.ruleType,
          severity: result.severity,
          status: ValidationStatus.FLAGGED,
          details: result.details as Record<string, unknown>,
          metadata: result.metadata as Record<string, unknown> | undefined
        }))
      );
    }

    // 7. Determine highest severity
    const highestSeverity = this.getHighestSeverity(failedResults);

    // 8. Return summary
    return {
      invoiceId,
      isValid: failedResults.length === 0,
      hasBlockingIssues: failedResults.some(r => r.severity === ValidationSeverity.CRITICAL),
      flagCount: failedResults.length,
      highestSeverity,
      validations: allResults
    };
  }

  private getHighestSeverity(results: ValidationResult[]): ValidationSeverity | null {
    if (results.length === 0) return null;

    const severityOrder: Record<ValidationSeverity, number> = {
      [ValidationSeverity.CRITICAL]: 3,
      [ValidationSeverity.WARNING]: 2,
      [ValidationSeverity.INFO]: 1
    };

    return results.reduce((highest: ValidationSeverity, current) => {
      return severityOrder[current.severity] > severityOrder[highest]
        ? current.severity
        : highest;
    }, ValidationSeverity.INFO);
  }
}
