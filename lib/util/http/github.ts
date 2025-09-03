import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import {
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { getCache } from '../cache/repository';
import { getEnv } from '../env';
import { maskToken } from '../mask';
import * as p from '../promises';
import { range } from '../range';
import { regEx } from '../regex';
import { joinUrlParts, parseLinkHeader, parseUrl } from '../url';
import { findMatchingRule } from './host-rules';
import {
  HttpBase,
  type InternalHttpOptions,
  type InternalJsonUnsafeOptions,
} from './http';
import type { GotLegacyError } from './legacy';
import type {
  GraphqlOptions,
  HttpMethod,
  HttpOptions,
  HttpResponse,
} from './types';

const githubBaseUrl = 'https://api.github.com/';
let baseUrl = githubBaseUrl;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface GithubBaseHttpOptions extends HttpOptions {
  repository?: string;
}

export interface GithubHttpOptions extends GithubBaseHttpOptions {
  paginate?: boolean | string;
  paginationField?: string;
  pageLimit?: number;
}

interface GithubGraphqlRepoData<T = unknown> {
  repository?: T;
}

export type GithubGraphqlResponse<T = unknown> =
  | {
      data: T;
      errors?: never;
    }
  | {
      data?: never;
      errors: {
        type?: string;
        message: string;
      }[];
    };

function handleGotError(
  err: GotLegacyError,
  url: string | URL,
  opts: GithubBaseHttpOptions,
): Error {
  const path = url.toString();
  let message = err.message || '';
  const body = err.response?.body;
  if (is.plainObject(body) && 'message' in body) {
    message = String(body.message);
  }
  if (
    err.code === 'ERR_HTTP2_STREAM_ERROR' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'EAI_AGAIN' ||
    err.code === 'ECONNRESET'
  ) {
    logger.debug({ err }, 'GitHub failure: RequestError');
    return new ExternalHostError(err, 'github');
  }
  if (err.name === 'ParseError') {
    logger.debug({ err }, '');
    return new ExternalHostError(err, 'github');
  }
  if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
    logger.debug({ err }, 'GitHub failure: 5xx');
    return new ExternalHostError(err, 'github');
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
    logger.warn({ err }, 'GitHub failure: secondary rate limit');
    return new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
  }
  if (err.statusCode === 403 && message.includes('Upgrade to GitHub Pro')) {
    logger.debug(`Endpoint: ${path}, needs paid GitHub plan`);
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
      'GitHub failure: Resource not accessible by integration',
    );
    return new Error(PLATFORM_INTEGRATION_UNAUTHORIZED);
  }
  if (err.statusCode === 401) {
    // Warn once for github.com token if unauthorized
    const hostname = parseUrl(url)?.hostname;
    if (hostname === 'github.com' || hostname === 'api.github.com') {
      logger.once.warn('github.com token 401 unauthorized');
    }
    if (message.includes('Bad credentials')) {
      const rateLimit = err.headers?.['x-ratelimit-limit'] ?? -1;
      logger.debug(
        {
          token: maskToken(opts.token),
          err,
        },
        'GitHub failure: Bad credentials',
      );
      if (rateLimit === '60') {
        return new ExternalHostError(err, 'github');
      }
      return new Error(PLATFORM_BAD_CREDENTIALS);
    }
  }
  if (err.statusCode === 422) {
    if (
      message.includes('Review cannot be requested from pull request author')
    ) {
      return err;
    } else if (err.body?.errors?.find((e: any) => e.field === 'milestone')) {
      return err;
    } else if (err.body?.errors?.find((e: any) => e.code === 'invalid')) {
      logger.debug({ err }, 'Received invalid response - aborting');
      return new Error(REPOSITORY_CHANGED);
    } else if (
      err.body?.errors?.find((e: any) =>
        e.message?.startsWith('A pull request already exists'),
      )
    ) {
      return err;
    }
    logger.debug({ err }, '422 Error thrown from GitHub');
    return new ExternalHostError(err, 'github');
  }
  if (
    err.statusCode === 410 &&
    err.body?.message === 'Issues are disabled for this repo'
  ) {
    return err;
  }
  return err;
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

  // TODO: regression of #6736
  if (
    !acceptStrings.some((x) => x === defaultAccept) &&
    (!acceptStrings.some((x) => x.startsWith('application/vnd.github.')) ||
      acceptStrings.length < 2)
  ) {
    acceptStrings.push(defaultAccept);
  }
  return acceptStrings.join(', ');
}

