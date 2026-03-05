import { ensureTrailingSlash, parseUrl } from '../url.ts';

const defaultSourceUrlBase = 'https://github.com/';
const defaultApiBaseUrl = 'https://api.github.com/';

export function getSourceUrlBase(registryUrl: string | undefined): string {
  // default to GitHub.com if no GHE host is specified.
  return ensureTrailingSlash(registryUrl ?? defaultSourceUrlBase);
}

export function getApiBaseUrl(registryUrl: string | undefined): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);

  if (
    sourceUrlBase === defaultSourceUrlBase ||
    sourceUrlBase === defaultApiBaseUrl
  ) {
    return defaultApiBaseUrl;
  }

  if (sourceUrlBase.endsWith('/api/v3/')) {
    return sourceUrlBase;
  }

  return `${sourceUrlBase}api/v3/`;
}

export function isGithubHost(registryUrl: string | undefined): boolean {
  if (!registryUrl) {
    return true; // defaults to github.com
  }

  const sourceUrlBase = getSourceUrlBase(registryUrl);

  if (
    sourceUrlBase === defaultSourceUrlBase ||
    sourceUrlBase === defaultApiBaseUrl
  ) {
    return true;
  }

  // GHE with explicit API path (e.g. https://ghe.company.com/api/v3/)
  if (sourceUrlBase.endsWith('/api/v3/')) {
    return true;
  }

  // GHE with 'github' in the hostname (e.g. github.company.com)
  const parsed = parseUrl(registryUrl);
  if (parsed?.hostname.includes('github')) {
    return true;
  }

  return false;
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string,
): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return `${sourceUrlBase}${packageName}`;
}
