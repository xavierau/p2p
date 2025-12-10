/**
 * Base class for all domain-specific errors.
 * Extends Error to maintain stack traces and standard error behavior.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when domain validation rules are violated.
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when attempting illegal state transitions.
 */
export class InvalidStateTransitionError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when attempting to modify immutable entities.
 */
export class ImmutableEntityError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when business rules are violated.
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
