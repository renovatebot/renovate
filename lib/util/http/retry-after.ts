import { setTimeout } from 'timers/promises';
import { RequestError } from 'got';
import * as hostRules from '../host-rules';
import { parseUrl } from '../url';
import type { Task } from './types';

const hostBlocks = new Map<string, Promise<void>>();

const maxRetries = 2;

export async function wrapWithRetry<T>(
  url: string,
  task: Task<T>,
  getDelaySeconds: (err: unknown) => number | null,
  maxRetryAfter = 60,
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
      if (retries === maxRetries) {
        throw err;
      }

      const delaySeconds = getDelaySeconds(err);
      if (delaySeconds === null) {
        throw err;
      }

      const delay = 1000 * Math.max(0, Math.min(delaySeconds, maxRetryAfter));
      hostBlocks.set(key, setTimeout(delay));
      retries += 1;
    }
  }
}

export function extractRetryAfterHeaderSeconds(err: unknown): number | null {
  if (!(err instanceof RequestError)) {
    return null;
  }

  if (!err.response) {
    return null;
  }

  if (err.response.statusCode !== 429) {
    return null;
  }

  const retryAfter = err.response.headers['retry-after'];
  if (!retryAfter) {
    return null;
  }

  const seconds = parseInt(retryAfter, 10);
  if (Number.isNaN(seconds)) {
    return null;
  }

  return seconds;
}

export function getMaxRetryAfter(url: string): number {
  const { maxRetryAfter = 60 } = hostRules.find({ url });
  return maxRetryAfter;
}
