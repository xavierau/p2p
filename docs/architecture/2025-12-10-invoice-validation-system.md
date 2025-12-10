# Invoice Validation System - Technical Specification

**Date**: 2025-12-10
**Status**: Draft
**Architecture**: Clean Architecture + DDD + Event-Driven

---

## Executive Summary

This specification defines a comprehensive invoice validation system to prevent duplicate invoices and detect suspicious patterns. The system implements real-time validation with user override capabilities, extensible for future ML-based detection.

### Core Features
1. **Duplicate Prevention**: Detect same invoice number from same vendor
2. **Suspicious Invoice Detection**: Rule-based anomaly detection using hard data
3. **Review Workflow**: Flag system with user override and audit trail
4. **Dashboard Integration**: Dedicated section for reviewing flagged invoices
5. **Extensibility**: Plugin architecture for future ML/behavioral analysis

---

## Phase 1: Codebase Investigation Summary

### Current System Architecture
- **Backend**: Express.js + TypeScript + Prisma (PostgreSQL)
- **Pattern**: Clean Architecture (routes → services → Prisma)
- **Events**: PubSub singleton (EventEmitter)
- **Validation**: Zod schemas
- **Audit**: AuditLog model exists

### Existing Invoice Model
```prisma
model Invoice {
  id              Int
  date            DateTime
  status          String  // PENDING, APPROVED, REJECTED
  totalAmount     Float
  userId          Int?
  purchaseOrderId Int?
  // Missing: invoiceNumber, vendorId (resolved through items)
}
```

### Extension Points
- PubSub events for validation hooks
- Service layer for business logic
- Subscriber pattern for async processing
- Existing audit infrastructure

### Constraints
- No direct vendor link on Invoice (resolved through InvoiceItem → Item → Vendor)
- Updates only allowed in PENDING status
- Soft delete pattern (`deletedAt`)

---

## Phase 3: Ontology Model

### Object Types

| Object | Identifier | Key Properties | Lifecycle States |
|--------|------------|----------------|------------------|
| Invoice | invoiceId | invoiceNumber, totalAmount, status | PENDING → APPROVED/REJECTED |
| InvoiceValidation | validationId | invoiceId, validationType, severity, status | FLAGGED → REVIEWED → APPROVED/REJECTED |
| ValidationRule | ruleId | ruleType, config, enabled | ACTIVE/INACTIVE |
| ValidationOverride | overrideId | validationId, userId, reason | - |
| Vendor | vendorId | name, contact | - |
| PurchaseOrder | poId | vendorId, status, date | DRAFT → SENT → FULFILLED |

### Relationships (Links)

| Source | Link | Target | Cardinality | Properties | Invariants |
|--------|------|--------|-------------|------------|------------|
| Invoice | HAS_NUMBER | InvoiceNumber | 1:0..1 | invoiceNumber (string) | Optional but recommended |
| Invoice | BELONGS_TO | Vendor | 1:1 | - | Derived through items |
| Invoice | REFERENCES | PurchaseOrder | 1:0..1 | purchaseOrderId | Optional |
| Invoice | HAS_VALIDATIONS | InvoiceValidation | 1:N | - | One invoice, many checks |
| InvoiceValidation | USES_RULE | ValidationRule | N:1 | - | Many validations use same rule |
| InvoiceValidation | HAS_OVERRIDE | ValidationOverride | 1:0..1 | - | Optional user override |
| ValidationOverride | CREATED_BY | User | N:1 | reason, timestamp | Audit trail |
| Invoice | VALIDATED_BY | ValidationResult | 1:1 | isValid, flagCount, severity | Computed aggregate |

### Actions

| Action | Affects | Preconditions | Side Effects | Domain Events |
|--------|---------|---------------|--------------|---------------|
| CreateInvoice | Invoice, InvoiceValidation | Items exist, user authenticated | Run validation pipeline | INVOICE_CREATED |
| ValidateInvoice | InvoiceValidation | Invoice exists | Create validation records | INVOICE_VALIDATED, DUPLICATE_DETECTED, SUSPICIOUS_DETECTED |
| OverrideValidation | ValidationOverride, InvoiceValidation | User has permission, reason provided | Update validation status | VALIDATION_OVERRIDDEN |
| ApproveInvoice | Invoice | Status=PENDING, no blocking validations | Update status, trigger accounting sync | INVOICE_APPROVED |
| ReviewFlagged | InvoiceValidation | Status=FLAGGED | Update to REVIEWED | VALIDATION_REVIEWED |

### Aggregate Boundaries

**Invoice Aggregate** (Root: Invoice)
- Contains: InvoiceItem[]
- Invariants:
  - Total = sum of (item.price × item.quantity)
  - Items not empty
  - Status transitions: PENDING → (APPROVED | REJECTED)
  - Cannot modify if status ≠ PENDING

**InvoiceValidation Aggregate** (Root: InvoiceValidation)
- Contains: ValidationOverride (optional)
- Invariants:
  - One override per validation max
  - Override requires reason
  - Override only by MANAGER+ role
  - Status transitions: FLAGGED → REVIEWED → (APPROVED | REJECTED)

### Domain Events

| Event | Trigger | Payload | Subscribers |
|-------|---------|---------|-------------|
| INVOICE_CREATED | createInvoice() | { invoiceId } | ValidationOrchestrator |
| INVOICE_VALIDATED | Validation complete | { invoiceId, results[] } | NotificationService, AuditLogger |
| DUPLICATE_DETECTED | Duplicate check fails | { invoiceId, duplicateInvoiceId, vendorId } | AlertService, AuditLogger |
| SUSPICIOUS_DETECTED | Suspicious rule triggered | { invoiceId, ruleType, severity, details } | AlertService, AuditLogger |
| VALIDATION_OVERRIDDEN | User overrides flag | { validationId, userId, reason } | AuditLogger, NotificationService |
| INVOICE_APPROVED | approveInvoice() | { invoiceId } | AccountingSync (existing) |

### Bounded Contexts

