# Product Requirements Document (PRD)
## SME Procurement-to-Payment Management Application

**Document Version**: 1.0
**Last Updated**: December 10, 2025
**Product Owner**: Development Team
**Status**: Active Development

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Vision and Objectives](#product-vision-and-objectives)
3. [User Personas](#user-personas)
4. [User Stories](#user-stories)
5. [Functional Requirements](#functional-requirements)
6. [Non-Functional Requirements](#non-functional-requirements)
7. [Success Metrics](#success-metrics)
8. [Feature Roadmap](#feature-roadmap)
9. [Technical Architecture](#technical-architecture)
10. [Technical Constraints](#technical-constraints)
11. [Appendix](#appendix)

---

## Executive Summary

### Product Vision
The SME Procurement-to-Payment Management Application is a comprehensive full-stack solution designed to streamline the entire procurement-to-payment lifecycle for small and medium enterprises (SMEs). The application provides powerful analytics, automated workflows, and seamless accounting integration to help finance teams manage vendors, items, purchase orders, and invoices with transparency, accuracy, and efficiency.

### Business Objectives
- **Reduce Processing Time**: Automate manual invoice approval workflows and reduce invoice processing time by 70%
- **Improve Visibility**: Provide real-time analytics and spending insights across vendors, departments, and cost centers
- **Ensure Compliance**: Maintain comprehensive audit trails for all financial transactions and approvals
- **Enable Integration**: Seamlessly sync with external accounting systems (starting with Xero) to eliminate double data entry
- **Support Growth**: Build a scalable platform that grows with business needs from single-location to multi-branch operations

### Target Users
- **Primary**: Finance teams, accounting staff, and procurement managers in SMEs (10-500 employees)
- **Secondary**: Department heads requiring spending visibility, external vendors submitting invoices via API
- **Tertiary**: Auditors and compliance officers requiring transaction history and audit trails

### Current State
- **Phase**: Active Development (v1.0 in progress)
- **Deployed**: Development environment only
- **Key Features Live**: User authentication, vendor/item management, invoice creation and approval workflows, purchase order management, analytics dashboard, MCP integration for AI-powered invoice creation
- **Pending Features**: Comprehensive testing framework, advanced approval workflows, document attachments, vendor portal

---

## Product Vision and Objectives

### Vision Statement
To become the go-to procurement-to-payment solution for SMEs, delivering enterprise-grade features with SME-friendly simplicity, enabling financial teams to shift from transaction processing to strategic financial management.

### Strategic Objectives

#### 1. Operational Excellence
- Automate 80% of manual invoice processing tasks
- Reduce invoice approval cycle time from days to hours
- Eliminate data entry errors through validation and integrations

#### 2. Financial Visibility
- Provide real-time spending visibility across all organizational dimensions (vendor, department, branch, cost center)
- Enable proactive price variance detection and vendor performance tracking
- Support data-driven procurement decisions with trend analysis

#### 3. Compliance and Control
- Maintain complete audit trails for all financial transactions
- Support role-based access control (RBAC) with granular permissions
- Enable multi-step approval workflows with delegation and escalation

#### 4. Integration and Extensibility
- Seamless bidirectional sync with accounting systems (Xero, QuickBooks, etc.)
- RESTful API for third-party integrations
- MCP (Model Context Protocol) server for AI-powered invoice processing
- Webhook support for event-driven integrations

#### 5. User Experience
- Intuitive, modern UI requiring minimal training
- Mobile-responsive design for on-the-go approvals
- Self-service vendor portal reducing inbound inquiries

---

## User Personas

### Persona 1: Finance Manager (Sarah)
**Role**: Finance Manager
**Age**: 35-45
**Technical Proficiency**: Medium
**Goals**:
- Approve invoices quickly and accurately
- Monitor departmental spending against budgets
- Ensure compliance with approval policies
- Generate reports for executive team

**Pain Points**:
- Email-based approval workflows are slow and error-prone
- No visibility into pending invoices until they arrive
- Manual reconciliation with accounting system is tedious
- Difficulty tracking which invoices need attention

**How This Product Helps**:
- Dashboard with pending approvals and spending alerts
- One-click approve/reject with audit trail
- Automatic sync with Xero eliminates manual entry
- Configurable approval thresholds and delegation

### Persona 2: Procurement Officer (Marcus)
**Role**: Procurement Officer
**Age**: 28-38
**Technical Proficiency**: High
**Goals**:
- Create purchase orders efficiently
- Track vendor performance and pricing trends
- Negotiate better pricing with data-driven insights
- Ensure purchase orders match received invoices

**Pain Points**:
- Vendors frequently change prices without notice
- Difficult to compare pricing across vendors
- Manual matching of invoices to POs is time-consuming
- No historical data to support vendor negotiations

**How This Product Helps**:
- Automatic price change alerts with historical tracking
- Vendor performance dashboards with spending breakdown
- PO-to-invoice matching validation
- Analytics for price variance and trends

### Persona 3: Department Head (Linda)
**Role**: Marketing Department Head
**Age**: 40-50
**Technical Proficiency**: Low
**Goals**:
- View department spending in real-time
- Submit invoices for approval quickly
- Understand where budget is being spent
- Stay within allocated budget

**Pain Points**:
- Spreadsheet-based budget tracking is outdated
- Can't easily see pending vs. approved spending
- Difficult to identify budget overruns early
- No drill-down into spending categories

**How This Product Helps**:
- Department-specific spending dashboard (read-only)
- Real-time budget vs. actual comparison
- Breakdown by vendor and cost center
- Mobile-friendly interface for quick checks

### Persona 4: Accounts Payable Clerk (James)
**Role**: AP Clerk
**Age**: 25-35
**Technical Proficiency**: Medium
**Goals**:
- Process high volume of invoices accurately
- Ensure all invoices are properly approved before payment
- Maintain accurate records for audit
- Minimize manual data entry

**Pain Points**:
- Manual entry of invoice data from PDFs/emails
- Chasing approvers for overdue approvals
- Errors in vendor information causing payment delays
- Time-consuming reconciliation with accounting system

**How This Product Helps**:
- Structured invoice entry with validation
- Automated approval routing and reminders
- Vendor master data management
- Seamless Xero integration for push-button sync

### Persona 5: External Vendor (TechSupply Co.)
**Role**: Supplier/Vendor
**Age**: N/A (Organizational User)
**Technical Proficiency**: Varies
**Goals**:
- Submit invoices electronically
- Track invoice status (pending, approved, paid)
- Reduce payment delays due to lost invoices
- Minimize follow-up calls to accounting

**Pain Points**:
- Email invoices sometimes get lost
- No visibility into approval status
- Lengthy payment cycles
- Multiple follow-up calls required

**How This Product Helps** (Future):
- Self-service vendor portal for invoice submission
- Real-time status tracking
- Automated notifications on approval/payment
- API integration for programmatic invoice submission

### Persona 6: Auditor (Patricia)
**Role**: External Auditor
**Age**: 45-55
**Technical Proficiency**: Medium
**Goals**:
- Review complete transaction history
- Verify approval workflows were followed
- Identify any unauthorized changes
- Export data for compliance reporting

**Pain Points**:
- Incomplete audit trails in manual systems
- Difficulty tracking who approved what and when
- No change history on modified invoices
- Time-consuming data extraction

**How This Product Helps**:
- Comprehensive audit log with user, timestamp, and changes
- Immutable approval records
- Role-based access with VIEWER permission for auditors
- Export capabilities for all transaction data

---

## User Stories

### Epic 1: User Authentication and Authorization

**US-001: User Registration**
**As a** System Administrator
**I want to** register new users with appropriate roles
**So that** team members can access the system with correct permissions
**Acceptance Criteria**:
- Admin can create users with email, name, and role (ADMIN, MANAGER, USER, VIEWER)
- Passwords are securely hashed with bcrypt
- Email addresses are unique across the system
- New users receive welcome email with login instructions (future)

**US-002: Secure Login with Rate Limiting**
**As a** registered user
**I want to** log in securely with my credentials
**So that** I can access the system safely
**Acceptance Criteria**:
- User logs in with email and password
- JWT access token issued with 15-minute expiry
- Refresh token stored as httpOnly cookie with 7-day expiry
- Account locked for 15 minutes after 5 failed attempts
- Login attempts and last login timestamp recorded

**US-003: Token Refresh**
**As a** logged-in user
**I want to** automatically renew my session
**So that** I don't get logged out during active use
**Acceptance Criteria**:
- Access token auto-refreshes before expiry using refresh token
- Token rotation implemented (old refresh token invalidated)
- Session extends up to maximum refresh token lifetime
- Expired refresh tokens return 401 and require re-login

**US-004: Role-Based Access Control**
**As a** System Administrator
**I want to** control what each user role can do
**So that** users only access features appropriate to their role
**Acceptance Criteria**:
- ADMIN: Full access to all features
- MANAGER: Full vendor/item/invoice/PO access, can approve/reject invoices
- USER: Can create vendors, items, invoices, POs, but cannot approve/reject
- VIEWER: Read-only access to all entities
- API endpoints enforce permission checks using middleware

**US-005: Password Reset**
**As a** user who forgot their password
**I want to** reset my password via email
**So that** I can regain access to my account
**Acceptance Criteria**:
- User submits forgot password request with email
- Secure reset token generated and sent via email (future implementation)
- Reset link expires after 1 hour
- User sets new password via reset link

### Epic 2: Vendor Management

**US-006: Create Vendor**
**As a** Procurement Officer
**I want to** add new vendors to the system
**So that** I can associate items and purchase orders with them
**Acceptance Criteria**:
- Vendor created with name and optional contact information
- Vendor name is required and validated
- Vendor appears in vendor list immediately
- Audit log records vendor creation

**US-007: View Vendor List**
**As a** Finance Manager
**I want to** view all active vendors with pagination
**So that** I can browse and search vendors efficiently
**Acceptance Criteria**:
- Vendors displayed in paginated list (default 10 per page)
- Supports filtering by name (exact match or contains)
- Soft-deleted vendors excluded from default view
- Pagination includes total count and page navigation

**US-008: View Vendor Details**
**As a** Procurement Officer
**I want to** view detailed vendor information including associated items and POs
**So that** I can assess vendor relationships and activity
**Acceptance Criteria**:
- Vendor detail page shows name, contact, creation date
- Displays list of all items supplied by vendor
- Shows all purchase orders with this vendor
- Displays total spending with this vendor over time

**US-009: Update Vendor**
**As a** Procurement Officer
**I want to** update vendor contact information
**So that** I can keep vendor records current
**Acceptance Criteria**:
- Update vendor name and contact information
- Changes immediately reflected in system
- Audit log records old and new values
- Cannot update deleted vendors

**US-010: Delete Vendor**
**As a** Manager
**I want to** deactivate vendors no longer used
**So that** vendor list remains clean and relevant
**Acceptance Criteria**:
- Vendor soft-deleted (deletedAt timestamp set)
- Soft-deleted vendors excluded from active lists
- Associated items remain but marked as from deleted vendor
- Cannot delete vendor with active purchase orders
- Audit log records deletion

### Epic 3: Item Management

**US-011: Create Item**
**As a** Procurement Officer
**I want to** add items to the catalog with pricing
**So that** I can use them in purchase orders and invoices
**Acceptance Criteria**:
- Item created with name, price, vendor, and optional item code
- Price recorded as first entry in price history
- Item code must be unique per vendor
- Vendor must exist in system
- Audit log records item creation

**US-012: View Item List with Vendor Filtering**
**As a** Finance Manager
**I want to** view all items with filtering by vendor
**So that** I can quickly find items from specific suppliers
**Acceptance Criteria**:
- Items displayed with name, price, vendor, item code
- Filter by vendor ID (exact match)
- Filter by vendor name (fuzzy/contains match)
- Pagination with configurable page size
- Soft-deleted items excluded

**US-013: View Item Details with Price History**
**As a** Procurement Officer
**I want to** see item details including full price history
**So that** I can track price changes over time
**Acceptance Criteria**:
- Detail page shows current price, vendor, item code
- Price history table shows all historical prices with dates
- Price changes highlighted with percentage variance
- Chart visualization of price trend over time

**US-014: Update Item Price**
**As a** Procurement Officer
**I want to** update item pricing
**So that** catalog reflects current vendor pricing
**Acceptance Criteria**:
- Update item name, price, vendor, or item code
- Price change automatically creates new price history record
- Old price preserved in history with timestamp
- Price change analytics updated
- Audit log records change

**US-015: Price Change Alerts**
**As a** Procurement Officer
**I want to** see recent price changes in dashboard
**So that** I'm aware of vendor price fluctuations
**Acceptance Criteria**:
- Dashboard displays recent price changes (last 30 days)
- Shows old price, new price, absolute change, percentage change
- Sorted by date descending
- Highlights increases in red, decreases in green
- Paginated for large datasets

### Epic 4: Purchase Order Management

**US-016: Create Purchase Order**
**As a** Procurement Officer
**I want to** create purchase orders with multiple line items
**So that** I can formally order items from vendors
**Acceptance Criteria**:
- PO created with vendor, date, status (default DRAFT)
- Line items specify item, quantity, and price (locked at PO creation)
- Total amount calculated automatically
- PO number auto-generated sequentially
- Audit log records creation

**US-017: View Purchase Order List**
**As a** Finance Manager
**I want to** view all purchase orders with filtering
**So that** I can track procurement activity
**Acceptance Criteria**:
- List shows PO number, vendor, date, status, total amount
- Filter by vendor, status (DRAFT/SENT/FULFILLED), date range
- Pagination support
- Soft-deleted POs excluded
- Status badges color-coded

**US-018: View Purchase Order Details**
**As a** Procurement Officer
**I want to** view detailed PO information
**So that** I can review order contents and status
**Acceptance Criteria**:
- Detail page shows vendor, date, status, line items
- Each line item shows item name, quantity, unit price, subtotal
- Total amount displayed prominently
- Related invoices linked to this PO displayed
- Fulfillment status indicator (e.g., "2 of 3 invoices received")

**US-019: Update Purchase Order Status**
**As a** Manager
**I want to** change PO status from DRAFT to SENT to FULFILLED
**So that** I can track PO lifecycle
**Acceptance Criteria**:
- Status updated via dropdown or status change button
- Valid transitions: DRAFT → SENT → FULFILLED
- SENT POs can be edited (items cannot be changed)
- FULFILLED POs are read-only
- Status change triggers email notification to vendor (future)
- Audit log records status change

**US-020: Delete Purchase Order**
**As a** Manager
**I want to** cancel draft purchase orders
**So that** incorrect POs don't clutter the system
**Acceptance Criteria**:
- Only DRAFT POs can be deleted
- Soft-delete sets deletedAt timestamp
- Cannot delete PO with linked invoices
- Audit log records deletion

### Epic 5: Invoice Management

**US-021: Create Invoice Manually**
**As a** AP Clerk
**I want to** create invoices with multiple line items
**So that** I can record vendor bills for approval
**Acceptance Criteria**:
- Invoice created with items (itemId, quantity, price)
- Optional fields: project, branch, department, cost center, purchaseOrderId
- Total amount calculated from line items (quantity × price)
- Invoice status defaults to PENDING
- Invoice assigned to creating user
- Audit log records creation

**US-022: Create Invoice via API**
**As a** External System
**I want to** submit invoices programmatically
**So that** invoice data flows automatically from source systems
**Acceptance Criteria**:
- API endpoint accepts JSON with items and metadata
- JWT token required for authentication
- Zod validation enforces schema compliance
- Returns invoice ID and total amount on success
- Returns detailed error messages on validation failure

**US-023: View Invoice List with Filtering**
**As a** Finance Manager
**I want to** view invoices with comprehensive filtering
**So that** I can find specific invoices quickly
**Acceptance Criteria**:
- List shows invoice ID, date, total, status, vendor, project
- Filter by status (PENDING/APPROVED/REJECTED)
- Filter by vendor, date range, project name
- Filter by branch, department, cost center
- Filter by sync status (PENDING/SYNCED/FAILED)
- Pagination with configurable page size
- Soft-deleted invoices excluded

**US-024: View Invoice Details**
**As a** Finance Manager
**I want to** view complete invoice details
**So that** I can review before approval
**Acceptance Criteria**:
- Detail page shows all invoice metadata (date, status, total, user, project)
- Line items table with item name, vendor, quantity, unit price, subtotal
- Organizational allocation (branch, department, cost center) displayed
- Linked purchase order (if any) with comparison view
- Approval history with timestamps and approver names
- Accounting sync status and error messages (if failed)

**US-025: Approve Invoice**
**As a** Manager
**I want to** approve invoices with one click
**So that** I can authorize payment efficiently
**Acceptance Criteria**:
- Only PENDING invoices can be approved
- Requires INVOICE_APPROVE permission (Manager or Admin)
- Status changes to APPROVED
- Approval triggers accounting sync event
- Approver ID and timestamp recorded
- Audit log records approval
- Cannot be reversed (must reject and create new invoice)

**US-026: Reject Invoice**
**As a** Manager
**I want to** reject invoices with reason
**So that** incorrect invoices are not paid
**Acceptance Criteria**:
- Only PENDING invoices can be rejected
- Requires INVOICE_REJECT permission (Manager or Admin)
- Status changes to REJECTED
- Optional rejection reason captured
- Rejector ID and timestamp recorded
- Audit log records rejection with reason
- Invoice creator notified via email (future)

**US-027: Update Invoice (PENDING only)**
**As a** AP Clerk
**I want to** edit pending invoices
**So that** I can correct data entry errors
**Acceptance Criteria**:
- Only PENDING status invoices can be updated
- Can update items, project, branch, department, cost center, purchaseOrderId
- Total amount recalculated on item changes
- Audit log records old and new values
- APPROVED/REJECTED invoices cannot be modified

**US-028: Delete Invoice**
**As a** Manager
**I want to** delete incorrect invoices
**So that** erroneous records don't appear in reports
**Acceptance Criteria**:
- Soft-delete sets deletedAt timestamp
- Cannot delete APPROVED invoices (must reverse via credit memo - future)
- Can delete PENDING or REJECTED invoices
- Audit log records deletion
- Soft-deleted invoices excluded from analytics

**US-029: Link Invoice to Purchase Order**
**As a** AP Clerk
**I want to** link invoices to corresponding purchase orders
**So that** I can verify invoices match PO terms
**Acceptance Criteria**:
- Invoice linked via purchaseOrderId field
- System validates invoice items exist in PO (future enhancement)
- System warns if invoice quantity exceeds PO quantity (future enhancement)
- PO fulfillment status updated based on linked invoices
- Linked PO displayed on invoice detail page

### Epic 6: Analytics and Reporting

**US-030: Dashboard Summary Metrics**
**As a** Finance Manager
**I want to** see key metrics at a glance
**So that** I can monitor business health
**Acceptance Criteria**:
- Dashboard displays total invoices, vendors, items, purchase orders
- Shows total approved spending (sum of approved invoices)
- Shows average invoice amount
- Metrics update in real-time on page load
- Supports optional date range filtering

**US-031: Invoice Trend Analysis**
**As a** Finance Manager
**I want to** view invoice amount trends over time
**So that** I can identify spending patterns
**Acceptance Criteria**:
- Line chart displays approved invoice totals by period
- Selectable periods: weekly, monthly, quarterly
- Configurable lookback (default 12 periods)
- Tooltip shows exact amount on hover
- Chart responsive on mobile devices

**US-032: Vendor Spending Breakdown**
**As a** Procurement Officer
**I want to** see spending by vendor
**So that** I can identify top vendors and concentration risk
**Acceptance Criteria**:
- Pie chart displays vendor spending shares
- Shows top N vendors (configurable, default 10)
- "Other" category for remaining vendors
- Percentage labels on chart
- Tooltip shows exact spending amount
- Click vendor to drill down to details (future)

**US-033: Item Spending Breakdown (Pareto Analysis)**
**As a** Procurement Officer
**I want to** see spending by item sorted by value
**So that** I can focus negotiations on high-value items
**Acceptance Criteria**:
- Bar chart displays item spending in descending order
- Top 20 items shown by default
- Pareto principle visualization (80/20 rule)
- Click item bar to view item detail modal
- Modal shows price history and vendor info

**US-034: Department and Branch Spending**
**As a** Finance Manager
**I want to** view spending by department and branch
**So that** I can analyze cost center performance
**Acceptance Criteria**:
- Breakdown by department shows total spending per department
- Breakdown by branch shows total spending per branch
- "Unassigned" category for invoices without department/branch
- Supports date range filtering
- Exportable to CSV/Excel (future)

**US-035: Price Change Analytics**
**As a** Procurement Officer
**I want to** monitor recent price changes
**So that** I can proactively manage cost increases
**Acceptance Criteria**:
- Table displays recent price changes (last 30 days)
- Columns: item, vendor, date, old price, new price, change, % change
- Sorted by date descending
- Color-coded: red for increases, green for decreases
- Paginated for large datasets
- Exportable to CSV (future)

### Epic 7: Organizational Hierarchy

**US-036: Manage Branches**
**As a** Admin
**I want to** create and manage branches
**So that** I can track spending by location
**Acceptance Criteria**:
- Create branches with unique names
- List all branches
- Update branch names
- Soft-delete branches (can't delete if invoices exist)
- Invoices can be assigned to branches

**US-037: Manage Departments**
**As a** Admin
**I want to** create and manage departments
**So that** I can track spending by functional area
**Acceptance Criteria**:
- Create departments with unique names
- List all departments
- Update department names
- Soft-delete departments (can't delete if invoices or cost centers exist)
- Invoices can be assigned to departments

**US-038: Manage Cost Centers**
**As a** Admin
**I want to** create cost centers under departments
**So that** I can track spending at granular level
**Acceptance Criteria**:
- Create cost centers with unique names and department assignment
- List cost centers (optionally filtered by department)
- Update cost center names
- Soft-delete cost centers (can't delete if invoices exist)
- Invoices can be assigned to cost centers
- Cost center dropdown filtered by selected department

### Epic 8: Integration with Accounting Systems

**US-039: Configure Xero Integration**
**As a** Admin
**I want to** configure Xero API credentials
**So that** invoices can sync to Xero automatically
**Acceptance Criteria**:
- Settings page for integration configuration
- Store Xero OAuth credentials securely (encrypted)
- Test connection button validates credentials
- Enable/disable integration toggle
- Integration status displayed on dashboard

**US-040: Automatic Invoice Sync on Approval**
**As a** System
**I want to** automatically sync approved invoices to Xero
**So that** accounting records are always current
**Acceptance Criteria**:
- Invoice approval triggers "invoice.approved" event
- Accounting subscriber listens for event
- Subscriber creates invoice in Xero via API
- Xero invoice ID stored in invoice.accountingId field
- Sync status updated to SYNCED on success
- Sync status updated to FAILED on error with error message
- Failed syncs retryable manually

**US-041: Manual Sync Retry**
**As a** Admin
**I want to** manually retry failed syncs
**So that** I can resolve sync errors without recreating invoices
**Acceptance Criteria**:
- Invoice detail page shows "Retry Sync" button for FAILED status
- Button triggers sync attempt
- Success updates status to SYNCED
- Failure updates error message with new details
- Audit log records retry attempts

**US-042: Sync Status Visibility**
**As a** Finance Manager
**I want to** see which invoices have synced successfully
**So that** I know accounting system is up to date
**Acceptance Criteria**:
- Invoice list shows sync status badge (PENDING/SYNCED/FAILED)
- Filter invoices by sync status
- Failed syncs highlighted prominently
- Dashboard widget shows count of failed syncs
- Sync error messages visible on invoice detail

### Epic 9: Audit and Compliance

**US-043: Comprehensive Audit Logging**
**As a** Auditor
**I want to** see complete history of all transactions
**So that** I can verify compliance and investigate issues
**Acceptance Criteria**:
- All create/update/delete operations logged to AuditLog table
- Log includes userId, action, entity, entityId, changes (JSON), IP, user agent, timestamp
- Changes field captures old and new values as JSON
- Logs immutable (no deletion or modification)
- Retained for minimum 7 years (configurable)

**US-044: View Audit Log**
**As a** Admin or Auditor
**I want to** query audit logs with filters
**So that** I can trace specific transactions or user actions
**Acceptance Criteria**:
- Audit log viewer page with filtering
- Filter by entity type, entity ID, user, date range, action
- Paginated results (100 per page)
- Export to CSV for external analysis
- Detailed view shows full JSON diff of changes

**US-045: Entity Change History**
**As a** Finance Manager
**I want to** see full change history for specific invoices/vendors/items
**So that** I can understand how records evolved
**Acceptance Criteria**:
- Invoice/vendor/item detail page shows "History" tab
- Timeline view of all changes with timestamps and users
- Expand change to see field-level diffs
- Highlight approval/rejection events
- Show related events (e.g., PO creation → invoice creation → approval)

### Epic 10: MCP Integration (AI-Powered)

**US-046: Generate MCP API Token**
**As a** Admin or Manager
**I want to** generate secure API tokens for MCP clients
**So that** AI assistants can create invoices on my behalf
**Acceptance Criteria**:
- Token generation page in Settings
- User provides friendly name (e.g., "Claude Desktop")
- Token generated with cryptographic randomness (64 bytes)
- Token hashed with bcrypt before storage
- Lookup hash (SHA-256) stored for O(1) verification
- Token prefix (first 12 chars) displayed for identification
- Expiry date configurable (default 90 days)
- Token shown ONLY once at creation (cannot retrieve later)

**US-047: Revoke MCP Token**
**As a** Admin or Manager
**I want to** revoke compromised or unused tokens
**So that** unauthorized access is prevented
**Acceptance Criteria**:
- Token list page shows all user's tokens
- Each token shows name, prefix, last used, expiry, status
- Revoke button soft-deletes token (sets revokedAt timestamp)
- Revoked tokens cannot be used for authentication
- Audit log records revocation

**US-048: MCP Tool: Create Invoice**
**As a** AI Assistant (Claude)
**I want to** create invoices via MCP tools protocol
**So that** users can request invoice creation in natural language
**Acceptance Criteria**:
- MCP tool "create_invoice" accepts items array and metadata
- Tool enforces same validation as REST API
- Tool respects user's RBAC permissions
- Returns invoice ID and total on success
- Returns detailed error on validation failure
- Session-bound authentication (no token in tool args)

**US-049: MCP Tool: Query Vendors, Items, POs**
**As a** AI Assistant (Claude)
**I want to** query entities via MCP tools
**So that** I can help users find information conversationally
**Acceptance Criteria**:
- MCP tools: get_vendors, get_vendor, get_items, get_item, get_purchase_orders, get_purchase_order
- Support filtering and pagination
- Return JSON formatted data
- Respect user's read permissions
- Session-bound authentication

**US-050: MCP HTTP Transport**
**As a** External MCP Client
**I want to** connect via HTTP SSE transport
**So that** I can integrate from any HTTP-capable environment
**Acceptance Criteria**:
- HTTP endpoint `/mcp` accepts SSE connections
- Authorization header contains MCP API token
- Token verified against lookup hash
- Session created with user context from token
- All tool calls use session's user permissions
- Connection closed on token revocation

---

## Functional Requirements

### 1. Authentication and Authorization

#### 1.1 User Authentication
- **FR-AUTH-001**: System MUST support user registration with email, password, name, and role
- **FR-AUTH-002**: Passwords MUST be hashed using bcrypt with minimum cost factor 10
- **FR-AUTH-003**: System MUST issue JWT access tokens with 15-minute expiry
- **FR-AUTH-004**: System MUST issue refresh tokens with 7-day expiry stored as httpOnly cookies
- **FR-AUTH-005**: System MUST implement token rotation on refresh (invalidate old token)
- **FR-AUTH-006**: System MUST lock accounts for 15 minutes after 5 failed login attempts
- **FR-AUTH-007**: System MUST record login attempts, timestamps, and IP addresses
- **FR-AUTH-008**: System MUST support password reset via secure email token (future)

#### 1.2 Role-Based Access Control
- **FR-AUTH-009**: System MUST support four roles: ADMIN, MANAGER, USER, VIEWER
- **FR-AUTH-010**: ADMIN role MUST have all permissions
- **FR-AUTH-011**: MANAGER role MUST have create/read/update/delete for vendors, items, invoices, POs, and approve/reject invoices
- **FR-AUTH-012**: USER role MUST have create/read for vendors, items, invoices, POs, but NOT approve/reject
- **FR-AUTH-013**: VIEWER role MUST have read-only access to all entities
- **FR-AUTH-014**: All API endpoints MUST enforce permission checks via middleware
- **FR-AUTH-015**: Unauthorized access attempts MUST return 403 Forbidden with clear error message

#### 1.3 MCP API Token Authentication
- **FR-AUTH-016**: System MUST support generating long-lived API tokens for MCP clients
- **FR-AUTH-017**: Tokens MUST be cryptographically random (64 bytes minimum)
- **FR-AUTH-018**: Tokens MUST be hashed with bcrypt before storage
- **FR-AUTH-019**: Tokens MUST have SHA-256 lookup hash for O(1) verification
- **FR-AUTH-020**: Tokens MUST have configurable expiry (default 90 days)
- **FR-AUTH-021**: Tokens MUST support soft-delete revocation (revokedAt timestamp)
- **FR-AUTH-022**: Token usage MUST update lastUsedAt timestamp
- **FR-AUTH-023**: Expired or revoked tokens MUST return 401 Unauthorized

### 2. Vendor Management

- **FR-VENDOR-001**: System MUST allow creation of vendors with name (required) and contact (optional)
- **FR-VENDOR-002**: Vendor names MUST be validated for non-empty and max 255 characters
- **FR-VENDOR-003**: System MUST support listing vendors with pagination (configurable page size)
- **FR-VENDOR-004**: System MUST support filtering vendors by name (exact or contains match)
- **FR-VENDOR-005**: System MUST support soft-delete of vendors (deletedAt timestamp)
- **FR-VENDOR-006**: Soft-deleted vendors MUST be excluded from default lists
- **FR-VENDOR-007**: System MUST prevent deletion of vendors with active (non-deleted) purchase orders
- **FR-VENDOR-008**: System MUST display vendor details including associated items and purchase orders
- **FR-VENDOR-009**: System MUST calculate and display total spending per vendor

### 3. Item Management

- **FR-ITEM-001**: System MUST allow creation of items with name, price, vendorId, and optional item_code
- **FR-ITEM-002**: Item codes MUST be unique per vendor (composite unique constraint)
- **FR-ITEM-003**: System MUST validate item prices are non-negative
- **FR-ITEM-004**: System MUST create price history record on item creation
- **FR-ITEM-005**: System MUST create new price history record whenever price is updated
- **FR-ITEM-006**: System MUST support listing items with pagination
- **FR-ITEM-007**: System MUST support filtering items by vendorId (exact match)
- **FR-ITEM-008**: System MUST support filtering items by vendor name (fuzzy/contains match)
- **FR-ITEM-009**: System MUST display item details with full price history
- **FR-ITEM-010**: System MUST calculate price change percentage for price history entries
- **FR-ITEM-011**: System MUST support soft-delete of items (deletedAt timestamp)
- **FR-ITEM-012**: Soft-deleted items MUST be excluded from invoice and PO item dropdowns

### 4. Purchase Order Management

- **FR-PO-001**: System MUST allow creation of purchase orders with vendor, date, and line items
- **FR-PO-002**: PO line items MUST specify itemId, quantity, and price (locked at PO creation)
- **FR-PO-003**: PO status MUST default to "DRAFT" on creation
- **FR-PO-004**: System MUST support three PO statuses: DRAFT, SENT, FULFILLED
- **FR-PO-005**: System MUST calculate total amount from line items automatically
- **FR-PO-006**: System MUST support listing POs with pagination
- **FR-PO-007**: System MUST support filtering POs by vendorId, status, and date range
- **FR-PO-008**: System MUST support updating PO status (DRAFT → SENT → FULFILLED)
- **FR-PO-009**: System MUST prevent editing FULFILLED POs
- **FR-PO-010**: System MUST support soft-delete of DRAFT POs only
- **FR-PO-011**: System MUST prevent deletion of POs with linked invoices
- **FR-PO-012**: System MUST display fulfillment status (percentage of PO value invoiced) (future)

### 5. Invoice Management

- **FR-INV-001**: System MUST allow creation of invoices with items array (itemId, quantity, price)
- **FR-INV-002**: Invoice items MUST validate itemId exists and is not deleted
- **FR-INV-003**: System MUST calculate totalAmount from line items (sum of quantity × price)
- **FR-INV-004**: Invoice status MUST default to "PENDING" on creation
- **FR-INV-005**: System MUST support three invoice statuses: PENDING, APPROVED, REJECTED
- **FR-INV-006**: System MUST support optional fields: project, branchId, departmentId, costCenterId, purchaseOrderId
- **FR-INV-007**: System MUST assign invoice to creating user (userId)
- **FR-INV-008**: System MUST support listing invoices with pagination
- **FR-INV-009**: System MUST support filtering invoices by status, vendorId, date range, project, branch, department, cost center, syncStatus
- **FR-INV-010**: System MUST support approving PENDING invoices (MANAGER/ADMIN only)
- **FR-INV-011**: System MUST support rejecting PENDING invoices (MANAGER/ADMIN only)
- **FR-INV-012**: System MUST prevent updating APPROVED or REJECTED invoices
- **FR-INV-013**: System MUST support soft-delete of PENDING and REJECTED invoices
- **FR-INV-014**: System MUST prevent deletion of APPROVED invoices
- **FR-INV-015**: System MUST trigger accounting sync event on invoice approval
- **FR-INV-016**: System MUST support linking invoice to purchase order via purchaseOrderId
- **FR-INV-017**: System MUST validate invoice items match PO items when linked (future enhancement)

### 6. Analytics and Reporting

- **FR-ANALYTICS-001**: System MUST calculate dashboard totals: invoices, vendors, items, purchase orders, approved spending, average invoice amount
- **FR-ANALYTICS-002**: System MUST support optional date range filtering for all analytics
- **FR-ANALYTICS-003**: System MUST provide invoice trend analysis by period (weekly, monthly, quarterly)
- **FR-ANALYTICS-004**: System MUST provide spending breakdown by vendor
- **FR-ANALYTICS-005**: System MUST provide spending breakdown by item
- **FR-ANALYTICS-006**: System MUST provide spending breakdown by department
- **FR-ANALYTICS-007**: System MUST provide spending breakdown by branch
- **FR-ANALYTICS-008**: System MUST provide price change analytics with old price, new price, change, percentage change, date
- **FR-ANALYTICS-009**: System MUST cache analytics results with TTL (5 min dashboard, 15 min spending, 15 min trends, 30 min price changes)
- **FR-ANALYTICS-010**: System MUST invalidate cache on data mutations affecting cached results
- **FR-ANALYTICS-011**: Analytics MUST only include APPROVED invoices for spending calculations
- **FR-ANALYTICS-012**: System MUST exclude soft-deleted entities from all analytics

### 7. Organizational Hierarchy

- **FR-ORG-001**: System MUST support creation of branches with unique names
- **FR-ORG-002**: System MUST support creation of departments with unique names
- **FR-ORG-003**: System MUST support creation of cost centers with unique names and department assignment
- **FR-ORG-004**: System MUST prevent deletion of branches, departments, or cost centers with associated invoices
- **FR-ORG-005**: System MUST support soft-delete of branches, departments, cost centers
- **FR-ORG-006**: Invoice creation/update MUST allow assignment to branch, department, cost center
- **FR-ORG-007**: System MUST validate department exists when assigning cost center to invoice
- **FR-ORG-008**: System MUST validate cost center belongs to selected department (if both specified)

### 8. Integration with Accounting Systems

- **FR-INTEGRATION-001**: System MUST support configurable integration with Xero accounting system
- **FR-INTEGRATION-002**: System MUST securely store integration credentials (encrypted at rest)
- **FR-INTEGRATION-003**: System MUST support enable/disable toggle for integrations
- **FR-INTEGRATION-004**: System MUST publish "invoice.approved" event when invoice is approved
- **FR-INTEGRATION-005**: Accounting subscriber MUST listen for "invoice.approved" event
- **FR-INTEGRATION-006**: Accounting subscriber MUST create invoice in Xero via API on event
- **FR-INTEGRATION-007**: System MUST store Xero invoice ID in invoice.accountingId field on success
- **FR-INTEGRATION-008**: System MUST update syncStatus to "SYNCED" on successful sync
- **FR-INTEGRATION-009**: System MUST update syncStatus to "FAILED" and store error message on failure
- **FR-INTEGRATION-010**: System MUST support manual retry of failed syncs
- **FR-INTEGRATION-011**: System MUST support adapter pattern for multiple accounting providers
- **FR-INTEGRATION-012**: System MUST support QuickBooks integration (future)

### 9. Audit and Compliance

- **FR-AUDIT-001**: System MUST log all create, update, delete, approve, reject operations to AuditLog table
- **FR-AUDIT-002**: Audit log MUST capture userId, action, entity, entityId, changes (JSON), ipAddress, userAgent, timestamp
- **FR-AUDIT-003**: Changes field MUST contain old and new values as JSON diff
- **FR-AUDIT-004**: Audit logs MUST be immutable (no deletion or modification)
- **FR-AUDIT-005**: System MUST retain audit logs for minimum 7 years
- **FR-AUDIT-006**: System MUST support querying audit logs by entity, entityId, user, date range, action
- **FR-AUDIT-007**: System MUST support exporting audit logs to CSV
- **FR-AUDIT-008**: Entity detail pages MUST display change history timeline from audit log
- **FR-AUDIT-009**: Audit log viewer MUST be restricted to ADMIN and VIEWER roles (future)

### 10. MCP Integration (AI-Powered)

- **FR-MCP-001**: System MUST implement MCP server protocol for AI assistant integration
- **FR-MCP-002**: System MUST support HTTP Server-Sent Events (SSE) transport for MCP
- **FR-MCP-003**: System MUST support stdio transport for MCP (local Claude Desktop)
- **FR-MCP-004**: MCP session MUST be authenticated via MCP API token in Authorization header
- **FR-MCP-005**: MCP session MUST be bound to user context for duration of connection
- **FR-MCP-006**: All MCP tool calls MUST enforce user's RBAC permissions
- **FR-MCP-007**: System MUST provide MCP tools: get_vendors, get_vendor, get_items, get_item, create_item, update_item, create_invoice, update_invoice, get_purchase_orders, get_purchase_order
- **FR-MCP-008**: MCP tools MUST validate inputs using Zod schemas
- **FR-MCP-009**: MCP tools MUST return structured JSON responses
- **FR-MCP-010**: MCP tool errors MUST include error codes (AUTH_ERROR, FORBIDDEN, VALIDATION_ERROR)
- **FR-MCP-011**: System MUST sanitize database errors in MCP responses (no internal details leaked)

### 11. Caching and Performance

- **FR-PERF-001**: System MUST cache analytics results in Redis with appropriate TTL
- **FR-PERF-002**: System MUST invalidate cache on data mutations via PubSub event subscribers
- **FR-PERF-003**: System MUST use database indexes for common query patterns (status, date, vendor, department, branch)
- **FR-PERF-004**: System MUST implement offset-based pagination for all list endpoints
- **FR-PERF-005**: System MUST limit page size to maximum 100 items
- **FR-PERF-006**: System MUST use N+1 query prevention via include/select patterns
- **FR-PERF-007**: Analytics queries MUST use raw SQL for complex aggregations when ORM is inefficient
- **FR-PERF-008**: Price change analytics MUST batch fetch related data to minimize queries

### 12. Validation and Error Handling

- **FR-VALIDATION-001**: System MUST validate all API inputs using Zod schemas
- **FR-VALIDATION-002**: System MUST return 400 Bad Request with detailed validation errors on schema failure
- **FR-VALIDATION-003**: System MUST sanitize user inputs to prevent XSS attacks
- **FR-VALIDATION-004**: System MUST validate foreign key references exist before insert/update
- **FR-VALIDATION-005**: System MUST return 404 Not Found when entity not found by ID
- **FR-VALIDATION-006**: System MUST return 401 Unauthorized when authentication fails
- **FR-VALIDATION-007**: System MUST return 403 Forbidden when authorization fails
- **FR-VALIDATION-008**: System MUST return 500 Internal Server Error with sanitized message on unexpected errors
- **FR-VALIDATION-009**: System MUST log all errors with full stack trace and context (user, request, payload)
- **FR-VALIDATION-010**: System MUST implement global error handler middleware

### 13. Rate Limiting and Security

- **FR-SECURITY-001**: System MUST implement rate limiting on all API endpoints (100 requests per 15 minutes per IP)
- **FR-SECURITY-002**: System MUST implement stricter rate limiting on authentication endpoints (5 login attempts per 15 minutes per IP)
- **FR-SECURITY-003**: System MUST implement CSRF protection for state-changing operations
- **FR-SECURITY-004**: System MUST use httpOnly cookies for refresh tokens (not accessible via JavaScript)
- **FR-SECURITY-005**: System MUST use secure cookies in production (HTTPS only)
- **FR-SECURITY-006**: System MUST set CORS headers to restrict API access to known frontend origins
- **FR-SECURITY-007**: System MUST implement SQL injection prevention via parameterized queries (Prisma ORM)
- **FR-SECURITY-008**: System MUST store passwords with bcrypt (cost factor 10 minimum)
- **FR-SECURITY-009**: System MUST encrypt sensitive integration credentials at rest
- **FR-SECURITY-010**: System MUST log security events (failed logins, permission denials) for monitoring

---

## Non-Functional Requirements

### 1. Performance

- **NFR-PERF-001**: API response time MUST be < 200ms for 95% of read requests (excluding analytics)
- **NFR-PERF-002**: API response time MUST be < 500ms for 95% of write requests
- **NFR-PERF-003**: Analytics dashboard MUST load in < 2 seconds with cache hit
- **NFR-PERF-004**: Analytics dashboard MUST load in < 5 seconds with cache miss
- **NFR-PERF-005**: System MUST support 100 concurrent users without performance degradation
- **NFR-PERF-006**: Database queries MUST use indexes for all filtered/sorted columns
- **NFR-PERF-007**: Pagination MUST be implemented for all list endpoints to prevent unbounded result sets
- **NFR-PERF-008**: System MUST use connection pooling for database access (Prisma default)
- **NFR-PERF-009**: Frontend MUST implement lazy loading for large datasets
- **NFR-PERF-010**: Frontend MUST debounce search inputs to minimize API calls

### 2. Scalability

- **NFR-SCALE-001**: System MUST handle 10,000 invoices per month without performance degradation
- **NFR-SCALE-002**: System MUST handle 1,000 vendors and 10,000 items without performance degradation
- **NFR-SCALE-003**: Database MUST scale vertically to support growing data volumes
- **NFR-SCALE-004**: System MUST support horizontal scaling via stateless API design (future)
- **NFR-SCALE-005**: Cache layer (Redis) MUST be external to support multi-instance deployment (future)
- **NFR-SCALE-006**: System MUST support database read replicas for analytics queries (future)

### 3. Availability

- **NFR-AVAILABILITY-001**: System MUST have 99.5% uptime during business hours (8am-6pm local time)
- **NFR-AVAILABILITY-002**: System MUST have scheduled maintenance windows announced 48 hours in advance
- **NFR-AVAILABILITY-003**: System MUST implement graceful degradation (e.g., analytics unavailable if cache down)
- **NFR-AVAILABILITY-004**: System MUST implement health check endpoint for monitoring
- **NFR-AVAILABILITY-005**: Database backups MUST be performed daily with 30-day retention
- **NFR-AVAILABILITY-006**: System MUST support point-in-time recovery within 24 hours

### 4. Security

- **NFR-SECURITY-001**: System MUST comply with OWASP Top 10 security best practices
- **NFR-SECURITY-002**: System MUST use HTTPS for all API communication in production
- **NFR-SECURITY-003**: System MUST encrypt sensitive data at rest (credentials, API keys)
- **NFR-SECURITY-004**: System MUST encrypt data in transit using TLS 1.2 or higher
- **NFR-SECURITY-005**: System MUST implement role-based access control (RBAC) for all features
- **NFR-SECURITY-006**: System MUST log all authentication and authorization failures
- **NFR-SECURITY-007**: System MUST implement account lockout after repeated failed login attempts
- **NFR-SECURITY-008**: System MUST sanitize all user inputs to prevent injection attacks
- **NFR-SECURITY-009**: System MUST implement CSRF protection for state-changing operations
- **NFR-SECURITY-010**: System MUST conduct security vulnerability scanning quarterly (future)

### 5. Usability

- **NFR-USABILITY-001**: UI MUST be responsive and functional on desktop, tablet, and mobile devices
- **NFR-USABILITY-002**: UI MUST follow WCAG 2.1 Level AA accessibility guidelines
- **NFR-USABILITY-003**: UI MUST provide clear error messages with actionable guidance
- **NFR-USABILITY-004**: UI MUST display loading indicators for operations > 200ms
- **NFR-USABILITY-005**: UI MUST support keyboard navigation for all features
- **NFR-USABILITY-006**: UI MUST use consistent design language (shadcn/ui components)
- **NFR-USABILITY-007**: UI MUST provide visual feedback for all user actions (success/error toasts)
- **NFR-USABILITY-008**: New users MUST be able to create first invoice within 10 minutes of onboarding
- **NFR-USABILITY-009**: System MUST support undo for accidental deletions (soft-delete recovery) (future)
- **NFR-USABILITY-010**: System MUST provide inline help and tooltips for complex features (future)

### 6. Maintainability

- **NFR-MAINTAIN-001**: Codebase MUST follow Clean Architecture principles (domain, application, infrastructure layers)
- **NFR-MAINTAIN-002**: Codebase MUST follow SOLID principles for all classes and modules
- **NFR-MAINTAIN-003**: Code MUST have minimum 80% test coverage (unit + integration tests) (future)
- **NFR-MAINTAIN-004**: All functions MUST have maximum cyclomatic complexity of 10
- **NFR-MAINTAIN-005**: All modules MUST be self-documenting with clear naming conventions
- **NFR-MAINTAIN-006**: All public functions MUST have JSDoc comments
- **NFR-MAINTAIN-007**: System MUST use TypeScript for type safety on frontend and backend
- **NFR-MAINTAIN-008**: System MUST enforce code quality via ESLint with zero warnings tolerance
- **NFR-MAINTAIN-009**: System MUST use Prettier for consistent code formatting
- **NFR-MAINTAIN-010**: Architecture decisions MUST be documented in ADR format (future)

### 7. Testability

- **NFR-TEST-001**: System MUST use Vitest for backend unit and integration testing
- **NFR-TEST-002**: System MUST use React Testing Library for frontend component testing
- **NFR-TEST-003**: System MUST use Supertest for API endpoint testing
- **NFR-TEST-004**: System MUST mock Prisma client for isolated service testing
- **NFR-TEST-005**: System MUST implement test fixtures for common entities
- **NFR-TEST-006**: System MUST run all tests in CI pipeline before merge
- **NFR-TEST-007**: System MUST generate code coverage reports in CI
- **NFR-TEST-008**: Critical business logic MUST have 100% test coverage (invoice calculation, approval, sync)
- **NFR-TEST-009**: System MUST support integration testing against test database
- **NFR-TEST-010**: System MUST implement E2E tests for critical user journeys (future)

### 8. Compatibility

- **NFR-COMPAT-001**: Backend MUST support Node.js 18 or higher
- **NFR-COMPAT-002**: Frontend MUST support modern browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **NFR-COMPAT-003**: Database MUST support PostgreSQL 14 or higher
- **NFR-COMPAT-004**: System MUST be deployable on Linux (Ubuntu 20.04+) or macOS
- **NFR-COMPAT-005**: System MUST run on Docker containers for development and production
- **NFR-COMPAT-006**: System MUST support deployment to cloud platforms (AWS, GCP, Azure) (future)

### 9. Compliance

- **NFR-COMPLIANCE-001**: System MUST comply with SOX requirements for financial audit trails
- **NFR-COMPLIANCE-002**: System MUST support GDPR data export and deletion requests (future)
- **NFR-COMPLIANCE-003**: System MUST retain financial data for minimum 7 years per IRS guidelines
- **NFR-COMPLIANCE-004**: System MUST log all data access and modifications for compliance audits
- **NFR-COMPLIANCE-005**: System MUST support data residency requirements (future)

### 10. Observability

- **NFR-OBSERVABILITY-001**: System MUST implement structured logging with pino logger
- **NFR-OBSERVABILITY-002**: System MUST log all errors with full context (user, request, stack trace)
- **NFR-OBSERVABILITY-003**: System MUST log all authentication and authorization events
- **NFR-OBSERVABILITY-004**: System MUST expose metrics endpoint for monitoring (Prometheus format)
- **NFR-OBSERVABILITY-005**: System MUST track key metrics: request rate, error rate, response time, cache hit rate
- **NFR-OBSERVABILITY-006**: System MUST implement health check endpoint with dependency status
- **NFR-OBSERVABILITY-007**: System MUST support distributed tracing for debugging (future)
- **NFR-OBSERVABILITY-008**: System MUST integrate with APM tools (New Relic, DataDog) (future)

---

## Success Metrics

### 1. Business Metrics

**BM-001: Invoice Processing Time**
- **Target**: Reduce average invoice approval time by 70% (from 3 days to < 1 day)
- **Measurement**: Time from invoice creation to approval (median and 95th percentile)
- **Current Baseline**: TBD (measure after v1.0 deployment)

**BM-002: Data Entry Efficiency**
- **Target**: Reduce manual data entry time by 80% via API and MCP integrations
- **Measurement**: Number of invoices created via API/MCP vs. manual entry
- **Current Baseline**: TBD

**BM-003: User Adoption**
- **Target**: 90% of finance team actively using system within 3 months of deployment
- **Measurement**: Daily active users (DAU) / total licensed users
- **Current Baseline**: TBD

**BM-004: Error Reduction**
- **Target**: Reduce invoice data errors by 90% (via validation and integrations)
- **Measurement**: Number of invoices rejected due to data errors / total invoices
- **Current Baseline**: TBD

**BM-005: Cost Savings**
- **Target**: Identify 5% cost savings via price variance analysis and vendor consolidation
- **Measurement**: Cost savings identified via analytics dashboards
- **Current Baseline**: TBD

### 2. Technical Metrics

**TM-001: API Response Time**
- **Target**: 95th percentile < 200ms for read operations, < 500ms for write operations
- **Measurement**: Prometheus metrics from API response time histogram
- **Current Baseline**: TBD

**TM-002: System Uptime**
- **Target**: 99.5% uptime during business hours
- **Measurement**: Health check endpoint monitoring (uptime percentage)
- **Current Baseline**: TBD

**TM-003: Test Coverage**
- **Target**: Minimum 80% code coverage (unit + integration)
- **Measurement**: Vitest coverage report
- **Current Baseline**: 0% (tests not yet implemented)

**TM-004: Error Rate**
- **Target**: < 1% of API requests result in 5xx errors
- **Measurement**: Count of 5xx responses / total requests
- **Current Baseline**: TBD

**TM-005: Cache Hit Rate**
- **Target**: > 80% cache hit rate for analytics queries
- **Measurement**: Cache hits / (cache hits + cache misses)
- **Current Baseline**: TBD

### 3. User Experience Metrics

**UX-001: Time to First Invoice**
- **Target**: New users create first invoice within 10 minutes of onboarding
- **Measurement**: User testing sessions with stopwatch
- **Current Baseline**: TBD

**UX-002: User Satisfaction**
- **Target**: Net Promoter Score (NPS) > 50
- **Measurement**: Quarterly NPS survey
- **Current Baseline**: TBD

**UX-003: Feature Discovery**
- **Target**: 80% of users discover and use analytics dashboard within first week
- **Measurement**: Analytics page views / total active users
- **Current Baseline**: TBD

**UX-004: Mobile Usage**
- **Target**: 20% of invoice approvals occur on mobile devices
- **Measurement**: User agent analysis on approval endpoints
- **Current Baseline**: TBD

### 4. Integration Metrics

**IM-001: Sync Success Rate**
- **Target**: > 95% of invoice approvals sync to Xero without errors
- **Measurement**: Count of SYNCED / (SYNCED + FAILED) invoice statuses
- **Current Baseline**: TBD

**IM-002: MCP Usage**
- **Target**: 30% of invoices created via MCP tools (AI assistants) after 6 months
- **Measurement**: Invoices created via MCP / total invoices
- **Current Baseline**: 0% (MCP newly implemented)

**IM-003: API Adoption**
- **Target**: 50% of invoices created via API (external systems) after 12 months
- **Measurement**: Invoices created via API / total invoices
- **Current Baseline**: TBD

---

## Feature Roadmap

### Current State (v1.0 - Development)

**Completed Features**:
- User authentication (register, login, JWT, refresh tokens)
- Account lockout protection (5 attempts, 15 min lockout)
- Role-based access control (ADMIN, MANAGER, USER, VIEWER)
- Vendor CRUD operations with soft-delete
- Item CRUD operations with price history tracking
- Purchase Order CRUD with status workflow (DRAFT/SENT/FULFILLED)
- Invoice CRUD with approval workflow (PENDING/APPROVED/REJECTED)
- Invoice-to-PO linking
- Organizational hierarchy (Branch, Department, Cost Center)
- Analytics dashboard (totals, trends, spending breakdowns, price changes)
- Xero integration with automatic sync on approval
- Event-driven architecture (PubSub for invoice approval → accounting sync)
- Cache layer with invalidation (Redis)
- MCP server integration (HTTP SSE and stdio transports)
- MCP API token authentication
- MCP tools for querying and creating invoices
- Audit logging schema (implementation pending)
- Rate limiting
- CSRF protection
- Comprehensive input validation (Zod schemas)
- Structured logging (pino)
- Metrics endpoint (Prometheus format)
- Responsive UI with shadcn/ui components

**Known Gaps**:
- No test framework configured (CRITICAL)
- Audit log subscriber not implemented
- Email notification system not implemented
- Batch operations not implemented
- Vendor portal not implemented
- Document attachment support not implemented
- Password reset flow not fully implemented (email sending pending)

### Phase 1: Foundation Completion (Q1 2026)

**High Priority - Must Have for Production**:

1. **Testing Framework Setup** [CRITICAL]
   - Configure Vitest for backend
   - Set up test utilities and Prisma mocks
   - Create test fixtures
   - Write unit tests for all service layer functions
   - Write integration tests for all API endpoints
   - Configure CI pipeline with automated testing
   - **Acceptance Criteria**: Minimum 80% code coverage, all tests passing in CI

2. **PO-Invoice Matching Validation**
   - Validate invoice items exist in linked PO
   - Validate quantities don't exceed PO quantities
   - Track partial fulfillment on PO items
   - Display fulfillment status on PO detail page
   - **Acceptance Criteria**: Cannot approve invoice with mismatched PO, fulfillment % accurate

3. **Audit Logging Integration**
   - Create audit log subscriber for PubSub events
   - Subscribe to all create/update/delete/approve/reject events
   - Capture user, action, entity, changes (JSON diff), IP, user agent
   - Add API endpoint to query audit logs (ADMIN/VIEWER only)
   - Add "History" tab to entity detail pages
   - **Acceptance Criteria**: All mutations logged, audit log queryable, timeline view functional

4. **Production Deployment Setup**
   - Dockerfile for backend and frontend
   - Docker Compose for full stack
   - Environment variable configuration
   - Database migration scripts
   - SSL/TLS certificate setup
   - Reverse proxy configuration (nginx)
   - Monitoring and alerting setup
   - **Acceptance Criteria**: Deployed to production environment, health checks passing, monitoring active

### Phase 2: Workflow Automation (Q2 2026)

**Medium Priority - Enhance User Experience**:

1. **Email Notification System**
   - Integrate SendGrid or AWS SES
   - Email templates (invoice submitted, approved, rejected, PO status change)
   - User notification preferences
   - Subscribe to workflow events and send emails
   - **Acceptance Criteria**: Users receive email on invoice approval/rejection

2. **Batch Operations**
   - POST /api/items/batch - Bulk create items (CSV import)
   - PUT /api/items/batch - Bulk update items
   - POST /api/invoices/batch - Bulk create invoices
   - PUT /api/invoices/batch/approve - Bulk approve invoices
   - Transaction support for atomic batch operations
   - **Acceptance Criteria**: Can import 1000 items via CSV in < 30 seconds

3. **Enhanced Error Handling**
   - Define error code taxonomy (VENDOR_001, INVOICE_002, etc.)
   - Create custom error classes with codes
   - Update all service methods to throw typed errors
   - Standardize error response format: { code, message, details }
   - Document error codes in API docs
   - **Acceptance Criteria**: All API errors include structured error codes

4. **Advanced Approval Workflows**
   - Multi-step approval chains (e.g., Manager → Director → CFO)
   - Approval thresholds (e.g., > $10k requires CFO approval)
   - Approval delegation (assign approvals to another user)
   - Approval escalation (auto-escalate if not approved within SLA)
   - **Acceptance Criteria**: Configurable approval chains, delegation functional, SLA escalation working

### Phase 3: Vendor Collaboration (Q3 2026)

**Medium Priority - External User Experience**:

1. **Vendor Portal**
   - Vendor user registration and authentication
   - Vendor dashboard (submitted invoices, status, payment dates)
   - Vendor invoice submission form
   - Invoice status tracking (pending, approved, paid)
   - Automated notifications on status changes
   - **Acceptance Criteria**: Vendors can submit and track invoices independently

2. **Document Attachments**
   - File upload support (PDF, images) for invoices and POs
   - S3 or local file storage integration
   - Virus scanning on upload
   - File retrieval and download
   - Thumbnail generation for images
   - **Acceptance Criteria**: Can attach invoice PDF, view in UI, download

3. **Invoice OCR and Auto-Extraction** [Future Innovation]
   - Upload invoice PDF/image
   - OCR to extract vendor, items, amounts, dates
   - AI-powered line item extraction
   - Pre-fill invoice form for human review
   - **Acceptance Criteria**: 80% accuracy on standard invoice formats

### Phase 4: Reporting and Insights (Q4 2026)

**Low Priority - Advanced Analytics**:

1. **Reporting and Export**
   - PDF report generation (spending by vendor, department, etc.)
   - Excel export for all analytics
   - Scheduled report delivery via email
   - Custom report builder (drag-and-drop)
   - **Acceptance Criteria**: Generate PDF spending report, export to Excel, schedule monthly email

2. **Budget Management**
   - Set budgets by department, branch, cost center
   - Budget vs. actual tracking
   - Budget alerts when approaching limit (80%, 100%)
   - Budget forecasting based on historical trends
   - **Acceptance Criteria**: Set department budget, receive alert at 80%, dashboard shows variance

3. **Vendor Performance Scoring**
   - Vendor scorecards (on-time delivery, pricing stability, quality)
   - Vendor risk assessment
   - Vendor consolidation recommendations
   - Preferred vendor lists
   - **Acceptance Criteria**: Vendor scorecard displayed, consolidation suggestions generated

4. **Predictive Analytics** [Future Innovation]
   - Forecast next month's spending based on trends
   - Anomaly detection (unusual invoice amounts or patterns)
   - Price increase predictions based on historical changes
   - **Acceptance Criteria**: Dashboard shows spending forecast with confidence interval

### Phase 5: Enterprise Features (2027)

**Future Considerations**:

1. **Multi-Currency Support**
   - Currency field on invoices and POs
   - Exchange rate API integration
   - Multi-currency reporting with base currency conversion
   - **Acceptance Criteria**: Create invoice in EUR, convert to USD for reporting

2. **Multi-Tenancy**
   - Tenant isolation (schema-per-tenant or row-level security)
   - Tenant-specific branding
   - Tenant admin role
   - **Acceptance Criteria**: Support 100 tenants on single instance, complete data isolation

3. **Advanced Integrations**
   - QuickBooks integration
   - SAP integration
   - Oracle NetSuite integration
   - Webhook support for custom integrations
   - **Acceptance Criteria**: Sync invoices to QuickBooks, webhooks fire on events

4. **Mobile App** (Native iOS/Android)
   - Invoice approval on mobile
   - Receipt capture and submission
   - Push notifications
   - Offline mode with sync
   - **Acceptance Criteria**: Approve invoice on iPhone, receive push notification

---

## Technical Architecture

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │   Invoices   │  │   Vendors    │          │
│  │   Analytics  │  │   Approval   │  │     POs      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                     Axios HTTP Client                           │
│                      (JWT in headers)                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTPS (TLS 1.2+)
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     EXPRESS API SERVER                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE LAYER                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │  Rate      │  │   Auth     │  │   CSRF     │         │   │
│  │  │  Limiter   │  │   (JWT)    │  │ Protection │         │   │
│  │  └────────────┘  └────────────┘  └────────────┘         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │  RBAC      │  │ Validation │  │   Error    │         │   │
│  │  │ Authorize  │  │   (Zod)    │  │  Handler   │         │   │
│  │  └────────────┘  └────────────┘  └────────────┘         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      ROUTE LAYER                         │   │
│  │  /api/auth  /api/vendors  /api/items  /api/invoices     │   │
│  │  /api/purchaseOrders  /api/analytics  /api/settings     │   │
│  │  /api/departments  /api/mcp-tokens  /health  /metrics   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SERVICE LAYER                         │   │
│  │  (Business Logic - Framework Independent)               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Vendor     │  │    Item      │  │   Invoice    │   │   │
│  │  │   Service    │  │   Service    │  │   Service    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │     PO       │  │  Analytics   │  │     Auth     │   │   │
│  │  │   Service    │  │   Service    │  │   Service    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │    Cache     │  │    Audit     │  │  MCP Token   │   │   │
│  │  │   Service    │  │   Service    │  │   Service    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   EVENT BUS (PubSub)                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Events: invoice.created, invoice.approved,        │  │   │
│  │  │          item.priceChanged, vendor.deleted         │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   SUBSCRIBER LAYER                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  Accounting  │  │    Cache     │  │    Audit     │   │   │
│  │  │  Subscriber  │  │ Invalidator  │  │  Subscriber  │   │   │
│  │  │ (Xero Sync)  │  │              │  │   (future)   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 INFRASTRUCTURE LAYER                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Prisma     │  │    Redis     │  │  Accounting  │   │   │
│  │  │   Client     │  │    Cache     │  │   Adapter    │   │   │
│  │  └──────────────┘  └──────────────┘  │ (Xero/QB)    │   │   │
│  │                                      └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
      ▼                       ▼                       ▼
┌───────────┐          ┌───────────┐          ┌───────────┐
│PostgreSQL │          │   Redis   │          │   Xero    │
│ Database  │          │   Cache   │          │    API    │
└───────────┘          └───────────┘          └───────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       MCP INTEGRATION                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    MCP SERVER                            │   │
│  │  ┌────────────────┐            ┌────────────────┐        │   │
│  │  │  HTTP SSE      │            │     stdio      │        │   │
│  │  │  Transport     │            │   Transport    │        │   │
│  │  │ (Claude API)   │            │ (Claude Desktop)        │   │
│  │  └────────────────┘            └────────────────┘        │   │
│  │         │                              │                 │   │
│  │         └──────────────┬───────────────┘                 │   │
│  │                        │                                 │   │
│  │              ┌─────────▼─────────┐                       │   │
│  │              │  Session Context  │                       │   │
│  │              │   (User + Auth)   │                       │   │
│  │              └─────────┬─────────┘                       │   │
│  │                        │                                 │   │
│  │         ┌──────────────┼──────────────┐                  │   │
│  │         │              │              │                  │   │
│  │         ▼              ▼              ▼                  │   │
│  │    ┌─────────┐   ┌─────────┐   ┌─────────┐             │   │
│  │    │  Query  │   │ Create  │   │ Update  │             │   │
│  │    │  Tools  │   │  Tools  │   │  Tools  │             │   │
│  │    └─────────┘   └─────────┘   └─────────┘             │   │
│  │         │              │              │                  │   │
│  │         └──────────────┼──────────────┘                  │   │
│  │                        │                                 │   │
│  │                        ▼                                 │   │
│  │           Same Service Layer as REST API                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- React 18 (functional components, hooks)
- TypeScript 5
- Vite 5 (build tool)
- Tailwind CSS 3 (styling)
- shadcn/ui (component library based on Radix UI)
- React Router 6 (client-side routing)
- Axios (HTTP client with interceptors)
- Recharts (charts and visualizations)
- Zod (runtime validation)

**Backend**:
- Node.js 18+ (runtime)
- Express 4 (web framework)
- TypeScript 5 (type safety)
- Prisma 5 (ORM)
- PostgreSQL 14+ (database)
- Redis (cache)
- JWT (jsonwebtoken for access tokens)
- bcryptjs (password hashing, token hashing)
- Zod (validation schemas)
- pino (structured logging)
- express-rate-limit (rate limiting)

**Infrastructure**:
- Docker & Docker Compose (containerization)
- nginx (reverse proxy, SSL termination)
- PostgreSQL (via Docker)
- Redis (via Docker)

**Testing** (Planned):
- Vitest (unit and integration testing)
- React Testing Library (component testing)
- Supertest (API endpoint testing)

**DevOps** (Future):
- GitHub Actions (CI/CD)
- AWS/GCP/Azure (cloud hosting)
- Terraform (infrastructure as code)
- DataDog/New Relic (APM)

**Integrations**:
- Xero API (accounting sync)
- SendGrid/AWS SES (email notifications)
- MCP Protocol (AI assistant integration)

### Data Model

See `server/prisma/schema.prisma` for complete schema definition.

**Core Entities**:
- User (authentication, RBAC)
- Vendor (suppliers)
- Item (products/services with price history)
- PurchaseOrder (procurement intent)
- PurchaseOrderItem (line items)
- Invoice (payable documents)
- InvoiceItem (line items)
- Branch, Department, CostCenter (organizational hierarchy)
- IntegrationConfig (accounting system credentials)
- AuditLog (compliance trail)
- McpApiToken (AI assistant authentication)

**Entity Relationships**:
- User → Invoice (1:N, creator)
- Vendor → Item (1:N)
- Vendor → PurchaseOrder (1:N)
- Item → ItemPriceHistory (1:N)
- PurchaseOrder → PurchaseOrderItem (1:N)
- Item → PurchaseOrderItem (N:1)
- Invoice → InvoiceItem (1:N)
- Item → InvoiceItem (N:1)
- PurchaseOrder → Invoice (1:N, optional linkage)
- Branch → Invoice (1:N)
- Department → Invoice (1:N)
- Department → CostCenter (1:N)
- CostCenter → Invoice (1:N)
- User → McpApiToken (1:N)

### Security Architecture

**Authentication**:
- JWT access tokens (15-min expiry, stateless)
- Refresh tokens (7-day expiry, stored hashed in database)
- Token rotation on refresh (old token invalidated)
- httpOnly cookies for refresh tokens (XSS protection)
- Account lockout after 5 failed attempts (15-min lockout)

**Authorization**:
- Role-based access control (RBAC)
- Permission middleware on all protected routes
- Four roles: ADMIN (all permissions), MANAGER (approve/reject), USER (create only), VIEWER (read-only)
- Granular permissions: VENDOR_READ, INVOICE_APPROVE, etc.

**Data Security**:
- Passwords hashed with bcrypt (cost factor 10)
- Integration credentials encrypted at rest
- MCP API tokens hashed with bcrypt, lookup hash with SHA-256
- SQL injection prevented via Prisma parameterized queries
- XSS prevention via input sanitization
- CSRF protection via tokens on state-changing operations

**Network Security**:
- HTTPS/TLS 1.2+ for all API communication
- CORS headers restricting origins
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Security headers (Helmet.js)

### Deployment Architecture (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER (nginx)                    │
│                   SSL Termination (TLS 1.2+)                │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐      ┌────────┐      ┌────────┐
   │ API    │      │ API    │      │ API    │
   │ Server │      │ Server │      │ Server │
   │   1    │      │   2    │      │   3    │
   └────────┘      └────────┘      └────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐      ┌────────┐      ┌────────┐
   │ Redis  │      │Postgres│      │  Xero  │
   │ Cluster│      │ Primary│      │  API   │
   │        │      │  +      │      │        │
   │        │      │ Replica│      │        │
   └────────┘      └────────┘      └────────┘
```

---

## Technical Constraints

### 1. Technology Constraints

**TC-001: Programming Languages**
- Backend MUST use TypeScript (compiled to Node.js)
- Frontend MUST use TypeScript with React
- Rationale: Type safety, developer experience, ecosystem maturity

**TC-002: Database**
- MUST use PostgreSQL 14 or higher
- MUST NOT use NoSQL databases for core transactional data
- Rationale: ACID compliance for financial data, relational integrity

**TC-003: ORM**
- MUST use Prisma as ORM for type safety and migrations
- Raw SQL ONLY for complex analytics queries where ORM is inefficient
- Rationale: Developer productivity, type safety, migration management

**TC-004: Node.js Version**
- MUST support Node.js 18 LTS or higher
- Rationale: Long-term support, modern JS features

**TC-005: Browser Support**
- MUST support Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- MUST be mobile-responsive (iOS Safari, Chrome Mobile)
- Rationale: Cover 95% of SME users

### 2. Architectural Constraints

**AC-001: Clean Architecture**
- MUST follow layered architecture: Routes → Services → Infrastructure
- Business logic MUST reside in service layer (framework-independent)
- Rationale: Testability, maintainability, framework independence

**AC-002: Stateless API**
- API servers MUST be stateless (no in-memory session storage)
- All session state via JWT or database
- Rationale: Horizontal scalability, cloud-native deployment

**AC-003: Event-Driven**
- MUST use PubSub pattern for cross-cutting concerns (audit, cache, notifications)
- Domain events: invoice.created, invoice.approved, item.priceChanged, etc.
- Rationale: Decoupling, extensibility, asynchronous processing

**AC-004: RESTful API**
- API MUST follow REST conventions (GET/POST/PUT/DELETE, resource-based URLs)
- API responses MUST be JSON
- Rationale: Industry standard, tooling support, client library compatibility

**AC-005: Single Page Application (SPA)**
- Frontend MUST be SPA with client-side routing
- Server-side rendering (SSR) NOT required
- Rationale: Developer experience, faster interactions, simpler deployment

### 3. Integration Constraints

**IC-001: Accounting System Integration**
- MUST support Xero integration via official API
- MUST use adapter pattern to support multiple providers (future: QuickBooks, NetSuite)
- MUST NOT tightly couple to Xero-specific data structures
- Rationale: Multi-vendor support, maintainability

**IC-002: MCP Protocol**
- MUST implement MCP server protocol for AI assistant integration
- MUST support both HTTP SSE and stdio transports
- MCP tools MUST respect RBAC permissions
- Rationale: AI-powered invoice creation, future-proof integration layer

**IC-003: External API Access**
- API MUST be accessible to third-party systems via standard HTTP
- API authentication MUST support JWT tokens
- API rate limiting MUST be enforced
- Rationale: Ecosystem integration, programmatic invoice submission

### 4. Compliance Constraints

**CC-001: Data Retention**
- Financial data (invoices, POs, audit logs) MUST be retained for minimum 7 years
- Soft-delete MUST be used instead of hard-delete for financial records
- Rationale: IRS/tax compliance, SOX compliance

**CC-002: Audit Trail**
- All data mutations MUST be logged to audit log
- Audit logs MUST be immutable
- Audit logs MUST include user, timestamp, old/new values, IP address
- Rationale: SOX compliance, fraud detection, dispute resolution

**CC-003: Authentication Security**
- Passwords MUST be hashed with bcrypt (minimum cost factor 10)
- Password reset tokens MUST expire within 1 hour
- Account lockout MUST occur after 5 failed login attempts
- Rationale: OWASP best practices, data security

**CC-004: Data Encryption**
- All API communication MUST use HTTPS/TLS 1.2+ in production
- Integration credentials MUST be encrypted at rest
- Sensitive logs MUST NOT contain passwords or tokens
- Rationale: Data protection, compliance (GDPR, SOC 2)

### 5. Performance Constraints

**PC-001: Response Time**
- 95% of read API requests MUST respond in < 200ms
- 95% of write API requests MUST respond in < 500ms
- Analytics dashboard MUST load in < 5 seconds (cold cache)
- Rationale: User experience, productivity

**PC-002: Concurrency**
- System MUST support minimum 100 concurrent users without degradation
- Database connections MUST use pooling (Prisma default: 10 connections)
- Rationale: SME usage patterns, cost efficiency

**PC-003: Data Volume**
- System MUST handle 10,000 invoices per month without performance issues
- System MUST handle 1,000 vendors and 10,000 items
- Analytics queries MUST use caching with appropriate TTL
- Rationale: Typical SME scale, growth headroom

### 6. Development Constraints

**DC-001: Testing**
- MUST implement unit tests for all service layer functions (target 80% coverage)
- MUST implement integration tests for all API endpoints
- Tests MUST run in CI before merge
- Rationale: Code quality, regression prevention, refactoring confidence

**DC-002: Code Quality**
- MUST use ESLint with zero warnings tolerance
- MUST use Prettier for consistent formatting
- MUST follow SOLID principles
- Maximum cyclomatic complexity: 10
- Rationale: Maintainability, code review efficiency

**DC-003: Version Control**
- MUST use Git with feature branch workflow
- MUST use pull requests with code review before merge
- MUST write meaningful commit messages (conventional commits)
- Rationale: Collaboration, change tracking, rollback capability

**DC-004: Documentation**
- MUST document architecture decisions in ADR format (future)
- MUST document API endpoints (OpenAPI/Swagger) (future)
- Public functions MUST have JSDoc comments
- Rationale: Onboarding, maintenance, API consumers

### 7. Operational Constraints

**OC-001: Deployment**
- MUST be deployable via Docker containers
- MUST support Docker Compose for local development
- MUST support cloud deployment (AWS/GCP/Azure) (future)
- Rationale: Portability, consistency, scalability

**OC-002: Monitoring**
- MUST expose health check endpoint
- MUST expose metrics endpoint (Prometheus format)
- MUST implement structured logging (JSON logs)
- Rationale: Observability, incident response, performance optimization

**OC-003: Backup and Recovery**
- Database backups MUST be performed daily
- Backups MUST be retained for 30 days
- System MUST support point-in-time recovery within 24 hours
- Rationale: Data protection, disaster recovery

**OC-004: Scalability**
- System MUST be horizontally scalable (stateless API design)
- Cache layer MUST be external (Redis cluster) for multi-instance deployment
- Database MUST support read replicas for analytics queries (future)
- Rationale: Growth, cost efficiency, performance

---

## Appendix

### A. Glossary

- **AP**: Accounts Payable - department responsible for paying vendor invoices
- **Clean Architecture**: Software design philosophy separating concerns into layers (domain, application, infrastructure)
- **Cost Center**: Granular organizational unit under a department for budget tracking
- **CSRF**: Cross-Site Request Forgery - web security vulnerability
- **DDD**: Domain-Driven Design - software design approach focused on business domain
- **DTO**: Data Transfer Object - object for transferring data between layers
- **JWT**: JSON Web Token - compact token format for authentication
- **MCP**: Model Context Protocol - standard for AI assistant integration
- **ORM**: Object-Relational Mapping - database abstraction layer
- **PO**: Purchase Order - formal document requesting goods/services from vendor
- **RBAC**: Role-Based Access Control - authorization model based on user roles
- **SOX**: Sarbanes-Oxley Act - US law requiring audit trails for financial data
- **SSE**: Server-Sent Events - HTTP standard for server-to-client streaming
- **TDD**: Test-Driven Development - practice of writing tests before implementation
- **Three-Way Match**: Verification that PO, receipt, and invoice align before payment

### B. Acronyms

- ADR: Architecture Decision Record
- API: Application Programming Interface
- APM: Application Performance Monitoring
- CI/CD: Continuous Integration / Continuous Deployment
- CSV: Comma-Separated Values
- GDPR: General Data Protection Regulation
- HTTP: Hypertext Transfer Protocol
- HTTPS: HTTP Secure
- IRS: Internal Revenue Service
- NPS: Net Promoter Score
- OWASP: Open Web Application Security Project
- PDF: Portable Document Format
- REST: Representational State Transfer
- SLA: Service Level Agreement
- SME: Small and Medium Enterprise
- SQL: Structured Query Language
- SSL: Secure Sockets Layer
- TLS: Transport Layer Security
- UI: User Interface
- URL: Uniform Resource Locator
- UX: User Experience
- WCAG: Web Content Accessibility Guidelines
- XSS: Cross-Site Scripting

### C. References

- Prisma Schema: `server/prisma/schema.prisma`
- Backend Todo Backlog: `docs/reports/2025-12-05-backend-todo-backlog.md`
- System Design: `docs/system_design.md`
- CLAUDE.md: Project development guidelines
- README.md: Setup and development instructions

### D. Change Log

| Version | Date       | Author          | Changes                     |
|---------|------------|-----------------|------------------------------|
| 1.0     | 2025-12-10 | Development Team | Initial PRD creation        |

---

**Document End**
