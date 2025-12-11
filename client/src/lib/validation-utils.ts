/**
 * Validation utility functions
 * Shared utilities for validation components to eliminate code duplication
 */

import type { ValidationSeverity } from '@/types';

/**
 * Format rule type for display
 * Converts SCREAMING_SNAKE_CASE to Title Case
 *
 * @example
 * formatRuleType('DUPLICATE_INVOICE') // 'Duplicate Invoice'
 * formatRuleType('AMOUNT_THRESHOLD') // 'Amount Threshold'
 */
export function formatRuleType(ruleType: string): string {
  return ruleType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get badge variant for severity level
 * Maps validation severity to UI badge variant
 *
 * @example
 * getSeverityBadgeVariant('CRITICAL') // 'error'
 * getSeverityBadgeVariant('WARNING') // 'warning'
 */
export function getSeverityBadgeVariant(
  severity: ValidationSeverity
): 'error' | 'warning' | 'info' | 'default' {
  switch (severity) {
    case 'CRITICAL':
      return 'error';
    case 'WARNING':
      return 'warning';
    case 'INFO':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Get alert variant for severity level
 * Maps validation severity to UI alert variant
 */
export function getSeverityAlertVariant(
  severity: ValidationSeverity
): 'default' | 'destructive' {
  return severity === 'CRITICAL' ? 'destructive' : 'default';
}

/**
 * Get background color class for severity level
 * Returns Tailwind CSS classes for severity-based backgrounds
 */
export function getSeverityBgColor(severity: ValidationSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-50 dark:bg-red-950';
    case 'WARNING':
      return 'bg-yellow-50 dark:bg-yellow-950';
    case 'INFO':
      return 'bg-blue-50 dark:bg-blue-950';
    default:
      return 'bg-gray-50 dark:bg-gray-950';
  }
}

/**
 * Get border color class for severity level
 * Returns Tailwind CSS classes for severity-based border colors
 */
export function getSeverityBorderColor(severity: ValidationSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-l-red-500';
    case 'WARNING':
      return 'border-l-yellow-500';
    case 'INFO':
      return 'border-l-blue-500';
    default:
      return 'border-l-gray-500';
  }
}
