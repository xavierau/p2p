# Database Seeding Troubleshooting

## Issue
The seed script may not be running properly or the database might be empty.

## Manual Seeding Steps

### Option 1: Run seed script directly
```bash
cd server
node prisma/seed.js
```

You should see output like:
```
🌱 Starting database seed...
✅ Created admin user: admin@example.com
✅ Created regular user: user@example.com
✅ Created vendor: Tech Supplies Inc.
...
🎉 Database seeded successfully!
```

### Option 2: Use Prisma's seed command
```bash
cd server
npx prisma db seed
```

### Option 3: Reset and reseed database
```bash
cd server

# Delete existing database
rm prisma/dev.db

# Recreate schema
npx prisma db push

# Run seed
node prisma/seed.js
```

## Verify Database Contents

### Check vendor count
```bash
cd server
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Vendor;"
```

Should return: `2`

### List all vendors
```bash
sqlite3 prisma/dev.db "SELECT * FROM Vendor;"
```

Should show:
```
1|Tech Supplies Inc.|contact@techsupplies.com
2|Office Depot|sales@officedepot.com
```

### Check all tables
```bash
sqlite3 prisma/dev.db << EOF
SELECT 'Users:', COUNT(*) FROM User;
SELECT 'Vendors:', COUNT(*) FROM Vendor;
SELECT 'Items:', COUNT(*) FROM Item;
SELECT 'Invoices:', COUNT(*) FROM Invoice;
EOF
```

Expected output:
```
Users:|2
Vendors:|2
Items:|3
Invoices:|2
```

## Test API After Seeding

### 1. Generate tokens
```bash
cd server
npx ts-node scripts/generate-tokens.ts
```

### 2. Test vendors endpoint
```bash
curl http://localhost:3000/api/vendors \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Should return:
```json
[
  {
    "id": 1,
    "name": "Tech Supplies Inc.",
    "contact": "contact@techsupplies.com"
  },
  {
    "id": 2,
    "name": "Office Depot",
    "contact": "sales@officedepot.com"
  }
]
```

## Common Issues

### Issue: Empty array returned from API
**Cause**: Database not seeded
**Solution**: Run `node prisma/seed.js` and verify with sqlite3 commands above

### Issue: "Table doesn't exist" error
**Cause**: Database schema not created
**Solution**: Run `npx prisma db push` first, then seed

### Issue: Seed script runs but no data
**Cause**: Possible error in seed script
**Solution**: Check for error messages in console output

### Issue: Token authentication fails
**Cause**: User IDs in token don't match database
**Solution**: Regenerate tokens after seeding with `npx ts-node scripts/generate-tokens.ts`

## Quick Reset Script

Save this as `reset-db.sh`:
```bash
#!/bin/bash
cd /Users/xavierau/Code/js/payment_management/server
echo "Resetting database..."
rm -f prisma/dev.db
npx prisma db push --accept-data-loss
node prisma/seed.js
echo "Database reset complete!"
```

Run with: `bash reset-db.sh`
