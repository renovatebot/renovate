import URL from 'url';
import PQueue from 'p-queue';
import { getRequestLimit } from './host-rules';

let hostQueues: Record<string, PQueue> = {};

function getUrlHost(url: string): string | null {
  try {
    return URL.parse(url).host;
  } catch (e) /* istanbul ignore next */ {
    return null;
  }
}

export function getQueue(url: string): PQueue | null {
  const host = getUrlHost(url);

  /* istanbul ignore if */
  if (!host) {
    return null;
  }

  let queue = hostQueues[host];
  if (!queue) {
    const concurrency = getRequestLimit(url);
    if (concurrency) {
      queue = new PQueue({ concurrency });
      hostQueues[host] = queue;
    } else {
      queue = null;
    }
  }

  return queue;
}

export function clear(): void {
  hostQueues = {};
}
