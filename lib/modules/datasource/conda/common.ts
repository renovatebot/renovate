import { parseUrl } from '../../../util/url.ts';

export const defaultRegistryUrl = 'https://api.anaconda.org/package/';
export const datasource = 'conda';

// `fast.prefix.dev` is a deprecated alias, but it is still running.
const prefixDevHosts = ['prefix.dev', 'fast.prefix.dev'];

/** Whether the registry is served by the prefix.dev API. */
export function isPrefixDevUrl(registryUrl: string): boolean {
  const hostname = parseUrl(registryUrl)?.hostname;
  return !!hostname && prefixDevHosts.includes(hostname);
}
