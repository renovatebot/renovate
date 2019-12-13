import { logger } from '../../logger';
import { create } from './util';

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

export const instance = create({
  options: {},
  handler: (options, next) => {
    const start = new Date();
    const nextPromise = next(options);
    nextPromise.on('response', () => {
      const elapsed = new Date().getTime() - start.getTime();
      stats[options.hostname] = stats[options.hostname] || [];
      stats[options.hostname].push(elapsed);
    });
    return nextPromise;
  },
});
