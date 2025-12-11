import { performance } from 'perf_hooks';
import prisma from '../../prisma';
import { getFlaggedInvoices, validateInvoice } from '../../services/invoiceValidationService';
import { ValidationSeverity } from '@prisma/client';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  passed: boolean;
  target: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 10,
  target: number = 500
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  await fn();

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Calculate stats
  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const sortedTimes = times.sort((a, b) => a - b);
  const p95Index = Math.floor(iterations * 0.95);
  const p95Time = sortedTimes[p95Index];

  return {
    name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p95Time,
    passed: p95Time < target,
    target
  };
}

async function setupBenchmarkData() {
  console.log('🔧 Setting up benchmark data...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'benchmark@test.com' },
    update: {},
    create: {
      email: 'benchmark@test.com',
      name: 'Benchmark User',
      password: 'hashed_password',
      role: 'USER'
    }
  });

  // Create test vendor
  const vendor = await prisma.vendor.upsert({
    where: { id: 9999 },
    update: {},
    create: {
      id: 9999,
      name: 'Benchmark Test Vendor',
      contact: 'benchmark-vendor@test.com'
    }
  });

  // Check if we already have benchmark invoices
  const existingCount = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: 'BENCH-' } }
  });

  if (existingCount >= 100) {
    console.log(`   ✓ Found ${existingCount} existing benchmark invoices`);
    return { user, vendor };
  }

  // Create 100 invoices with validations
  console.log('   Creating 100 test invoices...');
  for (let i = 0; i < 100; i++) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `BENCH-${i.toString().padStart(5, '0')}`,
        date: new Date(),
        totalAmount: 1000 + i * 10,
        userId: user.id,
        vendorId: vendor.id,
        status: 'PENDING'
      }
    });

    // Create validation for each invoice
    await prisma.invoiceValidation.create({
      data: {
        invoiceId: invoice.id,
        ruleType: 'AMOUNT_THRESHOLD_EXCEEDED',
        severity: i % 3 === 0 ? ValidationSeverity.CRITICAL : ValidationSeverity.WARNING,
        status: 'FLAGGED',
        details: { threshold: 1000, actualAmount: invoice.totalAmount }
      }
    });

    if ((i + 1) % 25 === 0) {
      console.log(`   Created ${i + 1}/100 invoices...`);
    }
  }

  console.log('   ✓ Benchmark data setup complete\n');
  return { user, vendor };
}

async function cleanupBenchmarkData() {
  console.log('\n🧹 Cleaning up benchmark data...');

  // Delete in correct order due to foreign key constraints
  await prisma.invoiceValidation.deleteMany({
    where: {
      invoice: {
        invoiceNumber: { startsWith: 'BENCH-' }
      }
    }
  });

  await prisma.invoice.deleteMany({
    where: { invoiceNumber: { startsWith: 'BENCH-' } }
  });

  await prisma.vendor.deleteMany({
    where: { id: 9999 }
  });

  await prisma.user.deleteMany({
    where: { email: 'benchmark@test.com' }
  });

  console.log('   ✓ Cleanup complete');
}

