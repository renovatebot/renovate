import is from '@sindresorhus/is';
// eslint-disable-next-line no-restricted-imports
import _parseLinkHeader from 'parse-link-header';
import urlJoin from 'url-join';
import { logger } from '../logger';
import { regEx } from './regex';

export function joinUrlParts(...parts: string[]): string {
  return urlJoin(...parts);
}

export function ensurePathPrefix(url: string, prefix: string): string {
  const parsed = new URL(url);
  const fullPath = parsed.pathname + parsed.search;
  if (fullPath.startsWith(prefix)) {
    return url;
  }
  return parsed.origin + prefix + fullPath;
}

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/'); // TODO #12875 adds slash at the front when re2 is used
}

export function trimTrailingSlash(url: string): string {
  return url.replace(regEx(/\/+$/), '');
}

export function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

export function trimSlashes(path: string): string {
  return trimLeadingSlash(trimTrailingSlash(path));
}

/**
 * Resolves an input path against a base URL
 *
 * @param baseUrl - base URL to resolve against
 * @param input - input path (if this is a full URL, it will be returned)
 */
export function resolveBaseUrl(baseUrl: string, input: string | URL): string {
  const inputString = input.toString();

  let host;
  let pathname;
  try {
    ({ host, pathname } = new URL(inputString));
  } catch {
    pathname = inputString;
  }

  return host ? inputString : urlJoin(baseUrl, pathname || '');
}

/**
 * Replaces the path of a URL with a new path
 *
 * @param baseUrl - source URL
 * @param path - replacement path (if this is a full URL, it will be returned)
 */
export function replaceUrlPath(baseUrl: string | URL, path: string): string {
  if (parseUrl(path)) {
    return path;
  }

  const { origin } = is.string(baseUrl) ? new URL(baseUrl) : baseUrl;
  return urlJoin(origin, path);
}

export function getQueryString(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (is.array<object>(v)) {
      for (const item of v) {
        // TODO: fix me?
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        usp.append(k, item.toString());
      }
    } else {
      usp.append(k, v.toString());
    }
  }
  return usp.toString();
}

export function isHttpUrl(url: unknown): boolean {
  if (!is.nonEmptyString(url) && !is.urlInstance(url)) {
    return false;
  }
  const protocol = parseUrl(url)?.protocol;
  return protocol === 'https:' || protocol === 'http:';
}

export function parseUrl(url: URL | string | undefined | null): URL | null {
  if (!url) {
    return null;
  }

  if (url instanceof URL) {
    return url;
  }

  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Tries to create an URL object from either a full URL string or a hostname
 * @param url either the full url or a hostname
 * @returns an URL object or null
 */
export function createURLFromHostOrURL(url: string): URL | null {
  return parseUrl(url) ?? parseUrl(`https://${url}`);
}

export type LinkHeaderLinks = _parseLinkHeader.Links;

export function parseLinkHeader(
  linkHeader: string | null | undefined,
): LinkHeaderLinks | null {
  if (!is.nonEmptyString(linkHeader)) {
    return null;
  }
  if (linkHeader.length > 2000) {
    logger.warn({ linkHeader }, 'Link header too long.');
    return null;
  }
  return _parseLinkHeader(linkHeader);
}

/**
 * Extract the filename from a file path or URL.
 * Works with paths that may have query parameters.
 *
 * @param pathOrUrl - The path or URL to extract the filename from
 * @returns The extracted filename without query parameters
 */
export function getFilenameFromPath(pathOrUrl: string): string {
  try {
    // Try to parse as URL first
    const url = new URL(pathOrUrl);
    const pathname = url.pathname;

    // Extract the last part after the last slash
    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex >= 0) {
      return pathname.substring(lastSlashIndex + 1);
    }

    return pathname;
  } catch (error) {
    // Not a valid URL, treat as a file path
    const pathWithoutQuery = pathOrUrl.split('?')[0];

    // Extract the last part after the last slash
    const lastSlashIndex = pathWithoutQuery.lastIndexOf('/');
    if (lastSlashIndex >= 0) {
      return pathWithoutQuery.substring(lastSlashIndex + 1);
    }

    return pathWithoutQuery;
  }
}

/**
 * prefix https:// to hosts with port or path
 */
export function massageHostUrl(url: string): string {
  if (!url.includes('://') && url.includes('/')) {
    return 'https://' + url;
  } else if (!url.includes('://') && url.includes(':')) {
    return 'https://' + url;
  } else {
    return url;
  }
}
