import { regEx } from '../regex.ts';
import { joinUrlParts } from '../url.ts';

export const defaultRegistryUrl = 'https://gitlab.com';

/**
 * The GitLab instance a registry URL points at.
 *
 * A registry URL may be written either as the instance URL or as its API base
 * URL, so a trailing `/api/v4` is stripped.
 */
export function getDepHost(registryUrl: string = defaultRegistryUrl): string {
  return registryUrl.replace(regEx(/\/api\/v4$/), '');
}

/**
 * The base URL of the instance's REST API, for both spellings of `registryUrl`.
 */
export function getApiBaseUrl(registryUrl?: string): string {
  return joinUrlParts(getDepHost(registryUrl), 'api/v4');
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string,
): string {
  return joinUrlParts(getDepHost(registryUrl), packageName);
}