const MAX_GRAPHQL_PAGE_SIZE = 100;

interface GraphqlPageCacheItem {
  pageLastResizedAt: string;
  pageSize: number;
}

export type GraphqlPageCache = Record<string, GraphqlPageCacheItem>;

function getGraphqlPageSize(
  fieldName: string,
  defaultPageSize = MAX_GRAPHQL_PAGE_SIZE,
): number {
  const cache = getCache();
  const graphqlPageCache = cache?.platform?.github
    ?.graphqlPageCache as GraphqlPageCache;
  const cachedRecord = graphqlPageCache?.[fieldName];

  if (graphqlPageCache && cachedRecord) {
    logger.debug(
      { fieldName, ...cachedRecord },
      'GraphQL page size: found cached value',
    );

    const oldPageSize = cachedRecord.pageSize;

    const now = DateTime.local();
    const then = DateTime.fromISO(cachedRecord.pageLastResizedAt);
    const expiry = then.plus({ hours: 24 });
    if (now > expiry) {
      const newPageSize = Math.min(oldPageSize * 2, MAX_GRAPHQL_PAGE_SIZE);
      if (newPageSize < MAX_GRAPHQL_PAGE_SIZE) {
        const timestamp = now.toISO();

        logger.debug(
          { fieldName, oldPageSize, newPageSize, timestamp },
          'GraphQL page size: expanding',
        );

        cachedRecord.pageLastResizedAt = timestamp;
        cachedRecord.pageSize = newPageSize;
      } else {
        logger.debug(
          { fieldName, oldPageSize, newPageSize },
          'GraphQL page size: expanded to default page size',
        );

        delete graphqlPageCache[fieldName];
      }

      return newPageSize;
    }

    return oldPageSize;
  }

  return defaultPageSize;
}

function setGraphqlPageSize(fieldName: string, newPageSize: number): void {
  const oldPageSize = getGraphqlPageSize(fieldName);
  if (newPageSize !== oldPageSize) {
    const now = DateTime.local();
    const pageLastResizedAt = now.toISO();
    logger.debug(
      { fieldName, oldPageSize, newPageSize, timestamp: pageLastResizedAt },
      'GraphQL page size: shrinking',
    );
    const cache = getCache();
    cache.platform ??= {};
    cache.platform.github ??= {};
    cache.platform.github.graphqlPageCache ??= {};
    const graphqlPageCache = cache.platform.github
      .graphqlPageCache as GraphqlPageCache;
    graphqlPageCache[fieldName] = {
      pageLastResizedAt,
      pageSize: newPageSize,
    };
  }
}

function replaceUrlBase(url: URL, baseUrl: string): URL {
  const relativeUrl = `${url.pathname}${url.search}`;
  return new URL(relativeUrl, baseUrl);
}

