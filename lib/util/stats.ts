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
