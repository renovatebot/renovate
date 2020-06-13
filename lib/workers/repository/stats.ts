import URL from 'url';
import { logger } from '../../logger';
import * as runCache from '../../util/cache/run';

export function printRequestStats(): void {
  const httpRequests = runCache.get('http-requests');
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
  const requestHosts: Record<string, number[]> = {};
  for (const request of httpRequests) {
    allRequests.push(
      `${request.method.toUpperCase()} ${request.url} ${request.duration}`
    );
    const { hostname } = URL.parse(request.url);
    requestHosts[hostname] = requestHosts[hostname] || [];
    requestHosts[hostname].push(request.duration);
  }
  logger.trace({ allRequests, requestHosts }, 'full stats');
  const hostStats: string[] = [];
  let totalRequests = 0;
  for (const [hostname, requests] of Object.entries(requestHosts)) {
    const hostRequests = requests.length;
    totalRequests += hostRequests;
    const requestSum = requests.reduce((a, b) => a + b, 0);
    const avg = Math.round(requestSum / hostRequests);
    const requestCount =
      `${hostRequests} ` + (hostRequests > 1 ? 'requests' : 'request');
    hostStats.push(`${hostname}, ${requestCount}, ${avg}ms average`);
  }
  logger.debug({ hostStats, totalRequests }, 'http statistics');
}
