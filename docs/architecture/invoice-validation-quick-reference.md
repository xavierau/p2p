# Invoice Validation System - Quick Reference

**Last Updated**: 2025-12-10

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER CREATES INVOICE                            │
│                    POST /api/invoices (with invoiceNumber)               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        INVOICE SERVICE LAYER                             │
│  1. Validate input (Zod)                                                 │
│  2. Extract/denormalize vendorId                                         │
│  3. Create invoice + items (transaction)                                 │
│  4. Publish INVOICE_CREATED event                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       VALIDATION SUBSCRIBER                              │
│  Receives: INVOICE_CREATED { invoiceId }                                 │
│  Calls: ValidationOrchestrator.validateInvoice(invoiceId)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     VALIDATION ORCHESTRATOR                              │
│  1. Fetch invoice with relations (items, vendor, PO, DNs)                │
│  2. Run DuplicateDetector.checkDuplicate(invoice)                        │
│  3. Run SuspiciousDetector.detectAnomalies(invoice)                      │
│  4. Aggregate results                                                    │
│  5. Persist InvoiceValidation records                                    │
│  6. Publish events (INVOICE_VALIDATED, DUPLICATE_DETECTED, etc.)         │
│  7. Return InvoiceValidationSummary                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
              ┌─────────────────────┴─────────────────────┐
              ↓                                           ↓
┌──────────────────────────────┐          ┌──────────────────────────────┐
│   DUPLICATE DETECTOR          │          │   SUSPICIOUS DETECTOR         │
│                               │          │                               │
│  Check:                       │          │  Load enabled rules:          │
│  - Same invoiceNumber         │          │  - MissingInvoiceNumber       │
│  - Same vendorId              │          │  - AmountThreshold            │
│  - Different invoiceId        │          │  - RoundAmountPattern         │
│  - Not deleted                │          │  - POAmountVariance           │
│                               │          │  - POItemMismatch             │
│  Return:                      │          │  - DeliveryNoteMismatch       │
│  - ValidationResult           │          │  - PriceVariance              │
│    (CRITICAL if duplicate)    │          │                               │
│                               │          │  Execute all in parallel      │
└──────────────────────────────┘          │  Return: ValidationResult[]   │
                                          └──────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATABASE (InvoiceValidation)                        │
│  Records created for each failed/flagged rule:                           │
│  - invoiceId, ruleType, severity, status=FLAGGED                         │
│  - passed=false, details={...}, metadata={...}                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER SEES RESULT                                 │
│  - Invoice created successfully                                          │
│  - Validation summary included in response                               │
│  - UI shows alerts/badges if flagged                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules Matrix

| Rule Type | Severity | Blocks Approval | Description | Config |
|-----------|----------|-----------------|-------------|--------|
| DUPLICATE_INVOICE_NUMBER | CRITICAL | ✅ Yes | Same invoice number from same vendor | - |
| MISSING_INVOICE_NUMBER | WARNING | ❌ No | Invoice number not provided | - |
| AMOUNT_THRESHOLD_EXCEEDED | WARNING | ❌ No | Invoice amount exceeds threshold | `threshold: 10000` |
| ROUND_AMOUNT_PATTERN | INFO | ❌ No | Suspiciously round amount (e.g., $1000.00) | `minAmount: 1000`<br/>`roundingIncrement: 100` |
| PO_AMOUNT_VARIANCE | WARNING | ❌ No | Invoice total differs from PO total | `varianceThresholdPercent: 10` |
| PO_ITEM_MISMATCH | WARNING | ❌ No | Invoice items don't match PO items | - |
| DELIVERY_NOTE_MISMATCH | WARNING | ❌ No | Invoice doesn't match linked delivery notes | - |
| PRICE_VARIANCE | INFO | ❌ No | Item prices differ from catalog prices | `varianceThresholdPercent: 20` |

**Blocking Logic**: Only CRITICAL severity WITHOUT override blocks approval

---

## API Endpoints Quick Reference

### Get Flagged Invoices
```http
GET /api/validations/flagged
Authorization: Bearer <token>
Permissions: VALIDATION_READ

Query Parameters:
  severity: INFO | WARNING | ERROR | CRITICAL
  status: FLAGGED | REVIEWED | OVERRIDDEN | DISMISSED
  startDate: ISO date string
  endDate: ISO date string
  page: number (default: 1)
  limit: number (default: 10)

Response:
{
  "data": [
    {
      "id": 1,
      "invoice": { ... },
      "validations": [ ... ],
      "summary": {
        "flagCount": 2,
        "highestSeverity": "CRITICAL",
        "hasOverride": false
      }
    }
  ],
  "pagination": { ... }
}
```

