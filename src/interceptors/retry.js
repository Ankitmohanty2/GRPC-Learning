const grpc = require('@grpc/grpc-js');
const { createLogger } = require('../config/logger');

const logger = createLogger('grpc-retry');

const DEFAULT_RETRYABLE_STATUSES = [
  grpc.status.UNAVAILABLE,
  grpc.status.DEADLINE_EXCEEDED,
  grpc.status.RESOURCE_EXHAUSTED,
];

async function executeWithRetry(operation, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const initialBackoff = options.initialBackoffMs ?? 100;
  const maxBackoff = options.maxBackoffMs ?? 2000;
  const multiplier = options.backoffMultiplier ?? 2;
  const retryable = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  let attempt = 0;
  let currentBackoff = initialBackoff;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      const statusCode = err?.code;
      const isRetryable = statusCode !== undefined && retryable.includes(statusCode);

      if (attempt > maxRetries || !isRetryable) {
        logger.warn(
          { attempt, maxRetries, code: statusCode, isRetryable },
          'Operation failed and will not be retried',
        );
        throw err;
      }

      const jitter = currentBackoff * (0.8 + Math.random() * 0.4);
      logger.info(
        { attempt, nextDelayMs: Math.round(jitter), code: statusCode },
        'Transient error encountered — retrying with backoff',
      );

      await new Promise((resolve) => setTimeout(resolve, jitter));
      currentBackoff = Math.min(currentBackoff * multiplier, maxBackoff);
    }
  }
}

module.exports = {
  DEFAULT_RETRYABLE_STATUSES,
  executeWithRetry,
};
