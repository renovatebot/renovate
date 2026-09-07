import pThrottle from 'p-throttle';
import { logger } from '../../logger/index.ts';
import { parseUrl } from '../url.ts';
import { getThrottleIntervalMs } from './rate-limits.ts';

const hostThrottles = new Map<string, Throttle | null>();

export class Throttle {
  private throttle: ReturnType<typeof pThrottle>;

  constructor(interval: number) {
    this.throttle = pThrottle({
      strict: true,
      limit: 1,
      interval,
    });
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    const throttledTask = this.throttle(task);
    return throttledTask();
  }
}

/**
 * The throttle pacing requests to `url`'s host.
 *
 * As with `getQueue`, `hostType` only selects which host rules the interval is
 * read from: the throttle stays keyed by host alone, so a host reached under
 * several `hostType`s keeps the interval of whichever request created it.
 */
export function getThrottle(url: string, hostType?: string): Throttle | null {
  const host = parseUrl(url)?.host;
  if (!host) {
    // should never happen
    logger.debug(`No host on ${url}`);
    return null;
  }

  let throttle = hostThrottles.get(host);
  if (throttle === undefined) {
    throttle = null; // null represents "no throttle", as opposed to undefined
    const throttleMs = getThrottleIntervalMs(url, hostType);
    if (throttleMs) {
      logger.debug(`Using throttle ${throttleMs} intervalMs for host ${host}`);
      throttle = new Throttle(throttleMs);
    } else {
      logger.trace({ host }, 'No throttle');
    }
  }
  hostThrottles.set(host, throttle);

  return throttle;
}

export function clear(): void {
  hostThrottles.clear();
}
