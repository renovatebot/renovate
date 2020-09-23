import { parse } from 'url';
import urlJoin from 'url-join';

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

export function resolveBaseUrl(baseUrl: string, pathOrUrl: string): string {
  const { host, path } = parse(pathOrUrl);
  const result = host ? path : urlJoin(baseUrl, path || '');
  return result.replace(/\/+$/, '');
}
