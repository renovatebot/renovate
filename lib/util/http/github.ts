import { GotError } from 'got';
import URL from 'url';
import pAll from 'p-all';
import parseLinkHeader from 'parse-link-header';
import { Http, HttpPostOptions, HttpResponse, InternalHttpOptions } from '.';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { maskToken } from '../mask';
import { logger } from '../../logger';

let baseUrl = 'https://api.github.com/';
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

type GotRequestError<E = unknown, T = unknown> = GotError & {
  body: {
    message?: string;
    errors?: E[];
  };
  headers?: Record<string, T>;
};

interface GithubInternalOptions extends InternalHttpOptions {
  body?: string;
}

export interface GithubHttpOptions extends InternalHttpOptions {
  paginate?: boolean | string;
  pageLimit?: number;
  token?: string;
}

interface GithubGraphqlResponse<T = unknown> {
  data?: {
    repository?: T;
  };
  errors?: { message: string; locations: unknown }[];
}

function handleGotError(
  err: GotRequestError,
  url: string | URL,
  opts: GithubHttpOptions
): never {
  const path = url.toString();
  let message = err.message || '';
  if (err.body?.message) {
    message = err.body.message;
  }
  if (
    err.name === 'RequestError' &&
    (err.code === 'ENOTFOUND' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN')
  ) {
    logger.debug({ err }, 'GitHub failure: RequestError');
    throw new Error(PLATFORM_FAILURE);
  }
  if (err.name === 'ParseError') {
    logger.debug({ err }, 'GitHub failure: ParseError');
    throw new Error(PLATFORM_FAILURE);
  }
  if (err.statusCode >= 500 && err.statusCode < 600) {
    logger.debug({ err }, 'GitHub failure: 5xx');
    throw new Error(PLATFORM_FAILURE);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('You have triggered an abuse detection mechanism')
  ) {
    logger.debug({ err }, 'GitHub failure: abuse detection');
    throw new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (err.statusCode === 403 && message.includes('Upgrade to GitHub Pro')) {
    logger.debug({ path }, 'Endpoint needs paid GitHub plan');
    throw err;
  }
  if (err.statusCode === 403 && message.includes('rate limit exceeded')) {
    logger.debug({ err }, 'GitHub failure: rate limit');
    throw new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('Resource not accessible by integration')
  ) {
    logger.debug(
      { err },
      'GitHub failure: Resource not accessible by integration'
    );
    throw new Error(PLATFORM_INTEGRATION_UNAUTHORIZED);
  }
  if (err.statusCode === 401 && message.includes('Bad credentials')) {
    const rateLimit = err.headers ? err.headers['x-ratelimit-limit'] : -1;
    logger.debug(
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
    logger.debug({ err }, '422 Error thrown from GitHub');
    throw new Error(PLATFORM_FAILURE);
  }
  throw err;
}

export class GithubHttp extends Http<GithubHttpOptions, GithubHttpOptions> {
  constructor(
    hostType: string = PLATFORM_TYPE_GITHUB,
    options?: GithubHttpOptions
  ) {
    super(hostType, options);
  }

  protected async request<T>(
    url: string | URL,
    options?: GithubInternalOptions & GithubHttpOptions,
    okToRetry = true
  ): Promise<HttpResponse<T> | null> {
    let result = null;

    const opts = {
      baseUrl,
      ...options,
      throwHttpErrors: true,
    };

    const method = opts.method || 'get';

    if (method.toLowerCase() === 'post' && url === 'graphql') {
      // GitHub Enterprise uses unversioned graphql path
      opts.baseUrl = opts.baseUrl.replace('/v3/', '/');
    }

    if (global.appMode) {
      const appAccept = 'application/vnd.github.machine-man-preview+json';
      opts.headers = {
        accept: appAccept,
        'user-agent':
          process.env.RENOVATE_USER_AGENT ||
          'https://github.com/renovatebot/renovate',
        ...opts.headers,
      };
      const optsAccept = opts?.headers?.accept;
      if (typeof optsAccept === 'string' && !optsAccept.includes(appAccept)) {
        opts.headers.accept = `${appAccept}, ${opts.headers.accept}`;
      }
    }

    try {
      result = await super.request<T>(url, opts);

      if (result !== null) {
        if (opts.paginate) {
          // Check if result is paginated
          const pageLimit = opts.pageLimit || 10;
          const linkHeader =
            result?.headers?.link &&
            parseLinkHeader(result.headers.link as string);
          if (linkHeader && linkHeader.next && linkHeader.last) {
            let lastPage = +linkHeader.last.page;
            if (!process.env.RENOVATE_PAGINATE_ALL && opts.paginate !== 'all') {
              lastPage = Math.min(pageLimit, lastPage);
            }
            const pageNumbers = Array.from(
              new Array(lastPage),
              (x, i) => i + 1
            ).slice(1);
            const queue = pageNumbers.map((page) => (): Promise<
              HttpResponse
            > => {
              const nextUrl = URL.parse(linkHeader.next.url, true);
              delete nextUrl.search;
              nextUrl.query.page = page.toString();
              return this.request(
                URL.format(nextUrl),
                { ...opts, paginate: false },
                okToRetry
              );
            });
            const pages = await pAll(queue, { concurrency: 5 });
            result.body = result.body.concat(
              ...pages.filter(Boolean).map((page) => page.body)
            );
          }
        }
      }
    } catch (err) {
      handleGotError(err, url, opts);
    }

    return result;
  }

  private async getGraphql<T = unknown>(
    query: string
  ): Promise<GithubGraphqlResponse<T>> {
    let result = null;

    const path = 'graphql';

    const opts: HttpPostOptions = {
      body: { query },
    };

    if (global.appMode) {
      opts.headers = {
        accept: 'application/vnd.github.merge-info-preview+json',
        'user-agent':
          process.env.RENOVATE_USER_AGENT ||
          'https://github.com/renovatebot/renovate',
        ...opts.headers,
      };
    }

    logger.trace(`Performing Github GraphQL request`);

    try {
      const res = await this.postJson('graphql', opts);
      result = res && res.body;
    } catch (gotErr) {
      handleGotError(gotErr, path, opts);
    }
    return result;
  }

  async getGraphqlNodes<T = Record<string, unknown>>(
    queryOrig: string,
    fieldName: string,
    options: { paginate?: boolean; count?: number } = {}
  ): Promise<T[]> {
    const result: T[] = [];

    const regex = new RegExp(`(\\W)${fieldName}(\\s*)\\(`);

    const { paginate = true } = options;
    let { count = 100 } = options;
    let canIterate = true;
    let cursor = null;

    while (canIterate) {
      let replacement = `$1${fieldName}$2(first: ${count}`;
      replacement += cursor ? `, after: "${cursor}", ` : ', ';
      const query = queryOrig.replace(regex, replacement);
      const gqlRes = await this.getGraphql<T>(query);
      if (
        gqlRes &&
        gqlRes.data &&
        gqlRes.data.repository &&
        gqlRes.data.repository[fieldName]
      ) {
        const { nodes, pageInfo } = gqlRes.data.repository[fieldName];
        result.push(...nodes);

        if (paginate && pageInfo) {
          const { hasNextPage, endCursor } = pageInfo;
          if (hasNextPage && endCursor) {
            cursor = endCursor;
          } else {
            canIterate = false;
          }
        }
      } else {
        count = Math.floor(count / 2);
        if (count === 0) {
          logger.error('Error fetching GraphQL nodes');
          canIterate = false;
        }
      }

      if (!paginate) {
        canIterate = false;
      }
    }

    return result;
  }
}
