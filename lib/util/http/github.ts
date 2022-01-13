import is from '@sindresorhus/is';
import pAll from 'p-all';
import parseLinkHeader from 'parse-link-header';
import { PlatformId } from '../../constants';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { maskToken } from '../mask';
import { regEx } from '../regex';
import { GotLegacyError } from './legacy';
import { Http, HttpPostOptions, HttpResponse, InternalHttpOptions } from '.';

const githubBaseUrl = 'https://api.github.com/';
let baseUrl = githubBaseUrl;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

interface GithubInternalOptions extends InternalHttpOptions {
  body?: string;
}

export interface GithubHttpOptions extends InternalHttpOptions {
  paginate?: boolean | string;
  paginationField?: string;
  pageLimit?: number;
  token?: string;
}

interface GithubGraphqlRepoData<T = unknown> {
  repository?: T;
}

interface GithubGraphqlResponse<T = unknown> {
  data?: T;
  errors?: {
    type?: string;
    message: string;
    locations: unknown;
  }[];
}

function handleGotError(
  err: GotLegacyError,
  url: string | URL,
  opts: GithubHttpOptions
): Error {
  const path = url.toString();
  let message = err.message || '';
  const body = err.response?.body;
  if (is.plainObject(body) && 'message' in body) {
    message = String(body.message);
  }
  if (
    err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'EAI_AGAIN' ||
    err.code === 'ECONNRESET'
  ) {
    logger.debug({ err }, 'GitHub failure: RequestError');
    return new ExternalHostError(err, PlatformId.Github);
  }
  if (err.name === 'ParseError') {
    logger.debug({ err }, '');
    return new ExternalHostError(err, PlatformId.Github);
  }
  if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
    logger.debug({ err }, 'GitHub failure: 5xx');
    return new ExternalHostError(err, PlatformId.Github);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('You have triggered an abuse detection mechanism')
  ) {
    logger.debug({ err }, 'GitHub failure: abuse detection');
    return new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('You have exceeded a secondary rate limit')
  ) {
    logger.debug({ err }, 'GitHub failure: secondary rate limit');
    return new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (err.statusCode === 403 && message.includes('Upgrade to GitHub Pro')) {
    logger.debug({ path }, 'Endpoint needs paid GitHub plan');
    return err;
  }
  if (err.statusCode === 403 && message.includes('rate limit exceeded')) {
    logger.debug({ err }, 'GitHub failure: rate limit');
    return new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (
    err.statusCode === 403 &&
    message.startsWith('Resource not accessible by integration')
  ) {
    logger.debug(
      { err },
      'GitHub failure: Resource not accessible by integration'
    );
    return new Error(PLATFORM_INTEGRATION_UNAUTHORIZED);
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
      return new ExternalHostError(err, PlatformId.Github);
    }
    return new Error(PLATFORM_BAD_CREDENTIALS);
  }
  if (err.statusCode === 422) {
    if (
      message.includes('Review cannot be requested from pull request author')
    ) {
      return err;
    } else if (err.body?.errors?.find((e: any) => e.code === 'invalid')) {
      logger.debug({ err }, 'Received invalid response - aborting');
      return new Error(REPOSITORY_CHANGED);
    } else if (
      err.body?.errors?.find((e: any) =>
        e.message?.startsWith('A pull request already exists')
      )
    ) {
      return err;
    }
    logger.debug({ err }, '422 Error thrown from GitHub');
    return new ExternalHostError(err, PlatformId.Github);
  }
  if (
    err.statusCode === 410 &&
    err.body?.message === 'Issues are disabled for this repo'
  ) {
    return err;
  }
  if (err.statusCode === 404) {
    logger.debug({ url: path }, 'GitHub 404');
  } else {
    logger.debug({ err }, 'Unknown GitHub error');
  }
  return err;
}

interface GraphqlOptions {
  variables?: Record<string, string | number | null>;
  paginate?: boolean;
  count?: number;
  limit?: number;
  cursor?: string | null;
  acceptHeader?: string;
}

interface GraphqlPaginatedContent<T = unknown> {
  nodes: T[];
  edges: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string };
}

function constructAcceptString(input?: any): string {
  const defaultAccept = 'application/vnd.github.v3+json';
  const acceptStrings =
    typeof input === 'string' ? input.split(regEx(/\s*,\s*/)) : [];
  if (
    !acceptStrings.some((x) => x.startsWith('application/vnd.github.')) ||
    acceptStrings.length < 2
  ) {
    acceptStrings.push(defaultAccept);
  }
  return acceptStrings.join(', ');
}

export class GithubHttp extends Http<GithubHttpOptions, GithubHttpOptions> {
  constructor(
    hostType: string = PlatformId.Github,
    options?: GithubHttpOptions
  ) {
    super(hostType, options);
  }

