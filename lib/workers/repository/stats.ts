import URL from 'node:url';
import { logger } from '../../logger';
import { sortNumeric } from '../../util/array';
import * as memCache from '../../util/cache/memory';
import type { LookupStats } from '../../util/cache/memory/types';
import type { RequestStats } from '../../util/http/types';

interface CacheStats {
  count: number;
  avgMs?: number;
  medianMs?: number;
  maxMs?: number;
}

export function printLookupStats(): void {
  const lookups = memCache.get<LookupStats[]>('lookup-stats') ?? [];
  const datasourceDurations: Record<string, number[]> = {};
  for (const lookup of lookups) {
    datasourceDurations[lookup.datasource] ??= [];
    datasourceDurations[lookup.datasource].push(lookup.duration);
  }
  const data: Record<string, unknown> = {};
  for (const [datasource, durations] of Object.entries(datasourceDurations)) {
    const count = durations.length;
    const totalMs = durations.reduce((a, c) => a + c, 0);
    const averageMs = Math.round(totalMs / count);
    const maximumMs = Math.max(...durations);
    data[datasource] = { count, averageMs, totalMs, maximumMs };
  }
  logger.debug(data, 'Package lookup durations');
}

export function printRequestStats(): void {
  const packageCacheGets = (
    memCache.get<number[]>('package-cache-gets') ?? []
  ).sort(sortNumeric);
  const packageCacheSets = (
    memCache.get<number[]>('package-cache-sets') ?? []
  ).sort(sortNumeric);
  const packageCacheStats: Record<string, CacheStats> = {
    get: {
      count: packageCacheGets.length,
    },
    set: {
      count: packageCacheSets.length,
    },
  };
  if (packageCacheGets.length) {
    packageCacheStats.get.avgMs = Math.round(
      packageCacheGets.reduce((a, b) => a + b, 0) / packageCacheGets.length,
    );
    if (packageCacheGets.length > 1) {
      packageCacheStats.get.medianMs =
        packageCacheGets[Math.round(packageCacheGets.length / 2) - 1];
      packageCacheStats.get.maxMs =
        packageCacheGets[packageCacheGets.length - 1];
    }
  }
  if (packageCacheSets.length) {
    packageCacheStats.set.avgMs = Math.round(
      packageCacheSets.reduce((a, b) => a + b, 0) / packageCacheSets.length,
    );
    if (packageCacheSets.length > 1) {
      packageCacheStats.set.medianMs =
        packageCacheSets[Math.round(packageCacheSets.length / 2) - 1];
      packageCacheStats.set.maxMs =
        packageCacheSets[packageCacheSets.length - 1];
    }
  }
  logger.debug(packageCacheStats, 'Package cache statistics');
  const httpRequests = memCache.get<RequestStats[]>('http-requests');
  // istanbul ignore next
  if (!httpRequests) {
    return;
  }
  httpRequests.sort((a, b) => {
    if (a.url === b.url) {
      return 0;
    }
    if (a.url < b.url) {
      return -1;
    }
    return 1;
  });
  const allRequests: string[] = [];
  const requestHosts: Record<string, RequestStats[]> = {};
  const rawUrls: Record<string, number> = {};
  for (const httpRequest of httpRequests) {
    const { method, url, duration, queueDuration, statusCode } = httpRequest;
    const [baseUrl] = url.split('?');
    // put method last for better sorting
    const urlKey = `${baseUrl} (${method.toUpperCase()},${statusCode})`;
    if (rawUrls[urlKey]) {
      rawUrls[urlKey] += 1;
    } else {
      rawUrls[urlKey] = 1;
    }
    allRequests.push(
      `${method.toUpperCase()} ${url} ${statusCode} ${duration} ${queueDuration}`,
    );
    const { hostname } = URL.parse(url);

    // istanbul ignore if: TODO: fix types (#9610)
    if (!hostname) {
      return;
    }
    requestHosts[hostname] = requestHosts[hostname] || [];
    requestHosts[hostname].push(httpRequest);
  }
  const urls: Record<string, number> = {};
  // Sort urls for easier reading
  for (const url of Object.keys(rawUrls).sort()) {
    urls[url] = rawUrls[url];
  }
  logger.trace({ allRequests, requestHosts }, 'full stats');
  type HostStats = {
    requestCount: number;
    requestAvgMs: number;
    queueAvgMs: number;
  };
  const hostStats: Record<string, HostStats> = {};
  let totalRequests = 0;
  for (const [hostname, requests] of Object.entries(requestHosts)) {
    const requestCount = requests.length;
    totalRequests += requestCount;
    const requestSum = requests
      .map(({ duration }) => duration)
      .reduce((a, b) => a + b, 0);
    const requestAvgMs = Math.round(requestSum / requestCount);

    const queueSum = requests
      .map(({ queueDuration }) => queueDuration)
      .reduce((a, b) => a + b, 0);
    const queueAvgMs = Math.round(queueSum / requestCount);
    hostStats[hostname] = { requestCount, requestAvgMs, queueAvgMs };
  }
  logger.debug({ urls, hostStats, totalRequests }, 'http statistics');
}
