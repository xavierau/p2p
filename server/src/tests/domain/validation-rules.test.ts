import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { getPrismaMock } from '../helpers/prisma-mock';

// Import validation rules
import { MissingInvoiceNumberRule } from '../../domain/validation/rules/MissingInvoiceNumberRule';
import { AmountThresholdExceededRule } from '../../domain/validation/rules/AmountThresholdExceededRule';
import { RoundAmountPatternRule } from '../../domain/validation/rules/RoundAmountPatternRule';
import { DuplicateInvoiceNumberRule } from '../../domain/validation/rules/DuplicateInvoiceNumberRule';
import { POAmountVarianceRule } from '../../domain/validation/rules/POAmountVarianceRule';
import { POItemMismatchRule } from '../../domain/validation/rules/POItemMismatchRule';
import { DeliveryNoteMismatchRule } from '../../domain/validation/rules/DeliveryNoteMismatchRule';
import { PriceVarianceRule } from '../../domain/validation/rules/PriceVarianceRule';

// Import types
import { InvoiceWithRelations } from '../../domain/validation/types/Invoice';
import { ValidationContext } from '../../domain/validation/types/ValidationContext';

const prismaMock = getPrismaMock();

describe('Validation Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // MissingInvoiceNumberRule
  // ==========================================================================
  describe('MissingInvoiceNumberRule', () => {
    it('should fail when invoice number is null', async () => {
      const rule = new MissingInvoiceNumberRule({ enabled: true, severity: ValidationSeverity.CRITICAL });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: null,
        totalAmount: 100,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.severity).toBe(ValidationSeverity.CRITICAL);
      expect(result.ruleType).toBe(ValidationRuleType.MISSING_INVOICE_NUMBER);
      expect(result.details.message.toLowerCase()).toContain('invoice number');
    });

    it('should fail when invoice number is empty string', async () => {
      const rule = new MissingInvoiceNumberRule({ enabled: true, severity: ValidationSeverity.WARNING });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: '',
        totalAmount: 100,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.severity).toBe(ValidationSeverity.WARNING);
    });

    it('should fail when invoice number is whitespace only', async () => {
      const rule = new MissingInvoiceNumberRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: '   ',
        totalAmount: 100,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
    });

    it('should pass when invoice number is present', async () => {
      const rule = new MissingInvoiceNumberRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 100,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('Invoice number provided');
    });

    it('should use custom severity when configured', async () => {
      const rule = new MissingInvoiceNumberRule({
        enabled: true,
        severity: ValidationSeverity.CRITICAL
      });

      expect(rule.severity).toBe(ValidationSeverity.CRITICAL);
    });
  });

  // ==========================================================================
  // AmountThresholdExceededRule
  // ==========================================================================
  describe('AmountThresholdExceededRule', () => {
    it('should fail when amount exceeds default threshold', async () => {
      const rule = new AmountThresholdExceededRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 15000, // Exceeds default 10000
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.amount).toBe(15000);
      expect(result.details.threshold).toBe(10000);
      expect(result.details.excess).toBe(5000);
    });

    it('should fail when amount exceeds custom threshold', async () => {
      const rule = new AmountThresholdExceededRule({
        enabled: true,
        threshold: 5000
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 7500,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.threshold).toBe(5000);
      expect(result.details.excess).toBe(2500);
    });

    it('should pass when amount is below threshold', async () => {
      const rule = new AmountThresholdExceededRule({
        enabled: true,
        threshold: 10000
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 8000,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.amount).toBe(8000);
      expect(result.details.threshold).toBe(10000);
    });

    it('should pass when amount equals threshold', async () => {
      const rule = new AmountThresholdExceededRule({
        enabled: true,
        threshold: 10000
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 10000,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });
  });

  // ==========================================================================
  // RoundAmountPatternRule
  // ==========================================================================
  describe('RoundAmountPatternRule', () => {
    it('should fail for round amount above default minimum', async () => {
      const rule = new RoundAmountPatternRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 5000, // Round and above 1000
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.amount).toBe(5000);
      expect(result.details.pattern).toContain('Round number');
    });

    it('should pass for round amount below minimum', async () => {
      const rule = new RoundAmountPatternRule({
        enabled: true,
        minimumAmount: 1000
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 500, // Round but below minimum
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should pass for non-round amount', async () => {
      const rule = new RoundAmountPatternRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 5432.50, // Not round
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('not suspiciously round');
    });

    it('should detect various round amounts', async () => {
      const rule = new RoundAmountPatternRule({
        enabled: true,
        minimumAmount: 1000
      });

      const roundAmounts = [1000, 2500, 5000, 10000, 15300];

      for (const amount of roundAmounts) {
        const invoice: Partial<InvoiceWithRelations> = {
          id: 1,
          totalAmount: amount,
          items: []
        };

        const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);
        expect(result.isPassed()).toBe(false, `Amount ${amount} should be flagged as round`);
      }
    });
  });

  // ==========================================================================
  // DuplicateInvoiceNumberRule
  // ==========================================================================
  describe('DuplicateInvoiceNumberRule', () => {
    it('should fail when duplicate invoice found', async () => {
      const rule = new DuplicateInvoiceNumberRule(prismaMock as any, { enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        vendorId: 10,
        totalAmount: 1000,
        items: []
      };

      const duplicateInvoice = {
        id: 2,
        invoiceNumber: 'INV-001',
        vendorId: 10,
        date: new Date('2024-01-15'),
        totalAmount: 1000,
        status: 'APPROVED'
      };

      prismaMock.invoice.findFirst.mockResolvedValue(duplicateInvoice as any);

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.severity).toBe(ValidationSeverity.CRITICAL);
      expect(result.details.message).toContain('Duplicate invoice number');
      expect(result.details.duplicateInvoiceId).toBe(2);
    });

    it('should pass when no duplicate found', async () => {
      const rule = new DuplicateInvoiceNumberRule(prismaMock as any, { enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        vendorId: 10,
        totalAmount: 1000,
        items: []
      };

      prismaMock.invoice.findFirst.mockResolvedValue(null);

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No duplicate found');
    });

    it('should pass when invoice number is missing', async () => {
      const rule = new DuplicateInvoiceNumberRule(prismaMock as any, { enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: null,
        vendorId: 10,
        totalAmount: 1000,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No invoice number');
    });

    it('should pass when vendor ID is missing', async () => {
      const rule = new DuplicateInvoiceNumberRule(prismaMock as any, { enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        vendorId: null,
        totalAmount: 1000,
        items: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should query with correct filters', async () => {
      const rule = new DuplicateInvoiceNumberRule(prismaMock as any, { enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        vendorId: 10,
        totalAmount: 1000,
        items: []
      };

      prismaMock.invoice.findFirst.mockResolvedValue(null);

      await rule.validate(invoice as InvoiceWithRelations, {} as ValidationContext);

      expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith({
        where: {
          invoiceNumber: 'INV-001',
          vendorId: 10,
          deletedAt: null,
          id: { not: 1 }
        },
        select: expect.any(Object)
      });
    });
  });

  // ==========================================================================
  // POAmountVarianceRule
  // ==========================================================================
  describe('POAmountVarianceRule', () => {
    it('should fail when variance exceeds threshold', async () => {
      const rule = new POAmountVarianceRule({
        enabled: true,
        variancePercent: 10
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 12000, // 20% higher than PO
        items: []
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: {
          id: 1,
          vendorId: 10,
          date: new Date(),
          status: 'APPROVED',
          deletedAt: null,
          items: [
            { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 1000 }
          ]
        }
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.invoiceAmount).toBe(12000);
      expect(result.details.poAmount).toBe(10000);
      expect(result.details.variancePercent).toBeCloseTo(20, 1);
    });

    it('should pass when variance is within threshold', async () => {
      const rule = new POAmountVarianceRule({
        enabled: true,
        variancePercent: 10
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 10500, // 5% higher than PO
        items: []
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: {
          id: 1,
          vendorId: 10,
          date: new Date(),
          status: 'APPROVED',
          deletedAt: null,
          items: [
            { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 1000 }
          ]
        }
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.variancePercent).toBeCloseTo(5, 1);
    });

    it('should pass when no PO is linked', async () => {
      const rule = new POAmountVarianceRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 10000,
        items: []
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: null
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No purchase order');
    });

    it('should calculate variance correctly with multiple PO items', async () => {
      const rule = new POAmountVarianceRule({
        enabled: true,
        variancePercent: 10
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 5500,
        items: []
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: {
          id: 1,
          vendorId: 10,
          date: new Date(),
          status: 'APPROVED',
          deletedAt: null,
          items: [
            { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 100 },  // 1000
            { id: 2, purchaseOrderId: 1, itemId: 2, quantity: 5, price: 200 },   // 1000
            { id: 3, purchaseOrderId: 1, itemId: 3, quantity: 20, price: 150 }   // 3000
            // Total: 5000
          ]
        }
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.poAmount).toBe(5000);
      expect(result.details.variancePercent).toBe(10);
    });
  });

  // ==========================================================================
  // POItemMismatchRule
  // ==========================================================================
  describe('POItemMismatchRule', () => {
    it('should fail when invoice has items not in PO', async () => {
      const rule = new POItemMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 5, price: 100, item: {} as any },
          { id: 2, invoiceId: 1, itemId: 2, quantity: 3, price: 150, item: {} as any },
          { id: 3, invoiceId: 1, itemId: 99, quantity: 1, price: 200, item: {} as any } // Not in PO
        ]
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: {
          id: 1,
          vendorId: 10,
          date: new Date(),
          status: 'APPROVED',
          deletedAt: null,
          items: [
            { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 100 },
            { id: 2, purchaseOrderId: 1, itemId: 2, quantity: 5, price: 150 }
          ]
        }
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.mismatchedItemCount).toBe(1);
      expect(result.details.mismatchedItemIds).toContain(99);
    });

    it('should pass when all invoice items are in PO', async () => {
      const rule = new POItemMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 5, price: 100, item: {} as any },
          { id: 2, invoiceId: 1, itemId: 2, quantity: 3, price: 150, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: {
          id: 1,
          vendorId: 10,
          date: new Date(),
          status: 'APPROVED',
          deletedAt: null,
          items: [
            { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 100 },
            { id: 2, purchaseOrderId: 1, itemId: 2, quantity: 5, price: 150 },
            { id: 3, purchaseOrderId: 1, itemId: 3, quantity: 2, price: 200 } // Extra item in PO is OK
          ]
        }
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should pass when no PO is linked', async () => {
      const rule = new POItemMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 5, price: 100, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        purchaseOrder: null
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No purchase order');
    });
  });

  // ==========================================================================
  // DeliveryNoteMismatchRule
  // ==========================================================================
  describe('DeliveryNoteMismatchRule', () => {
    it('should fail when invoice quantity exceeds delivered quantity', async () => {
      const rule = new DeliveryNoteMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 15, price: 100, item: {} as any } // Invoiced 15, delivered only 10
        ]
      };

      const context: Partial<ValidationContext> = {
        deliveryNotes: [
          {
            id: 1,
            deliveryDate: new Date(),
            receivedBy: 'John Doe',
            notes: null,
            status: 'CONFIRMED' as const,
            purchaseOrderId: 1,
            vendorId: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 1,
            items: [
              {
                id: 1,
                deliveryNoteId: 1,
                itemId: 1,
                quantityOrdered: 15,
                quantityDelivered: 10,
                condition: 'GOOD' as const,
                discrepancyReason: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.mismatchCount).toBe(1);
      expect(result.details.mismatches[0].itemId).toBe(1);
      expect(result.details.mismatches[0].invoicedQuantity).toBe(15);
      expect(result.details.mismatches[0].deliveredQuantity).toBe(10);
      expect(result.details.mismatches[0].excess).toBe(5);
    });

    it('should pass when invoice quantity matches delivered quantity', async () => {
      const rule = new DeliveryNoteMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 100, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        deliveryNotes: [
          {
            id: 1,
            deliveryDate: new Date(),
            receivedBy: 'John Doe',
            notes: null,
            status: 'CONFIRMED' as const,
            purchaseOrderId: 1,
            vendorId: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 1,
            items: [
              {
                id: 1,
                deliveryNoteId: 1,
                itemId: 1,
                quantityOrdered: 10,
                quantityDelivered: 10,
                condition: 'GOOD' as const,
                discrepancyReason: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should aggregate quantities from multiple delivery notes', async () => {
      const rule = new DeliveryNoteMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 15, price: 100, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        deliveryNotes: [
          {
            id: 1,
            deliveryDate: new Date(),
            receivedBy: 'John Doe',
            notes: null,
            status: 'CONFIRMED' as const,
            purchaseOrderId: 1,
            vendorId: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 1,
            items: [
              {
                id: 1,
                deliveryNoteId: 1,
                itemId: 1,
                quantityOrdered: 10,
                quantityDelivered: 8, // First delivery: 8
                condition: 'GOOD' as const,
                discrepancyReason: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          },
          {
            id: 2,
            deliveryDate: new Date(),
            receivedBy: 'Jane Smith',
            notes: null,
            status: 'CONFIRMED' as const,
            purchaseOrderId: 1,
            vendorId: 10,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 1,
            items: [
              {
                id: 2,
                deliveryNoteId: 2,
                itemId: 1,
                quantityOrdered: 10,
                quantityDelivered: 7, // Second delivery: 7 (total: 15)
                condition: 'GOOD' as const,
                discrepancyReason: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should pass when no delivery notes are linked', async () => {
      const rule = new DeliveryNoteMismatchRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 100, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        deliveryNotes: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No delivery notes');
    });
  });

  // ==========================================================================
  // PriceVarianceRule
  // ==========================================================================
  describe('PriceVarianceRule', () => {
    it('should fail when price variance exceeds threshold', async () => {
      const rule = new PriceVarianceRule({
        enabled: true,
        variancePercent: 15,
        historicalCount: 5
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 150, item: {} as any } // 50% higher than avg
        ]
      };

      const context: Partial<ValidationContext> = {
        priceHistory: [
          { id: 1, itemId: 1, price: 100, date: new Date('2024-01-01') },
          { id: 2, itemId: 1, price: 100, date: new Date('2024-01-05') },
          { id: 3, itemId: 1, price: 100, date: new Date('2024-01-10') },
          { id: 4, itemId: 1, price: 100, date: new Date('2024-01-15') },
          { id: 5, itemId: 1, price: 100, date: new Date('2024-01-20') }
          // Average: 100, Current: 150, Variance: 50%
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.varianceCount).toBe(1);
      expect(result.details.variances[0].currentPrice).toBe(150);
      expect(result.details.variances[0].averagePrice).toBe(100);
      expect(result.details.variances[0].variancePercent).toBe(50);
    });

    it('should pass when price variance is within threshold', async () => {
      const rule = new PriceVarianceRule({
        enabled: true,
        variancePercent: 15
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 105, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        priceHistory: [
          { id: 1, itemId: 1, price: 100, date: new Date('2024-01-01') },
          { id: 2, itemId: 1, price: 100, date: new Date('2024-01-05') },
          { id: 3, itemId: 1, price: 100, date: new Date('2024-01-10') }
          // Average: 100, Current: 105, Variance: 5%
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
    });

    it('should use most recent prices when calculating average', async () => {
      const rule = new PriceVarianceRule({
        enabled: true,
        variancePercent: 15,
        historicalCount: 3 // Only use 3 most recent
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 105, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        priceHistory: [
          { id: 1, itemId: 1, price: 50, date: new Date('2024-01-01') },  // Oldest (ignored)
          { id: 2, itemId: 1, price: 60, date: new Date('2024-01-05') },  // Ignored
          { id: 3, itemId: 1, price: 100, date: new Date('2024-01-10') }, // Used
          { id: 4, itemId: 1, price: 100, date: new Date('2024-01-15') }, // Used
          { id: 5, itemId: 1, price: 100, date: new Date('2024-01-20') }  // Used (most recent)
          // Recent avg: 100, not 70
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      // Variance should be 5% (105 vs 100), not 50% (105 vs 70)
    });

    it('should pass when no price history available', async () => {
      const rule = new PriceVarianceRule({ enabled: true });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 1000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 100, item: {} as any }
        ]
      };

      const context: Partial<ValidationContext> = {
        priceHistory: []
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(true);
      expect(result.details.reason).toContain('No historical price data');
    });

    it('should handle multiple items with different variances', async () => {
      const rule = new PriceVarianceRule({
        enabled: true,
        variancePercent: 15
      });

      const invoice: Partial<InvoiceWithRelations> = {
        id: 1,
        invoiceNumber: 'INV-001',
        totalAmount: 2000,
        items: [
          { id: 1, invoiceId: 1, itemId: 1, quantity: 10, price: 150, item: {} as any }, // 50% variance (fail)
          { id: 2, invoiceId: 1, itemId: 2, quantity: 5, price: 105, item: {} as any }   // 5% variance (pass)
        ]
      };

      const context: Partial<ValidationContext> = {
        priceHistory: [
          // Item 1 history
          { id: 1, itemId: 1, price: 100, date: new Date('2024-01-01') },
          { id: 2, itemId: 1, price: 100, date: new Date('2024-01-05') },
          // Item 2 history
          { id: 3, itemId: 2, price: 100, date: new Date('2024-01-01') },
          { id: 4, itemId: 2, price: 100, date: new Date('2024-01-05') }
        ]
      };

      const result = await rule.validate(invoice as InvoiceWithRelations, context as ValidationContext);

      expect(result.isPassed()).toBe(false);
      expect(result.details.varianceCount).toBe(1);
      expect(result.details.variances[0].itemId).toBe(1);
    });
  });
});
