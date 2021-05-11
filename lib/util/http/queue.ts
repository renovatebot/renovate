import PQueue from 'p-queue';
import { parseUrl } from '../url';
import { getRequestLimit } from './host-rules';

const hostQueues = new Map<string | null, PQueue | null>();

function getUrlHost(url: string): string | null {
  try {
    return parseUrl(url)?.host ?? null;
  } catch (e) {
    return null;
  }
}

export function getQueue(url: string): PQueue | null {
  const host = getUrlHost(url);
  if (!host) {
    return null;
  }

  let queue = hostQueues.get(host);
  if (queue === undefined) {
    queue = null; // null represents "no queue", as opposed to undefined
    const concurrency = getRequestLimit(url);
    if (concurrency) {
      queue = new PQueue({ concurrency });
    }
  }
  hostQueues.set(host, queue);

  return queue;
}

export function clear(): void {
  hostQueues.clear();
}
