import URL from 'url';
import pAll from 'p-all';
import parseLinkHeader from 'parse-link-header';
import { Http, HttpResponse } from './index';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import { dispatchError } from '../../platform/github/gh-got-wrapper';

const hostType = PLATFORM_TYPE_GITHUB;
export const getHostType = (): string => hostType;

let baseUrl = 'https://api.github.com/';
export const getBaseUrl = (): string => baseUrl;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

const http = new Http(PLATFORM_TYPE_GITHUB);

async function request<T = unknown>(
  path: string,
  options?: any,
  okToRetry = true
): Promise<HttpResponse<T> | null> {
  let result = null;

  const opts = {
    hostType,
    baseUrl,
    ...options,
    throwHttpErrors: true,
  };

  const method = opts.method || 'get';

  if (method.toLowerCase() === 'post' && path === 'graphql') {
    // GitHub Enterprise uses unversioned graphql path
    opts.baseUrl = opts.baseUrl.replace('/v3/', '/');
  }

  if (global.appMode) {
    const appAccept = 'application/vnd.github.machine-man-preview+json';

    const extraHeaders = {
      accept: appAccept,
      'user-agent':
        process.env.RENOVATE_USER_AGENT ||
        'https://github.com/renovatebot/renovate',
    };

    opts.headers = {
      ...extraHeaders,
      ...opts.headers,
    };

    if (opts.headers.accept !== appAccept) {
      opts.headers.accept = `${appAccept}, ${opts.headers.accept}`;
    }
  }

  try {
    if (method === 'get') {
      result = await http.getJson<T>(path, opts);
    } else if (method === 'post') {
      result = await http.postJson<T>(path, opts);
    } else if (method === 'patch') {
      result = await http.patchJson<T>(path, opts);
    } else if (method === 'put') {
      result = await http.putJson<T>(path, opts);
    } else if (method === 'delete') {
      result = await http.deleteJson<T>(path, opts);
    }

    if (result !== null) {
      if (opts.paginate) {
        // Check if result is paginated
        const pageLimit = opts.pageLimit || 10;
        const linkHeader = parseLinkHeader(result.headers.link as string);
        if (linkHeader && linkHeader.next && linkHeader.last) {
          let lastPage = +linkHeader.last.page;
          if (!process.env.RENOVATE_PAGINATE_ALL && opts.paginate !== 'all') {
            lastPage = Math.min(pageLimit, lastPage);
          }
          const pageNumbers = Array.from(
            new Array(lastPage),
            (x, i) => i + 1
          ).slice(1);
          const queue = pageNumbers.map(page => (): Promise<HttpResponse> => {
            const nextUrl = URL.parse(linkHeader.next.url, true);
            delete nextUrl.search;
            nextUrl.query.page = page.toString();
            return request(
              URL.format(nextUrl),
              { ...opts, paginate: false },
              okToRetry
            );
          });
          const pages = await pAll(queue, { concurrency: 5 });
          result.body = result.body.concat(
            ...pages.filter(Boolean).map(page => page.body)
          );
        }
      }
    }
  } catch (err) {
    dispatchError(err, path, opts);
  }

  return result;
}

export function getJson<T = unknown>(
  url: string,
  opts?: any
): Promise<HttpResponse<T>> {
  return request<T>(url, { ...opts, method: 'get' });
}

export function postJson<T = unknown>(
  url: string,
  opts?: any
): Promise<HttpResponse<T>> {
  return request<T>(url, { ...opts, method: 'post' });
}

export function patchJson<T = unknown>(
  url: string,
  opts?: any
): Promise<HttpResponse<T>> {
  return request<T>(url, { ...opts, method: 'patch' });
}

export function putJson<T = unknown>(
  url: string,
  opts?: any
): Promise<HttpResponse<T>> {
  return request<T>(url, { ...opts, method: 'put' });
}

export function deleteJson<T = unknown>(
  url: string,
  opts?: any
): Promise<HttpResponse<T>> {
  return request<T>(url, { ...opts, method: 'delete' });
}
