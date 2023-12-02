import { setTimeout } from 'timers/promises';
import { RequestError } from 'got';
import { DateTime } from 'luxon';
import { logger } from '../../logger';
import { parseUrl } from '../url';
import type { Task } from './types';

const hostBlocks = new Map<string, Promise<unknown>>();

const maxRetries = 2;

export async function wrapWithRetry<T>(
  task: Task<T>,
  url: string,
  getRetryAfter: (err: unknown) => number | null,
  maxRetryAfter: number,
): Promise<T> {
  const key = parseUrl(url)?.host ?? /* istanbul ignore next */ url;

  let retries = 0;
  for (;;) {
    try {
      const delayPromise = hostBlocks.get(key);
      if (delayPromise) {
        await delayPromise;
        hostBlocks.delete(key);
      }

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
        hostBlocks.get(key),
        setTimeout(1000 * delaySeconds),
      ]);
      hostBlocks.set(key, delay);
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

  if (err.response.statusCode !== 429 && err.response.statusCode !== 403) {
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
  if (!Number.isNaN(seconds)) {
    return seconds;
  }

  logger.debug(
    { url: err.response.url, retryAfter },
    'Retry-After: unsupported format',
  );
  return null;
}
