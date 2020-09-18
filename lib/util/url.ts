import { parse, resolve } from 'url';
import urljoin from 'url-join';

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
}

export function resolveBaseUrl(baseUrl: string, urlOrPath: string): string {
  return parse(urlOrPath).host
    ? resolve(baseUrl, urlOrPath)
    : urljoin(baseUrl, urlOrPath);
}
