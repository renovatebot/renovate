import got, { CancelableRequest } from 'got';
import { logger } from '../../logger';

interface HostStats {
  median?: number;
  average?: number;
  sum?: number;
  requests?: number;
}

let stats: Record<string, number[]> = {};

// istanbul ignore next
export const resetStats = (): void => {
  stats = {};
};

// istanbul ignore next
export const printStats = (): void => {
  logger.trace({ stats }, 'Host transfer stats (milliseconds)');
  const hostStats: Record<string, HostStats> = {};
  for (const [hostname, entries] of Object.entries(stats)) {
    const res: HostStats = {};
    res.requests = entries.length;
    res.sum = 0;
    entries.forEach(entry => {
      res.sum += entry;
    });
    res.average = Math.round(res.sum / res.requests);
    res.median = entries[Math.floor(entries.length / 2)];
    hostStats[hostname] = res;
  }
  logger.debug({ hostStats }, 'Host request stats (milliseconds)');
};

export const instance = got.extend({
  handlers: [
    (options, next) => {
      const nextPromise = next(options);
      const { hostname } = options;

      (nextPromise as CancelableRequest<unknown>).on(
        'response',
        ({ timings }) => {
          const elapsed = timings.response - timings.start;

          if (hostname in stats) {
            stats[hostname].push(elapsed);
          } else {
            stats[hostname] = [elapsed];
          }
        }
      );

      return nextPromise;
    },
  ],
});
