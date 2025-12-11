# Invoice Validation Testing Guide

This guide provides comprehensive testing instructions for the invoice validation feature.

## Prerequisites

### Fix Pre-existing Error

Before testing, fix the TypeScript error in `server/src/infrastructure/persistence/prisma/repositories/PrismaDeliveryNoteRepository.ts`:

**Line 21** - The `items.create` needs to include the `item` relation:

```typescript
// Current (incorrect):
items: {
  create: data.items.map(item => ({
    itemId: item.itemId,
    quantityOrdered: item.quantityOrdered,
    quantityDelivered: item.quantityDelivered,
    condition: item.condition,
    discrepancyReason: item.discrepancyReason,
  }))
}

// Fixed:
items: {
  create: data.items.map(item => ({
    item: { connect: { id: item.itemId } },
    quantityOrdered: item.quantityOrdered,
    quantityDelivered: item.quantityDelivered,
    condition: item.condition,
    discrepancyReason: item.discrepancyReason,
  }))
}
```

### Start Servers

```bash
# Terminal 1 - Backend
cd server
pnpm dev

# Terminal 2 - Frontend
cd client
pnpm dev
```

## Test Plan

### Phase 1: Database Setup ✅

**Verify schema changes:**
```bash
cd server
npx prisma studio
```

Check that these models exist:
- ✅ InvoiceValidation
- ✅ ValidationRule
- ✅ ValidationOverride

Verify 8 validation rules are seeded:
- DUPLICATE_INVOICE_NUMBER (CRITICAL)
- MISSING_INVOICE_NUMBER (WARNING)
- AMOUNT_THRESHOLD_EXCEEDED (WARNING)
- ROUND_AMOUNT_PATTERN (INFO)
- PO_AMOUNT_VARIANCE (WARNING)
- PO_ITEM_MISMATCH (WARNING)
- DELIVERY_NOTE_MISMATCH (WARNING)
- PRICE_VARIANCE (INFO)

### Phase 2: Backend API Testing

#### Test 1: Create Invoice with Duplicate Invoice Number

**Expected:** CRITICAL validation triggered, invoice cannot be approved

```bash
# Create first invoice
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vendorId": 1,
    "invoiceNumber": "INV-12345",
    "amount": 1000,
    "dueDate": "2025-12-31",
    "items": [{"itemId": 1, "quantity": 10, "unitPrice": 100}]
  }'

# Create second invoice with SAME invoice number
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vendorId": 1,
    "invoiceNumber": "INV-12345",
    "amount": 2000,
    "dueDate": "2025-12-31",
    "items": [{"itemId": 2, "quantity": 20, "unitPrice": 100}]
  }'

# Get validation summary
curl http://localhost:3000/api/validations/invoices/:invoiceId \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "invoiceId": 2,
  "hasBlockingIssues": true,
  "validations": [{
    "ruleType": "DUPLICATE_INVOICE_NUMBER",
    "severity": "CRITICAL",
    "status": "FLAGGED",
    "message": "Duplicate invoice number INV-12345 from vendor Acme Corp"
  }]
}
```

#### Test 2: Create Invoice Above Threshold

**Expected:** WARNING validation (default threshold: $10,000)

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vendorId": 1,
    "invoiceNumber": "INV-99999",
    "amount": 15000,
    "dueDate": "2025-12-31",
    "items": [{"itemId": 1, "quantity": 150, "unitPrice": 100}]
  }'
```

#### Test 3: Try to Approve Invoice with Critical Validation

**Expected:** 400 error - approval blocked

```bash
curl -X PUT http://localhost:3000/api/invoices/:id/approve \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "error": "Cannot approve invoice with unresolved critical validations"
}
```

#### Test 4: Override Critical Validation

**Expected:** Validation marked as OVERRIDDEN, invoice can now be approved

```bash
curl -X POST http://localhost:3000/api/validations/:validationId/override \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "reason": "Vendor corrected the invoice number discrepancy via email"
  }'

# Now approve should work
curl -X PUT http://localhost:3000/api/invoices/:id/approve \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 5: Get Flagged Invoices List

```bash
curl "http://localhost:3000/api/validations/flagged?severity=CRITICAL" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 6: Update Validation Rule Configuration

```bash
# Lower threshold to $5,000
curl -X PATCH http://localhost:3000/api/validations/rules/:ruleId \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "config": {"threshold": 5000}
  }'
