import Bull, { Queue, Job, JobOptions } from 'bull';
import { logger } from '../../utils/logger';
import { JobQueueError } from '../../errors/AnalyticsError';
import { AnalyticsConfig, getRedisUrl } from '../../config/analytics';

/**
 * Job data payload type
 */
export interface JobData {
  [key: string]: unknown;
}

/**
 * Recurring job schedule configuration
 */
export interface RecurringJobConfig {
  /** Job name for processor routing */
  name: string;
  /** Cron expression for scheduling */
  cron: string;
  /** Job data to pass to the processor */
  data?: JobData;
  /** Job-specific options */
  options?: Omit<JobOptions, 'repeat'>;
}

/**
 * Job processor function type
 */
export type JobProcessor<T = JobData> = (job: Job<T>) => Promise<void>;

/**
 * Job Queue Service implementation using Bull
 *
 * ARCHITECTURE: Manages Bull queues for background job processing
 * Uses separate queues for different job types to allow parallel processing
 * Uses dependency injection for testability
 */
export class JobQueueService {
  private readonly log = logger.child({ service: 'JobQueueService' });
  private queues: Map<string, Queue> = new Map();
  private readonly redisUrl: string;

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || getRedisUrl();
    this.log.info({ redisUrl: this.redisUrl }, 'JobQueueService initialized');
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Create a new Bull queue
   *
   * @param queueName - Name of the queue
   * @param defaultJobOptions - Default options for jobs in this queue
   * @returns The created queue
   */
  createQueue(
    queueName: string,
    defaultJobOptions?: JobOptions
  ): Queue {
    if (this.queues.has(queueName)) {
      this.log.warn({ queueName }, 'Queue already exists, returning existing queue');
      return this.queues.get(queueName)!;
    }

    const queue = new Bull(queueName, this.redisUrl, {
      defaultJobOptions: {
        attempts: AnalyticsConfig.RETRY.MAX_ATTEMPTS,
        backoff: {
          type: AnalyticsConfig.RETRY.BACKOFF_TYPE,
          delay: AnalyticsConfig.RETRY.BACKOFF_DELAY,
        },
        removeOnComplete: AnalyticsConfig.CLEANUP.KEEP_COMPLETED,
        removeOnFail: AnalyticsConfig.CLEANUP.KEEP_FAILED,
        ...defaultJobOptions,
      },
    });

    // Set up event handlers
    this.setupQueueEventHandlers(queue, queueName);

    this.queues.set(queueName, queue);
    this.log.info({ queueName }, 'Queue created');

    return queue;
  }

