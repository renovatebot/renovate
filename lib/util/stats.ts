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

// url -> method -> status -> count
type UrlHttpStat = Record<string, Record<string, Record<string, number>>>;

interface HttpStatsCollection {
  // debug data
  urls: UrlHttpStat;
  hosts: Record<string, HostStatsData>;
  requests: number;

  // trace data
  rawRequests: string[];
  hostRequests: Record<string, HttpRequestStatsDataPoint[]>;
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

    const requests = dataPoints.length;

    const urls: UrlHttpStat = {};
    const rawRequests: string[] = [];
    const hostRequests: Record<string, HttpRequestStatsDataPoint[]> = {};

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

      urls[baseUrl] ??= {};
      urls[baseUrl][method] ??= {};
      urls[baseUrl][method][status] ??= 0;
      urls[baseUrl][method][status] += 1;

      rawRequests.push(`${method} ${url} ${status} ${reqMs} ${queueMs}`);

      hostRequests[hostname] ??= [];
      hostRequests[hostname].push(dataPoint);
    }

    const hosts: Record<string, HostStatsData> = {};

    for (const [hostname, dataPoints] of Object.entries(hostRequests)) {
      const count = dataPoints.length;

      const reqTimes = dataPoints.map((r) => r.reqMs);
      const queueTimes = dataPoints.map((r) => r.queueMs);

      const reqReport = makeTimingReport(reqTimes);
      const queueReport = makeTimingReport(queueTimes);

      hosts[hostname] = {
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
      urls,
      rawRequests,
      hostRequests,
      hosts,
      requests,
    };
  }

  static report(): void {
    const { urls, rawRequests, hostRequests, hosts, requests } =
      HttpStats.getReport();
    logger.trace({ rawRequests, hostRequests }, 'HTTP full statistics');
    logger.debug({ urls, hosts, requests }, 'HTTP statistics');
  }
}

interface HttpCacheHostStatsData {
  hit: number;
  miss: number;
  localHit?: number;
  localMiss?: number;
}

type HttpCacheStatsData = Record<string, HttpCacheHostStatsData>;

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    result[key] = obj[key];
  }
  return result;
}

export class HttpCacheStats {
  static getData(): HttpCacheStatsData {
    return memCache.get<HttpCacheStatsData>('http-cache-stats') ?? {};
  }

  static read(key: string): HttpCacheHostStatsData {
    return (
      this.getData()?.[key] ?? {
        hit: 0,
        miss: 0,
      }
    );
  }

  static write(key: string, data: HttpCacheHostStatsData): void {
    const stats = memCache.get<HttpCacheStatsData>('http-cache-stats') ?? {};
    stats[key] = data;
    memCache.set('http-cache-stats', stats);
  }

  static getBaseUrl(url: string): string | null {
    const parsedUrl = parseUrl(url);
    if (!parsedUrl) {
      logger.debug({ url }, 'Failed to parse URL during cache stats');
      return null;
    }
    const { origin, pathname } = parsedUrl;
    const baseUrl = `${origin}${pathname}`;
    return baseUrl;
  }

  static incLocalHits(url: string): void {
    const baseUrl = HttpCacheStats.getBaseUrl(url);
    if (baseUrl) {
      const host = baseUrl;
      const stats = HttpCacheStats.read(host);
      stats.localHit ??= 0;
      stats.localHit += 1;
      HttpCacheStats.write(host, stats);
    }
  }

  static incLocalMisses(url: string): void {
    const baseUrl = HttpCacheStats.getBaseUrl(url);
    if (baseUrl) {
      const host = baseUrl;
      const stats = HttpCacheStats.read(host);
      stats.localMiss ??= 0;
      stats.localMiss += 1;
      HttpCacheStats.write(host, stats);
    }
  }

  static incRemoteHits(url: string): void {
    const baseUrl = HttpCacheStats.getBaseUrl(url);
    if (baseUrl) {
      const host = baseUrl;
      const stats = HttpCacheStats.read(host);
      stats.hit += 1;
      HttpCacheStats.write(host, stats);
    }
  }

  static incRemoteMisses(url: string): void {
    const baseUrl = HttpCacheStats.getBaseUrl(url);
    if (baseUrl) {
      const host = baseUrl;
      const stats = HttpCacheStats.read(host);
      stats.miss += 1;
      HttpCacheStats.write(host, stats);
    }
  }

  static report(): void {
    const data = HttpCacheStats.getData();
    let report: Record<string, Record<string, HttpCacheHostStatsData>> = {};
    for (const [url, stats] of Object.entries(data)) {
      const parsedUrl = parseUrl(url);
      if (parsedUrl) {
        const { origin, pathname } = parsedUrl;
        report[origin] ??= {};
        report[origin][pathname] = stats;
      }
    }

    for (const [host, hostStats] of Object.entries(report)) {
      report[host] = sortObject(hostStats);
    }
    report = sortObject(report);

    logger.debug(report, 'HTTP cache statistics');
  }
}
