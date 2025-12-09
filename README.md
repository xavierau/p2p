# Payment Management App

A full-stack TypeScript application for managing vendors, items, and invoices with approval workflows.

## Tech Stack

### Backend
- **Express** - Web framework
- **Prisma** - ORM with SQLite
- **TypeScript** - Type safety
- **JWT** - Authentication
- **bcryptjs** - Password hashing

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Router** - Routing
- **Axios** - HTTP client

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Backend Setup

```bash
cd server
pnpm install

# Setup database
npx prisma db push

# Seed database with test data
npx prisma db seed

# Run development server
pnpm dev
```

The server will run on `http://localhost:3000`

### Frontend Setup

```bash
cd client
pnpm install

# Run development server
pnpm dev
```

The client will run on `http://localhost:5173`

## Test Credentials

After seeding, you can login with:

- **Admin User**
  - Email: `admin@example.com`
  - Password: `password123`

- **Regular User**
  - Email: `user@example.com`
  - Password: `password123`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset

### Vendors
- `GET /api/vendors` - List all vendors
- `POST /api/vendors` - Create vendor

### Items
- `GET /api/items` - List all items
- `POST /api/items` - Create item

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id/approve` - Approve invoice
- `PUT /api/invoices/:id/reject` - Reject invoice

## Features

- ✅ User authentication (Login, Register, Forgot Password)
- ✅ Vendor management
- ✅ Item management (linked to vendors)
- ✅ Invoice creation with multiple items
- ✅ Invoice approval workflow
- ✅ Modern, responsive UI with shadcn/ui
- ✅ External API support for invoice creation

## Database Schema

```
User
├── id
├── email (unique)
├── password (hashed)
├── name
└── invoices[]

Vendor
├── id
├── name
├── contact
└── items[]

Item
├── id
├── name
├── price
├── vendorId
└── vendor

Invoice
├── id
├── date
├── status (PENDING/APPROVED/REJECTED)
├── totalAmount
├── userId
└── items[]

InvoiceItem
├── id
├── invoiceId
├── itemId
├── quantity
└── price
```

## Development

### Reset Database
```bash
cd server
rm prisma/dev.db
npx prisma db push
npx prisma db seed
```

### Build for Production
```bash
# Backend
cd server
pnpm build

# Frontend
cd client
pnpm build
```

## API Testing

### Generate Test Tokens
```bash
cd server
npx ts-node scripts/generate-tokens.ts
```

This will output JWT tokens for both test users (valid for 30 days).

### Import Postman Collection
1. Import `postman_collection.json` into Postman
2. Set the `adminToken` and `userToken` variables with generated tokens
3. Start testing the API endpoints

See [API_TESTING.md](./API_TESTING.md) for detailed testing instructions and cURL examples.
