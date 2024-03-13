import { logger } from '../logger';
import * as memCache from './cache/memory';

type LookupStatsData = Record<string, number[]>;

interface LookupStatsReport {
  count: number;
  averageMs: number;
  medianMs: number;
  maximumMs: number;
  totalMs: number;
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

  static getReport(): Record<string, LookupStatsReport> {
    const report: Record<string, LookupStatsReport> = {};
    const data = memCache.get<LookupStatsData>('lookup-stats') ?? {};
    for (const [datasource, durations] of Object.entries(data)) {
      const count = durations.length;
      const totalMs = durations.reduce((a, c) => a + c, 0);
      const averageMs = Math.round(totalMs / count);
      const maximumMs = Math.max(...durations);
      const sorted = durations.sort((a, b) => a - b);
      const medianMs = sorted[Math.floor(count / 2)];
      report[datasource] = {
        count,
        averageMs,
        medianMs,
        maximumMs,
        totalMs,
      };
    }

    return report;
  }

  static report(): void {
    const report = LookupStats.getReport();
    logger.debug(report, 'Lookup statistics');
  }
}