### Get Validation Summary for Invoice
```http
GET /api/validations/invoices/:invoiceId
Authorization: Bearer <token>
Permissions: VALIDATION_READ

Response:
{
  "invoiceId": 123,
  "isValid": false,
  "hasBlockingIssues": true,
  "flagCount": 2,
  "highestSeverity": "CRITICAL",
  "validations": [
    {
      "id": 1,
      "ruleType": "DUPLICATE_INVOICE_NUMBER",
      "severity": "CRITICAL",
      "status": "FLAGGED",
      "passed": false,
      "details": { "duplicateInvoiceId": 100 },
      "override": null
    }
  ]
}
```

### Override Validation
```http
POST /api/validations/:validationId/override
Authorization: Bearer <token>
Permissions: VALIDATION_OVERRIDE (MANAGER+)

Body:
{
  "reason": "Vendor confirmed this is a corrected invoice..." (min 10 chars)
}

Response:
{
  "validationId": 1,
  "status": "OVERRIDDEN",
  "override": {
    "id": 1,
    "userId": 5,
    "reason": "...",
    "createdAt": "2025-12-10T10:00:00Z"
  }
}
```

### Review/Dismiss Validation
```http
PUT /api/validations/:validationId/review
Authorization: Bearer <token>
Permissions: VALIDATION_READ

Body:
{
  "action": "DISMISS" | "ESCALATE"
}

Response:
{
  "validationId": 1,
  "status": "DISMISSED",
  "reviewedAt": "2025-12-10T10:00:00Z",
  "reviewedBy": 5
}
```

### Revalidate Invoice
```http
POST /api/validations/invoices/:invoiceId/revalidate
Authorization: Bearer <token>
Permissions: VALIDATION_REVALIDATE

Response:
{
  "invoiceId": 123,
  "validations": [ ... ]
}
```

### Get Validation Rules
```http
GET /api/validations/rules
Authorization: Bearer <token>
Permissions: VALIDATION_READ

Response:
{
  "rules": [
    {
      "id": 1,
      "ruleType": "DUPLICATE_INVOICE_NUMBER",
      "name": "Duplicate Invoice Number",
      "description": "...",
      "enabled": true,
      "severity": "CRITICAL",
      "config": {}
    }
  ]
}
```

### Update Validation Rule (Admin)
```http
PATCH /api/validations/rules/:ruleId
Authorization: Bearer <token>
Permissions: VALIDATION_CONFIGURE (ADMIN only)

Body:
{
  "enabled": false,
  "severity": "WARNING",
  "config": { "threshold": 15000 }
}

Response:
{
  "rule": { ... }
}
```

### Get Dashboard Stats
```http
GET /api/validations/dashboard/stats
Authorization: Bearer <token>
Permissions: VALIDATION_READ

Response:
{
  "totalFlagged": 12,
  "byStatus": [
    { "status": "FLAGGED", "count": 8 },
    { "status": "OVERRIDDEN", "count": 4 }
  ],
  "bySeverity": [
    { "severity": "CRITICAL", "count": 2 },
    { "severity": "WARNING", "count": 7 },
    { "severity": "INFO", "count": 3 }
  ],
  "recentFlags": [ ... ],
  "topRules": [
    { "ruleType": "MISSING_INVOICE_NUMBER", "count": 5 }
  ]
}
```

---

## Database Schema Quick Reference

### Invoice (Modified)
```sql
Invoice {
  -- Existing fields
  id, date, status, totalAmount, userId, purchaseOrderId, ...

  -- NEW FIELDS
  invoiceNumber  String?   -- Vendor-provided invoice number
  vendorId       Int?      -- Denormalized vendor reference

  -- Relations
  validations    InvoiceValidation[]
}

-- NEW INDEXES
CREATE INDEX Invoice_vendorId_invoiceNumber_idx ON Invoice(vendorId, invoiceNumber);
```

### InvoiceValidation (New)
```sql
InvoiceValidation {
  id            Int @id @default(autoincrement())
  invoiceId     Int
  ruleType      ValidationRuleType
  severity      ValidationSeverity
  status        ValidationStatus @default(FLAGGED)
  passed        Boolean @default(false)
  details       String  -- JSON
  metadata      String? -- JSON
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  reviewedAt    DateTime?
  reviewedBy    Int?

  -- Relations
  invoice       Invoice @relation(...)
  override      ValidationOverride?
}

-- INDEXES
CREATE INDEX InvoiceValidation_invoiceId_idx ON InvoiceValidation(invoiceId);
CREATE INDEX InvoiceValidation_status_idx ON InvoiceValidation(status);
CREATE INDEX InvoiceValidation_severity_status_idx ON InvoiceValidation(severity, status);
```