```
┌─────────────────────────────────────────────────────────────┐
│ INVOICE MANAGEMENT CONTEXT (Existing)                       │
│ - Invoice, InvoiceItem, Vendor, PurchaseOrder               │
│ - Create, Update, Approve, Reject invoices                  │
└─────────────────────────────────────────────────────────────┘
                          ↓ Events ↓
┌─────────────────────────────────────────────────────────────┐
│ VALIDATION CONTEXT (New)                                    │
│ - InvoiceValidation, ValidationRule, ValidationOverride     │
│ - Detect duplicates, check rules, flag suspicious           │
└─────────────────────────────────────────────────────────────┘
                          ↓ Events ↓
┌─────────────────────────────────────────────────────────────┐
│ REVIEW CONTEXT (New)                                        │
│ - Review flagged invoices, override validations             │
│ - Dashboard, alerts, notifications                          │
└─────────────────────────────────────────────────────────────┘
```

**Context Communication**: Event-driven (PubSub), Anti-Corruption Layer (validation results → UI DTOs)

---

## Phase 4: DDD Mapping

### Value Objects

```typescript
// Validation severity level
type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

// Validation status
type ValidationStatus = 'FLAGGED' | 'REVIEWED' | 'OVERRIDDEN' | 'DISMISSED';

// Validation rule type
type ValidationRuleType =
  | 'DUPLICATE_INVOICE_NUMBER'
  | 'MISSING_INVOICE_NUMBER'
  | 'AMOUNT_THRESHOLD_EXCEEDED'
  | 'ROUND_AMOUNT_PATTERN'
  | 'PO_AMOUNT_VARIANCE'
  | 'PO_ITEM_MISMATCH'
  | 'DELIVERY_NOTE_MISMATCH'
  | 'PRICE_VARIANCE';

// Validation result
interface ValidationResult {
  readonly ruleType: ValidationRuleType;
  readonly severity: ValidationSeverity;
  readonly passed: boolean;
  readonly details: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

// Invoice validation summary
interface InvoiceValidationSummary {
  readonly invoiceId: number;
  readonly isValid: boolean;
  readonly hasBlockingIssues: boolean;
  readonly flagCount: number;
  readonly highestSeverity: ValidationSeverity | null;
  readonly validations: ValidationResult[];
}
```

### Domain Services

```typescript
// Duplicate Detection Service
interface DuplicateDetector {
  checkDuplicate(invoice: Invoice): Promise<ValidationResult>;
}

// Suspicious Pattern Detector
interface SuspiciousDetector {
  detectAnomalies(invoice: Invoice): Promise<ValidationResult[]>;
}

// Validation Orchestrator
interface ValidationOrchestrator {
  validateInvoice(invoiceId: number): Promise<InvoiceValidationSummary>;
}

// Override Service
interface ValidationOverrideService {
  override(validationId: number, userId: number, reason: string): Promise<void>;
  canOverride(userId: number, validationId: number): Promise<boolean>;
}
```

### Repository Interfaces (Domain Layer)

```typescript
interface InvoiceValidationRepository {
  create(validation: CreateInvoiceValidation): Promise<InvoiceValidation>;
  findByInvoiceId(invoiceId: number): Promise<InvoiceValidation[]>;
  findFlagged(filters: FlaggedFilters): Promise<InvoiceValidation[]>;
  update(id: number, data: UpdateInvoiceValidation): Promise<InvoiceValidation>;
}

interface ValidationRuleRepository {
  findEnabled(): Promise<ValidationRule[]>;
  findByType(ruleType: ValidationRuleType): Promise<ValidationRule | null>;
}

interface ValidationOverrideRepository {
  create(override: CreateValidationOverride): Promise<ValidationOverride>;
  findByValidationId(validationId: number): Promise<ValidationOverride | null>;
}
```

---

## Phase 5: Technical Design

### Database Schema Changes

```prisma
// ============================================
// INVOICE VALIDATION MODELS
// ============================================

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
  ERROR
  CRITICAL
}

enum ValidationStatus {
  FLAGGED
  REVIEWED
  OVERRIDDEN
  DISMISSED
}

model Invoice {
  // ... existing fields ...

  // NEW FIELDS
  invoiceNumber String?  // Vendor-provided invoice number
  vendorId      Int?     // Direct vendor reference (denormalized)
  vendor        Vendor?  @relation(fields: [vendorId], references: [id])

  validations   InvoiceValidation[]

  // NEW INDEXES
  @@index([vendorId, invoiceNumber])  // Duplicate detection
  @@index([status, date])              // Flagged invoice queries
}

model InvoiceValidation {
  id          Int                  @id @default(autoincrement())

  invoiceId   Int
  invoice     Invoice              @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  ruleType    ValidationRuleType
  severity    ValidationSeverity
  status      ValidationStatus     @default(FLAGGED)

  passed      Boolean              @default(false)
  details     String               // JSON stringified details
  metadata    String?              // JSON stringified metadata

  // Relationships
  override    ValidationOverride?

  // Audit
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  reviewedAt  DateTime?
  reviewedBy  Int?                 // User ID

  @@index([invoiceId])
  @@index([status])
  @@index([severity, status])
  @@index([ruleType, status])
  @@index([createdAt])
}

model ValidationRule {
  id          Int                  @id @default(autoincrement())

  ruleType    ValidationRuleType   @unique
  name        String
  description String?

  enabled     Boolean              @default(true)
  severity    ValidationSeverity   @default(WARNING)

  config      String               // JSON stringified configuration

  // Audit
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([enabled])
  @@index([ruleType, enabled])
}

model ValidationOverride {
  id              Int               @id @default(autoincrement())

  validationId    Int               @unique
  validation      InvoiceValidation @relation(fields: [validationId], references: [id], onDelete: Cascade)

  userId          Int
  user            User              @relation(fields: [userId], references: [id])

  reason          String

  createdAt       DateTime          @default(now())

  @@index([validationId])
  @@index([userId])
  @@index([createdAt])
}

// Add to User model
model User {
  // ... existing fields ...
  validationOverrides ValidationOverride[]
}

// Add to Vendor model
model Vendor {
  // ... existing fields ...
  invoices Invoice[]  // Direct relation for easier queries
}
```

### Directory Structure (Clean Architecture)