  /**
   * Get an existing queue by name
   *
   * @param queueName - Name of the queue
   * @returns The queue or undefined if not found
   */
  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  /**
   * Get an existing queue by name or throw if not found
   *
   * @param queueName - Name of the queue
   * @returns The queue
   * @throws JobQueueError if queue not found
   */
  getQueueOrThrow(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new JobQueueError('getQueue', `Queue '${queueName}' not found`);
    }
    return queue;
  }

  // ============================================================================
  // Job Operations
  // ============================================================================

  /**
   * Add a job to a queue
   *
   * ARCHITECTURE: Uses job.name for processor routing, not jobId
   * Bull routes jobs to processors based on the name property
   *
   * @param queueName - Name of the queue
   * @param jobName - Job name for processor routing
   * @param data - Job data
   * @param options - Job-specific options
   * @returns The created job
   */
  async addJob<T extends JobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueueOrThrow(queueName);

    try {
      // IMPORTANT: Use queue.add(name, data, options) to set job.name
      // This allows Bull to route to the correct processor
      const job = await queue.add(jobName, data, options);

      this.log.info(
        { queueName, jobName, jobId: job.id },
        'Job added to queue'
      );

      return job;
    } catch (error) {
      this.log.error({ error, queueName, jobName }, 'Failed to add job');
      throw new JobQueueError(
        'addJob',
        `Failed to add job '${jobName}' to queue '${queueName}'`,
        error as Error
      );
    }
  }

  /**
   * Add a recurring job to a queue
   *
   * @param queueName - Name of the queue
   * @param config - Recurring job configuration
   * @returns The created job
   */
  async addRecurringJob(
    queueName: string,
    config: RecurringJobConfig
  ): Promise<Job<JobData>> {
    const queue = this.getQueueOrThrow(queueName);

    try {
      // Remove any existing repeatable job with the same name first
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const repeatableJob of repeatableJobs) {
        if (repeatableJob.name === config.name) {
          await queue.removeRepeatableByKey(repeatableJob.key);
          this.log.info(
            { queueName, jobName: config.name },
            'Removed existing repeatable job'
          );
        }
      }

      // Add the new recurring job
      const job = await queue.add(
        config.name,
        config.data ?? {},
        {
          ...config.options,
          repeat: { cron: config.cron },
        }
      );

      this.log.info(
        { queueName, jobName: config.name, cron: config.cron, jobId: job.id },
        'Recurring job added'
      );

      return job;
    } catch (error) {
      this.log.error({ error, queueName, config }, 'Failed to add recurring job');
      throw new JobQueueError(
        'addRecurringJob',
        `Failed to add recurring job '${config.name}' to queue '${queueName}'`,
        error as Error
      );
    }
  }

  /**
   * Register a processor for a specific job name on a queue
   *
   * ARCHITECTURE: Processors are registered by job name
   * Bull routes jobs to the processor matching job.name
   *
   * @param queueName - Name of the queue
   * @param jobName - Job name to process
   * @param processor - Processing function
   * @param concurrency - Number of concurrent jobs to process
   */
  registerProcessor<T extends JobData>(
    queueName: string,
    jobName: string,
    processor: JobProcessor<T>,
    concurrency: number = 1
  ): void {
    const queue = this.getQueueOrThrow(queueName);

    // Register the processor with the job name
    queue.process(jobName, concurrency, async (job: Job<T>) => {
      const startTime = Date.now();
      this.log.info(
        { queueName, jobName, jobId: job.id },
        'Processing job'
      );

      try {
        await processor(job);
        const durationMs = Date.now() - startTime;
        this.log.info(
          { queueName, jobName, jobId: job.id, durationMs },
          'Job completed successfully'
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;
        this.log.error(
          { error, queueName, jobName, jobId: job.id, durationMs },
          'Job failed'
        );
        throw error; // Re-throw to trigger Bull's retry mechanism
      }
    });

    this.log.info(
      { queueName, jobName, concurrency },
      'Processor registered'
    );
  }

  // ============================================================================
  // Queue Information
  // ============================================================================

  /**
   * Get job counts for a queue
   *
   * @param queueName - Name of the queue
   * @returns Job counts by status
   */
  async getJobCounts(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueueOrThrow(queueName);
    return queue.getJobCounts();
  }

  /**
   * Get repeatable jobs for a queue
   *
   * @param queueName - Name of the queue
   * @returns Array of repeatable job info
   */
  async getRepeatableJobs(queueName: string): Promise<Array<{
    key: string;
    name: string;
    cron: string;
    next: number;
  }>> {
    const queue = this.getQueueOrThrow(queueName);
    const jobs = await queue.getRepeatableJobs();
    return jobs.map((job) => ({
      key: job.key,
      name: job.name ?? 'unnamed',
      cron: job.cron ?? '',
      next: job.next,
    }));
  }

  // ============================================================================
  // Queue Control
  // ============================================================================

  /**
   * Pause a queue
   *
   * @param queueName - Name of the queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueOrThrow(queueName);
    await queue.pause();
    this.log.info({ queueName }, 'Queue paused');
  }

  /**
   * Resume a paused queue
   *
   * @param queueName - Name of the queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueOrThrow(queueName);
    await queue.resume();
    this.log.info({ queueName }, 'Queue resumed');
  }

  /**
   * Close a specific queue
   *
   * @param queueName - Name of the queue
   */
  async closeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.close();
      this.queues.delete(queueName);
      this.log.info({ queueName }, 'Queue closed');
    }
  }

  /**
   * Close all queues gracefully
   */
  async closeAll(): Promise<void> {
    this.log.info('Closing all queues...');

    const closePromises = Array.from(this.queues.entries()).map(
      async ([name, queue]) => {
        try {
          await queue.close();
          this.log.info({ queueName: name }, 'Queue closed');
        } catch (error) {
          this.log.error({ error, queueName: name }, 'Error closing queue');
        }
      }
    );

    await Promise.all(closePromises);
    this.queues.clear();
    this.log.info('All queues closed');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Set up event handlers for a queue
   */
  private setupQueueEventHandlers(queue: Queue, queueName: string): void {
    queue.on('error', (error) => {
      this.log.error({ error, queueName }, 'Queue error');
    });

    queue.on('waiting', (jobId) => {
      this.log.debug({ queueName, jobId }, 'Job waiting');
    });

    queue.on('active', (job) => {
      this.log.debug(
        { queueName, jobId: job.id, jobName: job.name },
        'Job active'
      );
    });

    queue.on('stalled', (job) => {
      this.log.warn(
        { queueName, jobId: job.id, jobName: job.name },
        'Job stalled'
      );
    });

    queue.on('completed', (job) => {
      this.log.debug(
        { queueName, jobId: job.id, jobName: job.name },
        'Job completed'
      );
    });

    queue.on('failed', (job, error) => {
      this.log.error(
        {
          queueName,
          jobId: job.id,
          jobName: job.name,
          error: error.message,
          attemptsMade: job.attemptsMade,
        },
        'Job failed'
      );
    });

    queue.on('removed', (job) => {
      this.log.debug(
        { queueName, jobId: job.id, jobName: job.name },
        'Job removed'
      );
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create JobQueueService
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param redisUrl - Optional Redis URL (defaults to env or localhost)
 * @returns JobQueueService instance
 */
export function createJobQueueService(redisUrl?: string): JobQueueService {
  return new JobQueueService(redisUrl);
}
