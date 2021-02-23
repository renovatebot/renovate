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

  return host ? inputString : urlJoin(baseUrl, pathname || '');
}

export function compareHosts(url1: string | URL, url2: string | URL): boolean {
  let host1;
  let host2;

  try {
    ({ host: host1 } = new URL(url1?.toString()));
    ({ host: host2 } = new URL(url2?.toString()));

    return host1 === host2;
  } catch (e) {
    return false;
  }
}
