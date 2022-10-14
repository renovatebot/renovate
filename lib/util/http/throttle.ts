import pThrottle from 'p-throttle';
import { logger } from '../../logger';
import { parseUrl } from '../url';
import { getThrottleOptions } from './host-rules';

const hostThrottles = new Map<string, Throttle | null>();

class Throttle {
  private throttle: <Argument extends readonly unknown[], ReturnValue>(
    function_: (...args: Argument) => ReturnValue
  ) => pThrottle.ThrottledFunction<Argument, ReturnValue>;

  constructor(limit: number, interval: number) {
    this.throttle = pThrottle({ limit, interval, strict: true });
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
    logger.debug({ url }, 'No host');
    return null;
  }

  let throttle = hostThrottles.get(host);
  if (throttle === undefined) {
    throttle = null; // null represents "no throttle", as opposed to undefined
    const throttleOptions = getThrottleOptions(url);
    if (throttleOptions) {
      const { limit, interval } = throttleOptions;
      logger.debug({ limit, interval, host }, 'Using throttle');
      throttle = new Throttle(limit, interval);
    } else {
      logger.debug({ host }, 'No throttle');
    }
  }
  hostThrottles.set(host, throttle);

  return throttle;
}

export function clear(): void {
  hostThrottles.clear();
}
