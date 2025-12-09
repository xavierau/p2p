# Backend Todo Backlog

**Created**: 2025-12-05
**Last Updated**: 2025-12-05
**Status**: Active

---

## Overview

This document tracks improvement opportunities and feature requests for the backend implementation of the SME Procurement-to-Payment Management application.

---

## High Priority

### 1. Testing Framework Setup
- **Description**: Configure Vitest for backend service and API testing
- **Rationale**: No test framework currently configured; critical for code quality and refactoring confidence
- **Scope**:
  - [ ] Install and configure Vitest
  - [ ] Set up test utilities and mocks for Prisma
  - [ ] Create test fixtures for common entities (Vendor, Item, Invoice, PO)
  - [ ] Write unit tests for all service layer functions
  - [ ] Write integration tests for API endpoints
  - [ ] Configure CI pipeline for automated testing

### 2. PO-Invoice Matching Validation
- **Description**: Validate that invoice items match the linked purchase order items
- **Rationale**: Currently loose coupling via `purchaseOrderId`; no validation that items/quantities align
- **Scope**:
  - [ ] Add validation when linking invoice to PO
  - [ ] Check item IDs exist in linked PO
  - [ ] Validate quantities don't exceed PO quantities
  - [ ] Track partial fulfillment status on PO items
  - [ ] Add endpoint to check PO fulfillment status

### 3. Audit Logging Integration
- **Description**: Implement audit logging for all data mutations
- **Rationale**: `AuditLog` schema exists but no subscriber integration; needed for compliance
- **Scope**:
  - [ ] Create audit logging subscriber
  - [ ] Subscribe to relevant events (create, update, delete, status changes)
  - [ ] Record user, action, entity, old/new values, timestamp
  - [ ] Add API endpoint to query audit logs
  - [ ] Implement log retention policy

---

## Medium Priority

### 4. Email Notification System
- **Description**: Send email notifications for key workflow events
- **Rationale**: Users need to be notified of approvals, rejections, and pending items
- **Scope**:
  - [ ] Set up email service (SendGrid, AWS SES, or similar)
  - [ ] Create email templates for:
    - Invoice submitted for approval
    - Invoice approved
    - Invoice rejected
    - PO status changes
  - [ ] Create notification preferences per user
  - [ ] Subscribe to workflow events and trigger emails

### 5. Batch Operations
- **Description**: Add bulk create/update/delete endpoints for efficiency
- **Rationale**: No bulk endpoints; manual one-by-one operations are slow for large imports
- **Scope**:
  - [ ] `POST /api/items/batch` - Bulk create items
  - [ ] `PUT /api/items/batch` - Bulk update items
  - [ ] `POST /api/invoices/batch` - Bulk create invoices
  - [ ] `PUT /api/invoices/batch/approve` - Bulk approve invoices
  - [ ] Add transaction support for atomic batch operations
  - [ ] Implement validation and partial success handling

### 6. Enhanced Error Handling
- **Description**: Implement more specific error responses with error codes
- **Rationale**: Current error responses are generic; clients need specific codes for handling
- **Scope**:
  - [ ] Define error code taxonomy (e.g., `VENDOR_001`, `INVOICE_002`)
  - [ ] Create custom error classes with codes
  - [ ] Update all service methods to throw typed errors
  - [ ] Standardize error response format: `{ code, message, details }`
  - [ ] Document error codes in API documentation

---

## Low Priority

### 7. Cursor-Based Pagination
- **Description**: Implement cursor-based pagination for large datasets
- **Rationale**: Current offset-based pagination degrades on large tables
- **Scope**:
  - [ ] Add cursor parameter support to list endpoints
  - [ ] Implement cursor encoding/decoding
  - [ ] Return `nextCursor` in paginated responses
  - [ ] Maintain backward compatibility with offset pagination

### 8. Invoice Line Item Discounts
- **Description**: Support discounts on invoice line items
- **Rationale**: Current schema only supports `quantity * price`; no discount capability
- **Scope**:
  - [ ] Add `discount` and `discountType` fields to `InvoiceItem`
  - [ ] Update `totalAmount` calculation to apply discounts
  - [ ] Add validation for discount ranges
  - [ ] Update analytics to account for discounts

### 9. Rate Limiting Granularity
- **Description**: Implement per-endpoint rate limiting
- **Rationale**: Current rate limiting is global; need endpoint-specific limits
- **Scope**:
  - [ ] Configure different limits for read vs. write operations
  - [ ] Add higher limits for analytics endpoints
  - [ ] Implement user-tier-based rate limits
  - [ ] Add rate limit headers to responses

### 10. API Documentation
- **Description**: Generate OpenAPI/Swagger documentation
- **Rationale**: No API documentation for frontend developers or integrators
- **Scope**:
  - [ ] Install and configure swagger-jsdoc
  - [ ] Document all endpoints with parameters and responses
  - [ ] Add example request/response bodies
  - [ ] Set up Swagger UI endpoint

---

## Future Considerations

### 11. Multi-Currency Support
- **Description**: Support invoices and POs in multiple currencies
- **Scope**: Currency field, exchange rates, reporting currency conversion

### 12. Approval Workflows
- **Description**: Configurable multi-step approval workflows
- **Scope**: Approval chains, thresholds, delegation, escalation

### 13. Document Attachments
- **Description**: Attach files (PDFs, images) to invoices and POs
- **Scope**: File upload, storage (S3), retrieval, virus scanning

### 14. Vendor Portal
- **Description**: Self-service portal for vendors to submit invoices
- **Scope**: Vendor authentication, invoice submission, status tracking

### 15. Reporting & Export
- **Description**: Generate reports and export data in various formats
- **Scope**: PDF reports, Excel exports, scheduled report delivery

---

## Completed Items

_None yet_

---

## Notes

- Priority levels are suggestions; adjust based on business needs
- Each item should be broken down into smaller tasks before implementation
- Consider creating architecture docs before implementing major features
- All implementations should follow TDD practices
