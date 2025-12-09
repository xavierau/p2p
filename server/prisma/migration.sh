#!/bin/sh
cd "$(dirname "$0")/.."
rm -rf prisma/migrations
npx prisma migrate dev --name "initial-migration"
