const skipRetryForTheseHosts = ['jcenter.bintray.com'];
const skipRetryHostsSet = new Set(skipRetryForTheseHosts);

export function skipRetry(url: string): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const { hostname } = new URL(url);
  return skipRetryHostsSet.has(hostname);
}
