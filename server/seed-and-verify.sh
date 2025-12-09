#!/bin/bash

echo "Checking database status..."
echo ""

cd /Users/xavierau/Code/js/payment_management/server

# Check if database file exists
if [ -f "prisma/dev.db" ]; then
    echo "✅ Database file exists: prisma/dev.db"
else
    echo "❌ Database file not found!"
    exit 1
fi

echo ""
echo "Running seed script..."
node prisma/seed.js

echo ""
echo "Verifying data..."
echo ""

# Use sqlite3 to check data
echo "Vendors in database:"
sqlite3 prisma/dev.db "SELECT id, name, contact FROM Vendor;"

echo ""
echo "Items in database:"
sqlite3 prisma/dev.db "SELECT id, name, price FROM Item LIMIT 5;"

echo ""
echo "Users in database:"
sqlite3 prisma/dev.db "SELECT id, email, name FROM User;"

echo ""
echo "Done!"
