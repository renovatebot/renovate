import { setTimeout } from 'timers/promises';
import { RequestError } from 'got';
import { DateTime } from 'luxon';
import { logger } from '../../logger';
import { parseUrl } from '../url';
import type { Task } from './types';

const hostDelays = new Map<string, Promise<unknown>>();

const maxRetries = 2;

/**
 * Given a task that returns a promise, retry the task if it fails with a
 * 429 Too Many Requests or 403 Forbidden response, using the Retry-After
 * header to determine the delay.
 *
 * For response codes other than 429 or 403, or if the Retry-After header
 * is not present or invalid, the task is not retried, throwing the error.
 */
export async function wrapWithRetry<T>(
  task: Task<T>,
  url: string,
  getRetryAfter: (err: unknown) => number | null,
  maxRetryAfter: number,
): Promise<T> {
  const key = parseUrl(url)?.host ?? url;

  let retries = 0;
  for (;;) {
    try {
      await hostDelays.get(key);
      hostDelays.delete(key);

      return await task();
    } catch (err) {
      const delaySeconds = getRetryAfter(err);
      if (delaySeconds === null) {
        throw err;
      }

      if (retries === maxRetries) {
        logger.debug(
          `Retry-After: reached maximum retries (${maxRetries}) for ${url}`,
        );
        throw err;
      }

      if (delaySeconds > maxRetryAfter) {
        logger.debug(
          `Retry-After: delay ${delaySeconds} seconds exceeds maxRetryAfter ${maxRetryAfter} seconds for ${url}`,
        );
        throw err;
      }

      logger.debug(
        `Retry-After: will retry ${url} after ${delaySeconds} seconds`,
      );

      const delay = Promise.all([
        hostDelays.get(key),
        setTimeout(1000 * delaySeconds),
      ]);
      hostDelays.set(key, delay);
      retries += 1;
    }
  }
}

export function getRetryAfter(err: unknown): number | null {
  if (!(err instanceof RequestError)) {
    return null;
  }

  if (!err.response) {
    return null;
  }

  if (err.response.statusCode < 400 || err.response.statusCode >= 500) {
    logger.debug(
      { url: err.response.url },
      `Retry-After: unexpected status code ${err.response.statusCode}`,
    );
    return null;
  }

  const retryAfter = err.response.headers['retry-after']?.trim();
  if (!retryAfter) {
    return null;
  }

  const date = DateTime.fromHTTP(retryAfter);
  if (date.isValid) {
    const seconds = Math.floor(date.diffNow('seconds').seconds);
    if (seconds < 0) {
      logger.debug(
        { url: err.response.url, retryAfter },
        'Retry-After: date in the past',
      );
      return null;
    }

    return seconds;
  }

  const seconds = parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds;
  }

  logger.debug(
    { url: err.response.url, retryAfter },
    'Retry-After: unsupported format',
  );
  return null;
}
