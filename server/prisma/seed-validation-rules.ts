import { PrismaClient, ValidationRuleType, ValidationSeverity } from '@prisma/client';

const prisma = new PrismaClient();

const defaultRules = [
  {
    ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
    name: 'Duplicate Invoice Number',
    description: 'Prevents same invoice number from same vendor',
    enabled: true,
    severity: ValidationSeverity.CRITICAL,
    config: {}
  },
  {
    ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
    name: 'Missing Invoice Number',
    description: 'Warns when invoice number is not provided',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: {}
  },
  {
    ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
    name: 'Amount Threshold Exceeded',
    description: 'Flags invoices above configured amount',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: { threshold: 10000 }
  },
  {
    ruleType: ValidationRuleType.ROUND_AMOUNT_PATTERN,
    name: 'Round Amount Pattern',
    description: 'Detects suspiciously round invoice amounts',
    enabled: true,
    severity: ValidationSeverity.INFO,
    config: { minimumAmount: 1000 }
  },
  {
    ruleType: ValidationRuleType.PO_AMOUNT_VARIANCE,
    name: 'Purchase Order Amount Variance',
    description: 'Flags invoices with significant variance from PO amount',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: { variancePercent: 10 }
  },
  {
    ruleType: ValidationRuleType.PO_ITEM_MISMATCH,
    name: 'Purchase Order Item Mismatch',
    description: 'Detects invoice items not present in purchase order',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: {}
  },
  {
    ruleType: ValidationRuleType.DELIVERY_NOTE_MISMATCH,
    name: 'Delivery Note Mismatch',
    description: 'Detects invoice quantity exceeding delivered quantity',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: {}
  },
  {
    ruleType: ValidationRuleType.PRICE_VARIANCE,
    name: 'Price Variance',
    description: 'Detects items priced significantly different from historical average',
    enabled: true,
    severity: ValidationSeverity.INFO,
    config: { variancePercent: 15, historicalCount: 5 }
  }
];

export async function seedValidationRules() {
  console.log('Seeding validation rules...');

  for (const rule of defaultRules) {
    await prisma.validationRule.upsert({
      where: { ruleType: rule.ruleType },
      update: {
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        severity: rule.severity,
        config: rule.config
      },
      create: rule
    });
    console.log(`✓ Seeded rule: ${rule.name}`);
  }

  console.log('✓ All 8 validation rules seeded successfully');
}

// Allow running standalone
if (require.main === module) {
  seedValidationRules()
    .catch((e) => {
      console.error('Error seeding validation rules:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
