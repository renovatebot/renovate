import {
  isArray,
  isNonEmptyString,
  isObject,
  isString,
  isUrlInstance,
} from '@sindresorhus/is';
// oxlint-disable-next-line no-restricted-imports
import _parseLinkHeader from 'parse-link-header';
import urlJoin from 'url-join';
import { logger } from '../logger/index.ts';
import { regEx } from './regex.ts';

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
  return url.replace(regEx(/\/?$/), '/');
}

export function trimTrailingSlash(url: string): string {
  return url.replace(regEx(/\/+$/), '');
}

export function trimLeadingSlash(path: string): string {
  return path.replace(regEx(/^\/+/), '');
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

  const { origin } = isString(baseUrl) ? new URL(baseUrl) : baseUrl;
  return urlJoin(origin, path);
}

/**
 * Resolves a server-provided pagination "next" URL against the current request
 * URL, returning it only when it stays on the same origin.
 *
 * Registries paginate by returning a `Link` header (or Atom `<link rel="next">`)
 * pointing at the next page.
 *
 * However, if we were to follow that URL without validating it, this could lead to us being redirected to a different host, which could lead to Server-Side Request Forgery (SSRF).
 *
 * This guard drops any `next` URL that resolves to a different origin.
 *
 * @param baseUrl - the URL of the request that produced `nextUrl`
 * @param nextUrl - the remote-server-provided pagination target (may be relative, and may be malicious)
 * @returns the resolved absolute URL if same-origin, otherwise `null`
 */
export function resolveSameOriginUrl(
  baseUrl: string | URL,
  nextUrl: string | URL,
): string | null {
  const base = parseUrl(baseUrl);
  if (!base) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(nextUrl.toString(), base);
  } catch {
    return null;
  }

  // If the base URL is HTTPS and the resolved URL is HTTP, but has no port specified, we can assume that the server intended to use HTTPS. This is a common misconfiguration in some registries.
  if (
    base.protocol === 'https:' &&
    resolved.protocol === 'http:' &&
    resolved.port === ''
  ) {
    logger.debug(`Detected protocol downgrade and fixed it: ${resolved.href}`);
    resolved.protocol = 'https:';
  }

  return resolved.origin === base.origin ? resolved.href : null;
}

export function getQueryString(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (isArray<object>(v)) {
      for (const item of v) {
        // TODO: fix me?
        // oxlint-disable-next-line typescript/no-base-to-string
        usp.append(k, item.toString());
      }
    } else {
      usp.append(k, v.toString());
    }
  }
  return usp.toString();
}

