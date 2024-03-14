import { logger } from '../logger';
import * as memCache from './cache/memory';

type LookupStatsData = Record<string, number[]>;

interface TimingStatsReport {
  count: number;
  avgMs: number;
  medianMs: number;
  maxMs: number;
  totalMs: number;
}

export function makeTimingReport(data: number[]): TimingStatsReport {
  const count = data.length;
  const totalMs = data.reduce((a, c) => a + c, 0);
  const avgMs = count ? Math.round(totalMs / count) : 0;
  const maxMs = Math.max(0, ...data);
  const sorted = data.sort((a, b) => a - b);
  const medianMs = count ? sorted[Math.floor(count / 2)] : 0;
  return { count, avgMs, medianMs, maxMs, totalMs };
}

export class LookupStats {
  static write(datasource: string, duration: number): void {
    const data = memCache.get<LookupStatsData>('lookup-stats') ?? {};
    data[datasource] ??= [];
    data[datasource].push(duration);
    memCache.set('lookup-stats', data);
  }

  static async wrap<T>(
    datasource: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const result = await callback();
    const duration = Date.now() - start;
    LookupStats.write(datasource, duration);
    return result;
  }

  static getReport(): Record<string, TimingStatsReport> {
    const report: Record<string, TimingStatsReport> = {};
    const data = memCache.get<LookupStatsData>('lookup-stats') ?? {};
    for (const [datasource, durations] of Object.entries(data)) {
      report[datasource] = makeTimingReport(durations);
    }
    return report;
  }

  static report(): void {
    const report = LookupStats.getReport();
    logger.debug(report, 'Lookup statistics');
  }
}

type PackageCacheData = number[];

export class PackageCacheStats {
  static writeSet(duration: number): void {
    const data = memCache.get<PackageCacheData>('package-cache-sets') ?? [];
    data.push(duration);
    memCache.set('package-cache-sets', data);
  }

  static async wrapSet<T>(callback: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await callback();
    const duration = Date.now() - start;
    PackageCacheStats.writeSet(duration);
    return result;
  }

  static writeGet(duration: number): void {
    const data = memCache.get<PackageCacheData>('package-cache-gets') ?? [];
    data.push(duration);
    memCache.set('package-cache-gets', data);
  }

  static async wrapGet<T>(callback: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await callback();
    const duration = Date.now() - start;
    PackageCacheStats.writeGet(duration);
    return result;
  }

  static getReport(): { get: TimingStatsReport; set: TimingStatsReport } {
    const packageCacheGets =
      memCache.get<PackageCacheData>('package-cache-gets') ?? [];
    const get = makeTimingReport(packageCacheGets);

    const packageCacheSets =
      memCache.get<PackageCacheData>('package-cache-sets') ?? [];
    const set = makeTimingReport(packageCacheSets);

    return { get, set };
  }

  static report(): void {
    const report = PackageCacheStats.getReport();
    logger.debug(report, 'Package cache statistics');
  }
}
