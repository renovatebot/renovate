import { parseGitUrl } from '../git/url.ts';
import { ensureTrailingSlash } from '../url.ts';

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

export function getSourceUrl(
  packageName: string,
  registryUrl?: string,
): string {
  const sourceUrlBase = getSourceUrlBase(registryUrl);
  return `${sourceUrlBase}${packageName}`;
}

/**
 * The `registryUrl` and `packageName` (`owner/repo`) of a GitHub source URL:
 * the inverse of {@link getSourceUrl}.
 */
export function parseSourceUrl(
  sourceUrl: string,
): { registryUrl: string; packageName: string } | null {
  try {
    const { resource, owner, name } = parseGitUrl(sourceUrl);
    return owner && name
      ? { registryUrl: `https://${resource}/`, packageName: `${owner}/${name}` }
      : null;
  } catch {
    return null;
  }
}
