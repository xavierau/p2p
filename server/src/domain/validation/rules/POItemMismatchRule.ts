import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class POItemMismatchRule implements IValidationRule {
  ruleType = ValidationRuleType.PO_ITEM_MISMATCH;
  severity: ValidationSeverity = ValidationSeverity.WARNING;
  enabled = true;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Skip if no PO linked
    if (!context.purchaseOrder) {
      return ValidationResult.passed(
        this.ruleType,
        this.severity,
        { reason: 'No purchase order linked to invoice' }
      );
    }

    const po = context.purchaseOrder;

    // Get PO item IDs
    const poItemIds = new Set(po.items?.map(item => item.itemId) || []);

    // Find invoice items not in PO
    const mismatchedItems = invoice.items?.filter(invoiceItem =>
      !poItemIds.has(invoiceItem.itemId)
    ) || [];

    if (mismatchedItems.length > 0) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `${mismatchedItems.length} invoice item(s) not found in purchase order`,
          mismatchedItemIds: mismatchedItems.map(item => item.itemId),
          mismatchedItemCount: mismatchedItems.length,
          purchaseOrderId: po.id,
          recommendation: 'Verify these items should be on this invoice or update the purchase order'
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'All invoice items match purchase order items' }
    );
  }
}
