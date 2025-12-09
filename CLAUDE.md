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

## Testing Setup (TODO)

No testing framework configured yet. Recommended: **Vitest** for both backend services and React components with React Testing Library.

## Environment

Backend requires `.env` in `server/`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `PORT` - Server port (default: 3000)