export function isHttpUrl(url: unknown): boolean {
  if (!isNonEmptyString(url) && !isUrlInstance(url)) {
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

/**
 * Removes the `user:password@` userinfo from a URL.
 *
 * Registries are sometimes configured with a URL that carries a placeholder such as `${USER}:${PASS}@`, and credentials embedded this way should not stop the URL from matching a plain `matchHost`.
 *
 * @returns the URL's `href` without userinfo, or `null` if `url` cannot be parsed
 */
export function stripUrlCredentials(url: URL): string;
export function stripUrlCredentials(url: string | URL): string | null;
export function stripUrlCredentials(url: string | URL): string | null {
  const parsed = parseUrl(url);
  if (!parsed) {
    return null;
  }
  if (!parsed.username && !parsed.password) {
    return parsed.href;
  }
  // clone rather than mutate: `parseUrl` returns the same instance it was given when `url` is already a `URL`
  const stripped = new URL(parsed.href);
  stripped.username = '';
  stripped.password = '';
  return stripped.href;
}

/**
 * Matches the `scheme` and the `userinfo` of every URL inside a text, the userinfo ending at the last `@` before the path as in the URL standard.
 *
 * The text may not be a single URL but may contain several, e.g. a `replaceString`, a `managerData` value or a cache key, so we cannot perform URL parsing as-is
 *
 * A single URL is handled by {@link stripUrlCredentials} instead.
 */
export const urlUserinfoRegex = regEx(
  /(?<scheme>[a-z][a-z\d+.-]*):\/\/(?<userinfo>[^/?#\s]+)@/gi,
);

/**
 * Matches exactly one `${NAME}`, `${env.NAME}`, `${NAME:?msg}`, `${NAME?msg}`, upper-case `$NAME`, `${{ expression }}` or `{{ NAME }}` reference.
 */
const userinfoPlaceholderRegex = regEx(
  /^(?:\$\{(?:env\.)?[A-Za-z_]\w*(?::?\?[^{}]*)?\}|\$[A-Z_][A-Z\d_]*|\$\{\{\s*[^{}\s][^{}]*\}\}|\{\{\s*[A-Za-z_]\w*\s*\}\})$/,
);

/**
 * Usernames without a password of their own, which stand for a credential resolved at request time.
 *
 * `oauth2accesstoken` is Google Artifact Registry's, whose token the pypi and docker datasources fetch per request.
 *
 * @see https://docs.renovatebot.com/docker/#google-container-registry-google-artifact-registry
 */
const placeholderUsernames = new Set(['oauth2accesstoken']);

/**
 * Whether `username` is a placeholder username such as `oauth2accesstoken`.
 */
export function isPlaceholderUsername(username: string): boolean {
  return placeholderUsernames.has(username);
}

/**
 * Decodes a percent-encoded userinfo part, or returns it as is when it is not valid percent-encoding.
 */
export function decodeUserinfo(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Whether a percent-encoded userinfo part, once decoded, is exactly one `${NAME}`, `${env.NAME}`, `${NAME:?msg}`, `${NAME?msg}`, upper-case `$NAME`, `${{ expression }}` or `{{ NAME }}` placeholder.
 */
export function isUserinfoPlaceholder(value: string): boolean {
  return userinfoPlaceholderRegex.test(decodeUserinfo(value));
}

const firstPathSegmentRegex = regEx(/^[^/?#\s]*\/(?<segment>[^/?#\s]*)/);

/**
 * Whether `username` equals, ignoring case, the first path segment of `rest`, the text following the `@` of a URL's userinfo.
 */
function isFirstPathSegment(username: string, rest: string): boolean {
  const match = firstPathSegmentRegex.exec(rest);
  if (!match) {
    return false;
  }
  const { segment } = match.groups!;
  return decodeUserinfo(segment).toLowerCase() === username.toLowerCase();
}

/**
 * The minimum length of a username without a password which counts as a credential.
 */
const minUsernameCredentialLength = 16;

/**
 * Whether a `scheme://userinfo@` followed by `rest` holds a credential once its parts are decoded:
 * a non-empty password other than a template placeholder, or a username of at least {@link minUsernameCredentialLength} characters with an empty or no password, except for an ssh scheme, a template placeholder, a placeholder username or a username equal to the first path segment.
 * A `docker://image:tag@digest` reference holds none.
 */
export function isCredentialUserinfo(
  scheme: string,
  userinfo: string,
  rest: string,
): boolean {
  const lowerScheme = scheme.toLowerCase();
  if (lowerScheme === 'docker') {
    return false;
  }
  const [rawUsername, ...rawPasswordParts] = userinfo.split(':');
  const rawPassword = rawPasswordParts.join(':');
  if (rawPassword) {
    // a username next to a placeholder password is not a token of its own
    return !isUserinfoPlaceholder(rawPassword);
  }
  const username = decodeUserinfo(rawUsername);
  return (
    username.length >= minUsernameCredentialLength &&
    !lowerScheme.endsWith('ssh') &&
    !isUserinfoPlaceholder(rawUsername) &&
    !isPlaceholderUsername(username) &&
    !isFirstPathSegment(username, rest)
  );
}

/**
 * Whether `text` contains a URL with a `user:password@` or `token@` userinfo.
 */
export function hasUrlCredentials(text: string): boolean {
  for (const match of text.matchAll(urlUserinfoRegex)) {
    const { scheme, userinfo } = match.groups!;
    const rest = text.slice(match.index + match[0].length);
    if (isCredentialUserinfo(scheme, userinfo, rest)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether any string inside `value`, searched through arrays and object values, contains a URL with credentials.
 */
export function containsUrlCredentials(value: unknown): boolean {
  if (isString(value)) {
    return hasUrlCredentials(value);
  }
  if (isObject(value)) {
    return Object.values(value).some(containsUrlCredentials);
  }
  return false;
}

/**
 * Removes the `user:password@` or `token@` userinfo of every URL inside `text` that carries a credential, leaving the rest of `text` unchanged.
 */
export function withoutUrlCredentials(text: string): string {
  return text.replace(urlUserinfoRegex, (match: string, ...args: unknown[]) => {
    // the offset, the input and the named groups are the last arguments of a `replace()` callback
    const offset = args.at(-3) as number;
    const { scheme, userinfo } = args.at(-1) as Record<string, string>;
    const rest = text.slice(offset + match.length);
    return isCredentialUserinfo(scheme, userinfo, rest)
      ? `${scheme}://`
      : match;
  });
}

export type LinkHeaderLinks = _parseLinkHeader.Links;

export function parseLinkHeader(
  linkHeader: string | null | undefined,
): LinkHeaderLinks | null {
  if (!isNonEmptyString(linkHeader)) {
    return null;
  }
  if (linkHeader.length > 2000) {
    logger.warn({ linkHeader }, 'Link header too long.');
    return null;
  }
  return _parseLinkHeader(linkHeader);
}

/**
 * prefix https:// to hosts with port or path
 */
export function massageHostUrl(url: string): string {
  if (!url.includes('://') && url.includes('/')) {
    return `https://${url}`;
  }
  if (!url.includes('://') && url.includes(':')) {
    return `https://${url}`;
  }
  return url;
}