### ValidationRule (New)
```sql
ValidationRule {
  id            Int @id @default(autoincrement())
  ruleType      ValidationRuleType @unique
  name          String
  description   String?
  enabled       Boolean @default(true)
  severity      ValidationSeverity @default(WARNING)
  config        String  -- JSON
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### ValidationOverride (New)
```sql
ValidationOverride {
  id            Int @id @default(autoincrement())
  validationId  Int @unique
  userId        Int
  reason        String
  createdAt     DateTime @default(now())

  -- Relations
  validation    InvoiceValidation @relation(...)
  user          User @relation(...)
}
```

---

## Permissions Matrix

| Permission | ADMIN | MANAGER | USER | VIEWER |
|------------|-------|---------|------|--------|
| VALIDATION_READ | ✅ | ✅ | ✅ | ✅ |
| VALIDATION_OVERRIDE | ✅ | ✅ | ❌ | ❌ |
| VALIDATION_CONFIGURE | ✅ | ❌ | ❌ | ❌ |
| VALIDATION_REVALIDATE | ✅ | ✅ | ❌ | ❌ |

---

## Common Use Cases

### 1. Create Invoice with Validation
```typescript
// Frontend
const response = await fetch('/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceNumber: 'INV-001',
    items: [...],
    project: 'Project X',
    branchId: 1
  })
});

const invoice = await response.json();

// Check validation summary
if (invoice.validationSummary?.flagCount > 0) {
  // Show alerts to user
}
```

### 2. Check if Invoice Can Be Approved
```typescript
const summary = await validationService.getValidationSummary(invoiceId);

if (summary.hasBlockingIssues) {
  alert('Cannot approve: Critical validation issues exist');
  return;
}

if (summary.flagCount > 0) {
  const confirmed = confirm('Invoice has warnings. Approve anyway?');
  if (!confirmed) return;
}

// Proceed with approval
await invoiceService.approveInvoice(invoiceId);
```

### 3. Override Critical Validation
```typescript
const validationId = 1;
const reason = 'Vendor confirmed this is a corrected invoice to replace the previously submitted one.';

await validationService.overrideValidation(validationId, reason);

// Now invoice can be approved
```

### 4. Configure Rule Threshold (Admin)
```typescript
const ruleId = 3; // AMOUNT_THRESHOLD_EXCEEDED
const newConfig = {
  enabled: true,
  severity: 'WARNING',
  config: {
    threshold: 15000  // Increase from $10k to $15k
  }
};

await validationService.updateValidationRule(ruleId, newConfig);
```

---

## Troubleshooting

### Issue: Validation not running on invoice creation
**Check**:
1. Subscriber registered? Check `server/src/index.ts`
2. Event published? Check `invoiceService.createInvoice()`
3. Logs show validation execution? Check server logs

### Issue: Duplicate not detected
**Check**:
1. Invoice has `invoiceNumber` field populated?
2. Invoice has `vendorId` field populated?
3. Rule enabled? Check `ValidationRule` table
4. Duplicate exists? Query: `SELECT * FROM Invoice WHERE vendorId = X AND invoiceNumber = 'Y'`

### Issue: Override not working
**Check**:
1. User has `VALIDATION_OVERRIDE` permission?
2. Reason meets minimum length (10 chars)?
3. Validation exists and is FLAGGED?
4. Check `ValidationOverride` table for record

### Issue: Approval still blocked after override
**Check**:
1. Override successfully created? Check `ValidationOverride` table
2. InvoiceValidation.status updated to OVERRIDDEN?
3. Cache issue? Revalidate invoice
4. Multiple CRITICAL flags? Must override all

---

## Performance Optimization Tips

### 1. Database Indexes
Ensure these indexes exist:
- `Invoice(vendorId, invoiceNumber)` - Duplicate detection
- `InvoiceValidation(invoiceId)` - Fetch validations
- `InvoiceValidation(status, severity)` - Dashboard queries

### 2. Query Optimization
```typescript
// Good: Use select to limit fields
const invoice = await prisma.invoice.findUnique({
  where: { id },
  select: {
    id: true,
    invoiceNumber: true,
    vendorId: true,
    totalAmount: true,
    items: {
      select: { itemId: true, quantity: true, price: true }
    }
  }
});

