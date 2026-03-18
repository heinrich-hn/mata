/**
 * Centralized logging utility
 * Provides environment-aware logging that only outputs in development
 * and properly formats error logs for production monitoring
 */

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

// Disable all logs in test environment
const shouldLog = !isTest;

export const logger = {
  /**
   * Development-only general logging
   */
  log: (...args: unknown[]): void => {
    if (shouldLog && isDev) {
      console.log('[LOG]', ...args);
    }
  },

  /**
   * Error logging (always enabled, formatted for production)
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    if (!shouldLog) return;

    const errorDetails = {
      message,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.MODE,
      ...(context && { context }),
      ...(error && {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: isDev ? error.stack : undefined,
            }
          : error,
      }),
    };

    if (isDev) {
      console.error('[ERROR]', errorDetails);
    } else {
      // In production, send structured error to monitoring service
      console.error(JSON.stringify(errorDetails));

      // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
      // sendToMonitoring(errorDetails);
    }
  },

  /**
   * Warning logging (development only)
   */
  warn: (...args: unknown[]): void => {
    if (shouldLog && isDev) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Info logging (development only)
   */
  info: (...args: unknown[]): void => {
    if (shouldLog && isDev) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Debug logging (development only, for verbose debugging)
   */
  debug: (...args: unknown[]): void => {
    if (shouldLog && isDev) {
      console.debug('[DEBUG]', ...args);
    }
  },

  /**
   * Performance timing
   */
  time: (label: string): void => {
    if (shouldLog && isDev) {
      console.time(`[TIME] ${label}`);
    }
  },

  /**
   * End performance timing
   */
  timeEnd: (label: string): void => {
    if (shouldLog && isDev) {
      console.timeEnd(`[TIME] ${label}`);
    }
  },

  /**
   * Group related logs
   */
  group: (label: string): void => {
    if (shouldLog && isDev) {
      console.group(`[GROUP] ${label}`);
    }
  },

  /**
   * End log group
   */
  groupEnd: (): void => {
    if (shouldLog && isDev) {
      console.groupEnd();
    }
  },
};

/**
 * Async error handler wrapper
 * Usage: await handleAsync(myAsyncFunction())
 */
export async function handleAsync<T>(
  promise: Promise<T>,
  errorMessage?: string
): Promise<[T | null, Error | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error);
    }
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

export default logger;