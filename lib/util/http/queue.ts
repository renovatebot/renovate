import URL from 'url';
import PQueue from 'p-queue';
import { getRequestLimit } from './host-rules';

let hostQueues: Record<string, PQueue> = {};
let defaultQueue: PQueue;

function getDefaultQueue(): PQueue {
  if (!defaultQueue) {
    defaultQueue = new PQueue();
  }
  return defaultQueue;
}

function getUrlHost(url: string): string | null {
  try {
    return URL.parse(url).host;
  } catch (e) /* istanbul ignore next */ {
    return null;
  }
}

export function getQueue(url: string): PQueue {
  const host = getUrlHost(url);

  /* istanbul ignore if */
  if (!host) {
    return getDefaultQueue();
  }

  let queue = hostQueues[host];
  if (!queue) {
    const concurrency = getRequestLimit(url);
    if (concurrency) {
      queue = new PQueue({ concurrency });
      hostQueues[host] = queue;
    } else {
      queue = getDefaultQueue();
    }
  }

  return queue;
}

export function clear() {
  hostQueues = {};
  defaultQueue = undefined;
}
