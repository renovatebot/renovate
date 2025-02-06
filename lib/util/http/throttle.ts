import pThrottle from 'p-throttle';
import { logger } from '../../logger';
import { parseUrl } from '../url';
import { getThrottleIntervalMs } from './rate-limits';

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

export function getThrottle(url: string): Throttle | null {
  const host = parseUrl(url)?.host;
  if (!host) {
    // should never happen
    logger.debug(`No host on ${url}`);
    return null;
  }

  let throttle = hostThrottles.get(host);
  if (throttle === undefined) {
    throttle = null; // null represents "no throttle", as opposed to undefined
    const throttleMs = getThrottleIntervalMs(url);
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