```
server/src/
├── domain/
│   └── validation/                   # NEW
│       ├── entities/
│       │   ├── InvoiceValidation.ts
│       │   ├── ValidationRule.ts
│       │   └── ValidationOverride.ts
│       ├── value-objects/
│       │   ├── ValidationSeverity.ts
│       │   ├── ValidationStatus.ts
│       │   └── ValidationResult.ts
│       ├── services/
│       │   ├── DuplicateDetector.ts
│       │   ├── SuspiciousDetector.ts
│       │   └── ValidationOrchestrator.ts
│       ├── repositories/
│       │   ├── IInvoiceValidationRepository.ts
│       │   ├── IValidationRuleRepository.ts
│       │   └── IValidationOverrideRepository.ts
│       └── events/
│           ├── InvoiceValidated.event.ts
│           ├── DuplicateDetected.event.ts
│           └── ValidationOverridden.event.ts
│
├── application/                      # NEW (Use Cases)
│   └── validation/
│       ├── commands/
│       │   ├── ValidateInvoice.command.ts
│       │   ├── OverrideValidation.command.ts
│       │   └── ReviewValidation.command.ts
│       ├── queries/
│       │   ├── GetFlaggedInvoices.query.ts
│       │   ├── GetValidationSummary.query.ts
│       │   └── GetValidationHistory.query.ts
│       └── handlers/
│           ├── ValidateInvoiceHandler.ts
│           ├── OverrideValidationHandler.ts
│           └── ReviewValidationHandler.ts
│
├── infrastructure/
│   └── persistence/
│       └── prisma/                   # NEW
│           ├── InvoiceValidationRepository.ts
│           ├── ValidationRuleRepository.ts
│           └── ValidationOverrideRepository.ts
│
├── services/                         # EXISTING (adapter layer)
│   ├── invoiceService.ts             # MODIFY: Add validation hooks
│   └── validationService.ts          # NEW: Facade for validation domain
│
├── routes/
│   └── validations.ts                # NEW: REST API endpoints
│
├── subscribers/
│   └── validation.subscriber.ts      # NEW: Event handlers
│
└── schemas/
    └── validation/                   # NEW
        ├── invoiceValidation.schema.ts
        ├── validationRule.schema.ts
        └── validationOverride.schema.ts
```

### Validation Pipeline Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Invoice Creation (POST /invoices)                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Create Invoice in Database                                │
│    - Insert Invoice                                           │
│    - Insert InvoiceItems                                      │
│    - Publish INVOICE_CREATED event                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Validation Subscriber Receives Event                      │
│    - ValidationOrchestrator.validateInvoice(invoiceId)       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Parallel Validation Execution                             │
│    ┌─────────────────────────────────────────────┐           │
│    │ DuplicateDetector                           │           │
│    │ - Check invoice number + vendor             │           │
│    └─────────────────────────────────────────────┘           │
│    ┌─────────────────────────────────────────────┐           │
│    │ SuspiciousDetector (Rule Engine)            │           │
│    │ - Missing invoice number check              │           │
│    │ - Amount threshold check                    │           │
│    │ - Round amount pattern check                │           │
│    │ - PO variance check                         │           │
│    │ - Price variance check                      │           │
│    │ - Delivery note reconciliation              │           │
│    └─────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Create InvoiceValidation Records                          │
│    - One record per failed/flagged rule                      │
│    - Store severity, details, metadata                       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Publish Validation Events                                 │
│    - INVOICE_VALIDATED                                       │
│    - DUPLICATE_DETECTED (if duplicate found)                 │
│    - SUSPICIOUS_DETECTED (if flags raised)                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Return Response to Client                                 │
│    - Invoice created successfully                            │
│    - Include validation summary in response                  │
│    - UI shows flags if any                                   │
└──────────────────────────────────────────────────────────────┘
```

### Validation Rules Implementation

Each rule is a self-contained validator following this interface:

```typescript
interface ValidationRule {
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  enabled: boolean;

  validate(invoice: Invoice, context: ValidationContext): Promise<ValidationResult>;
}

interface ValidationContext {
  prisma: PrismaClient;
  config: RuleConfig;
  // Future: ML models, external services, etc.
}
```

**Rule Implementations**:

1. **DUPLICATE_INVOICE_NUMBER**
   ```typescript
   // Check if same invoiceNumber exists for same vendor
   const duplicate = await prisma.invoice.findFirst({
     where: {
       vendorId: invoice.vendorId,
       invoiceNumber: invoice.invoiceNumber,
       id: { not: invoice.id },
       deletedAt: null
     }
   });

   return {
     ruleType: 'DUPLICATE_INVOICE_NUMBER',
     severity: 'CRITICAL',
     passed: !duplicate,
     details: { duplicateInvoiceId: duplicate?.id }
   };
   ```

2. **MISSING_INVOICE_NUMBER**
   ```typescript
   return {
     ruleType: 'MISSING_INVOICE_NUMBER',
     severity: 'WARNING',
     passed: !!invoice.invoiceNumber,
     details: { message: 'Invoice number not provided by vendor' }
   };
   ```

3. **AMOUNT_THRESHOLD_EXCEEDED**
   ```typescript
   const threshold = config.amountThreshold || 10000;
   return {
     ruleType: 'AMOUNT_THRESHOLD_EXCEEDED',
     severity: 'WARNING',
     passed: invoice.totalAmount <= threshold,
     details: {
       threshold,
       amount: invoice.totalAmount,
       variance: invoice.totalAmount - threshold
     }
   };
   ```

4. **ROUND_AMOUNT_PATTERN**
   ```typescript
   // Check if amount is suspiciously round (e.g., exactly 1000.00)
   const isRound = invoice.totalAmount % 100 === 0 &&
                   invoice.totalAmount >= 1000;
   return {
     ruleType: 'ROUND_AMOUNT_PATTERN',
     severity: 'INFO',
     passed: !isRound,
     details: { amount: invoice.totalAmount }
   };
   ```

5. **PO_AMOUNT_VARIANCE**
   ```typescript
   if (!invoice.purchaseOrderId) {
     return { passed: true }; // Skip if no PO
   }

   const po = await prisma.purchaseOrder.findUnique({
     where: { id: invoice.purchaseOrderId },
     include: { items: true }
   });

   const poTotal = po.items.reduce((sum, item) =>
     sum + (item.price * item.quantity), 0
   );

   const variancePercent = Math.abs(
     (invoice.totalAmount - poTotal) / poTotal * 100
   );

   const threshold = config.poVarianceThreshold || 10; // 10%

   return {
     ruleType: 'PO_AMOUNT_VARIANCE',
     severity: variancePercent > 20 ? 'WARNING' : 'INFO',
     passed: variancePercent <= threshold,
     details: {
       poTotal,
       invoiceTotal: invoice.totalAmount,
       variancePercent,
       threshold
     }
   };
   ```

6. **PRICE_VARIANCE**
   ```typescript
   // Compare invoice item prices vs catalog prices
   const variances = invoice.items.map(invoiceItem => {
     const catalogPrice = invoiceItem.item.price;
     const variancePercent = Math.abs(
       (invoiceItem.price - catalogPrice) / catalogPrice * 100
     );
     return { itemId: invoiceItem.itemId, variancePercent };
   });

   const threshold = config.priceVarianceThreshold || 20; // 20%
   const exceeds = variances.filter(v => v.variancePercent > threshold);

   return {
     ruleType: 'PRICE_VARIANCE',
     severity: exceeds.length > 0 ? 'WARNING' : 'INFO',
     passed: exceeds.length === 0,
     details: { variances, exceeds, threshold }
   };
   ```

7. **DELIVERY_NOTE_MISMATCH**
   ```typescript
   // Check if invoice items match linked delivery notes
   const deliveryNotes = await prisma.deliveryNote.findMany({
     where: {
       invoices: { some: { invoiceId: invoice.id } }
     },
     include: { items: true }
   });

   if (deliveryNotes.length === 0) {
     return { passed: true }; // Skip if no DNs linked
   }

   // Compare quantities, items, etc.
   const mismatches = detectMismatches(invoice.items, deliveryNotes);

   return {
     ruleType: 'DELIVERY_NOTE_MISMATCH',
     severity: 'WARNING',
     passed: mismatches.length === 0,
     details: { mismatches }
   };
   ```

---

## Phase 6: API Endpoints

### REST API Routes

```typescript
// GET /api/validations/flagged
// Get all flagged invoices for review
Query Params:
  - severity?: ValidationSeverity
  - status?: ValidationStatus
  - startDate?: string
  - endDate?: string
  - page?: number
  - limit?: number
