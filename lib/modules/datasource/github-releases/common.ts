import { ensureTrailingSlash } from '../../../util/url';

const defaultSourceUrlBase = 'https://github.com/';

export function getSourceUrlBase(registryUrl: string | undefined): string {
  // default to GitHub.com if no GHE host is specified.
  return ensureTrailingSlash(registryUrl ?? defaultSourceUrlBase);
}

export function getApiBaseUrl(registryUrl: string | undefined): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return sourceUrlBase === defaultSourceUrlBase
    ? `https://api.github.com/`
    : `${sourceUrlBase}api/v3/`;
}

export function getSourceUrl(
  packageName: string,
  registryUrl?: string
): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return `${sourceUrlBase}${packageName}`;
}
