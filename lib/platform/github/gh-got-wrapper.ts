import URL from 'url';
import parseLinkHeader from 'parse-link-header';
import pAll from 'p-all';

import { GotError } from 'got';
import got, { GotJSONOptions } from '../../util/got';
import { maskToken } from '../../util/mask';
import { GotApi, GotResponse } from '../common';
import { logger } from '../../logger';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_FAILURE,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';

const hostType = 'github';
export const getHostType = (): string => hostType;

let baseUrl = 'https://api.github.com/';
export const getBaseUrl = (): string => baseUrl;

type GotRequestError<E = unknown, T = unknown> = GotError & {
  body: {
    message?: string;
    errors?: E[];
  };
  headers?: Record<string, T>;
};

type GotRequestOptions = GotJSONOptions & {
  token?: string;
};

export function dispatchError(
  err: GotRequestError,
  path: string,
  opts: GotRequestOptions
): never {
  let message = err.message;
  if (err.body && err.body.message) {
    message = err.body.message;
  }
  if (
    err.name === 'RequestError' &&
    (err.code === 'ENOTFOUND' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN')
  ) {
    logger.info({ err }, 'GitHub failure: RequestError');
    throw new Error(PLATFORM_FAILURE);
  }
  if (err.name === 'ParseError') {
    logger.info({ err }, 'GitHub failure: ParseError');
    throw new Error(PLATFORM_FAILURE);
  }
  if (err.statusCode >= 500 && err.statusCode < 600) {
    logger.info({ err }, 'GitHub failure: 5xx');
    throw new Error(PLATFORM_FAILURE);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('You have triggered an abuse detection mechanism')
  ) {
    logger.info({ err }, 'GitHub failure: abuse detection');
    throw new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (err.statusCode === 403 && message.includes('Upgrade to GitHub Pro')) {
    logger.debug({ path }, 'Endpoint needs paid GitHub plan');
    throw err;
  }
  if (err.statusCode === 403 && message.includes('rate limit exceeded')) {
    logger.info({ err }, 'GitHub failure: rate limit');
    throw new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('Resource not accessible by integration')
  ) {
    logger.info(
      { err },
      'GitHub failure: Resource not accessible by integration'
    );
    throw new Error(PLATFORM_INTEGRATION_UNAUTHORIZED);
  }
  if (err.statusCode === 401 && message.includes('Bad credentials')) {
    const rateLimit = err.headers ? err.headers['x-ratelimit-limit'] : -1;
    logger.info(
      {
        token: maskToken(opts.token),
        err,
      },
      'GitHub failure: Bad credentials'
    );
    if (rateLimit === '60') {
      throw new Error(PLATFORM_FAILURE);
    }
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }
  if (err.statusCode === 422) {
    if (
      message.includes('Review cannot be requested from pull request author')
    ) {
      throw err;
    } else if (
      err.body &&
      err.body.errors &&
      err.body.errors.find((e: any) => e.code === 'invalid')
    ) {
      throw new Error(REPOSITORY_CHANGED);
    }
    throw new Error(PLATFORM_FAILURE);
  }
  throw err;
}

async function get(
  path: string,
  options?: any,
  okToRetry = true
): Promise<GotResponse> {
  let result = null;

  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };
  const method = opts.method || 'get';
  if (method.toLowerCase() === 'post' && path === 'graphql') {
    // GitHub Enterprise uses unversioned graphql path
    opts.baseUrl = opts.baseUrl.replace('/v3/', '/');
  }
  logger.trace(`${method.toUpperCase()} ${path}`);
  try {
    if (global.appMode) {
      const appAccept = 'application/vnd.github.machine-man-preview+json';
      opts.headers = {
        accept: appAccept,
        'user-agent':
          process.env.RENOVATE_USER_AGENT ||
          'https://github.com/renovatebot/renovate',
        ...opts.headers,
      };
      if (opts.headers.accept !== appAccept) {
        opts.headers.accept = `${appAccept}, ${opts.headers.accept}`;
      }
    }
    result = await got(path, opts);
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
        const queue = pageNumbers.map(page => (): Promise<GotResponse> => {
          const nextUrl = URL.parse(linkHeader.next.url, true);
          delete nextUrl.search;
          nextUrl.query.page = page.toString();
          return get(
            URL.format(nextUrl),
            { ...opts, paginate: false },
            okToRetry
          );
        });
        const pages = await pAll<{ body: any[] }>(queue, { concurrency: 5 });
        result.body = result.body.concat(
          ...pages.filter(Boolean).map(page => page.body)
        );
      }
    }
    // istanbul ignore if
    if (method === 'POST' && path === 'graphql') {
      const goodResult = '{"data":{';
      if (result.body.startsWith(goodResult)) {
        if (!okToRetry) {
          logger.info('Recovered graphql query');
        }
      } else if (okToRetry) {
        logger.info('Retrying graphql query');
        opts.body = opts.body.replace('first: 100', 'first: 25');
        return get(path, opts, !okToRetry);
      }
    }
  } catch (gotErr) {
    dispatchError(gotErr, path, opts);
  }
  return result;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  (get as any)[x] = (url: string, opts: any): Promise<GotResponse> =>
    get(url, { ...opts, method: x.toUpperCase() });
}

get.setBaseUrl = (u: string): void => {
  baseUrl = u;
};

export const api: GotApi = get as any;
export default api;
