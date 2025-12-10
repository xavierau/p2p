/**
 * Shared Domain Layer Exports
 * Common domain errors and utilities used across all bounded contexts.
 */

export {
  DomainError,
  ValidationError,
  InvalidStateTransitionError,
  ImmutableEntityError,
  BusinessRuleViolationError,
} from './DomainError';
