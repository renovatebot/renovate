import urlJoin from 'url-join';

export function ensureTrailingSlash(url: string): string {
  return url.replace(/\/?$/, '/');
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

  const result = host ? inputString : urlJoin(baseUrl, pathname || '');
  return result.replace(/\/+$/, '');
}
