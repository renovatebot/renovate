import URL from 'url';
import { logger } from '../../logger';
import * as memCache from '../../util/cache/memory';

export function printRequestStats(): void {
  const httpRequests = memCache.get('http-requests');
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
  const requestHosts: Record<
    string,
    { duration: number; queueDuration: number }[]
  > = {};
  for (const { method, url, duration, queueDuration } of httpRequests) {
    allRequests.push(
      `${method.toUpperCase()} ${url} ${duration} ${queueDuration}`
    );
    const { hostname } = URL.parse(url);
    requestHosts[hostname] = requestHosts[hostname] || [];
    requestHosts[hostname].push({ duration, queueDuration });
  }
  logger.trace({ allRequests, requestHosts }, 'full stats');
  const hostStats: string[] = [];
  let totalRequests = 0;
  for (const [hostname, requests] of Object.entries(requestHosts)) {
    const hostRequests = requests.length;
    totalRequests += hostRequests;
    const requestSum = requests
      .map(({ duration }) => duration)
      .reduce((a, b) => a + b, 0);
    const requestAvg = Math.round(requestSum / hostRequests);

    const queueSum = requests
      .map(({ queueDuration }) => queueDuration)
      .reduce((a, b) => a + b, 0);
    const queueAvg = Math.round(queueSum / hostRequests);

    const requestCount =
      `${hostRequests} ` + (hostRequests > 1 ? 'requests' : 'request');
    hostStats.push(
      `${hostname}, ${requestCount}, ${requestAvg}ms request average, ${queueAvg}ms queue average`
    );
  }
  logger.debug({ hostStats, totalRequests }, 'http statistics');
}
