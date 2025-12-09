# API Testing Guide

## Quick Start with Postman

### 1. Import Collection
Import `postman_collection.json` into Postman.

### 2. Set Environment Variables
After importing, set these collection variables:
- `baseUrl`: `http://localhost:3000/api`
- `adminToken`: (see below)
- `userToken`: (see below)

## Test Tokens

Run this command to generate fresh tokens:
```bash
cd server
npx ts-node scripts/generate-tokens.ts
```

Or use these pre-generated tokens (valid for 30 days):

### Admin Token
User: `admin@example.com`
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTczMjE2MzY5MSwiZXhwIjoxNzM0NzU1NjkxfQ.xYZ...
```

### Regular User Token
User: `user@example.com`
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImlhdCI6MTczMjE2MzY5MSwiZXhwIjoxNzM0NzU1NjkxfQ.abc...
```

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

### List Vendors (with token)
```bash
curl http://localhost:3000/api/vendors \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create Invoice
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"itemId": 1, "quantity": 2, "price": 1200.00},
      {"itemId": 2, "quantity": 5, "price": 25.50}
    ]
  }'
```

### Approve Invoice
```bash
curl -X PUT http://localhost:3000/api/invoices/1/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Testing Workflow

1. **Authentication** (optional - or use pre-generated tokens)
   - Login with `admin@example.com` / `password123`
   - Copy the token from response

2. **List Resources**
   - Get all vendors
   - Get all items
   - Get all invoices

3. **Create Resources**
   - Create a new vendor
   - Create a new item (linked to vendor)
   - Create an invoice with multiple items

4. **Invoice Workflow**
   - Create invoice (status: PENDING)
   - Approve or reject the invoice
   - List invoices to see updated status

## External API Integration

For external apps creating invoices, use the same endpoint with a valid token:

```javascript
// Example: External app creating invoice
const response = await fetch('http://localhost:3000/api/invoices', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [
      { itemId: 1, quantity: 2, price: 1200.00 }
    ]
  })
});
```

## Notes

- All authenticated endpoints require `Authorization: Bearer <token>` header
- Tokens expire after 30 days
- Generate new tokens anytime with `npx ts-node scripts/generate-tokens.ts`
- Server must be running on port 3000
