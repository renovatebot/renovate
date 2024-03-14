import { logger } from '../logger';
import * as memCache from './cache/memory';
import { parseUrl } from './url';

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

export interface HttpRequestStatsDataPoint {
  method: string;
  url: string;
  reqMs: number;
  queueMs: number;
  status: number;
}

interface HostStatsData {
  count: number;
  reqAvgMs: number;
  reqMedianMs: number;
  reqMaxMs: number;
  queueAvgMs: number;
  queueMedianMs: number;
  queueMaxMs: number;
}

interface HttpStatsCollection {
  urlCounts: Record<string, number>;
  allRequests: string[];
  requestsByHost: Record<string, HttpRequestStatsDataPoint[]>;
  statsByHost: Record<string, HostStatsData>;
  totalRequests: number;
}

export class HttpStats {
  static write(data: HttpRequestStatsDataPoint): void {
    const httpRequests =
      memCache.get<HttpRequestStatsDataPoint[]>('http-requests') ?? [];
    httpRequests.push(data);
    memCache.set('http-requests', httpRequests);
  }

  static getDataPoints(): HttpRequestStatsDataPoint[] {
    const httpRequests =
      memCache.get<HttpRequestStatsDataPoint[]>('http-requests') ?? [];

    // istanbul ignore next: sorting is hard and not worth testing
    httpRequests.sort((a, b) => {
      if (a.url < b.url) {
        return -1;
      }

      if (a.url > b.url) {
        return 1;
      }

      return 0;
    });

    return httpRequests;
  }

  static getReport(): HttpStatsCollection {
    const dataPoints = HttpStats.getDataPoints();

    const urlCounts: Record<string, number> = {};
    const allRequests: string[] = [];
    const requestsByHost: Record<string, HttpRequestStatsDataPoint[]> = {};

    for (const dataPoint of dataPoints) {
      const { url, reqMs, queueMs, status } = dataPoint;
      const method = dataPoint.method.toUpperCase();

      const parsedUrl = parseUrl(url);
      if (!parsedUrl) {
        logger.debug({ url }, 'Failed to parse URL during stats reporting');
        continue;
      }
      const { hostname, origin, pathname } = parsedUrl;
      const baseUrl = `${origin}${pathname}`;

      const urlKey = `${baseUrl} (${method}, ${status})`;
      urlCounts[urlKey] ??= 0;
      urlCounts[urlKey] += 1;

      allRequests.push(`${method} ${url} ${status} ${reqMs} ${queueMs}`);

      requestsByHost[hostname] ??= [];
      requestsByHost[hostname].push(dataPoint);
    }

    const statsByHost: Record<string, HostStatsData> = {};

    let totalRequests = 0;
    for (const [hostname, requests] of Object.entries(requestsByHost)) {
      const count = requests.length;
      totalRequests += count;

      const reqTimes = requests.map((r) => r.reqMs);
      const queueTimes = requests.map((r) => r.queueMs);

      const reqReport = makeTimingReport(reqTimes);
      const queueReport = makeTimingReport(queueTimes);

      statsByHost[hostname] = {
        count,
        reqAvgMs: reqReport.avgMs,
        reqMedianMs: reqReport.medianMs,
        reqMaxMs: reqReport.maxMs,
        queueAvgMs: queueReport.avgMs,
        queueMedianMs: queueReport.medianMs,
        queueMaxMs: queueReport.maxMs,
      };
    }

    return {
      urlCounts,
      allRequests,
      requestsByHost,
      statsByHost,
      totalRequests,
    };
  }

  static report(): void {
    const {
      urlCounts,
      allRequests,
      requestsByHost,
      statsByHost,
      totalRequests,
    } = HttpStats.getReport();
    logger.trace({ allRequests, requestsByHost }, 'HTTP full stats');
    logger.debug({ urlCounts, statsByHost, totalRequests }, 'HTTP stats');
  }
}