Response:
{
  data: {
    id: number,
    invoice: Invoice,
    validations: InvoiceValidation[],
    summary: {
      flagCount: number,
      highestSeverity: ValidationSeverity,
      hasOverride: boolean
    }
  }[],
  pagination: { ... }
}

// GET /api/validations/invoices/:invoiceId
// Get validation summary for specific invoice
Response:
{
  invoiceId: number,
  isValid: boolean,
  hasBlockingIssues: boolean,
  flagCount: number,
  highestSeverity: ValidationSeverity | null,
  validations: {
    id: number,
    ruleType: ValidationRuleType,
    severity: ValidationSeverity,
    status: ValidationStatus,
    passed: boolean,
    details: object,
    override?: {
      userId: number,
      userName: string,
      reason: string,
      createdAt: string
    }
  }[]
}

// POST /api/validations/:validationId/override
// Override a validation flag
Body:
{
  reason: string  // Required, min 10 chars
}
Response:
{
  validationId: number,
  status: 'OVERRIDDEN',
  override: {
    id: number,
    userId: number,
    reason: string,
    createdAt: string
  }
}

// PUT /api/validations/:validationId/review
// Mark validation as reviewed (dismiss without override)
Body:
{
  action: 'DISMISS' | 'ESCALATE'
}
Response:
{
  validationId: number,
  status: ValidationStatus,
  reviewedAt: string,
  reviewedBy: number
}

// POST /api/validations/invoices/:invoiceId/revalidate
// Manually trigger revalidation
Response:
{
  invoiceId: number,
  validations: ValidationResult[]
}

// GET /api/validations/rules
// Get all validation rules
Response:
{
  rules: {
    id: number,
    ruleType: ValidationRuleType,
    name: string,
    description: string,
    enabled: boolean,
    severity: ValidationSeverity,
    config: object
  }[]
}

// PATCH /api/validations/rules/:ruleId
// Update rule configuration (ADMIN only)
Body:
{
  enabled?: boolean,
  severity?: ValidationSeverity,
  config?: object
}
Response:
{
  rule: ValidationRule
}

// GET /api/validations/dashboard/stats
// Dashboard statistics
Response:
{
  totalFlagged: number,
  byStatus: { status: ValidationStatus, count: number }[],
  bySeverity: { severity: ValidationSeverity, count: number }[],
  recentFlags: InvoiceValidation[],
  topRules: { ruleType: ValidationRuleType, count: number }[]
}
```

### Permissions

```typescript
// Add to server/src/constants/permissions.ts
export enum Permission {
  // ... existing permissions ...

  // Validation permissions
  VALIDATION_READ = 'validation:read',
  VALIDATION_OVERRIDE = 'validation:override',
  VALIDATION_CONFIGURE = 'validation:configure',
  VALIDATION_REVALIDATE = 'validation:revalidate',
}

