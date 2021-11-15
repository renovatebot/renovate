import urlJoin from 'url-join';
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
  return url.replace(/\/?$/, '/'); // TODO #12070 #12071 adds / in the front when used with re2
}

export function trimTrailingSlash(url: string): string {
  return url.replace(regEx(/\/+$/), ''); // TODO #12071
}

export function resolveBaseUrl(baseUrl: string, input: string | URL): string {
  const inputString = input.toString();

  let host;
  let pathname;
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

/**
 * Tries to create an URL object from either a full URL string or a hostname
 * @param url either the full url or a hostname
 * @returns an URL object or null
 */
export function createURLFromHostOrURL(url: string): URL | null {
  return parseUrl(url) || parseUrl(`https://${url}`);
}

export function trimLeadingSlash(url: string): string {
  return url.replace(regEx(/^\//), '');
}
