import URL from 'url';
import PQueue from 'p-queue';
import { getQueueOptions } from './host-rules';

const hostQueues = new Map<string | null, PQueue | null>();

function getUrlHost(url: string): string | null {
  try {
    return URL.parse(url).host;
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

    const options = getQueueOptions(url);
    if (Object.keys(options).length !== 0) {
      queue = new PQueue(options);
    }

    hostQueues.set(host, queue);
  }

  return queue;
}

export function clear(): void {
  hostQueues.clear();
}
