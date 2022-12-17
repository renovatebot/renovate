import PQueue from 'p-queue';
import { logger } from '../../logger';
import { parseUrl } from '../url';
import { getConcurrentRequestsLimit } from './host-rules';

const hostQueues = new Map<string, PQueue | null>();

export function getQueue(url: string): PQueue | null {
  const host = parseUrl(url)?.host;
  if (!host) {
    // should never happen
    logger.debug(`No host on ${url}`);
    return null;
  }

  let queue = hostQueues.get(host);
  if (queue === undefined) {
    queue = null; // null represents "no queue", as opposed to undefined
    const concurrency = getConcurrentRequestsLimit(url);
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
