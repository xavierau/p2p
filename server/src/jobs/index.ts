/**
 * Jobs Module Index
 * Re-exports all background job setup and utilities
 *
 * ARCHITECTURE: Jobs are organized by domain (analytics, etc.)
 * Each domain exports its own setup function
 */

// Analytics Jobs
export {
  setupAnalyticsJobs,
  JobQueueService,
  createJobQueueService,
  type AnalyticsJobsDependencies,
  type AnalyticsJobsSetupResult,
} from './analytics';
