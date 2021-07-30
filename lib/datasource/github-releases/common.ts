import { GithubHttp } from '../../util/http/github';
import { ensureTrailingSlash } from '../../util/url';

const defaultSourceUrlBase = 'https://github.com/';

export const cacheNamespace = 'datasource-github-releases';
export const http = new GithubHttp();

export function getSourceUrlBase(registryUrl: string): string {
  // default to GitHub.com if no GHE host is specified.
  return ensureTrailingSlash(registryUrl ?? defaultSourceUrlBase);
}

export function getApiBaseUrl(sourceUrlBase: string): string {
  return sourceUrlBase === defaultSourceUrlBase
    ? `https://api.github.com/`
    : `${sourceUrlBase}api/v3/`;
}