// Bad: Fetch all fields and deep relations
const invoice = await prisma.invoice.findUnique({
  where: { id },
  include: { items: { include: { item: true } } }
});
```

### 3. Parallel Execution
Rules execute in parallel for performance:
```typescript
const results = await Promise.all(
  rules.map(rule => rule.validate(invoice, context))
);
```

### 4. Caching (Future)
Consider caching:
- Validation rules (rarely change)
- Vendor invoice number sets (for duplicate detection)
- Invoice validation summaries (invalidate on update)

---

## Testing Checklist

### Unit Tests
- [ ] Each rule validates correctly (happy path)
- [ ] Each rule handles edge cases (null, empty, invalid data)
- [ ] Orchestrator aggregates results correctly
- [ ] Helpers (isBlockingValidation, getHighestSeverity) work correctly

### Integration Tests
- [ ] Invoice creation triggers validation
- [ ] Validation results persisted to database
- [ ] Events published correctly
- [ ] Approval blocked by CRITICAL flags
- [ ] Approval allowed after override

### E2E Tests
- [ ] Create invoice → see flags in UI
- [ ] Override validation → approval enabled
- [ ] Admin configure rule → new threshold applied
- [ ] Dashboard displays correct stats

---

## Monitoring & Metrics

### Key Metrics to Track
- Validation execution time (target: <500ms)
- Flagged invoice rate (% of total invoices)
- Override rate (% of flagged invoices overridden)
- Top triggered rules
- False positive rate (requires manual labeling)

### Logging
```typescript
logger.info({ invoiceId, validationCount, duration }, 'Invoice validated');
logger.warn({ invoiceId, ruleType, severity }, 'Validation failed');
logger.info({ validationId, userId, reason }, 'Validation overridden');
```

### Alerts
Set up alerts for:
- High duplicate detection rate (possible data quality issue)
- Very high override rate (rules too strict?)
- Validation errors/failures
- Performance degradation (>1s validation time)

---

## Extensibility Hooks

### 1. Add New Rule
1. Add enum value to `ValidationRuleType`
2. Create rule class implementing `IValidationRule`
3. Add rule to seed data
4. Register in `SuspiciousDetector`
5. Add tests

### 2. Integrate ML Model (Future)
```typescript
class MLFraudDetector implements IValidationRule {
  async validate(invoice: any, context: ValidationContext) {
    const features = this.extractFeatures(invoice);
    const prediction = await this.model.predict(features);

    return {
      ruleType: ValidationRuleType.ML_FRAUD_DETECTION,
      severity: prediction.score > 0.8 ? 'CRITICAL' : 'WARNING',
      passed: prediction.score < 0.5,
      details: { score: prediction.score, factors: prediction.factors }
    };
  }
}
```

### 3. External Service Integration
```typescript
class VendorVerificationRule implements IValidationRule {
  async validate(invoice: any, context: ValidationContext) {
    const vendor = invoice.vendor;
    const verification = await externalAPI.verifyVendor(vendor.taxId);

    return {
      ruleType: ValidationRuleType.VENDOR_VERIFICATION,
      severity: 'WARNING',
      passed: verification.status === 'VERIFIED',
      details: { verification }
    };
  }
}
```

---

## Migration Guide

### Step 1: Backup Database
```bash
pg_dump -U user -d payment_management > backup.sql
```

### Step 2: Run Migration
```bash
cd server
npx prisma migrate dev --name add-invoice-validation
```

### Step 3: Seed Validation Rules
```bash
npx ts-node prisma/seed-validation-rules.ts
```

### Step 4: Backfill vendorId (if needed)
```sql
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

### Step 5: Verify
```bash
npx prisma studio
# Check that ValidationRule table has 8 records
# Check that Invoice.vendorId is populated
```

### Step 6: Deploy Code
```bash
git checkout feature/invoice-validation
npm run build
pm2 restart payment-management
```

---

## Quick Commands

```bash
# Development
pnpm dev                                    # Start dev server
npx prisma studio                           # Open database GUI
npx prisma migrate dev                      # Apply migrations
npx prisma db seed                          # Seed data

# Testing
npm run test -- validation                  # Run validation tests
npm run test:coverage -- validation         # Coverage report
npm run test:e2e                            # E2E tests

# Database
npx prisma db push                          # Sync schema without migration
npx prisma generate                         # Regenerate Prisma client
npx prisma migrate reset                    # Reset database

# Production
npm run build                               # Build TypeScript
npm start                                   # Start production server
pm2 restart payment-management              # Restart with PM2
```

---

## Support & Resources

- **Full Specification**: `/docs/architecture/2025-12-10-invoice-validation-system.md`
- **Implementation Checklist**: `/docs/implementation/invoice-validation-checklist.md`
- **Type Definitions**: `/server/src/domain/validation/types.ts`
- **User Guide**: `/docs/guides/invoice-validation-user-guide.md` (to be created)
- **Admin Guide**: `/docs/guides/invoice-validation-admin-guide.md` (to be created)

**Questions?** Contact the development team or refer to the main specification document.
