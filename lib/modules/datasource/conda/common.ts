import { parseUrl } from '../../../util/url.ts';

export const defaultRegistryUrl = 'https://api.anaconda.org/package/';
export const datasource = 'conda';

/**
 * Host of the Anaconda.org REST API. Any other registry (that is not
 * prefix.dev) is treated as a standard conda channel serving `repodata.json`.
 */
const anacondaApiHost = 'api.anaconda.org';

// `fast.prefix.dev` is a deprecated alias, but it is still running.
const prefixDevHosts = ['prefix.dev', 'fast.prefix.dev'];

/** Whether the registry is served by the Anaconda.org REST API. */
export function isAnacondaApiUrl(registryUrl: string): boolean {
  return parseUrl(registryUrl)?.hostname === anacondaApiHost;
}

/** Whether the registry is served by the prefix.dev API. */
export function isPrefixDevUrl(registryUrl: string): boolean {
  const hostname = parseUrl(registryUrl)?.hostname;
  return !!hostname && prefixDevHosts.includes(hostname);
}
