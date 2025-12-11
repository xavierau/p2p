import { createQueryCounter } from './query-counter';
import { getFlaggedInvoices } from '../../services/invoiceValidationService';
import prisma from '../../prisma';

async function testQueryCount() {
  console.log('🔍 Testing Query Count for getFlaggedInvoices...\n');
  console.log('━'.repeat(100));

  // Create test data first
  const user = await prisma.user.upsert({
    where: { email: 'query-test@test.com' },
    update: {},
    create: {
      email: 'query-test@test.com',
      name: 'Query Test User',
      password: 'hashed',
      role: 'USER'
    }
  });

  const vendor = await prisma.vendor.upsert({
    where: { id: 9998 },
    update: {},
    create: {
      id: 9998,
      name: 'Query Test Vendor',
      contact: 'query-test-vendor@test.com'
    }
  });

  // Create 10 test invoices with validations
  console.log('Setting up test data (10 invoices)...\n');
  for (let i = 0; i < 10; i++) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `QUERY-${i.toString().padStart(3, '0')}`,
        date: new Date(),
        totalAmount: 1000 + i * 100,
        userId: user.id,
        vendorId: vendor.id,
        status: 'PENDING'
      }
    });

    await prisma.invoiceValidation.create({
      data: {
        invoiceId: invoice.id,
        ruleType: 'AMOUNT_THRESHOLD_EXCEEDED',
        severity: 'WARNING',
        status: 'FLAGGED',
        details: { threshold: 1000 }
      }
    });
  }

  // Test query count
  const counter = createQueryCounter();
  counter.reset();

  console.log('Running getFlaggedInvoices with query logging...\n');
  await getFlaggedInvoices({}, { page: 1, limit: 100 });

  const queryCount = counter.getCount();
  const queries = counter.getQueries();

  console.log('━'.repeat(100));
  console.log('\n📊 Query Analysis:\n');
  console.log(`Total Queries: ${queryCount}`);
  console.log(`Target: ≤10 queries`);
  console.log(`Status: ${queryCount <= 10 ? '✅ PASS' : '❌ FAIL'}\n`);

  counter.printSummary();

  // Detailed query breakdown
  console.log('\n📋 Detailed Query List:\n');
  queries.forEach((q, idx) => {
    const queryType = q.query.trim().split(' ')[0].toUpperCase();
    const tableName = extractTableName(q.query);
    console.log(`${idx + 1}. [${queryType}] ${tableName} - ${q.duration.toFixed(2)}ms`);
  });
  console.log('━'.repeat(100));

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await prisma.invoiceValidation.deleteMany({
    where: {
      invoice: {
        invoiceNumber: { startsWith: 'QUERY-' }
      }
    }
  });
  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: 'QUERY-' } }
  });
  await prisma.vendor.deleteMany({ where: { id: 9998 } });
  await prisma.user.deleteMany({ where: { email: 'query-test@test.com' } });

  await counter.disconnect();

  console.log('✓ Cleanup complete\n');
  console.log(`\n${queryCount <= 10 ? '✅' : '❌'} Query count test ${queryCount <= 10 ? 'PASSED' : 'FAILED'}\n`);

  return queryCount <= 10;
}

function extractTableName(query: string): string {
  // Extract table name from query
  const match = query.match(/FROM\s+["']?(\w+)["']?/i);
  if (match) return match[1];

  const selectMatch = query.match(/SELECT.*FROM\s+`?(\w+)`?/i);
  if (selectMatch) return selectMatch[1];

  return 'Unknown';
}

// Run test
testQueryCount()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
