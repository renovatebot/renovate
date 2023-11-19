import { RequestError } from 'got';
import type { Task } from './types';

const hostBlocks = new Map<string, Promise<void>>();

const maxRetries = 2;

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => global.setTimeout(resolve, seconds * 1000));
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

export async function wrapWithRetry<T>(
  key: string,
  task: Task<T>,
  getDelaySeconds: (err: unknown) => number | null,
): Promise<T> {
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

      hostBlocks.set(key, sleep(delaySeconds));
      retries += 1;
    }
  }
}
