import URL from 'url';
import { logger } from '../../logger';
import * as memCache from '../../util/cache/memory';
import type { RequestStats } from '../../util/http/types';

export function printRequestStats(): void {
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
  for (const httpRequest of httpRequests) {
    const { method, url, duration, queueDuration } = httpRequest;
    allRequests.push(
      `${method.toUpperCase()} ${url} ${duration} ${queueDuration}`
    );
    const { hostname } = URL.parse(url);
    requestHosts[hostname] = requestHosts[hostname] || [];
    requestHosts[hostname].push(httpRequest);
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
  logger.debug({ hostStats, totalRequests }, 'http statistics');
}
