import is from '@sindresorhus/is';
import pAll from 'p-all';
import parseLinkHeader from 'parse-link-header';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { maskToken } from '../mask';
import { GotLegacyError } from './legacy';
import { Http, HttpPostOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl = 'https://api.github.com/';
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
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
  err: GotLegacyError,
  url: string | URL,
  opts: GithubHttpOptions
): never {
  const path = url.toString();
  let message = err.message || '';
  if (is.plainObject(err.response?.body) && 'message' in err.response.body) {
    message = String(err.response.body.message);
  }
  if (
    err.name === 'RequestError' &&
    (err.code === 'ENOTFOUND' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'EAI_AGAIN' ||
      err.code === 'ECONNRESET')
  ) {
    logger.debug({ err }, 'GitHub failure: RequestError');
    throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
  }
  if (err.name === 'ParseError') {
    logger.debug({ err }, '');
    throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
  }
  if (err.statusCode >= 500 && err.statusCode < 600) {
    logger.debug({ err }, 'GitHub failure: 5xx');
    throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
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
    const rateLimit = err.headers?.['x-ratelimit-limit'] ?? -1;
    logger.debug(
      {
        token: maskToken(opts.token),
        err,
      },
      'GitHub failure: Bad credentials'
    );
    if (rateLimit === '60') {
      throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
    }
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }
  if (err.statusCode === 422) {
    if (
      message.includes('Review cannot be requested from pull request author')
    ) {
      throw err;
    } else if (err.body?.errors?.find((e: any) => e.code === 'invalid')) {
      logger.debug({ err }, 'Received invalid response - aborting');
      throw new Error(REPOSITORY_CHANGED);
    } else if (
      err.body?.errors?.find((e: any) =>
        e.message?.startsWith('A pull request already exists')
      )
    ) {
      throw err;
    }
    logger.debug({ err }, '422 Error thrown from GitHub');
    throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
  }
  if (err.statusCode === 404) {
    logger.debug({ url: path }, 'GitHub 404');
  } else {
    logger.debug({ err }, 'Unknown GitHub error');
  }
  throw err;
}

interface GraphqlOptions {
  paginate?: boolean;
  count?: number;
  limit?: number;
  acceptHeader?: string;
  fromEnd?: boolean;
}

function constructAcceptString(input?: any): string {
  const defaultAccept = 'application/vnd.github.v3+json';
  const acceptStrings = typeof input === 'string' ? input.split(/\s*,\s*/) : [];
  if (
    !acceptStrings.some((x) => x.startsWith('application/vnd.github.')) ||
    acceptStrings.length < 2
  ) {
    acceptStrings.push(defaultAccept);
  }
  return acceptStrings.join(', ');
}

export class GithubHttp extends Http<GithubHttpOptions, GithubHttpOptions> {
  constructor(options?: GithubHttpOptions) {
    super(PLATFORM_TYPE_GITHUB, options);
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

    const accept = constructAcceptString(opts.headers?.accept);

    opts.headers = {
      ...opts.headers,
      accept,
    };

    try {
      result = await super.request<T>(url, opts);

      // istanbul ignore else: Can result be null ???
      if (result !== null) {
        if (opts.paginate) {
          // Check if result is paginated
          const pageLimit = opts.pageLimit || 10;
          const linkHeader =
            result?.headers?.link &&
            parseLinkHeader(result.headers.link as string);
          if (linkHeader?.next && linkHeader?.last) {
            let lastPage = +linkHeader.last.page;
            // istanbul ignore else: needs a test
            if (!process.env.RENOVATE_PAGINATE_ALL && opts.paginate !== 'all') {
              lastPage = Math.min(pageLimit, lastPage);
            }
            const pageNumbers = Array.from(
              new Array(lastPage),
              (x, i) => i + 1
            ).slice(1);
            const queue = pageNumbers.map(
              (page) => (): Promise<HttpResponse> => {
                const nextUrl = new URL(linkHeader.next.url, baseUrl);
                delete nextUrl.search;
                nextUrl.searchParams.set('page', page.toString());
                return this.request(
                  nextUrl,
                  { ...opts, paginate: false },
                  okToRetry
                );
              }
            );
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

  public async queryRepo<T = unknown>(
    query: string,
    options: GraphqlOptions = {}
  ): Promise<T> {
    let result = null;

    const path = 'graphql';

    const opts: HttpPostOptions = {
      baseUrl: baseUrl.replace('/v3/', '/'), // GHE uses unversioned graphql path
      body: { query },
      headers: { accept: options?.acceptHeader },
    };

    logger.trace(`Performing Github GraphQL request`);

    try {
      const res = await this.postJson<GithubGraphqlResponse<T>>(
        'graphql',
        opts
      );
      result = res?.body?.data?.repository;
    } catch (err) {
      if (err instanceof ExternalHostError) {
        const gotError = err.err as GotLegacyError;
        const statusCode = gotError?.statusCode;
        const count = options.count;
        if (
          count &&
          count > 10 &&
          statusCode &&
          statusCode >= 500 &&
          statusCode < 600
        ) {
          logger.info('Reducing pagination count to workaround graphql 5xx');
          return null;
        }
      }
      handleGotError(err, path, opts);
    }
    return result;
  }

  async queryRepoField<T = Record<string, unknown>>(
    queryOrig: string,
    fieldName: string,
    options: GraphqlOptions = {}
  ): Promise<T[]> {
    const result: T[] = [];

    const regex = new RegExp(`(\\W)${fieldName}(\\s*)\\(`);

    const { paginate = true } = options;
    let count = options.count || 100;
    let limit = options.limit || 1000;
    let cursor: string = null;

    let isIterating = true;
    while (isIterating) {
      let query = queryOrig;
      if (paginate) {
        let replacement = `$1${fieldName}$2(first: ${Math.min(count, limit)}`;
        replacement += cursor ? `, after: "${cursor}", ` : ', ';
        query = query.replace(regex, replacement);
      }
      const gqlRes = await this.queryRepo<T>(query, { ...options, count });
      if (gqlRes?.[fieldName]) {
        const { nodes = [], edges = [], pageInfo } = gqlRes[fieldName];
        result.push(...nodes);
        result.push(...edges);

        limit = Math.max(0, limit - nodes.length - edges.length);

        if (limit === 0) {
          isIterating = false;
        } else if (paginate && pageInfo) {
          const { hasNextPage, endCursor } = pageInfo;
          if (hasNextPage && endCursor) {
            cursor = endCursor;
          } else {
            isIterating = false;
          }
        }
      } else {
        count = Math.floor(count / 2);
        if (count === 0) {
          logger.error({ gqlRes }, 'Error fetching GraphQL nodes');
          isIterating = false;
        }
      }

      if (!paginate) {
        isIterating = false;
      }
    }

    return result;
  }
}
