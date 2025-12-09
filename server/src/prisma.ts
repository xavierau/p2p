import { PrismaClient } from '@prisma/client';
import pubSubService from './services/pubsub';
import { logger } from './utils/logger';

const SLOW_QUERY_THRESHOLD_MS = 100;

const prismaClient = new PrismaClient({
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : ['error'],
});

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  prismaClient.$on('query', (e) => {
    if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        {
          query: e.query.substring(0, 200), // Truncate long queries
          duration: e.duration,
          params: e.params,
        },
        `Slow query detected (${e.duration}ms)`
      );
    }
  });
}

const prisma = prismaClient.$extends({
    query: {
        $allModels: {
            async create({ model, operation, args, query }) {
                pubSubService.publish(`${model}.create.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.create.after`, result);
                return result;
            },
            async createMany({ model, operation, args, query }) {
                pubSubService.publish(`${model}.createMany.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.createMany.after`, result);
                return result;
            },
            async update({ model, operation, args, query }) {
                pubSubService.publish(`${model}.update.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.update.after`, result);
                return result;
            },
            async updateMany({ model, operation, args, query }) {
                pubSubService.publish(`${model}.updateMany.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.updateMany.after`, result);
                return result;
            },
            async delete({ model, operation, args, query }) {
                pubSubService.publish(`${model}.delete.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.delete.after`, result);
                return result;
            },
            async deleteMany({ model, operation, args, query }) {
                pubSubService.publish(`${model}.deleteMany.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.deleteMany.after`, result);
                return result;
            },
            async upsert({ model, operation, args, query }) {
                pubSubService.publish(`${model}.upsert.before`, args);
                const result = await query(args);
                pubSubService.publish(`${model}.upsert.after`, result);
                return result;
            },
        },
    },
});

export default prisma;
