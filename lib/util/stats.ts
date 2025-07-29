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

interface DatasourceCacheDataPoint {
  datasource: string;
  registryUrl: string;
  packageName: string;
  action: 'hit' | 'miss' | 'set' | 'skip';
}

/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
export interface DatasourceCacheReport {
  long: {
    [datasource in string]: {
      [registryUrl in string]: {
        [packageName in string]: {
          read?: 'hit' | 'miss';
          write?: 'set' | 'skip';
        };
      };
    };
  };
  short: {
    [datasource in string]: {
      [registryUrl in string]: {
        hit: number;
        miss: number;
        set: number;
        skip: number;
      };
    };
  };
}
/* eslint-enable @typescript-eslint/consistent-indexed-object-style */

export class DatasourceCacheStats {
  private static getData(): DatasourceCacheDataPoint[] {
    return (
      memCache.get<DatasourceCacheDataPoint[]>('datasource-cache-stats') ?? []
    );
  }

  private static setData(data: DatasourceCacheDataPoint[]): void {
    memCache.set('datasource-cache-stats', data);
  }

  static hit(
    datasource: string,
    registryUrl: string,
    packageName: string,
  ): void {
    const data = this.getData();
    data.push({ datasource, registryUrl, packageName, action: 'hit' });
    this.setData(data);
  }

  static miss(
    datasource: string,
    registryUrl: string,
    packageName: string,
  ): void {
    const data = this.getData();
    data.push({ datasource, registryUrl, packageName, action: 'miss' });
    this.setData(data);
  }

  static set(
    datasource: string,
    registryUrl: string,
    packageName: string,
  ): void {
    const data = this.getData();
    data.push({ datasource, registryUrl, packageName, action: 'set' });
    this.setData(data);
  }

  static skip(
    datasource: string,
    registryUrl: string,
    packageName: string,
  ): void {
    const data = this.getData();
    data.push({ datasource, registryUrl, packageName, action: 'skip' });
    this.setData(data);
  }

  static getReport(): DatasourceCacheReport {
    const data = this.getData();
    const result: DatasourceCacheReport = { long: {}, short: {} };
    for (const { datasource, registryUrl, packageName, action } of data) {
      result.long[datasource] ??= {};
      result.long[datasource][registryUrl] ??= {};
      result.long[datasource][registryUrl] ??= {};
      result.long[datasource][registryUrl][packageName] ??= {};

      result.short[datasource] ??= {};
      result.short[datasource][registryUrl] ??= {
        hit: 0,
        miss: 0,
        set: 0,
        skip: 0,
      };

      if (action === 'hit') {
        result.long[datasource][registryUrl][packageName].read = 'hit';
        result.short[datasource][registryUrl].hit += 1;
        continue;
      }

      if (action === 'miss') {
        result.long[datasource][registryUrl][packageName].read = 'miss';
        result.short[datasource][registryUrl].miss += 1;
        continue;
      }

      if (action === 'set') {
        result.long[datasource][registryUrl][packageName].write = 'set';
        result.short[datasource][registryUrl].set += 1;
        continue;
      }

      if (action === 'skip') {
        result.long[datasource][registryUrl][packageName].write = 'skip';
        result.short[datasource][registryUrl].skip += 1;
        continue;
      }
    }

    return result;
  }

  static report(): void {
    const { long, short } = this.getReport();

    if (Object.keys(short).length > 0) {
      logger.debug(short, 'Datasource cache statistics');
    }

    if (Object.keys(long).length > 0) {
      logger.trace(long, 'Datasource cache detailed statistics');
    }
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
    logger.debug({ hosts, requests }, 'HTTP statistics');
    logger.trace({ urls }, 'HTTP URL statistics');
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

type ObsoleteCacheStats = Record<
  string,
  {
    count: number;
  }
>;

/* v8 ignore start: temporary code */
export class ObsoleteCacheHitLogger {
  static getData(): ObsoleteCacheStats {
    return memCache.get<ObsoleteCacheStats>('obsolete-cache-stats') ?? {};
  }

  static write(url: string): void {
    const data = this.getData();
    if (!data[url]) {
      data[url] = { count: 0 };
    }
    data[url].count++;
    memCache.set('obsolete-cache-stats', data);
  }

  static report(): void {
    const hits = this.getData();
    logger.debug(
      { count: Object.keys(hits).length, hits },
      'Cache fallback URLs',
    );
  }
}
/* v8 ignore stop: temporary code */

interface AbandonedPackage {
  datasource: string;
  packageName: string;
  mostRecentTimestamp: string;
}

type AbandonedPackageReport = Record<string, Record<string, string>>;

export class AbandonedPackageStats {
  static getData(): AbandonedPackage[] {
    return memCache.get<AbandonedPackage[]>('abandonment-stats') ?? [];
  }

  private static setData(data: AbandonedPackage[]): void {
    memCache.set('abandonment-stats', data);
  }

  static write(
    datasource: string,
    packageName: string,
    mostRecentTimestamp: string,
  ): void {
    const data = this.getData();
    data.push({ datasource, packageName, mostRecentTimestamp });
    this.setData(data);
  }

  static getReport(): AbandonedPackageReport {
    const data = this.getData();
    const result: AbandonedPackageReport = {};

    for (const { datasource, packageName, mostRecentTimestamp } of data) {
      result[datasource] ??= {};
      result[datasource][packageName] = mostRecentTimestamp;
    }

    const sortedResult: AbandonedPackageReport = {};
    for (const datasource of Object.keys(result).sort()) {
      sortedResult[datasource] = {};
      for (const packageName of Object.keys(result[datasource]).sort()) {
        sortedResult[datasource][packageName] = result[datasource][packageName];
      }
    }

    return sortedResult;
  }

  static report(): void {
    const report = this.getReport();
    if (Object.keys(report).length > 0) {
      logger.debug(report, 'Abandoned package statistics');
    }
  }
}