export class GithubHttp extends HttpBase<GithubHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(hostType = 'github', options?: HttpOptions) {
    super(hostType, options);
  }

  protected override processOptions(
    url: URL,
    opts: InternalHttpOptions & GithubBaseHttpOptions,
  ): void {
    if (!opts.token) {
      const authUrl = new URL(url);

      if (opts.repository) {
        // set authUrl to https://api.github.com/repos/org/repo or https://gihub.domain.com/api/v3/repos/org/repo
        authUrl.hash = '';
        authUrl.search = '';
        authUrl.pathname = joinUrlParts(
          authUrl.pathname.startsWith('/api/v3') ? '/api/v3' : '',
          'repos',
          `${opts.repository}`,
        );
      }

      let readOnly = opts.readOnly;
      const { method = 'get' } = opts;
      if (
        readOnly === undefined &&
        ['get', 'head'].includes(method.toLowerCase())
      ) {
        readOnly = true;
      }
      const { token } = findMatchingRule(authUrl.toString(), {
        hostType: this.hostType,
        readOnly,
      });
      opts.token = token;
    }

    const accept = constructAcceptString(opts.headers?.accept);

    opts.headers = {
      ...opts.headers,
      accept,
    };
  }

  protected override handleError(
    url: string | URL,
    opts: HttpOptions,
    err: GotLegacyError,
  ): never {
    throw handleGotError(err, url, opts);
  }

  protected override async requestJsonUnsafe<T>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<GithubHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const httpOptions = options.httpOptions ?? {};
    const resolvedUrl = this.resolveUrl(options.url, httpOptions);
    const opts = {
      ...options,
      url: resolvedUrl,
    };

    const result = await super.requestJsonUnsafe<T>(method, opts);
    if (httpOptions.paginate) {
      delete httpOptions.cacheProvider;
      httpOptions.memCache = false;
      // Check if result is paginated
      const pageLimit = httpOptions.pageLimit ?? 10;
      const linkHeader = parseLinkHeader(result?.headers?.link);
      const next = linkHeader?.next;
      const env = getEnv();
      if (next?.url && linkHeader?.last?.page) {
        let lastPage = parseInt(linkHeader.last.page);
        if (!env.RENOVATE_PAGINATE_ALL && httpOptions.paginate !== 'all') {
          lastPage = Math.min(pageLimit, lastPage);
        }
        const baseUrl = httpOptions.baseUrl ?? this.baseUrl;
        const parsedUrl = new URL(next.url, baseUrl);
        const rebasePagination =
          !!baseUrl &&
          !!env.RENOVATE_X_REBASE_PAGINATION_LINKS &&
          // Preserve github.com URLs for use cases like release notes
          parsedUrl.origin !== 'https://api.github.com';
        const firstPageUrl = rebasePagination
          ? replaceUrlBase(parsedUrl, baseUrl)
          : parsedUrl;
        const queue = [...range(2, lastPage)].map(
          (pageNumber) => (): Promise<HttpResponse<T>> => {
            // copy before modifying searchParams
            const nextUrl = new URL(firstPageUrl);
            nextUrl.searchParams.set('page', String(pageNumber));
            return super.requestJsonUnsafe<T>(method, {
              ...opts,
              url: nextUrl,
            });
          },
        );
        const pages = await p.all(queue);
        if (httpOptions.paginationField && is.plainObject(result.body)) {
          const paginatedResult = result.body[httpOptions.paginationField];
          if (is.array<T>(paginatedResult)) {
            for (const nextPage of pages) {
              if (is.plainObject(nextPage.body)) {
                const nextPageResults =
                  nextPage.body[httpOptions.paginationField];
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
  }

  public async requestGraphql<T = unknown>(
    query: string,
    options: GraphqlOptions = {},
  ): Promise<GithubGraphqlResponse<T> | null> {
    const path = 'graphql';

    const { paginate, count = MAX_GRAPHQL_PAGE_SIZE, cursor = null } = options;
    let { variables } = options;
    if (paginate) {
      variables = {
        ...variables,
        count,
        cursor,
      };
    }
    const body = variables ? { query, variables } : { query };

    const opts: GithubBaseHttpOptions = {
      baseUrl: baseUrl.replace('/v3/', '/'), // GHE uses unversioned graphql path
      body,
      headers: { accept: options?.acceptHeader },
      readOnly: options.readOnly,
    };
    if (options.token) {
      opts.token = options.token;
    }
    logger.trace(`Performing Github GraphQL request`);

    try {
      const res = await this.postJson<GithubGraphqlResponse<T>>(path, opts);
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
    options: GraphqlOptions = {},
  ): Promise<T[]> {
    const result: T[] = [];

    const { paginate = true } = options;

    let optimalCount: null | number = null;
    let count = getGraphqlPageSize(
      fieldName,
      options.count ?? MAX_GRAPHQL_PAGE_SIZE,
    );
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
        is.nonEmptyObject(repositoryData) &&
        !is.nullOrUndefined(repositoryData[fieldName])
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

    if (optimalCount && optimalCount < MAX_GRAPHQL_PAGE_SIZE) {
      setGraphqlPageSize(fieldName, optimalCount);
    }

    return result;
  }

  /**
   * Get the raw text file from a URL.
   * Only use this method to fetch text files.
   *
   * @param url Full API URL, contents path or path inside the repository to the file
   * @param options
   *
   * @example url = 'https://api.github.com/repos/renovatebot/renovate/contents/package.json'
   * @example url = 'renovatebot/renovate/contents/package.json'
   * @example url = 'package.json' & options.repository = 'renovatebot/renovate'
   */
  public async getRawTextFile(
    url: string,
    options: InternalHttpOptions & GithubBaseHttpOptions = {},
  ): Promise<HttpResponse> {
    const newOptions: InternalHttpOptions & GithubBaseHttpOptions = {
      ...options,
      headers: {
        accept: 'application/vnd.github.raw+json',
      },
    };

    let newURL = url;
    const httpRegex = regEx(/^https?:\/\//);
    if (options.repository && !httpRegex.test(options.repository)) {
      newURL = joinUrlParts(options.repository, 'contents', url);
    }

    return await this.getText(newURL, newOptions);
  }
}