async function runBenchmarks() {
  console.log('🏁 Starting Performance Benchmarks...\n');
  console.log('━'.repeat(100));

  // Setup
  await setupBenchmarkData();

  const results: BenchmarkResult[] = [];

  // Benchmark 1: Load 100 flagged invoices
  console.log('📊 Benchmark 1: Load 100 flagged invoices');
  const result1 = await benchmark(
    'Load 100 Flagged Invoices',
    async () => {
      await getFlaggedInvoices(
        {},
        { page: 1, limit: 100 }
      );
    },
    10,
    500 // Target: <500ms
  );
  results.push(result1);
  console.log(`   ✓ Completed (${result1.p95Time.toFixed(2)}ms P95)\n`);

  // Benchmark 2: Load with filters
  console.log('📊 Benchmark 2: Load flagged invoices with severity filter');
  const result2 = await benchmark(
    'Load with Severity Filter',
    async () => {
      await getFlaggedInvoices(
        { severity: ValidationSeverity.CRITICAL },
        { page: 1, limit: 50 }
      );
    },
    10,
    300 // Target: <300ms (smaller dataset)
  );
  results.push(result2);
  console.log(`   ✓ Completed (${result2.p95Time.toFixed(2)}ms P95)\n`);

  // Benchmark 3: Validate single invoice
  console.log('📊 Benchmark 3: Validate single invoice');
  const testInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: 'BENCH-' } }
  });

  if (!testInvoice) {
    throw new Error('No test invoice found');
  }

  const result3 = await benchmark(
    'Validate Single Invoice',
    async () => {
      await validateInvoice(testInvoice.id);
    },
    20,
    200 // Target: <200ms
  );
  results.push(result3);
  console.log(`   ✓ Completed (${result3.p95Time.toFixed(2)}ms P95)\n`);

  // Benchmark 4: Consistency check (validation produces same results)
  console.log('📊 Benchmark 4: Validation consistency');
  const consistencyIterations = 10;
  const consistencyResults: any[] = [];

  for (let i = 0; i < consistencyIterations; i++) {
    const result = await validateInvoice(testInvoice.id);
    consistencyResults.push(result);
  }

  // Check that all results have same flag count
  const flagCounts = consistencyResults.map(r => r.flagCount);
  const allSame = flagCounts.every(count => count === flagCounts[0]);
  const avgTime = result3.avgTime;

  console.log(`   Validations run: ${consistencyIterations}`);
  console.log(`   Results consistent: ${allSame ? 'Yes' : 'No'}`);
  console.log(`   Average validation time: ${avgTime.toFixed(2)}ms`);
  console.log(`   Status: ${allSame ? '✅ PASS' : '❌ FAIL'}\n`);

  // Note: Cache is instance-scoped per validateInvoice call
  // For production, consider implementing application-level cache
  console.log('   ℹ️  Note: ValidationRuleCache is instance-scoped');
  console.log('   ℹ️  Each validateInvoice() creates new cache instance');
  console.log('   ℹ️  For production optimization, consider singleton cache\n');

  // Print results
  console.log('━'.repeat(100));
  console.log('\n📈 Benchmark Results:\n');
  console.log('━'.repeat(100));
  console.log(
    'Benchmark'.padEnd(35),
    'Avg'.padEnd(12),
    'Min'.padEnd(12),
    'Max'.padEnd(12),
    'P95'.padEnd(12),
    'Target'.padEnd(12),
    'Status'
  );
  console.log('━'.repeat(100));

  for (const result of results) {
    console.log(
      result.name.padEnd(35),
      `${result.avgTime.toFixed(2)}ms`.padEnd(12),
      `${result.minTime.toFixed(2)}ms`.padEnd(12),
      `${result.maxTime.toFixed(2)}ms`.padEnd(12),
      `${result.p95Time.toFixed(2)}ms`.padEnd(12),
      `<${result.target}ms`.padEnd(12),
      result.passed ? '✅ PASS' : '❌ FAIL'
    );
  }
  console.log('━'.repeat(100));

  // Overall summary
  const allPassed = results.every(r => r.passed) && allSame;
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'ALL BENCHMARKS PASSED' : 'SOME BENCHMARKS FAILED'}\n`);

  return {
    results,
    consistencyCheck: allSame,
    allPassed
  };
}

// Run benchmarks
runBenchmarks()
  .then(async (benchmarkResults) => {
    console.log('✅ Benchmarks complete');

    // Cleanup
    await cleanupBenchmarkData();

    process.exit(benchmarkResults.allPassed ? 0 : 1);
  })
  .catch(async (error) => {
    console.error('❌ Benchmark error:', error);

    // Attempt cleanup even on error
    try {
      await cleanupBenchmarkData();
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }

    process.exit(1);
  });
