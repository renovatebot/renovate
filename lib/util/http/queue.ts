import PQueue from 'p-queue';
import { logger } from '../../logger/index.ts';
import { parseUrl } from '../url.ts';
import { getConcurrentRequestsLimit } from './rate-limits.ts';

const hostQueues = new Map<string, PQueue | null>();

/**
 * The queue limiting how many requests may be in flight against `url`'s host.
 *
 * `hostType` only selects which host rules the limit is read from. The queue
 * stays keyed by host alone, because concurrency is a property of the remote
 * server rather than of the module talking to it, so a host reached under
 * several `hostType`s keeps the limit of whichever request created its queue.
 */
export function getQueue(url: string, hostType?: string): PQueue | null {
  const host = parseUrl(url)?.host;
  if (!host) {
    // should never happen
    logger.debug(`No host on ${url}`);
    return null;
  }

  let queue = hostQueues.get(host);
  if (queue === undefined) {
    queue = null; // null represents "no queue", as opposed to undefined
    const concurrency = getConcurrentRequestsLimit(url, hostType);
    if (concurrency) {
      logger.debug(`Using queue: host=${host}, concurrency=${concurrency}`);
      queue = new PQueue({ concurrency });
    } else {
      logger.trace({ host }, 'No concurrency limits');
    }
  }
  hostQueues.set(host, queue);

  return queue;
}

export function clear(): void {
  hostQueues.clear();
}