```

### Phase 3: Frontend UI Testing

#### Test 1: View Flagged Invoices Dashboard

1. Navigate to **Flagged Invoices** in sidebar
2. Verify statistics cards show correct counts
3. Filter by severity (CRITICAL, WARNING, INFO)
4. Filter by status (FLAGGED, OVERRIDDEN, DISMISSED)
5. Click on an invoice to navigate to details

**Expected:**
- Dashboard loads without errors
- Filters work correctly
- Click-through navigation works

#### Test 2: Invoice Detail with Validation Alerts

1. Navigate to invoice with critical validation
2. Verify red alert banner appears at top
3. Verify "Approve" button is disabled
4. Verify tooltip explains why approval is blocked

**Expected:**
- Validation alerts are prominently displayed
- Critical issues shown in red
- Warnings shown in yellow
- Info shown in blue

#### Test 3: Override Workflow

1. Click "Override" button on critical validation
2. Enter reason (minimum 10 characters)
3. Submit override
4. Verify validation status changes to "OVERRIDDEN"
5. Verify override info displays (who, when, reason)
6. Verify "Approve" button is now enabled

**Expected:**
- Dialog opens with form
- Validation enforces minimum 10 characters
- Success message appears
- UI updates without refresh

#### Test 4: Invoice List with Validation Badges

1. Navigate to **Invoices** list
2. Verify invoices with validations show badges
3. Verify badge shows count and severity
4. Verify approve button is disabled for flagged invoices
5. Hover over disabled button to see tooltip

**Expected:**
- Badges appear on flagged invoices
- Color-coded by severity (red/yellow/blue)
- Tooltip provides clear explanation

#### Test 5: Validation Rules Configuration (Admin)

1. Navigate to **Validation Rules**
2. Toggle rule enabled/disabled
3. Change severity level (CRITICAL → WARNING)
4. Update threshold value
5. Verify changes save immediately
6. Verify success message appears

**Expected:**
- All rules listed with descriptions
- Toggle switches work
- Severity dropdown works
- Threshold input accepts numbers
- Changes persist after page refresh

### Phase 4: Integration Testing

#### Test Scenario 1: Complete Invoice Lifecycle

1. Create invoice with duplicate number
2. Verify automatic validation triggers
3. Check validation appears in dashboard
4. View invoice detail - see alert
5. Try to approve - blocked
6. Override validation with reason
7. Approve invoice successfully
8. Verify validation history preserved

#### Test Scenario 2: Multiple Validations

1. Create invoice with:
   - Missing invoice number (WARNING)
   - Amount > $10,000 (WARNING)
   - Round amount like $10,000.00 (INFO)
2. Verify all 3 validations appear
3. Verify invoice can still be approved (no CRITICAL issues)
4. Dismiss INFO validation
5. Approve with warnings present

#### Test Scenario 3: PO Variance Detection

1. Create purchase order for $1,000
2. Create invoice against PO for $1,500
3. Verify PO_AMOUNT_VARIANCE triggered (>10% variance)
4. Review validation details
5. Override with explanation

### Phase 5: Performance Testing

1. **Load Test:** Create 100 invoices rapidly
2. **Parallel Validation:** Verify all validate in <5 seconds
3. **Dashboard Performance:** Load flagged invoices page with 100+ items
4. **Search Performance:** Filter dashboard with various criteria

**Expected:**
- Single invoice validation: <500ms
- Batch validation: <5s for 100 invoices
- Dashboard load: <2s
- No UI freezing during validation

### Phase 6: Edge Cases

#### Test 1: No Invoice Number
- Create invoice without `invoiceNumber`
- Verify WARNING validation (not CRITICAL)

#### Test 2: Exactly at Threshold
- Create invoice for exactly $10,000
- Verify no threshold validation (only > threshold)

#### Test 3: Disable All Rules
- Disable all validation rules
- Create invoice
- Verify no validations run

#### Test 4: Override Then Re-validate
- Override a validation
- Trigger re-validation
- Verify override is preserved

### Phase 7: Security Testing

1. **Authorization:** Try to override validation without proper role
2. **Input Validation:** Submit override with empty reason
3. **SQL Injection:** Try malicious input in invoice number
4. **XSS:** Try script tags in override reason

**Expected:**
- All unauthorized requests return 403
- All invalid input rejected with clear error
- No security vulnerabilities

## Test Data Setup

### Create Test Vendors
```sql
INSERT INTO "Vendor" (name, email, phone, address, status, taxId, paymentTerms, "glCode", "createdBy")
VALUES ('Acme Corp', 'acme@example.com', '555-0001', '123 Main St', 'ACTIVE', 'TAX001', 30, '5000', 1);
```

### Create Test Items
```sql
INSERT INTO "Item" (name, description, unit, category, "glCode", "createdBy")
VALUES ('Widget A', 'Standard widget', 'UNIT', 'SUPPLIES', '5100', 1);
```

## Acceptance Criteria

### ✅ Must Have (All must pass)
- [ ] Duplicate invoice numbers are detected (CRITICAL)
- [ ] Critical validations block approval
- [ ] Overrides work with audit trail
- [ ] Dashboard displays all flagged invoices
- [ ] Validation badges appear on invoice list
- [ ] Rules can be enabled/disabled
- [ ] All API endpoints return correct status codes
- [ ] Frontend compiles without errors
- [ ] Backend compiles without errors (after fix)

### ✅ Should Have (Nice to have)
- [ ] Threshold rules configurable
- [ ] Severity levels adjustable
- [ ] Real-time updates (no refresh needed)
- [ ] Performance <500ms per validation
- [ ] Accessible (keyboard navigation, screen reader)

### ✅ Could Have (Future enhancements)
- [ ] Email notifications for critical validations
- [ ] Validation rule testing (dry run)
- [ ] Bulk override capabilities
- [ ] Advanced reporting and analytics

## Troubleshooting

### Backend won't start
- Check Prisma schema is applied: `npx prisma db push`
- Verify database is running (PostgreSQL Docker)
- Check environment variables in `.env`
- Fix pre-existing PrismaDeliveryNoteRepository error

### Validations not triggering
- Check validation rules are enabled in database
- Verify event subscriber is registered in `index.ts`
- Check PubSub events are being published
- Review server logs for errors

### Frontend errors
- Verify API endpoints are accessible
- Check CORS configuration
- Verify JWT token is valid
- Check browser console for errors

## Success Metrics

- ✅ All 8 validation rules working
- ✅ 0 TypeScript errors
- ✅ <500ms validation response time
- ✅ 100% test coverage for validation rules
- ✅ All UI components accessible (WCAG AA)
- ✅ Zero security vulnerabilities

## Next Steps After Testing

1. Document any bugs found
2. Create tickets for enhancements
3. Add E2E tests with Playwright/Cypress
4. Performance profiling with Chrome DevTools
5. Security audit with OWASP ZAP
6. User acceptance testing (UAT)
7. Deploy to staging environment