// Role mappings
ADMIN: all validation permissions
MANAGER: read, override, revalidate
USER: read only
VIEWER: read only
```

---

## Phase 7: User Experience Design

### Invoice Creation Flow (Modified)

```
┌─────────────────────────────────────────────────────────────┐
│ Create Invoice Form                                         │
│                                                              │
│ [ Invoice Number ] (NEW - optional but recommended)         │
│ [ Vendor ]                                                   │
│ [ Purchase Order ] (optional)                               │
│ [ Items Table... ]                                           │
│                                                              │
│ [Create Invoice Button]                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   (Submit Invoice)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Validation Feedback (NEW)                                   │
│                                                              │
│ ✓ Invoice created successfully                              │
│                                                              │
│ ⚠️ Validation Warnings (2)                                  │
│ ├─ Missing invoice number (WARNING)                         │
│ └─ Amount exceeds threshold (WARNING)                       │
│                                                              │
│ [View Details] [Dismiss] [Continue to Dashboard]           │
└─────────────────────────────────────────────────────────────┘
```

### Flagged Invoices Dashboard (NEW)

```
┌─────────────────────────────────────────────────────────────┐
│ Flagged Invoices for Review                                 │
│                                                              │
│ Filters: [Severity ▾] [Status ▾] [Date Range]              │
│                                                              │
│ Stats:                                                       │
│ • Total Flagged: 12                                         │
│ • Critical: 2  Warning: 7  Info: 3                          │
│ • Pending Review: 8  Overridden: 4                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Invoice List                                                 │
├─────────────────────────────────────────────────────────────┤
│ 🔴 Invoice #INV-001 | Vendor: ACME Corp | $5,000.00        │
│    ├─ CRITICAL: Duplicate invoice number                    │
│    │  Found existing: INV-001 (Invoice #123)               │
│    └─ [View Invoice] [Override] [Details ▾]                │
├─────────────────────────────────────────────────────────────┤
│ 🟡 Invoice #INV-002 | Vendor: TechCo | $12,500.00          │
│    ├─ WARNING: Amount threshold exceeded                    │
│    │  Threshold: $10,000  |  Amount: $12,500               │
│    ├─ WARNING: PO variance 15%                              │
│    │  PO Total: $10,869  |  Invoice: $12,500               │
│    └─ [View Invoice] [Override] [Dismiss] [Details ▾]      │
├─────────────────────────────────────────────────────────────┤
│ ⚪ Invoice #INV-003 | Vendor: SupplierX | $8,000.00        │
│    ├─ INFO: Round amount pattern                            │
│    │  Amount is exactly $8,000.00                           │
│    └─ [View Invoice] [Dismiss] [Details ▾]                 │
└─────────────────────────────────────────────────────────────┘
```

### Invoice Detail Page (Modified)

```
┌─────────────────────────────────────────────────────────────┐
│ Invoice #INV-001                                             │
│                                                              │
│ Vendor: ACME Corp                                            │
│ Date: 2025-12-10                                             │
│ Total: $5,000.00                                             │
│ Status: PENDING                                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ VALIDATION ALERTS (NEW SECTION)                          │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL: Duplicate Invoice Number                       │
│    This invoice number already exists:                      │
│    • Invoice #123 (2025-12-01) - $5,000.00                  │
│    • Vendor: ACME Corp                                       │
│    • Status: APPROVED                                        │
│                                                              │
│    [View Duplicate Invoice] [Override with Reason]          │
├─────────────────────────────────────────────────────────────┤
│ 🟡 WARNING: PO Amount Variance                              │
│    Invoice total differs from PO by 12%                     │
│    • PO Total: $4,400.00                                     │
│    • Invoice Total: $5,000.00                                │
│    • Variance: +$600.00 (12%)                                │
│                                                              │
│    [View Purchase Order] [Dismiss]                          │
├─────────────────────────────────────────────────────────────┤
│ Items...                                                     │
│ [Approve] [Reject]                                           │
└─────────────────────────────────────────────────────────────┘
```

### Override Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Override Validation Flag                                    │
│                                                              │
│ You are overriding:                                         │
│ 🔴 CRITICAL: Duplicate Invoice Number                       │
│                                                              │
│ Reason for override: (required)                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Vendor confirmed this is a corrected invoice to         │ │
│ │ replace the previously submitted one. Original invoice  │ │
│ │ #123 was incorrect and will be voided.                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ⚠️ This action will be logged in the audit trail.           │
│                                                              │
│ [Cancel] [Confirm Override]                                 │
└─────────────────────────────────────────────────────────────┘
```

### Approval Flow (Modified)

```
Before: Click [Approve] → Invoice approved immediately

After:  Click [Approve] → Check for blocking validations
        ↓
        If CRITICAL flags exist and not overridden:
        ┌─────────────────────────────────────────────┐
        │ ⚠️ Cannot Approve                            │
        │                                              │
        │ This invoice has critical validation issues  │
        │ that must be resolved first:                 │
        │                                              │
        │ • Duplicate invoice number                   │
        │                                              │
        │ Please review and override if appropriate.   │
        │                                              │
        │ [Review Validations] [Cancel]                │
        └─────────────────────────────────────────────┘

        If only WARNING/INFO flags:
        ┌─────────────────────────────────────────────┐
        │ ⚠️ Confirm Approval                          │
        │                                              │
        │ This invoice has validation warnings:        │
        │ • Amount exceeds threshold ($12,500)         │
        │ • PO variance 15%                            │
        │                                              │
        │ Approve anyway?                              │
        │                                              │
        │ [Cancel] [Approve Anyway]                    │
        └─────────────────────────────────────────────┘
```

---

## Phase 8: Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Database schema, domain models, basic infrastructure

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 1.1 | Update Prisma schema | `server/prisma/schema.prisma` | - | 2h |
| 1.2 | Create migration | `npx prisma migrate dev` | 1.1 | 0.5h |
| 1.3 | Create domain entities | `server/src/domain/validation/entities/` | 1.2 | 3h |
| 1.4 | Create value objects | `server/src/domain/validation/value-objects/` | - | 2h |
| 1.5 | Create repository interfaces | `server/src/domain/validation/repositories/` | 1.3 | 2h |
| 1.6 | Implement Prisma repositories | `server/src/infrastructure/persistence/prisma/` | 1.5 | 4h |
| 1.7 | Create Zod schemas | `server/src/schemas/validation/` | 1.3 | 2h |

**Deliverables**:
- Database ready to store validations
- Domain layer foundation
- Repository pattern implemented

**Verification**:
```bash
cd server
npx prisma db push
npx prisma studio  # Verify new tables exist
npm run build      # TypeScript compilation succeeds
```

---

### Phase 2: Validation Rules Engine (Week 1-2)
**Goal**: Implement all validation rules

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 2.1 | Create ValidationRule interface | `server/src/domain/validation/services/ValidationRule.ts` | 1.3 | 1h |
| 2.2 | Implement DuplicateDetector | `server/src/domain/validation/services/DuplicateDetector.ts` | 2.1, 1.6 | 3h |
| 2.3 | Implement SuspiciousDetector | `server/src/domain/validation/services/SuspiciousDetector.ts` | 2.1, 1.6 | 4h |
| 2.4 | Implement individual rules | `server/src/domain/validation/rules/` | 2.1 | 6h |
| 2.5 | Create ValidationOrchestrator | `server/src/domain/validation/services/ValidationOrchestrator.ts` | 2.2, 2.3, 2.4 | 4h |
| 2.6 | Seed validation rules | `server/prisma/seed.ts` | 1.2 | 2h |
| 2.7 | Unit tests for rules | `server/src/domain/validation/__tests__/` | 2.4 | 6h |

**Deliverables**:
- All 7 validation rules implemented
- Orchestrator coordinates validation
- Rules configurable via database
- Unit tests pass

**Verification**:
```bash
cd server
npx prisma db seed                    # Load rules
npm run test -- validation            # Tests pass
npm run test:coverage -- validation   # >80% coverage
```

---

### Phase 3: Service Layer Integration (Week 2)
**Goal**: Integrate validation into invoice workflow

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 3.1 | Create validationService facade | `server/src/services/validationService.ts` | 2.5 | 3h |
| 3.2 | Modify invoiceService | `server/src/services/invoiceService.ts` | 3.1 | 2h |
| 3.3 | Create validation subscriber | `server/src/subscribers/validation.subscriber.ts` | 3.1 | 3h |
| 3.4 | Add validation events to PubSub | `server/src/services/pubsub.ts` | - | 1h |
| 3.5 | Update createInvoice to publish event | `server/src/services/invoiceService.ts` | 3.4 | 1h |
| 3.6 | Update approveInvoice to check validations | `server/src/services/invoiceService.ts` | 3.1 | 2h |
| 3.7 | Integration tests | `server/src/tests/integration/validation.test.ts` | 3.1-3.6 | 4h |

**Deliverables**:
- Invoice creation triggers validation
- Approval checks for blocking flags
- Event-driven architecture
- Integration tests pass

**Verification**:
```bash
cd server
npm run test:integration -- validation
# Create invoice via API → check validations created
# Approve flagged invoice → verify blocking behavior
```

---

### Phase 4: REST API Endpoints (Week 2-3)
**Goal**: Expose validation data via API

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 4.1 | Create validation routes | `server/src/routes/validations.ts` | 3.1 | 4h |
| 4.2 | Implement GET /flagged | `server/src/routes/validations.ts` | 3.1 | 2h |
| 4.3 | Implement GET /invoices/:id | `server/src/routes/validations.ts` | 3.1 | 2h |
| 4.4 | Implement POST /override | `server/src/routes/validations.ts` | 3.1 | 3h |
| 4.5 | Implement GET /rules | `server/src/routes/validations.ts` | 3.1 | 1h |
| 4.6 | Implement PATCH /rules/:id | `server/src/routes/validations.ts` | 3.1 | 2h |
| 4.7 | Implement GET /dashboard/stats | `server/src/routes/validations.ts` | 3.1 | 3h |
| 4.8 | Add permissions middleware | `server/src/constants/permissions.ts` | - | 1h |
| 4.9 | API tests | `server/src/tests/api/validations.test.ts` | 4.1-4.7 | 4h |

**Deliverables**:
- Full REST API for validations
- Permission-based access control
- API tests pass

**Verification**:
```bash
cd server
npm run test:api -- validations
# Use Postman/Insomnia to test endpoints
```

---

### Phase 5: Frontend - Dashboard (Week 3)
**Goal**: Flagged invoices dashboard

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 5.1 | Create validation service | `client/src/services/validationService.ts` | 4.1 | 2h |
| 5.2 | Create FlaggedInvoices page | `client/src/pages/FlaggedInvoices.tsx` | 5.1 | 4h |
| 5.3 | Create ValidationCard component | `client/src/components/validations/ValidationCard.tsx` | - | 3h |
| 5.4 | Create ValidationStats component | `client/src/components/validations/ValidationStats.tsx` | - | 2h |
| 5.5 | Add route to app | `client/src/App.tsx` | 5.2 | 0.5h |
| 5.6 | Add navigation link | `client/src/components/Navigation.tsx` | - | 0.5h |
| 5.7 | Style with Tailwind | Various | - | 2h |

**Deliverables**:
- Flagged invoices dashboard page
- Stats overview
- Navigation integration

**Verification**:
```bash
cd client
npm run dev
# Navigate to /flagged-invoices
# Verify data loads and displays correctly
```

---

### Phase 6: Frontend - Invoice Detail Integration (Week 3-4)
**Goal**: Show validations on invoice detail page

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 6.1 | Create ValidationAlert component | `client/src/components/validations/ValidationAlert.tsx` | - | 3h |
| 6.2 | Create OverrideModal component | `client/src/components/validations/OverrideModal.tsx` | 5.1 | 4h |
| 6.3 | Modify InvoiceDetail page | `client/src/pages/InvoiceDetail.tsx` | 6.1, 6.2 | 3h |
| 6.4 | Update approval flow | `client/src/pages/InvoiceDetail.tsx` | 6.1 | 2h |
| 6.5 | Add validation summary to invoice list | `client/src/pages/Invoices.tsx` | - | 2h |
| 6.6 | Style components | Various | - | 2h |

**Deliverables**:
- Validation alerts on invoice detail
- Override functionality
- Blocking approval for critical flags

**Verification**:
```bash
cd client
npm run dev
# Create invoice with duplicate number
# Verify alert shows on detail page
# Test override flow
# Test approval blocking
```

---

### Phase 7: Frontend - Admin Configuration (Week 4)
**Goal**: Rule management UI

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 7.1 | Create ValidationRules page | `client/src/pages/ValidationRules.tsx` | 5.1 | 4h |
| 7.2 | Create RuleConfigForm component | `client/src/components/validations/RuleConfigForm.tsx` | - | 4h |
| 7.3 | Add route (admin only) | `client/src/App.tsx` | 7.1 | 0.5h |
| 7.4 | Add to settings page | `client/src/pages/Settings.tsx` | - | 1h |

**Deliverables**:
- Admin can enable/disable rules
- Admin can adjust rule thresholds
- Changes persist to database

**Verification**:
```bash
cd client
npm run dev
# Login as ADMIN
# Navigate to settings → Validation Rules
# Toggle rule, adjust config, save
# Verify changes reflected in validations
```

---

### Phase 8: Testing & Documentation (Week 4)
**Goal**: Comprehensive testing and documentation

| # | Task | File | Dependencies | Estimate |
|---|------|------|--------------|----------|
| 8.1 | E2E tests (Playwright/Cypress) | `client/e2e/validation.spec.ts` | All | 6h |
| 8.2 | Performance testing | Various | All | 3h |
| 8.3 | Update OpenAPI spec | `server/openapi.yaml` | 4.1 | 2h |
| 8.4 | API documentation | `docs/api/validations.md` | 4.1 | 2h |
| 8.5 | User guide | `docs/guides/invoice-validation.md` | All | 3h |
| 8.6 | ADR document | `docs/adr/0001-invoice-validation.md` | - | 2h |

**Deliverables**:
- E2E test coverage
- OpenAPI spec updated
- User documentation
- Architecture decision record

**Verification**:
```bash
cd client
npm run test:e2e

cd server
npm run test:coverage  # Verify >80% coverage
```

---

### Implementation Order Summary

```
Week 1:
┌─────────────────────────────────────────────────────────────┐
│ Backend Foundation                                           │
│ • Database schema                                            │
│ • Domain models                                              │
│ • Validation rules engine                                    │
└─────────────────────────────────────────────────────────────┘

Week 2:
┌─────────────────────────────────────────────────────────────┐
│ Backend Integration                                          │
│ • Service layer                                              │
│ • Event subscribers                                          │
│ • REST API endpoints                                         │
└─────────────────────────────────────────────────────────────┘

Week 3:
┌─────────────────────────────────────────────────────────────┐
│ Frontend Core                                                │
│ • Flagged invoices dashboard                                 │
│ • Invoice detail integration                                 │
│ • Override workflow                                          │
└─────────────────────────────────────────────────────────────┘

Week 4:
┌─────────────────────────────────────────────────────────────┐
│ Polish & Admin                                               │
│ • Admin rule configuration                                   │
│ • Testing & QA                                               │
│ • Documentation                                              │
└─────────────────────────────────────────────────────────────┘
```

**Parallel Opportunities**:
- Weeks 1-2: Backend team works in parallel on foundation + integration
- Week 3: Frontend team starts while backend team finishes API
- Phase 2 (rules) can be parallelized (different developers, different rules)
- Phase 5-6 (frontend) can be parallelized (dashboard vs detail page)

---

## Phase 9: Extensibility & Future Enhancements

### Plugin Architecture for Future ML

```typescript
// Abstract validator interface allows pluggable implementations
interface IValidator {
  validate(invoice: Invoice): Promise<ValidationResult[]>;
}

// Current: Rule-based validator
class RuleBasedValidator implements IValidator {
  async validate(invoice: Invoice): Promise<ValidationResult[]> {
    // Current implementation
  }
}

// Future: ML-based validator
class MLValidator implements IValidator {
  constructor(private model: MLModel) {}

  async validate(invoice: Invoice): Promise<ValidationResult[]> {
    const features = this.extractFeatures(invoice);
    const prediction = await this.model.predict(features);
    return this.toPredictionResults(prediction);
  }
}

// Composite validator (runs multiple validators)
class CompositeValidator implements IValidator {
  constructor(private validators: IValidator[]) {}

  async validate(invoice: Invoice): Promise<ValidationResult[]> {
    const results = await Promise.all(
      this.validators.map(v => v.validate(invoice))
    );
    return results.flat();
  }
}

// Usage (future)
const validator = new CompositeValidator([
  new RuleBasedValidator(ruleEngine),
  new MLValidator(fraudDetectionModel),
  new BehavioralAnalyzer(vendorPatternService)
]);
```

### Future Enhancement Ideas

1. **Behavioral Analysis** (when historical data available)
   - Vendor submission patterns (frequency, time-of-day)
   - Unusual spikes in vendor activity
   - Anomaly detection based on historical trends

2. **Machine Learning Models**
   - Fraud detection (supervised learning on labeled fraud cases)
   - Anomaly detection (unsupervised learning)
   - Price prediction (detect unusual pricing)

3. **External Data Integration**
   - Vendor credit scores
   - Industry benchmarks
   - Regulatory compliance checks

4. **Advanced Workflows**
   - Multi-level approval for high-risk invoices
   - Automatic escalation paths
   - SLA tracking for review times

5. **Analytics Dashboard**
   - Validation trends over time
   - Rule effectiveness metrics
   - False positive rates

---

## Appendix A: Database Migration Script

```sql
-- Add invoice number and vendor reference to Invoice
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "vendorId" INTEGER;

-- Add foreign key constraint
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_vendorId_fkey"
  FOREIGN KEY ("vendorId")
  REFERENCES "Vendor"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Invoice_vendorId_invoiceNumber_idx"
  ON "Invoice"("vendorId", "invoiceNumber");

CREATE INDEX "Invoice_status_date_idx"
  ON "Invoice"("status", "date");

-- Create validation enums
CREATE TYPE "ValidationRuleType" AS ENUM (
  'DUPLICATE_INVOICE_NUMBER',
  'MISSING_INVOICE_NUMBER',
  'AMOUNT_THRESHOLD_EXCEEDED',
  'ROUND_AMOUNT_PATTERN',
  'PO_AMOUNT_VARIANCE',
  'PO_ITEM_MISMATCH',
  'DELIVERY_NOTE_MISMATCH',
  'PRICE_VARIANCE'
);

CREATE TYPE "ValidationSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'ERROR',
  'CRITICAL'
);

CREATE TYPE "ValidationStatus" AS ENUM (
  'FLAGGED',
  'REVIEWED',
  'OVERRIDDEN',
  'DISMISSED'
);

-- Create InvoiceValidation table
CREATE TABLE "InvoiceValidation" (
  "id" SERIAL PRIMARY KEY,
  "invoiceId" INTEGER NOT NULL,
  "ruleType" "ValidationRuleType" NOT NULL,
  "severity" "ValidationSeverity" NOT NULL,
  "status" "ValidationStatus" NOT NULL DEFAULT 'FLAGGED',
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "details" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" INTEGER,

  CONSTRAINT "InvoiceValidation_invoiceId_fkey"
    FOREIGN KEY ("invoiceId")
    REFERENCES "Invoice"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "InvoiceValidation_invoiceId_idx" ON "InvoiceValidation"("invoiceId");
CREATE INDEX "InvoiceValidation_status_idx" ON "InvoiceValidation"("status");
CREATE INDEX "InvoiceValidation_severity_status_idx" ON "InvoiceValidation"("severity", "status");
CREATE INDEX "InvoiceValidation_ruleType_status_idx" ON "InvoiceValidation"("ruleType", "status");
CREATE INDEX "InvoiceValidation_createdAt_idx" ON "InvoiceValidation"("createdAt");

-- Create ValidationRule table
CREATE TABLE "ValidationRule" (
  "id" SERIAL PRIMARY KEY,
  "ruleType" "ValidationRuleType" UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "severity" "ValidationSeverity" NOT NULL DEFAULT 'WARNING',
  "config" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "ValidationRule_enabled_idx" ON "ValidationRule"("enabled");
CREATE INDEX "ValidationRule_ruleType_enabled_idx" ON "ValidationRule"("ruleType", "enabled");

-- Create ValidationOverride table
CREATE TABLE "ValidationOverride" (
  "id" SERIAL PRIMARY KEY,
  "validationId" INTEGER UNIQUE NOT NULL,
  "userId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ValidationOverride_validationId_fkey"
    FOREIGN KEY ("validationId")
    REFERENCES "InvoiceValidation"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT "ValidationOverride_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "ValidationOverride_validationId_idx" ON "ValidationOverride"("validationId");
CREATE INDEX "ValidationOverride_userId_idx" ON "ValidationOverride"("userId");
CREATE INDEX "ValidationOverride_createdAt_idx" ON "ValidationOverride"("createdAt");

-- Backfill vendorId for existing invoices
UPDATE "Invoice" i
SET "vendorId" = (
  SELECT DISTINCT v.id
  FROM "InvoiceItem" ii
  JOIN "Item" itm ON ii."itemId" = itm.id
  JOIN "Vendor" v ON itm."vendorId" = v.id
  WHERE ii."invoiceId" = i.id
  LIMIT 1
)
WHERE i."vendorId" IS NULL AND i."deletedAt" IS NULL;
```

---

## Appendix B: Seed Data for Validation Rules

```typescript
// server/prisma/seed-validation-rules.ts
import { PrismaClient, ValidationRuleType, ValidationSeverity } from '@prisma/client';

const prisma = new PrismaClient();

const validationRules = [
  {
    ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
    name: 'Duplicate Invoice Number',
    description: 'Detects if the same invoice number already exists for this vendor',
    enabled: true,
    severity: ValidationSeverity.CRITICAL,
    config: JSON.stringify({})
  },
  {
    ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
    name: 'Missing Invoice Number',
    description: 'Flags invoices without an invoice number from vendor',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: JSON.stringify({})
  },
  {
    ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
    name: 'Amount Threshold Exceeded',
    description: 'Flags invoices with unusually high amounts',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: JSON.stringify({
      threshold: 10000  // $10,000
    })
  },
  {
    ruleType: ValidationRuleType.ROUND_AMOUNT_PATTERN,
    name: 'Round Amount Pattern',
    description: 'Detects suspiciously round invoice amounts',
    enabled: true,
    severity: ValidationSeverity.INFO,
    config: JSON.stringify({
      minAmount: 1000,
      roundingIncrement: 100
    })
  },
  {
    ruleType: ValidationRuleType.PO_AMOUNT_VARIANCE,
    name: 'PO Amount Variance',
    description: 'Checks if invoice amount differs significantly from PO total',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: JSON.stringify({
      varianceThresholdPercent: 10  // 10%
    })
  },
  {
    ruleType: ValidationRuleType.PO_ITEM_MISMATCH,
    name: 'PO Item Mismatch',
    description: 'Checks if invoice items match the referenced PO',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: JSON.stringify({})
  },
  {
    ruleType: ValidationRuleType.DELIVERY_NOTE_MISMATCH,
    name: 'Delivery Note Mismatch',
    description: 'Validates invoice items against linked delivery notes',
    enabled: true,
    severity: ValidationSeverity.WARNING,
    config: JSON.stringify({})
  },
  {
    ruleType: ValidationRuleType.PRICE_VARIANCE,
    name: 'Price Variance',
    description: 'Detects significant price differences from catalog prices',
    enabled: true,
    severity: ValidationSeverity.INFO,
    config: JSON.stringify({
      varianceThresholdPercent: 20  // 20%
    })
  }
];

async function seedValidationRules() {
  console.log('Seeding validation rules...');

  for (const rule of validationRules) {
    await prisma.validationRule.upsert({
      where: { ruleType: rule.ruleType },
      update: {},
      create: rule
    });
  }

  console.log('Validation rules seeded successfully!');
}

seedValidationRules()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Appendix C: Quality Gates

All implementations must pass:

### Backend Quality Gates
- ✅ TypeScript compiles without errors
- ✅ All Prisma migrations applied successfully
- ✅ Unit test coverage >80% for validation rules
- ✅ Integration tests pass for invoice workflow
- ✅ API tests pass for all endpoints
- ✅ No linting errors (ESLint)
- ✅ Performance: Validation completes in <500ms per invoice
- ✅ Security: SQL injection tests pass
- ✅ Security: XSS protection verified

### Frontend Quality Gates
- ✅ TypeScript compiles without errors
- ✅ Component renders without console errors
- ✅ Accessible (WCAG AA compliance)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ No linting errors (ESLint)
- ✅ E2E tests pass
- ✅ Performance: Page load <2s
- ✅ UX: Loading states implemented
- ✅ UX: Error states handled gracefully

### Documentation Quality Gates
- ✅ All API endpoints documented in OpenAPI spec
- ✅ User guide covers all features
- ✅ ADR explains architectural decisions
- ✅ Code comments for complex logic
- ✅ README updated with setup instructions

---

## Summary

This specification provides a complete blueprint for implementing a robust invoice validation system with:

1. **Duplicate Prevention**: Database-level + application-level detection
2. **Suspicious Detection**: 8 configurable rules for anomaly detection
3. **Review Workflow**: Flag → Review → Override/Dismiss → Approve
4. **Dashboard**: Dedicated UI for managing flagged invoices
5. **Extensibility**: Plugin architecture for future ML integration
6. **Clean Architecture**: Domain-driven design with clear boundaries
7. **Event-Driven**: PubSub pattern for loose coupling
8. **Audit Trail**: Full tracking of overrides and reviews

The system is designed to be demo-ready while remaining production-grade, with clear extension points for future behavioral analysis and machine learning capabilities.

**Total Estimated Effort**: 4 weeks (1 full-time developer) or 2 weeks (2 developers working in parallel)

**Next Steps**:
1. Review and approve specification
2. Set up development environment
3. Begin Phase 1 implementation
4. Daily standups to track progress
5. Weekly demos to stakeholders
