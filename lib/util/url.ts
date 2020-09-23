import { parse } from 'url';
import urlJoin from 'url-join';

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

export function resolveBaseUrl(
  baseUrl: string,
  pathOrUrl: string | URL
): string {
  const pathOrUrlString = pathOrUrl.toString();
  const { host, path } = parse(pathOrUrlString);
  const result = host ? pathOrUrlString : urlJoin(baseUrl, path || '');
  return result.replace(/\/+$/, '');
}
