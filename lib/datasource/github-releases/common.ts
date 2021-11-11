import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';
import type { GithubRelease } from './types';

const defaultSourceUrlBase = 'https://github.com/';
export const id = 'github-releases';

export const cacheNamespace = 'datasource-github-releases';
export const http = new GithubHttp(id);

export function getSourceUrlBase(registryUrl: string): string {
  // default to GitHub.com if no GHE host is specified.
  return ensureTrailingSlash(registryUrl ?? defaultSourceUrlBase);
}

export function getApiBaseUrl(registryUrl: string): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return sourceUrlBase === defaultSourceUrlBase
    ? `https://api.github.com/`
    : `${sourceUrlBase}api/v3/`;
}

export function getSourceUrl(lookupName: string, registryUrl?: string): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return `${sourceUrlBase}${lookupName}`;
}

export async function getGithubRelease(
  apiBaseUrl: string,
  repo: string,
  version: string
): Promise<GithubRelease> {
  const url = `${apiBaseUrl}repos/${repo}/releases/tags/${version}`;
  const res = await http.getJson<GithubRelease>(url);
  return res.body;
}