  protected override async request<T>(
    url: string | URL,
    options?: GithubInternalOptions & GithubHttpOptions,
    okToRetry = true
  ): Promise<HttpResponse<T>> {
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
      const result = await super.request<T>(url, opts);
      if (opts.paginate) {
        // Check if result is paginated
        const pageLimit = opts.pageLimit ?? 10;
        const linkHeader = parseLinkHeader(result?.headers?.link);
        if (linkHeader?.next && linkHeader?.last) {
          let lastPage = parseInt(linkHeader.last.page, 10);
          // istanbul ignore else: needs a test
          if (!process.env.RENOVATE_PAGINATE_ALL && opts.paginate !== 'all') {
            lastPage = Math.min(pageLimit, lastPage);
          }
          const queue = Array.from(new Array(lastPage), (_, i) => `${i + 1}`)
            .slice(1)
            .map((pageNumber) => (): Promise<HttpResponse<T>> => {
              const nextUrl = new URL(linkHeader.next.url, baseUrl);
              nextUrl.searchParams.set('page', pageNumber);
              return this.request<T>(
                nextUrl,
                { ...opts, paginate: false },
                okToRetry
              );
            });
          const pages = await pAll(queue, { concurrency: 5 });
          if (opts.paginationField && is.plainObject(result.body)) {
            const paginatedResult = result.body[opts.paginationField];
            if (is.array<T>(paginatedResult)) {
              for (const nextPage of pages) {
                if (is.plainObject(nextPage.body)) {
                  const nextPageResults = nextPage.body[opts.paginationField];
                  if (is.array<T>(nextPageResults)) {
                    paginatedResult.push(...nextPageResults);
                  }
                }
              }
            }
          } else if (is.array<T>(result.body)) {
            for (const nextPage of pages) {
              if (is.array<T>(nextPage.body)) {
                result.body.push(...nextPage.body);
              }
            }
          }
        }
      }
      return result;
    } catch (err) {
      throw handleGotError(err, url, opts);
    }
  }

  public async requestGraphql<T = unknown>(
    query: string,
    options: GraphqlOptions = {}
  ): Promise<GithubGraphqlResponse<T> | null> {
    const path = 'graphql';

    const { paginate, count = 100, cursor = null } = options;
    let { variables } = options;
    if (paginate) {
      variables = {
        ...variables,
        count,
        cursor,
      };
    }
    const body = variables ? { query, variables } : { query };

    const opts: HttpPostOptions = {
      baseUrl: baseUrl.replace('/v3/', '/'), // GHE uses unversioned graphql path
      body,
      headers: { accept: options?.acceptHeader },
    };

    logger.trace(`Performing Github GraphQL request`);

    try {
      const res = await this.postJson<GithubGraphqlResponse<T>>(
        'graphql',
        opts
      );
      return res?.body;
    } catch (err) {
      logger.debug({ err, query, options }, 'Unexpected GraphQL Error');
      if (err instanceof ExternalHostError && count && count > 10) {
        logger.info('Reducing pagination count to workaround graphql errors');
        return null;
      }
      throw handleGotError(err, path, opts);
    }
  }

  async queryRepoField<T = Record<string, unknown>>(
    query: string,
    fieldName: string,
    options: GraphqlOptions = {}
  ): Promise<T[]> {
    const result: T[] = [];

    const { paginate = true } = options;

    let optimalCount: null | number = null;
    const initialCount = options.count ?? 100;
    let count = initialCount;
    let limit = options.limit ?? 1000;
    let cursor: string | null = null;

    let isIterating = true;
    while (isIterating) {
      const res = await this.requestGraphql<GithubGraphqlRepoData<T>>(query, {
        ...options,
        count: Math.min(count, limit),
        cursor,
        paginate,
      });
      const repositoryData = res?.data?.repository;
      if (
        repositoryData &&
        is.plainObject(repositoryData) &&
        repositoryData[fieldName]
      ) {
        optimalCount = count;

        const {
          nodes = [],
          edges = [],
          pageInfo,
        } = repositoryData[fieldName] as GraphqlPaginatedContent<T>;
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
          logger.warn({ query, options, res }, 'Error fetching GraphQL nodes');
          isIterating = false;
        }
      }

      if (!paginate) {
        isIterating = false;
      }
    }

    // See: https://github.com/renovatebot/renovate/issues/12703
    // istanbul ignore if
    if (
      optimalCount &&
      optimalCount < initialCount && // log only shrinked results
      baseUrl === githubBaseUrl
    ) {
      logger.debug(
        { fieldName, optimalCount },
        'Successful GraphQL query with shrinked pagination size'
      );
    }

    return result;
  }
}
