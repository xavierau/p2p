/**
 * Infrastructure Layer Barrel Export
 * Provides convenient access to all infrastructure components.
 *
 * This layer contains:
 * - Persistence implementations (Prisma repositories and mappers)
 * - External service integrations (S3 storage)
 * - Event subscribers
 *
 * The infrastructure layer implements the interfaces defined in the domain layer,
 * ensuring that domain logic remains independent of implementation details.
 */

// Persistence - Repositories
export * from './persistence/prisma/repositories';

// Persistence - Mappers
export * from './persistence/prisma/mappers';

// Storage
export * from './storage';

// Events
export * from './events/subscribers';
