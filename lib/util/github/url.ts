import { ensureTrailingSlash, parseUrl } from '../url.ts';

const defaultSourceUrlBase = 'https://github.com/';
const defaultApiBaseUrl = 'https://api.github.com/';

export function getSourceUrlBase(registryUrl: string | undefined): string {
  // Default to GitHub.com if no GitHub Enterprise Cloud or Server host is specified.
  const sourceUrlBase = ensureTrailingSlash(
    registryUrl ?? defaultSourceUrlBase,
  );
  if (sourceUrlBase === defaultApiBaseUrl) {
    return defaultSourceUrlBase;
  }

  const parsedUrl = parseUrl(sourceUrlBase);
  if (
    parsedUrl?.hostname.startsWith('api.') &&
    parsedUrl.hostname.endsWith('.ghe.com')
  ) {
    parsedUrl.hostname = parsedUrl.hostname.slice('api.'.length);
    return parsedUrl.toString();
  }

  return sourceUrlBase;
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

  const parsedUrl = parseUrl(sourceUrlBase);
  if (parsedUrl?.hostname.endsWith('.ghe.com')) {
    parsedUrl.hostname = `api.${parsedUrl.hostname}`;
    return parsedUrl.toString();
  }

  return `${sourceUrlBase}api/v3/`;
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string,
): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return `${sourceUrlBase}${packageName}`;
}
