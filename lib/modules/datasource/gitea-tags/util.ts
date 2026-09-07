import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';

/**
 * Shared URL and cache-key helpers for the Gitea-compatible datasources
 * (`gitea-tags`, `gitea-releases`, `forgejo-tags`, `forgejo-releases`).
 *
 * All of them take an already resolved registry URL, so that each datasource
 * applies its own default registry URL before calling them.
 */

export function getApiUrl(registryUrl: string): string {
  const res = registryUrl.replace(regEx(/\/api\/v1$/), '');
  return `${ensureTrailingSlash(res)}api/v1/`;
}

export function getSourceUrl(packageName: string, registryUrl: string): string {
  return `${ensureTrailingSlash(registryUrl)}${packageName}`;
}

export function getCacheKey(
  registryUrl: string,
  repo: string,
  type: string,
): string {
  return `${registryUrl}:${repo}:${type}`;
}
