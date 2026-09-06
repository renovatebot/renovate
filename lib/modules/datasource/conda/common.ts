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

/**
 * Query parameter naming the platforms a workspace targets.
 *
 * A standard conda channel serves one index per platform subdir, and a version
 * is only usable if it is installable on every targeted platform. That cannot
 * be expressed through `registryUrls` - Renovate's registry strategies are
 * alternatives (`hunt`) or a union (`merge`), never an intersection - so the
 * platforms travel on the channel URL and the datasource reconciles the subdirs
 * itself. The `deb` datasource encodes suites, components and architectures the
 * same way.
 */
export const platformsParam = 'platforms';

/** Whether the registry is served by the Anaconda.org REST API. */
export function isAnacondaApiUrl(registryUrl: string): boolean {
  return parseUrl(registryUrl)?.hostname === anacondaApiHost;
}

/**
 * Whether the registry is served by the prefix.dev API.
 *
 * Both the datasource, which routes such registries to the prefix.dev GraphQL
 * API, and the pixi manager, which must not expand them into per-subdir URLs,
 * need this, so the host list is kept in one place.
 */
export function isPrefixDevUrl(registryUrl: string): boolean {
  const hostname = parseUrl(registryUrl)?.hostname;
  return !!hostname && prefixDevHosts.includes(hostname);
}
