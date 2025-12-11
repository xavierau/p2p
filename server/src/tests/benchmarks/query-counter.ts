import { PrismaClient } from '@prisma/client';

export interface QueryInfo {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
}

export interface QueryCounter {
  prisma: PrismaClient;
  getCount: () => number;
  getQueries: () => QueryInfo[];
  reset: () => void;
  disconnect: () => Promise<void>;
  printSummary: () => void;
}

/**
 * Creates a Prisma client with query logging and counting
 */
export function createQueryCounter(): QueryCounter {
  let queryCount = 0;
  const queries: QueryInfo[] = [];

  const prismaWithLogging = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  });

  // @ts-ignore - Prisma event types
  prismaWithLogging.$on('query', (e: any) => {
    queryCount++;
    queries.push({
      query: e.query,
      params: e.params,
      duration: e.duration,
      timestamp: new Date()
    });
  });

  const printSummary = () => {
    console.log('\n📊 Query Summary:');
    console.log('━'.repeat(100));
    console.log(`Total Queries: ${queryCount}`);
    console.log(`Total Duration: ${queries.reduce((sum, q) => sum + q.duration, 0).toFixed(2)}ms`);
    console.log(`Average Duration: ${(queries.reduce((sum, q) => sum + q.duration, 0) / queries.length).toFixed(2)}ms`);
    console.log('━'.repeat(100));

    if (queries.length > 0) {
      console.log('\nQuery Breakdown:');
      queries.forEach((q, idx) => {
        const queryPreview = q.query.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`${idx + 1}. [${q.duration.toFixed(2)}ms] ${queryPreview}...`);
      });
      console.log('━'.repeat(100));
    }
  };

  return {
    prisma: prismaWithLogging,
    getCount: () => queryCount,
    getQueries: () => [...queries],
    reset: () => {
      queryCount = 0;
      queries.length = 0;
    },
    disconnect: async () => {
      await prismaWithLogging.$disconnect();
    },
    printSummary
  };
}

/**
 * Measure query count for a specific operation
 */
export async function measureQueries<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  target: number = 10
): Promise<{ result: T; queryCount: number; queries: QueryInfo[]; passed: boolean }> {
  const counter = createQueryCounter();

  counter.reset();
  const result = await operation(counter.prisma);

  const queryCount = counter.getCount();
  const queries = counter.getQueries();
  const passed = queryCount <= target;

  console.log(`\n📊 Query Count Analysis:`);
  console.log(`   Total Queries: ${queryCount}`);
  console.log(`   Target: ≤${target} queries`);
  console.log(`   Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);

  if (!passed) {
    console.log(`\n⚠️  Warning: Query count (${queryCount}) exceeds target (${target})`);
    counter.printSummary();
  }

  await counter.disconnect();

  return { result, queryCount, queries, passed };
}

// Example usage
if (require.main === module) {
  (async () => {
    const { measureQueries } = await import('./query-counter');
    const { getFlaggedInvoices } = await import('../../services/invoiceValidationService');

    console.log('🔍 Testing query count for getFlaggedInvoices...\n');

    const { queryCount, passed } = await measureQueries(
      async (prisma) => {
        return await getFlaggedInvoices({}, { page: 1, limit: 100 });
      },
      10 // Target: less than 10 queries
    );

    console.log(`\n${passed ? '✅' : '❌'} Query count test ${passed ? 'PASSED' : 'FAILED'}`);
    process.exit(passed ? 0 : 1);
  })();
}
