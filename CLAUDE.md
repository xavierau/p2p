# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SME Procurement-to-Payment Management application with powerful analytics. Full-stack TypeScript monorepo with an Express backend and React frontend.

## Development Commands

### Backend (server/)
```bash
cd server
pnpm install
pnpm dev          # Run development server with nodemon (port 3000)
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run compiled production build
```

### Frontend (client/)
```bash
cd client
pnpm install
pnpm dev          # Vite dev server (port 5173)
pnpm build        # TypeScript check + Vite production build
pnpm lint         # ESLint with zero warnings tolerance
pnpm preview      # Preview production build
```

### Database (Prisma/PostgreSQL on Docker)
PostgreSQL runs in a Docker container that is always on.

```bash
cd server
npx prisma db push       # Apply schema to database
npx prisma db seed       # Seed with test data
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Open Prisma Studio GUI

# Reset database
npx prisma migrate reset   # Drop and recreate with seed
```

### Test Tokens
```bash
cd server
npx ts-node scripts/generate-tokens.ts   # Generate JWT tokens for API testing
```

## Architecture

### Backend Clean Architecture (server/src/)
```
routes/          → Express route definitions (thin layer, delegates to services)
middleware/      → Express middleware (auth.ts for JWT validation)
services/        → Business logic layer (framework-independent)
  └── accounting/  → Adapter pattern for external integrations (Xero)
subscribers/     → Event-driven handlers (PubSub pattern)
schemas.ts       → Zod validation schemas for all models
prisma.ts        → Singleton Prisma client
```

**Key patterns:**
- Routes call services directly; no controllers layer currently
- Services contain all business logic and Prisma queries
- PubSub singleton (`services/pubsub.ts`) for event-driven features (e.g., invoice approval triggers accounting sync)
- Accounting integration uses Adapter pattern (`AccountingProvider` interface, `XeroAdapter` implementation)

### Frontend Architecture (client/src/)
```
pages/           → Page components (route-level)
components/      → Reusable UI components
  └── ui/          → shadcn/ui primitives (Button, Input, Dialog, etc.)
services/        → API service modules (one per domain)
context/         → React Context providers (AuthContext)
lib/
  └── api.ts       → Axios instance with auth interceptor
```

**Key patterns:**
- Path aliases: `@/*` maps to `./src/*`
- All API calls go through `lib/api.ts` which auto-attaches JWT from localStorage
- Protected routes wrap content in `ProtectedRoute` component

### Data Model Entities
- User, Vendor, Item, Invoice, InvoiceItem
- PurchaseOrder, PurchaseOrderItem
- Branch, Department, CostCenter (organizational hierarchy)
- IntegrationConfig (external service settings)

## Development Principles

- **Clean Architecture:** Business logic in `services/` layer, independent of Express
- **Test-Driven Development:** Tests first, then implementation (framework setup pending)
- **SOLID Principles:** Follow for maintainable OO code
- **YAGNI:** Only build what's needed now
- **Zod Validation:** All API inputs validated via schemas in `schemas.ts`

## Invoice Validation Configuration

The invoice validation system supports runtime configuration via environment variables.

### Configuration Priority
1. Environment variables (.env) - **Highest priority**
2. Database (ValidationRule table) - Fallback
3. Hard-coded defaults - Last resort

### Environment Variables

All validation rules can be configured via `.env`:

```bash
# Enable/disable rules
VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED=true
VALIDATION_RULE_MISSING_INVOICE_NUMBER_ENABLED=false
VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_ENABLED=false

# Configure thresholds
VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD=10000
VALIDATION_RULE_PRICE_VARIANCE_VARIANCE_PERCENT=15
VALIDATION_RULE_PO_AMOUNT_VARIANCE_VARIANCE_PERCENT=10
```

See `.env.example` for complete configuration options.

### Default Behavior
- **DUPLICATE_INVOICE_NUMBER:** ENABLED (critical validation, prevents duplicate vendor invoice numbers)
- **All other rules:** DISABLED (opt-in for flexibility)

### Development vs Production

**Development:** Keep most rules disabled for faster testing and iteration
```bash
VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED=true
# Other rules disabled for development
```

**Production:** Enable relevant rules based on business requirements
```bash
VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED=true
VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_ENABLED=true
VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD=50000
VALIDATION_RULE_PO_AMOUNT_VARIANCE_ENABLED=true
VALIDATION_RULE_PO_AMOUNT_VARIANCE_VARIANCE_PERCENT=5
```

### Important Notes
- `.env` changes require application restart to take effect
- Invalid environment variable values log warnings and fall back to database configuration
- Database ValidationRule records are preserved as fallback when environment variables are not set
- Environment variables override database settings for both enable/disable flags and rule-specific thresholds

### Available Validation Rules

| Rule Type | Description | Config Variables |
|-----------|-------------|------------------|
| DUPLICATE_INVOICE_NUMBER | Prevents duplicate vendor invoice numbers | ENABLED |
| MISSING_INVOICE_NUMBER | Flags invoices without invoice numbers | ENABLED |
| AMOUNT_THRESHOLD_EXCEEDED | Flags invoices exceeding amount threshold | ENABLED, THRESHOLD |
| ROUND_AMOUNT_PATTERN | Detects suspiciously round amounts | ENABLED, MINIMUM_AMOUNT |
| PRICE_VARIANCE | Detects price variations from historical averages | ENABLED, VARIANCE_PERCENT, HISTORICAL_COUNT |
| PO_AMOUNT_VARIANCE | Detects invoice/PO amount discrepancies | ENABLED, VARIANCE_PERCENT |
| PO_ITEM_MISMATCH | Detects invoice items not in linked PO | ENABLED |
| DELIVERY_NOTE_MISMATCH | Detects invoice items not in delivery notes | ENABLED |

## Testing Setup (TODO)

No testing framework configured yet. Recommended: **Vitest** for both backend services and React components with React Testing Library.

## Environment

Backend requires `.env` in `server/`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `PORT` - Server port (default: 3000)
