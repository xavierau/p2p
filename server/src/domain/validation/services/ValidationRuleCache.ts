import { IValidationRuleRepository, ValidationRule } from '../repositories/IValidationRuleRepository';

/**
 * In-memory cache for validation rules with TTL
 * Reduces database queries from N to ~1 per TTL period
 */
export class ValidationRuleCache {
  private cache: ValidationRule[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private ruleRepository: IValidationRuleRepository) {}

  /**
   * Get enabled validation rules (from cache if available)
   */
  async getEnabledRules(): Promise<ValidationRule[]> {
    const now = Date.now();

    // Return cached rules if still valid
    if (this.cache && (now - this.cacheTimestamp) < this.TTL_MS) {
      return this.cache;
    }

    // Fetch fresh rules from repository
    const rules = await this.ruleRepository.findEnabled();

    // Update cache
    this.cache = rules;
    this.cacheTimestamp = now;

    return rules;
  }

  /**
   * Invalidate cache when rules are updated
   */
  invalidate(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Force refresh cache
   */
  async refresh(): Promise<ValidationRule[]> {
    this.invalidate();
    return this.getEnabledRules();
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { isCached: boolean; age: number; ttl: number } {
    const now = Date.now();
    const age = this.cache ? now - this.cacheTimestamp : 0;
    return {
      isCached: this.cache !== null,
      age,
      ttl: this.TTL_MS
    };
  }
}
