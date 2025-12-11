# Invoice Validation System - Technical Implementation Plan

**Project**: SME Procurement-to-Payment Management
**Feature**: Invoice Validation & Fraud Detection
**Created**: 2025-12-10
**Status**: Ready for Implementation
**Estimated Effort**: 4 weeks (1 developer) | 2 weeks (2 developers)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Codebase Analysis](#codebase-analysis)
3. [Technical Architecture](#technical-architecture)
4. [Database Design](#database-design)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Integration Points](#integration-points)
8. [Testing Strategy](#testing-strategy)
9. [Task Breakdown](#task-breakdown)
10. [Risks & Mitigations](#risks--mitigations)

---

## 1. Executive Summary

### Objective
Implement a comprehensive invoice validation system to prevent duplicate invoices and detect suspicious patterns in real-time, with user override capabilities and audit trails.

### Core Features
- **Duplicate Prevention**: Block invoices with same number from same vendor
- **Suspicious Detection**: 8 rule-based checks for anomaly detection
- **Review Workflow**: Flagged invoices dashboard with override capability
- **Admin Configuration**: Enable/disable rules, adjust thresholds
- **Audit Trail**: Complete history of validations and overrides

### Success Criteria
- ✅ Zero duplicate invoices in production
- ✅ <500ms validation time per invoice
- ✅ >80% test coverage
- ✅ WCAG AA accessibility compliance
- ✅ Complete audit logging

---

## 2. Codebase Analysis

### 2.1 Current Architecture

**Backend Structure:**
```
server/src/
├── routes/          → Express route handlers (thin layer)
├── services/        → Business logic (framework-independent)
├── middleware/      → Auth, validation, authorization
├── schemas.ts       → Zod validation schemas
├── prisma.ts        → Prisma client singleton
└── subscribers/     → Event-driven handlers
```

**Frontend Structure:**
```
client/src/
├── pages/           → Page components (route-level)
├── components/      → Reusable UI components
│   └── ui/          → shadcn/ui primitives
├── services/        → API client modules
├── context/         → React Context (AuthContext)
└── lib/api.ts       → Axios with auth interceptor
```

### 2.2 Existing Patterns to Follow

**Service Layer Pattern:**
```typescript
// Existing pattern in invoiceService.ts
export const getInvoices = async (filters, pagination) => {
  const validated = schema.parse(filters);
  const result = await prisma.invoice.findMany({ ... });
  return { data, pagination };
};
```

**Route Handler Pattern:**
```typescript
// Existing pattern in routes/invoices.ts
router.get('/',
  authenticateToken,
  authorize(Permission.INVOICE_READ),
  async (req, res) => {
    const result = await service.getInvoices(filters, pagination);
    res.json(result);
  }
);
```

**PubSub Event Pattern:**
```typescript
// Existing pattern in pubsub.ts
pubsub.publish(PubSubService.INVOICE_APPROVED, invoice.id);

// Subscriber
pubsub.subscribe(PubSubService.INVOICE_APPROVED, async (invoiceId) => {
  // Handle event
});
```

### 2.3 Key Findings

**Existing Infrastructure:**
- ✅ PubSub event system ready for validation hooks
- ✅ AuditLog model exists for tracking
- ✅ Permission system with role-based access
- ✅ Soft delete pattern (`deletedAt`)
- ✅ Transaction support for atomicity

**Current Limitations:**
- ❌ No `invoiceNumber` field on Invoice model
- ❌ No direct `vendorId` on Invoice (resolved through items)
- ❌ Existing `validationService.ts` is only for entity existence checks

**Required Changes:**
- Add `invoiceNumber` and `vendorId` to Invoice model
- Create new validation domain models
- Rename existing `validationService.ts` to `entityValidationService.ts`
- Add INVOICE_CREATED event to PubSub

---

## 3. Technical Architecture

### 3.1 Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│ Presentation Layer (Routes)                             │
│ - REST API endpoints                                    │
│ - Request/Response validation                           │
│ - Authentication & Authorization                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Application Layer (Services)                            │
│ - validationService.ts (Facade)                         │
│ - Orchestrates domain logic                             │
│ - Handles transactions                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Domain Layer (Business Logic)                           │
│ - ValidationOrchestrator (coordinates rules)            │
│ - DuplicateDetector (duplicate logic)                   │
│ - SuspiciousDetector (anomaly rules)                    │
│ - Individual rule implementations (8 rules)             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Infrastructure Layer (Persistence)                      │
│ - Prisma repositories                                   │
│ - Database access                                       │
│ - External service adapters                             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Domain Model (DDD)

**Aggregates:**

```typescript
// Invoice Aggregate (Extended)
Invoice {
  id: number
  invoiceNumber?: string  // NEW
  vendorId: number        // NEW (denormalized)
  date: DateTime
  status: InvoiceStatus
  totalAmount: number
  items: InvoiceItem[]
  validations: InvoiceValidation[]  // NEW

  // Invariants:
  // - totalAmount = sum(items.price × items.quantity)
  // - items.length > 0
  // - status transitions: PENDING → (APPROVED | REJECTED)
}

// InvoiceValidation Aggregate (NEW)
InvoiceValidation {
  id: number
  invoiceId: number
  ruleType: ValidationRuleType
  severity: ValidationSeverity
  status: ValidationStatus
  details: JSON
  override?: ValidationOverride

  // Invariants:
  // - One override max
  // - Override requires reason (min 10 chars)
  // - Status: FLAGGED → REVIEWED → (DISMISSED | OVERRIDDEN)
}
```

**Value Objects:**

```typescript
enum ValidationRuleType {
  DUPLICATE_INVOICE_NUMBER = 'DUPLICATE_INVOICE_NUMBER',
  MISSING_INVOICE_NUMBER = 'MISSING_INVOICE_NUMBER',
  AMOUNT_THRESHOLD_EXCEEDED = 'AMOUNT_THRESHOLD_EXCEEDED',
  ROUND_AMOUNT_PATTERN = 'ROUND_AMOUNT_PATTERN',
  PO_AMOUNT_VARIANCE = 'PO_AMOUNT_VARIANCE',
  PO_ITEM_MISMATCH = 'PO_ITEM_MISMATCH',
  DELIVERY_NOTE_MISMATCH = 'DELIVERY_NOTE_MISMATCH',
  PRICE_VARIANCE = 'PRICE_VARIANCE'
}

enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

enum ValidationStatus {
  FLAGGED = 'FLAGGED',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  OVERRIDDEN = 'OVERRIDDEN'
}
```

**Domain Events:**

```typescript
INVOICE_CREATED          → Triggers validation
INVOICE_VALIDATED        → Validation complete
DUPLICATE_DETECTED       → Duplicate found
SUSPICIOUS_DETECTED      → Anomaly detected
VALIDATION_OVERRIDDEN    → User override
```

### 3.3 Validation Rules Engine

**Rule Interface:**

```typescript
interface IValidationRule {
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  enabled: boolean;

  validate(invoice: Invoice, context: ValidationContext): Promise<ValidationResult>;
}

interface ValidationContext {
  purchaseOrder?: PurchaseOrder;
  deliveryNotes?: DeliveryNote[];
  historicalInvoices?: Invoice[];
  priceHistory?: ItemPriceHistory[];
}

interface ValidationResult {
  passed: boolean;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

**8 Rules to Implement:**

1. **DuplicateInvoiceNumberRule** (CRITICAL)
   - Check: Same invoiceNumber + vendorId exists
   - Query: `Invoice.findFirst({ invoiceNumber, vendorId, deletedAt: null })`
   - Block: Approval workflow

2. **MissingInvoiceNumberRule** (WARNING)
   - Check: invoiceNumber is null/empty
   - Simple: `!invoice.invoiceNumber`

3. **AmountThresholdExceededRule** (WARNING)
   - Check: totalAmount > configurable threshold
   - Config: `{ threshold: 10000 }` (default)

4. **RoundAmountPatternRule** (INFO)
   - Check: totalAmount is round number (e.g., 1000, 5000)
   - Pattern: `totalAmount % 100 === 0 && totalAmount >= configurable min`

5. **POAmountVarianceRule** (WARNING)
   - Check: |invoice.totalAmount - PO.totalAmount| > threshold %
   - Requires: purchaseOrderId
   - Config: `{ variancePercent: 10 }` (default)

6. **POItemMismatchRule** (WARNING)
   - Check: Invoice items not in PO items
   - Requires: purchaseOrderId
   - Compare: InvoiceItem.itemId vs PurchaseOrderItem.itemId

7. **DeliveryNoteMismatchRule** (WARNING)
   - Check: Invoice quantity > delivered quantity
   - Requires: Linked delivery notes
   - Compare: InvoiceItem.quantity vs DeliveryNoteItem.quantityDelivered

8. **PriceVarianceRule** (INFO)
   - Check: Item price differs from historical average by X%
   - Config: `{ variancePercent: 15 }` (default)
   - Query: ItemPriceHistory for last N records

---

## 4. Database Design

### 4.1 Schema Changes

**Invoice Model Updates:**

```prisma
model Invoice {
  id              Int      @id @default(autoincrement())
  invoiceNumber   String?  // NEW: Invoice number from vendor
  vendorId        Int?     // NEW: Denormalized for performance
  date            DateTime @default(now())
  status          String   @default("PENDING")
  totalAmount     Float    @default(0)
  // ... existing fields ...

  validations     InvoiceValidation[]  // NEW: relation

  @@unique([invoiceNumber, vendorId])  // NEW: Prevent duplicates
  @@index([invoiceNumber])             // NEW: Fast lookup
  @@index([vendorId])                  // NEW: Fast lookup
  @@index([invoiceNumber, vendorId, deletedAt])  // NEW: Composite
}
```

**New Models:**

```prisma
enum ValidationRuleType {
  DUPLICATE_INVOICE_NUMBER
  MISSING_INVOICE_NUMBER
  AMOUNT_THRESHOLD_EXCEEDED
  ROUND_AMOUNT_PATTERN
  PO_AMOUNT_VARIANCE
  PO_ITEM_MISMATCH
  DELIVERY_NOTE_MISMATCH
  PRICE_VARIANCE
}

enum ValidationSeverity {
  INFO
  WARNING
  CRITICAL
}

enum ValidationStatus {
  FLAGGED
  REVIEWED
  DISMISSED
  OVERRIDDEN
}

model InvoiceValidation {
  id          Int                  @id @default(autoincrement())
  invoiceId   Int
  invoice     Invoice              @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  ruleType    ValidationRuleType
  severity    ValidationSeverity
  status      ValidationStatus     @default(FLAGGED)
  details     Json                 // Flexible validation details
  metadata    Json?                // Additional context

  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  reviewedAt  DateTime?
  reviewedBy  Int?

  override    ValidationOverride?

  @@index([invoiceId])
  @@index([status])
  @@index([severity])
  @@index([ruleType])
  @@index([invoiceId, status])
  @@index([status, severity, createdAt])  // Dashboard queries
}

model ValidationRule {
  id          Int                  @id @default(autoincrement())
  ruleType    ValidationRuleType   @unique
  name        String
  description String
  enabled     Boolean              @default(true)
  severity    ValidationSeverity   @default(WARNING)
  config      Json?                // Rule-specific configuration

  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([enabled])
}

model ValidationOverride {
  id           Int               @id @default(autoincrement())
  validationId Int               @unique
  validation   InvoiceValidation @relation(fields: [validationId], references: [id], onDelete: Cascade)

  userId       Int
  user         User              @relation(fields: [userId], references: [id])
  reason       String            // Min 10 chars, required

  createdAt    DateTime          @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

**User Model Update:**

```prisma
model User {
  // ... existing fields ...
  validationOverrides ValidationOverride[]  // NEW
}
```

### 4.2 Migration Strategy

```bash
# 1. Create migration
npx prisma migrate dev --name add-invoice-validation

# 2. Seed validation rules
npx ts-node prisma/seed-validation-rules.ts

# 3. Backfill vendorId (optional, for existing invoices)
npx ts-node scripts/backfill-vendor-ids.ts
```

**Seed Data (8 Rules):**

```typescript
const defaultRules = [
  {
    ruleType: 'DUPLICATE_INVOICE_NUMBER',
    name: 'Duplicate Invoice Number',
    description: 'Prevents same invoice number from same vendor',
    enabled: true,
    severity: 'CRITICAL',
    config: {}
  },
  {
    ruleType: 'MISSING_INVOICE_NUMBER',
    name: 'Missing Invoice Number',
    description: 'Warns when invoice number is not provided',
    enabled: true,
    severity: 'WARNING',
    config: {}
  },
  {
    ruleType: 'AMOUNT_THRESHOLD_EXCEEDED',
    name: 'Amount Threshold Exceeded',
    description: 'Flags invoices above configured amount',
    enabled: true,
    severity: 'WARNING',
    config: { threshold: 10000 }
  },
  // ... 5 more rules
];
```

---

## 5. Backend Implementation

### 5.1 Directory Structure (New Files)

```
server/src/
├── domain/
│   └── validation/
│       ├── entities/
│       │   ├── InvoiceValidation.ts
│       │   ├── ValidationRule.ts
│       │   └── ValidationOverride.ts
│       ├── value-objects/
│       │   ├── ValidationSeverity.ts
│       │   ├── ValidationStatus.ts
│       │   └── ValidationResult.ts
│       ├── services/
│       │   ├── IValidationRule.ts (interface)
│       │   ├── ValidationContext.ts
│       │   ├── ValidationOrchestrator.ts
│       │   ├── DuplicateDetector.ts
│       │   └── SuspiciousDetector.ts
│       └── rules/
│           ├── DuplicateInvoiceNumberRule.ts
│           ├── MissingInvoiceNumberRule.ts
│           ├── AmountThresholdExceededRule.ts
│           ├── RoundAmountPatternRule.ts
│           ├── POAmountVarianceRule.ts
│           ├── POItemMismatchRule.ts
│           ├── DeliveryNoteMismatchRule.ts
│           └── PriceVarianceRule.ts
├── services/
│   ├── entityValidationService.ts (renamed from validationService.ts)
│   └── invoiceValidationService.ts (NEW - facade)
├── routes/
│   └── validations.ts (NEW)
├── subscribers/
│   └── invoiceValidation.subscriber.ts (NEW)
└── schemas/
    └── validation/
        ├── invoiceValidation.schema.ts
        ├── validationRule.schema.ts
        └── validationOverride.schema.ts
```

### 5.2 Key Service Implementations

**ValidationOrchestrator (Domain Service):**

```typescript
// server/src/domain/validation/services/ValidationOrchestrator.ts
export class ValidationOrchestrator {
  constructor(
    private duplicateDetector: DuplicateDetector,
    private suspiciousDetector: SuspiciousDetector,
    private prisma: PrismaClient
  ) {}

  async validateInvoice(invoiceId: number): Promise<InvoiceValidationSummary> {
    // 1. Fetch invoice with relations
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: {
        items: { include: { item: true } },
        purchaseOrder: { include: { items: true } },
        deliveryNotes: { include: { deliveryNote: { include: { items: true } } } }
      }
    });

    if (!invoice) throw new Error('Invoice not found');

    // 2. Run duplicate detection (blocking)
    const duplicateResult = await this.duplicateDetector.checkDuplicate(invoice);

    // 3. Run suspicious detection (parallel)
    const suspiciousResults = await this.suspiciousDetector.detectAnomalies(invoice);

    // 4. Combine results
    const allResults = [duplicateResult, ...suspiciousResults];
    const failedResults = allResults.filter(r => !r.passed);

    // 5. Persist to database
    await this.prisma.invoiceValidation.createMany({
      data: failedResults.map(result => ({
        invoiceId,
        ruleType: result.ruleType,
        severity: result.severity,
        status: 'FLAGGED',
        details: result.details,
        metadata: result.metadata
      }))
    });

    // 6. Publish events
    if (duplicateResult.passed === false) {
      pubsub.publish(PubSubService.DUPLICATE_DETECTED, { invoiceId });
    }
    if (suspiciousResults.some(r => !r.passed)) {
      pubsub.publish(PubSubService.SUSPICIOUS_DETECTED, { invoiceId });
    }

    // 7. Return summary
    return {
      invoiceId,
      isValid: failedResults.length === 0,
      hasBlockingIssues: failedResults.some(r => r.severity === 'CRITICAL'),
      flagCount: failedResults.length,
      highestSeverity: this.getHighestSeverity(failedResults),
      validations: allResults
    };
  }
}
```

**DuplicateDetector:**

```typescript
// server/src/domain/validation/services/DuplicateDetector.ts
export class DuplicateDetector {
  constructor(private prisma: PrismaClient) {}

  async checkDuplicate(invoice: Invoice): Promise<ValidationResult> {
    if (!invoice.invoiceNumber || !invoice.vendorId) {
      return {
        ruleType: 'DUPLICATE_INVOICE_NUMBER',
        severity: 'CRITICAL',
        passed: true,
        details: { reason: 'No invoice number or vendor to check' }
      };
    }

    const duplicate = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: invoice.invoiceNumber,
        vendorId: invoice.vendorId,
        deletedAt: null,
        id: { not: invoice.id }  // Exclude self
      }
    });

    return {
      ruleType: 'DUPLICATE_INVOICE_NUMBER',
      severity: 'CRITICAL',
      passed: !duplicate,
      details: duplicate
        ? { duplicateInvoiceId: duplicate.id, duplicateDate: duplicate.date }
        : { reason: 'No duplicate found' }
    };
  }
}
```

**InvoiceValidationService (Facade):**

```typescript
// server/src/services/invoiceValidationService.ts
export const validateInvoice = async (invoiceId: number) => {
  const orchestrator = new ValidationOrchestrator(
    new DuplicateDetector(prisma),
    new SuspiciousDetector(prisma),
    prisma
  );
  return orchestrator.validateInvoice(invoiceId);
};

export const getValidationSummary = async (invoiceId: number) => {
  const validations = await prisma.invoiceValidation.findMany({
    where: { invoiceId },
    include: { override: { include: { user: true } } },
    orderBy: { severity: 'desc' }
  });

  return {
    invoiceId,
    flagCount: validations.length,
    hasBlockingIssues: validations.some(v =>
      v.severity === 'CRITICAL' && v.status === 'FLAGGED'
    ),
    validations
  };
};

export const getFlaggedInvoices = async (filters, pagination) => {
  const { severity, status, startDate, endDate } = filters;
  const { skip, limit } = parsePagination(pagination);

  const where: Prisma.InvoiceValidationWhereInput = {};
  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [validations, total] = await prisma.$transaction([
    prisma.invoiceValidation.findMany({
      where,
      include: {
        invoice: {
          include: {
            items: { include: { item: { include: { vendor: true } } } }
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoiceValidation.count({ where })
  ]);

  return { data: validations, total };
};

export const overrideValidation = async (
  validationId: number,
  userId: number,
  reason: string
) => {
  if (reason.length < 10) {
    throw new Error('Override reason must be at least 10 characters');
  }

  return prisma.$transaction(async (tx) => {
    // Update validation status
    const validation = await tx.invoiceValidation.update({
      where: { id: validationId },
      data: { status: 'OVERRIDDEN' }
    });

    // Create override record
    const override = await tx.validationOverride.create({
      data: { validationId, userId, reason }
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'VALIDATION_OVERRIDDEN',
        entity: 'InvoiceValidation',
        entityId: validationId,
        changes: JSON.stringify({ reason })
      }
    });

    pubsub.publish(PubSubService.VALIDATION_OVERRIDDEN, { validationId, userId });

    return { validation, override };
  });
};
```

### 5.3 Invoice Service Integration

**Update createInvoice:**

```typescript
// server/src/services/invoiceService.ts
export const createInvoice = async (invoiceData: CreateInvoiceInput, userId: number) => {
  const validated = createInvoiceSchema.parse(invoiceData);
  const { items, project, branchId, departmentId, costCenterId, invoiceNumber } = validated;

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Extract vendorId (denormalized for performance)
  const firstItem = await prisma.item.findUnique({
    where: { id: items[0].itemId },
    select: { vendorId: true }
  });
  const vendorId = firstItem?.vendorId;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,     // NEW
      vendorId,          // NEW
      totalAmount,
      userId,
      project,
      branchId,
      departmentId,
      costCenterId,
      items: {
        create: items.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price
        }))
      }
    },
    include: { items: true }
  });

  invoicesCreated.inc();

  // Publish event for async validation
  pubsub.publish(PubSubService.INVOICE_CREATED, invoice.id);

  return invoice;
};
```

**Update approveInvoice:**

```typescript
export const approveInvoice = async (invoiceId: number) => {
  // Check for blocking validations
  const blockingValidations = await prisma.invoiceValidation.findFirst({
    where: {
      invoiceId,
      severity: 'CRITICAL',
      status: 'FLAGGED'  // Not overridden or dismissed
    }
  });

  if (blockingValidations) {
    throw new Error(
      'Cannot approve invoice with critical validation issues. ' +
      'Please review and override if necessary.'
    );
  }

  // Proceed with approval
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'APPROVED' },
    include: { items: { include: { item: { include: { vendor: true } } } } }
  });

  invoicesApproved.inc();
  pubsub.publish(PubSubService.INVOICE_APPROVED, invoice.id);

  return invoice;
};
```

### 5.4 REST API Endpoints

**Routes: /api/validations**

```typescript
// server/src/routes/validations.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import * as validationService from '../services/invoiceValidationService';

const router = express.Router();

router.use(authenticateToken);

// GET /api/validations/flagged - List flagged invoices
router.get('/flagged', authorize(Permission.VALIDATION_READ), async (req, res) => {
  const { severity, status, startDate, endDate, page, limit } = req.query;
  try {
    const result = await validationService.getFlaggedInvoices(
      { severity, status, startDate, endDate },
      { page, limit }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve flagged invoices' });
  }
});

// GET /api/validations/invoices/:invoiceId - Get validation summary
router.get('/invoices/:invoiceId', authorize(Permission.VALIDATION_READ), async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const summary = await validationService.getValidationSummary(Number(invoiceId));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve validation summary' });
  }
});

// POST /api/validations/:validationId/override - Override validation
router.post('/:validationId/override',
  authorize(Permission.VALIDATION_OVERRIDE),
  async (req: AuthRequest, res) => {
    const { validationId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        error: 'Override reason is required (minimum 10 characters)'
      });
    }

    try {
      const result = await validationService.overrideValidation(
        Number(validationId),
        userId!,
        reason
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to override validation' });
    }
  }
);

// PUT /api/validations/:validationId/review - Review validation
router.put('/:validationId/review',
  authorize(Permission.VALIDATION_READ),
  async (req: AuthRequest, res) => {
    const { validationId } = req.params;
    const { action } = req.body; // 'DISMISS' | 'ESCALATE'

    try {
      const result = await validationService.reviewValidation(
        Number(validationId),
        req.user?.userId!,
        action
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to review validation' });
    }
  }
);

// POST /api/validations/invoices/:invoiceId/revalidate - Trigger revalidation
router.post('/invoices/:invoiceId/revalidate',
  authorize(Permission.VALIDATION_REVALIDATE),
  async (req, res) => {
    const { invoiceId } = req.params;

    try {
      // Delete existing validations
      await prisma.invoiceValidation.deleteMany({
        where: { invoiceId: Number(invoiceId) }
      });

      // Run validation again
      const result = await validationService.validateInvoice(Number(invoiceId));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to revalidate invoice' });
    }
  }
);

// GET /api/validations/rules - List validation rules
router.get('/rules', authorize(Permission.VALIDATION_READ), async (req, res) => {
  try {
    const rules = await prisma.validationRule.findMany({
      orderBy: { ruleType: 'asc' }
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve rules' });
  }
});

// PATCH /api/validations/rules/:ruleId - Update rule configuration
router.patch('/rules/:ruleId',
  authorize(Permission.VALIDATION_CONFIGURE),
  async (req, res) => {
    const { ruleId } = req.params;
    const { enabled, severity, config } = req.body;

    try {
      const rule = await prisma.validationRule.update({
        where: { id: Number(ruleId) },
        data: { enabled, severity, config }
      });
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update rule' });
    }
  }
);

// GET /api/validations/dashboard/stats - Dashboard statistics
router.get('/dashboard/stats', authorize(Permission.VALIDATION_READ), async (req, res) => {
  try {
    const [totalFlagged, bySeverity, byStatus, recentFlags] = await Promise.all([
      prisma.invoiceValidation.count({ where: { status: 'FLAGGED' } }),

      prisma.invoiceValidation.groupBy({
        by: ['severity'],
        where: { status: 'FLAGGED' },
        _count: true
      }),

      prisma.invoiceValidation.groupBy({
        by: ['status'],
        _count: true
      }),

      prisma.invoiceValidation.findMany({
        where: { status: 'FLAGGED' },
        include: { invoice: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      totalFlagged,
      bySeverity,
      byStatus,
      recentFlags
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

export default router;
```

### 5.5 Event Subscriber

```typescript
// server/src/subscribers/invoiceValidation.subscriber.ts
import pubsub, { PubSubService } from '../services/pubsub';
import * as validationService from '../services/invoiceValidationService';
import { logger } from '../utils/logger';

export const initializeValidationSubscribers = () => {
  // Subscribe to INVOICE_CREATED event
  pubsub.subscribe(PubSubService.INVOICE_CREATED, async (invoiceId: number) => {
    try {
      logger.info({ invoiceId }, 'Running validation for new invoice');
      await validationService.validateInvoice(invoiceId);
    } catch (error) {
      logger.error({ err: error, invoiceId }, 'Invoice validation failed');
    }
  });

  logger.info('Invoice validation subscribers initialized');
};
```

**Register in server/src/index.ts:**

```typescript
import { initializeValidationSubscribers } from './subscribers/invoiceValidation.subscriber';

// ... after app setup
initializeValidationSubscribers();
```

### 5.6 Permissions Update

```typescript
// server/src/constants/permissions.ts
export enum Permission {
  // ... existing permissions ...

  // Validation permissions
  VALIDATION_READ = 'VALIDATION_READ',
  VALIDATION_OVERRIDE = 'VALIDATION_OVERRIDE',
  VALIDATION_CONFIGURE = 'VALIDATION_CONFIGURE',
  VALIDATION_REVALIDATE = 'VALIDATION_REVALIDATE',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // ... all existing permissions ...
    Permission.VALIDATION_READ,
    Permission.VALIDATION_OVERRIDE,
    Permission.VALIDATION_CONFIGURE,
    Permission.VALIDATION_REVALIDATE,
  ],

  [UserRole.MANAGER]: [
    // ... existing permissions ...
    Permission.VALIDATION_READ,
    Permission.VALIDATION_OVERRIDE,
    Permission.VALIDATION_REVALIDATE,
  ],

  [UserRole.USER]: [
    // ... existing permissions ...
    Permission.VALIDATION_READ,
  ],

  [UserRole.VIEWER]: [
    // ... existing permissions ...
    Permission.VALIDATION_READ,
  ],
};
```

### 5.7 Zod Schemas

```typescript
// server/src/schemas.ts (additions)
export const ValidationSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export const ValidationStatusSchema = z.enum(['FLAGGED', 'REVIEWED', 'DISMISSED', 'OVERRIDDEN']);

export const OverrideValidationSchema = z.object({
  reason: sanitizedString(500).refine(v => v.length >= 10,
    'Override reason must be at least 10 characters'
  ),
});
export type OverrideValidationInput = z.infer<typeof OverrideValidationSchema>;

export const GetFlaggedInvoicesFiltersSchema = z.object({
  severity: ValidationSeveritySchema.optional(),
  status: ValidationStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).partial();
export type GetFlaggedInvoicesFiltersInput = z.infer<typeof GetFlaggedInvoicesFiltersSchema>;

export const UpdateValidationRuleSchema = z.object({
  enabled: z.boolean().optional(),
  severity: ValidationSeveritySchema.optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateValidationRuleInput = z.infer<typeof UpdateValidationRuleSchema>;

// Update CreateInvoiceSchema
export const createInvoiceSchema = z.object({
  invoiceNumber: optionalSanitizedString(100),  // NEW
  items: z.array(z.object({
    itemId: z.number(),
    quantity: z.number(),
    price: z.number(),
  })),
  project: optionalSanitizedString(255),
  branchId: z.number().optional(),
  departmentId: z.number().optional(),
  costCenterId: z.number().optional(),
});
```

---

## 6. Frontend Implementation

### 6.1 Type Definitions

```typescript
// client/src/types/validation.ts
export enum ValidationRuleType {
  DUPLICATE_INVOICE_NUMBER = 'DUPLICATE_INVOICE_NUMBER',
  MISSING_INVOICE_NUMBER = 'MISSING_INVOICE_NUMBER',
  AMOUNT_THRESHOLD_EXCEEDED = 'AMOUNT_THRESHOLD_EXCEEDED',
  ROUND_AMOUNT_PATTERN = 'ROUND_AMOUNT_PATTERN',
  PO_AMOUNT_VARIANCE = 'PO_AMOUNT_VARIANCE',
  PO_ITEM_MISMATCH = 'PO_ITEM_MISMATCH',
  DELIVERY_NOTE_MISMATCH = 'DELIVERY_NOTE_MISMATCH',
  PRICE_VARIANCE = 'PRICE_VARIANCE'
}

export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum ValidationStatus {
  FLAGGED = 'FLAGGED',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  OVERRIDDEN = 'OVERRIDDEN'
}

export interface InvoiceValidation {
  id: number;
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  status: ValidationStatus;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  override?: ValidationOverride;
}

export interface ValidationOverride {
  id: number;
  validationId: number;
  userId: number;
  reason: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  name: string;
  description: string;
  enabled: boolean;
  severity: ValidationSeverity;
  config?: Record<string, unknown>;
}

export interface InvoiceValidationSummary {
  invoiceId: number;
  flagCount: number;
  hasBlockingIssues: boolean;
  validations: InvoiceValidation[];
}

export interface ValidationDashboardStats {
  totalFlagged: number;
  bySeverity: { severity: ValidationSeverity; _count: number }[];
  byStatus: { status: ValidationStatus; _count: number }[];
  recentFlags: InvoiceValidation[];
}
```

### 6.2 API Service

```typescript
// client/src/services/validationService.ts
import api from '../lib/api';
import { InvoiceValidation, ValidationRule, InvoiceValidationSummary, ValidationDashboardStats } from '../types/validation';

export const getFlaggedInvoices = async (filters: {
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, String(value));
  });

  const response = await api.get(`/validations/flagged?${params}`);
  return response.data;
};

export const getValidationSummary = async (invoiceId: number): Promise<InvoiceValidationSummary> => {
  const response = await api.get(`/validations/invoices/${invoiceId}`);
  return response.data;
};

export const overrideValidation = async (validationId: number, reason: string) => {
  const response = await api.post(`/validations/${validationId}/override`, { reason });
  return response.data;
};

export const reviewValidation = async (validationId: number, action: 'DISMISS' | 'ESCALATE') => {
  const response = await api.put(`/validations/${validationId}/review`, { action });
  return response.data;
};

export const revalidateInvoice = async (invoiceId: number) => {
  const response = await api.post(`/validations/invoices/${invoiceId}/revalidate`);
  return response.data;
};

export const getValidationRules = async (): Promise<ValidationRule[]> => {
  const response = await api.get('/validations/rules');
  return response.data;
};

export const updateValidationRule = async (ruleId: number, data: {
  enabled?: boolean;
  severity?: string;
  config?: Record<string, unknown>;
}) => {
  const response = await api.patch(`/validations/rules/${ruleId}`, data);
  return response.data;
};

export const getDashboardStats = async (): Promise<ValidationDashboardStats> => {
  const response = await api.get('/validations/dashboard/stats');
  return response.data;
};
```

### 6.3 Key Components

**ValidationAlert Component:**

```typescript
// client/src/components/validations/ValidationAlert.tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvoiceValidation, ValidationSeverity } from '@/types/validation';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ValidationAlertProps {
  validation: InvoiceValidation;
  onOverride?: () => void;
  onDismiss?: () => void;
}

const severityConfig = {
  CRITICAL: { icon: AlertCircle, color: 'destructive', bg: 'bg-red-50' },
  WARNING: { icon: AlertTriangle, color: 'warning', bg: 'bg-yellow-50' },
  INFO: { icon: Info, color: 'info', bg: 'bg-blue-50' }
};

export const ValidationAlert: React.FC<ValidationAlertProps> = ({
  validation,
  onOverride,
  onDismiss
}) => {
  const config = severityConfig[validation.severity];
  const Icon = config.icon;

  return (
    <Alert className={`${config.bg} border-l-4`}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{validation.ruleType.replace(/_/g, ' ')}</span>
        <Badge variant={config.color as any}>{validation.severity}</Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 text-sm">
          {JSON.stringify(validation.details, null, 2)}
        </div>
        {validation.severity === 'CRITICAL' && (
          <div className="mt-3 flex gap-2">
            {onOverride && (
              <Button size="sm" variant="outline" onClick={onOverride}>
                Override
              </Button>
            )}
          </div>
        )}
        {validation.severity === 'WARNING' && onDismiss && (
          <div className="mt-3">
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
```

**OverrideModal Component:**

```typescript
// client/src/components/validations/OverrideModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  validationMessage: string;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  validationMessage
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (reason.length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit(reason);
      onClose();
      setReason('');
    } catch (err) {
      setError('Failed to override validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Validation</DialogTitle>
          <DialogDescription>
            You are about to override a critical validation issue. This action will be logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-yellow-50 p-3 text-sm">
            <strong>Validation Issue:</strong>
            <div className="mt-1 text-muted-foreground">{validationMessage}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Override Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you are overriding this validation (minimum 10 characters)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="rounded-md bg-blue-50 p-3 text-xs text-muted-foreground">
            <strong>Note:</strong> This override will be permanently recorded in the audit log
            and associated with your user account.
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || reason.length < 10}>
            {loading ? 'Overriding...' : 'Confirm Override'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

**FlaggedInvoicesPage:**

```typescript
// client/src/pages/FlaggedInvoices.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ValidationAlert } from '@/components/validations/ValidationAlert';
import { OverrideModal } from '@/components/validations/OverrideModal';
import * as validationService from '@/services/validationService';
import { InvoiceValidation } from '@/types/validation';

export const FlaggedInvoicesPage = () => {
  const [validations, setValidations] = useState<InvoiceValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedValidation, setSelectedValidation] = useState<InvoiceValidation | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flaggedResult, statsResult] = await Promise.all([
        validationService.getFlaggedInvoices({ status: 'FLAGGED' }),
        validationService.getDashboardStats()
      ]);
      setValidations(flaggedResult.data);
      setStats(statsResult);
    } catch (error) {
      console.error('Failed to load flagged invoices', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = (validation: InvoiceValidation) => {
    setSelectedValidation(validation);
    setOverrideModalOpen(true);
  };

  const handleOverrideSubmit = async (reason: string) => {
    if (!selectedValidation) return;

    await validationService.overrideValidation(selectedValidation.id, reason);
    await loadData(); // Reload data
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Flagged Invoices</h1>
        <Badge variant="destructive">{stats?.totalFlagged || 0} Issues</Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats?.bySeverity.map((item: any) => (
          <Card key={item.severity}>
            <CardHeader>
              <CardTitle className="text-sm">{item.severity}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item._count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Validation List */}
      <div className="space-y-4">
        {validations.map((validation) => (
          <Card key={validation.id}>
            <CardContent className="pt-6">
              <ValidationAlert
                validation={validation}
                onOverride={() => handleOverride(validation)}
                onDismiss={() => {/* implement dismiss */}}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Override Modal */}
      {selectedValidation && (
        <OverrideModal
          isOpen={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          onSubmit={handleOverrideSubmit}
          validationMessage={selectedValidation.ruleType}
        />
      )}
    </div>
  );
};
```

**InvoiceDetail Integration:**

```typescript
// client/src/pages/InvoiceDetail.tsx (additions)
import { ValidationAlert } from '@/components/validations/ValidationAlert';
import * as validationService from '@/services/validationService';

// Inside component
const [validationSummary, setValidationSummary] = useState<any>(null);

useEffect(() => {
  if (invoice?.id) {
    validationService.getValidationSummary(invoice.id)
      .then(setValidationSummary)
      .catch(console.error);
  }
}, [invoice?.id]);

// In render, after invoice header:
{validationSummary && validationSummary.flagCount > 0 && (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <span>Validation Issues</span>
        <Badge variant={validationSummary.hasBlockingIssues ? 'destructive' : 'warning'}>
          {validationSummary.flagCount} {validationSummary.flagCount === 1 ? 'Issue' : 'Issues'}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {validationSummary.validations.map((validation: any) => (
        <ValidationAlert
          key={validation.id}
          validation={validation}
          onOverride={() => handleOverride(validation)}
        />
      ))}
    </CardContent>
  </Card>
)}

// Update approve button logic
const handleApprove = async () => {
  if (validationSummary?.hasBlockingIssues) {
    alert('Cannot approve invoice with critical validation issues. Please override first.');
    return;
  }

  // ... existing approval logic
};
```

### 6.4 Routing

```typescript
// client/src/App.tsx (additions)
import { FlaggedInvoicesPage } from './pages/FlaggedInvoices';
import { ValidationRulesPage } from './pages/ValidationRules';

// In Routes:
<Route path="/flagged-invoices" element={
  <ProtectedRoute>
    <FlaggedInvoicesPage />
  </ProtectedRoute>
} />

<Route path="/settings/validation-rules" element={
  <ProtectedRoute requiredRole="ADMIN">
    <ValidationRulesPage />
  </ProtectedRoute>
} />
```

---

## 7. Integration Points

### 7.1 Event Flow

```
User Creates Invoice
        ↓
createInvoice() service
        ↓
INVOICE_CREATED event published
        ↓
ValidationOrchestrator.validateInvoice()
        ↓
├─ DuplicateDetector.checkDuplicate()
└─ SuspiciousDetector.detectAnomalies()
        ↓
Persist InvoiceValidation records
        ↓
INVOICE_VALIDATED event published
        ↓
├─ DUPLICATE_DETECTED (if applicable)
└─ SUSPICIOUS_DETECTED (if applicable)
        ↓
Audit logs created
```

### 7.2 Approval Workflow Integration

```
User Clicks Approve
        ↓
approveInvoice() checks for CRITICAL + FLAGGED validations
        ↓
Found? → Block with error
Not Found? → Proceed with approval
        ↓
INVOICE_APPROVED event
        ↓
Existing accounting sync subscriber
```

### 7.3 Override Workflow

```
User Overrides Validation
        ↓
overrideValidation() service
        ↓
Transaction:
├─ Update validation.status = 'OVERRIDDEN'
├─ Create ValidationOverride record
└─ Create AuditLog entry
        ↓
VALIDATION_OVERRIDDEN event
        ↓
Approval now allowed
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Domain Rules:**
```typescript
// server/src/domain/validation/rules/__tests__/DuplicateInvoiceNumberRule.test.ts
describe('DuplicateInvoiceNumberRule', () => {
  it('should flag duplicate invoice number from same vendor', async () => {
    // Setup: Create existing invoice
    // Execute: Run rule on new invoice with same number
    // Assert: result.passed = false, severity = CRITICAL
  });

  it('should pass for different vendors with same invoice number', async () => {
    // Different vendorId should be allowed
  });

  it('should pass when no invoice number provided', async () => {
    // Null invoice number should skip check
  });
});
```

**Service Layer:**
```typescript
// server/src/services/__tests__/invoiceValidationService.test.ts
describe('InvoiceValidationService', () => {
  describe('validateInvoice', () => {
    it('should create validation records for failed rules', async () => {});
    it('should publish events for duplicates', async () => {});
    it('should handle validation errors gracefully', async () => {});
  });

  describe('overrideValidation', () => {
    it('should require minimum 10 character reason', async () => {});
    it('should create audit log entry', async () => {});
    it('should publish VALIDATION_OVERRIDDEN event', async () => {});
  });
});
```

### 8.2 Integration Tests

```typescript
// server/src/tests/integration/validation.test.ts
describe('Invoice Validation Integration', () => {
  it('should trigger validation on invoice creation', async () => {
    const invoice = await createInvoice({ ... });
    await waitFor(() => {
      const validations = await getValidationSummary(invoice.id);
      expect(validations.flagCount).toBeGreaterThan(0);
    });
  });

  it('should block approval with critical flags', async () => {
    const invoice = await createDuplicateInvoice();
    await expect(approveInvoice(invoice.id)).rejects.toThrow('critical validation');
  });

  it('should allow approval after override', async () => {
    const invoice = await createDuplicateInvoice();
    const validation = await getValidations(invoice.id)[0];
    await overrideValidation(validation.id, userId, 'Valid reason');
    await expect(approveInvoice(invoice.id)).resolves.toBeDefined();
  });
});
```

### 8.3 E2E Tests (Playwright/Cypress)

```typescript
// client/e2e/validation.spec.ts
test('should display validation alert on invoice detail', async ({ page }) => {
  await page.goto('/invoices/123');
  await expect(page.locator('[data-testid="validation-alert"]')).toBeVisible();
  await expect(page.locator('text=CRITICAL')).toBeVisible();
});

test('should override validation with reason', async ({ page }) => {
  await page.goto('/invoices/123');
  await page.click('button:has-text("Override")');
  await page.fill('textarea[name="reason"]', 'This is a valid duplicate from vendor correction');
  await page.click('button:has-text("Confirm Override")');
  await expect(page.locator('text=OVERRIDDEN')).toBeVisible();
});

test('admin can configure rules', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/settings/validation-rules');
  await page.click('button[data-rule="AMOUNT_THRESHOLD_EXCEEDED"]');
  await page.fill('input[name="threshold"]', '20000');
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Rule updated')).toBeVisible();
});
```

### 8.4 Performance Tests

```typescript
// Benchmark validation performance
test('validation should complete in <500ms', async () => {
  const start = Date.now();
  await validationService.validateInvoice(invoiceId);
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(500);
});

// Load test with 100 concurrent validations
test('should handle concurrent validations', async () => {
  const promises = Array.from({ length: 100 }, (_, i) =>
    createInvoice({ ... })
  );
  await Promise.all(promises);
  // Verify all validations completed without errors
});
```

---

## 9. Task Breakdown

### Phase 1: Foundation (Days 1-2) - PRIORITY: CRITICAL

#### 1.1 Database Setup
- [ ] **Task 1.1.1**: Update Prisma schema (2 hours)
  - Add `invoiceNumber`, `vendorId` to Invoice
  - Create ValidationRuleType, ValidationSeverity, ValidationStatus enums
  - Create InvoiceValidation, ValidationRule, ValidationOverride models
  - Add indexes
  - **Dependencies**: None
  - **Acceptance**: Schema compiles, migration created

- [ ] **Task 1.1.2**: Run migration (30 min)
  - `npx prisma migrate dev --name add-invoice-validation`
  - Verify in Prisma Studio
  - **Dependencies**: 1.1.1
  - **Acceptance**: Tables exist in database

- [ ] **Task 1.1.3**: Seed validation rules (1 hour)
  - Create `prisma/seed-validation-rules.ts`
  - Insert 8 default rules
  - Run: `npx ts-node prisma/seed-validation-rules.ts`
  - **Dependencies**: 1.1.2
  - **Acceptance**: 8 rules in database

#### 1.2 Rename Existing Files
- [ ] **Task 1.2.1**: Rename validationService.ts (15 min)
  - Rename to `entityValidationService.ts`
  - Update all imports
  - **Dependencies**: None
  - **Acceptance**: Build succeeds

#### 1.3 Update PubSub Events
- [ ] **Task 1.3.1**: Add validation events (15 min)
  - Add INVOICE_CREATED, INVOICE_VALIDATED, DUPLICATE_DETECTED, SUSPICIOUS_DETECTED, VALIDATION_OVERRIDDEN
  - **Dependencies**: None
  - **Acceptance**: Events exported

#### 1.4 Add Permissions
- [ ] **Task 1.4.1**: Update permissions.ts (30 min)
  - Add VALIDATION_READ, VALIDATION_OVERRIDE, VALIDATION_CONFIGURE, VALIDATION_REVALIDATE
  - Update ROLE_PERMISSIONS mappings
  - **Dependencies**: None
  - **Acceptance**: Permissions compile

---

### Phase 2: Domain Layer (Days 3-5) - PRIORITY: CRITICAL

#### 2.1 Rule Implementations
- [ ] **Task 2.1.1**: Create IValidationRule interface (1 hour)
  - Define validate() method signature
  - ValidationContext type
  - ValidationResult type
  - **Dependencies**: None
  - **Acceptance**: Interface defined

- [ ] **Task 2.1.2**: Implement DuplicateInvoiceNumberRule (2 hours)
  - Query for existing invoice with same number + vendor
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass, >80% coverage

- [ ] **Task 2.1.3**: Implement MissingInvoiceNumberRule (1 hour)
  - Check for null/empty invoiceNumber
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.4**: Implement AmountThresholdExceededRule (2 hours)
  - Check totalAmount > threshold
  - Load threshold from ValidationRule config
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.5**: Implement RoundAmountPatternRule (1 hour)
  - Check if amount is round number
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.6**: Implement POAmountVarianceRule (3 hours)
  - Compare invoice total vs PO total
  - Calculate variance percentage
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.7**: Implement POItemMismatchRule (3 hours)
  - Compare invoice items vs PO items
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.8**: Implement DeliveryNoteMismatchRule (3 hours)
  - Compare invoice quantity vs delivered quantity
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

- [ ] **Task 2.1.9**: Implement PriceVarianceRule (4 hours)
  - Query ItemPriceHistory
  - Calculate average and variance
  - Unit tests
  - **Dependencies**: 2.1.1
  - **Acceptance**: Tests pass

#### 2.2 Detection Services
- [ ] **Task 2.2.1**: Implement DuplicateDetector (2 hours)
  - checkDuplicate() method
  - Unit tests
  - **Dependencies**: 2.1.2
  - **Acceptance**: Tests pass

- [ ] **Task 2.2.2**: Implement SuspiciousDetector (3 hours)
  - Load enabled rules from database
  - Execute rules in parallel
  - Aggregate results
  - Unit tests
  - **Dependencies**: 2.1.3-2.1.9
  - **Acceptance**: Tests pass

#### 2.3 Orchestrator
- [ ] **Task 2.3.1**: Implement ValidationOrchestrator (4 hours)
  - Coordinate duplicate + suspicious detection
  - Persist results to database
  - Publish events
  - Return summary
  - Unit tests
  - **Dependencies**: 2.2.1, 2.2.2
  - **Acceptance**: Tests pass, integration test succeeds

---

### Phase 3: Service Layer (Days 6-7) - PRIORITY: HIGH

#### 3.1 Validation Service Facade
- [ ] **Task 3.1.1**: Create invoiceValidationService.ts (4 hours)
  - validateInvoice()
  - getValidationSummary()
  - getFlaggedInvoices()
  - overrideValidation()
  - reviewValidation()
  - getValidationRules()
  - updateValidationRule()
  - Unit tests
  - **Dependencies**: 2.3.1
  - **Acceptance**: Tests pass, >80% coverage

#### 3.2 Invoice Service Integration
- [ ] **Task 3.2.1**: Update createInvoice() (2 hours)
  - Accept invoiceNumber parameter
  - Extract and denormalize vendorId
  - Publish INVOICE_CREATED event
  - Update tests
  - **Dependencies**: 1.1.2, 1.3.1
  - **Acceptance**: Tests pass, event published

- [ ] **Task 3.2.2**: Update approveInvoice() (2 hours)
  - Check for CRITICAL + FLAGGED validations
  - Block if found
  - Update tests
  - **Dependencies**: 3.1.1
  - **Acceptance**: Tests pass, blocking works

#### 3.3 Event Subscriber
- [ ] **Task 3.3.1**: Create invoiceValidation.subscriber.ts (2 hours)
  - Subscribe to INVOICE_CREATED
  - Call validateInvoice()
  - Error handling
  - Register in index.ts
  - **Dependencies**: 3.1.1, 3.2.1
  - **Acceptance**: Validation triggered on invoice creation

#### 3.4 Zod Schemas
- [ ] **Task 3.4.1**: Create validation schemas (2 hours)
  - ValidationSeveritySchema, ValidationStatusSchema
  - OverrideValidationSchema
  - GetFlaggedInvoicesFiltersSchema
  - UpdateValidationRuleSchema
  - Update CreateInvoiceSchema
  - **Dependencies**: None
  - **Acceptance**: Schemas compile

---

### Phase 4: REST API (Days 8-9) - PRIORITY: HIGH

#### 4.1 Routes Implementation
- [ ] **Task 4.1.1**: Create validations.ts routes file (6 hours)
  - GET /api/validations/flagged
  - GET /api/validations/invoices/:invoiceId
  - POST /api/validations/:validationId/override
  - PUT /api/validations/:validationId/review
  - POST /api/validations/invoices/:invoiceId/revalidate
  - GET /api/validations/rules
  - PATCH /api/validations/rules/:ruleId
  - GET /api/validations/dashboard/stats
  - **Dependencies**: 3.1.1, 3.4.1
  - **Acceptance**: Postman tests pass

- [ ] **Task 4.1.2**: Register routes in index.ts (15 min)
  - Import and mount /api/validations
  - **Dependencies**: 4.1.1
  - **Acceptance**: Routes accessible

#### 4.2 API Tests
- [ ] **Task 4.2.1**: Create API integration tests (4 hours)
  - Test all endpoints
  - Test authentication/authorization
  - Test error cases
  - **Dependencies**: 4.1.1
  - **Acceptance**: All tests pass

---

### Phase 5: Frontend - Dashboard (Days 10-12) - PRIORITY: HIGH

#### 5.1 Type Definitions
- [ ] **Task 5.1.1**: Create validation types (1 hour)
  - ValidationRuleType, ValidationSeverity, ValidationStatus enums
  - InvoiceValidation, ValidationRule, ValidationOverride interfaces
  - **Dependencies**: None
  - **Acceptance**: Types compile

#### 5.2 API Service
- [ ] **Task 5.2.1**: Create validationService.ts (2 hours)
  - All API client methods
  - **Dependencies**: 5.1.1, 4.1.1
  - **Acceptance**: Service compiles, can call API

#### 5.3 Components
- [ ] **Task 5.3.1**: Create ValidationAlert component (3 hours)
  - Display severity, rule type, details
  - Action buttons (override, dismiss)
  - Styling with shadcn/ui
  - **Dependencies**: 5.1.1
  - **Acceptance**: Component renders correctly

- [ ] **Task 5.3.2**: Create OverrideModal component (3 hours)
  - Form with textarea
  - Validation (min 10 chars)
  - Submit handler
  - Styling
  - **Dependencies**: 5.1.1
  - **Acceptance**: Modal works, validation enforced

- [ ] **Task 5.3.3**: Create ValidationStats component (2 hours)
  - Display total, by severity, by status
  - Card layout
  - **Dependencies**: 5.1.1
  - **Acceptance**: Stats display correctly

#### 5.4 Pages
- [ ] **Task 5.4.1**: Create FlaggedInvoicesPage (4 hours)
  - Load flagged invoices
  - Display stats
  - Filters (severity, status, date)
  - Pagination
  - Override workflow
  - **Dependencies**: 5.2.1, 5.3.1, 5.3.2, 5.3.3
  - **Acceptance**: Page works end-to-end

- [ ] **Task 5.4.2**: Update InvoiceDetail page (3 hours)
  - Fetch validation summary
  - Display ValidationAlert components
  - Integrate override modal
  - Update approval button logic
  - **Dependencies**: 5.2.1, 5.3.1, 5.3.2
  - **Acceptance**: Validations display on invoice detail

- [ ] **Task 5.4.3**: Update InvoiceList page (2 hours)
  - Add validation badge/icon
  - Color-code by severity
  - Tooltip with flag count
  - **Dependencies**: 5.2.1
  - **Acceptance**: Badges display correctly

#### 5.5 Routing
- [ ] **Task 5.5.1**: Add routes in App.tsx (30 min)
  - /flagged-invoices
  - /settings/validation-rules
  - **Dependencies**: 5.4.1
  - **Acceptance**: Routes accessible

---

### Phase 6: Frontend - Admin Config (Days 13-14) - PRIORITY: MEDIUM

#### 6.1 Admin Page
- [ ] **Task 6.1.1**: Create RuleConfigForm component (4 hours)
  - Toggle enabled/disabled
  - Select severity
  - Dynamic config inputs
  - Form validation
  - **Dependencies**: 5.1.1
  - **Acceptance**: Form works, submits correctly

- [ ] **Task 6.1.2**: Create ValidationRulesPage (4 hours)
  - List all rules
  - Edit modal/drawer
  - Save handler
  - ADMIN role restriction
  - **Dependencies**: 6.1.1, 5.2.1
  - **Acceptance**: Admin can configure rules

---

### Phase 7: Testing & Polish (Days 15-16) - PRIORITY: MEDIUM

#### 7.1 E2E Tests
- [ ] **Task 7.1.1**: Set up Playwright/Cypress (2 hours)
  - Install dependencies
  - Configure test environment
  - **Dependencies**: None
  - **Acceptance**: Test runner works

- [ ] **Task 7.1.2**: Write E2E test scenarios (6 hours)
  - Create invoice → validation → override → approve
  - Flagged invoices dashboard workflow
  - Admin rule configuration
  - Permission restrictions
  - **Dependencies**: 7.1.1, All previous phases
  - **Acceptance**: All E2E tests pass

#### 7.2 Performance Testing
- [ ] **Task 7.2.1**: Benchmark validation performance (2 hours)
  - Measure validation time
  - Optimize if needed
  - **Dependencies**: All backend tasks
  - **Acceptance**: <500ms per invoice

#### 7.3 Accessibility Audit
- [ ] **Task 7.3.1**: WCAG AA compliance check (3 hours)
  - Screen reader testing
  - Keyboard navigation
  - Color contrast
  - Fix issues
  - **Dependencies**: All frontend tasks
  - **Acceptance**: WCAG AA compliant

#### 7.4 Security Testing
- [ ] **Task 7.4.1**: Security audit (3 hours)
  - SQL injection testing
  - XSS testing
  - CSRF protection
  - Permission bypass attempts
  - **Dependencies**: All tasks
  - **Acceptance**: No security issues found

---

### Phase 8: Documentation & Deployment (Days 17-18) - PRIORITY: LOW

#### 8.1 Documentation
- [ ] **Task 8.1.1**: API documentation (2 hours)
  - Create OpenAPI spec or docs/api/validations.md
  - **Dependencies**: 4.1.1
  - **Acceptance**: All endpoints documented

- [ ] **Task 8.1.2**: User guide (2 hours)
  - Create docs/guides/invoice-validation-user-guide.md
  - **Dependencies**: All phases
  - **Acceptance**: Guide complete

- [ ] **Task 8.1.3**: Admin guide (2 hours)
  - Create docs/guides/invoice-validation-admin-guide.md
  - **Dependencies**: 6.1.2
  - **Acceptance**: Guide complete

- [ ] **Task 8.1.4**: Architecture Decision Record (1 hour)
  - Create docs/adr/0001-invoice-validation-architecture.md
  - **Dependencies**: None
  - **Acceptance**: ADR complete

#### 8.2 Deployment Preparation
- [ ] **Task 8.2.1**: Environment variables documentation (1 hour)
  - Document any new env vars
  - **Dependencies**: All backend tasks
  - **Acceptance**: .env.example updated

- [ ] **Task 8.2.2**: Deployment checklist (1 hour)
  - Migration steps
  - Seed steps
  - Rollback plan
  - **Dependencies**: All tasks
  - **Acceptance**: Checklist complete

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Validation performance >500ms** | High | Medium | - Add database indexes<br>- Optimize queries with `select`<br>- Implement caching for rules<br>- Run rules in parallel |
| **Race condition on duplicate check** | High | Low | - Use database unique constraint as fallback<br>- Transaction isolation level<br>- Retry logic |
| **Missing vendorId on legacy invoices** | Medium | Medium | - Make vendorId nullable<br>- Create backfill script<br>- Graceful degradation in rules |
| **PubSub event delivery failure** | Medium | Low | - Add error handling in subscriber<br>- Implement retry mechanism<br>- Dead letter queue for failed validations |
| **Frontend state management complexity** | Medium | Medium | - Use React Query for server state<br>- Clear component boundaries<br>- Comprehensive E2E tests |

### 10.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **False positives block legitimate invoices** | High | Medium | - Override mechanism with audit trail<br>- Configurable severity levels<br>- Rule enable/disable toggle |
| **Users ignore warnings** | Medium | High | - Training documentation<br>- Warning confirmation dialogs<br>- Analytics on dismissal rates |
| **Admin misconfigures rules** | Medium | Low | - Validation on config values<br>- Preview/dry-run mode<br>- Rollback capability |
| **Audit compliance issues** | High | Low | - Complete audit logging<br>- Immutable override records<br>- Regular audit reports |

### 10.3 Mitigation Actions

**Pre-Implementation:**
- [ ] Review database schema with DBA
- [ ] Performance test on production-like dataset
- [ ] Security review of override mechanism
- [ ] Stakeholder approval of validation rules

**During Implementation:**
- [ ] Daily standup to track blockers
- [ ] Code review all PRs before merge
- [ ] Integration tests run on every commit
- [ ] Performance benchmarks on CI/CD

**Post-Implementation:**
- [ ] Monitor validation performance metrics
- [ ] Track false positive rates
- [ ] Collect user feedback
- [ ] Plan iteration based on analytics

---

## Appendix A: Definition of Done

For each task to be considered complete:

- ✅ Code written and follows project conventions
- ✅ Unit tests written and passing (>80% coverage)
- ✅ Integration tests passing (where applicable)
- ✅ TypeScript compiles without errors
- ✅ ESLint passes with zero warnings
- ✅ Code reviewed and approved
- ✅ Documentation updated (inline comments + guides)
- ✅ No console errors or warnings
- ✅ Committed with descriptive message (conventional commits)
- ✅ Manual testing completed
- ✅ Acceptance criteria met

---

## Appendix B: Quick Reference

### Command Cheat Sheet
```bash
# Database
npx prisma migrate dev --name add-invoice-validation
npx prisma generate
npx prisma db seed
npx prisma studio

# Backend
cd server && pnpm dev
pnpm test -- --watch validation
pnpm build

# Frontend
cd client && pnpm dev
pnpm lint
pnpm build

# Testing
pnpm test
pnpm test:coverage
pnpm test:e2e
```

### Git Branch Strategy
```
main
└── feature/invoice-validation
    ├── feature/invoice-validation/phase-1-foundation
    ├── feature/invoice-validation/phase-2-domain
    ├── feature/invoice-validation/phase-3-service
    └── ... (merge each phase when complete)
```

### Key File Locations
```
Backend Domain:  server/src/domain/validation/
Backend Service: server/src/services/invoiceValidationService.ts
Backend Routes:  server/src/routes/validations.ts
Frontend Types:  client/src/types/validation.ts
Frontend Pages:  client/src/pages/FlaggedInvoices.tsx
Frontend Comp:   client/src/components/validations/
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-10
**Status**: Ready for Implementation
**Estimated Effort**: 18 working days (4 weeks at 80% capacity)

---

## Summary

This implementation plan provides:

1. **Complete codebase analysis** - Understanding of existing patterns and constraints
2. **Clean Architecture design** - Domain → Application → Infrastructure layers
3. **DDD-based domain model** - Aggregates, Value Objects, Domain Events
4. **8 validation rules** - Duplicate prevention + 7 suspicious pattern detectors
5. **Full-stack implementation** - Backend services + REST API + React frontend
6. **Event-driven integration** - PubSub hooks into invoice lifecycle
7. **Override workflow** - User can override with audit trail
8. **Admin configuration** - Rule enable/disable, threshold adjustment
9. **Comprehensive testing** - Unit, integration, E2E, performance, security
10. **Detailed task breakdown** - 80+ tasks with dependencies and acceptance criteria
11. **Risk mitigation** - Technical and business risks identified with solutions

**Next Steps:**
1. Review and approve this plan with stakeholders
2. Set up development branch: `feature/invoice-validation`
3. Assign tasks to developers
4. Begin Phase 1: Foundation (database schema)
5. Daily standups to track progress
6. Merge phases incrementally to `main` after testing

**Critical Path:** Phases 1-5 (Foundation → Domain → Service → API → Dashboard)
**Nice-to-Have:** Phase 6 (Admin Config), Phase 8 (Documentation)
