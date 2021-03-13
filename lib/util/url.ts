// eslint-disable-next-line no-restricted-imports
import { UrlWithStringQuery, parse as _parseUrlLegacy } from 'url';
import urlJoin from 'url-join';

/**
 * Parses url with deprecated url module
 * @param url url to parse
 * @returns legacy `UrlWithStringQuery`
 * @deprecated
 */
export function parseUrlLegacy(url: string): UrlWithStringQuery {
  return _parseUrlLegacy(url);
}

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveBaseUrl(baseUrl: string, input: string | URL): string {
  const inputString = input.toString();

  let host: string | undefined;
  let pathname: string;
  try {
    ({ host, pathname } = new URL(inputString));
  } catch (e) {
    pathname = inputString;
  }

  return host ? inputString : urlJoin(baseUrl, pathname || '');
}

export function getQueryString(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        usp.append(k, item.toString());
      }
    } else {
      usp.append(k, v.toString());
    }
  }
  const res = usp.toString();
  return res;
}

export function validateUrl(url?: string, httpOnly = true): boolean {
  if (!url) {
    return false;
  }
  try {
    const { protocol } = new URL(url);
    return httpOnly ? !!protocol.startsWith('http') : !!protocol;
  } catch (err) {
    return false;
  }
}

export function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch (err) {
    return null;
  }
}
