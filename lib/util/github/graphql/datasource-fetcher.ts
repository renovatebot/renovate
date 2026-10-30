import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as memCache from '../../cache/memory/index.ts';
import * as packageCache from '../../cache/package/index.ts';
import { buildCacheKey } from '../../cache/package/key.ts';
import type { PackageCacheNamespace } from '../../cache/package/types.ts';
import type {
  GithubGraphqlResponse,
  GithubHttp,
  GithubHttpOptions,
} from '../../http/github.ts';
import type { HttpResponse } from '../../http/types.ts';
import { regEx } from '../../regex.ts';
import { getApiBaseUrl } from '../url.ts';
import { GithubGraphqlMemoryCacheStrategy } from './cache-strategies/memory-cache-strategy.ts';
import { GithubGraphqlPackageCacheStrategy } from './cache-strategies/package-cache-strategy.ts';
import type {
  GithubDatasourceItem,
  GithubGraphqlCacheStrategy,
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlPayload,
  GithubGraphqlQueryOptions,
  GithubGraphqlRepoParams,
  GithubGraphqlRepoResponse,
  GithubPackageConfig,
  RawQueryResponse,
} from './types.ts';

/**
 * Page sizes to try, from the largest to the smallest.
 *
 * Repositories with many tags can exceed the GitHub GraphQL execution
 * timeout even for small page sizes, hence the low floor.
 *
 * @see https://github.com/renovatebot/renovate/discussions/45248
 */
const pageSizes = [100, 50, 25, 10, 5] as const;

type PageSize = (typeof pageSizes)[number];

/**
 * Minimum time between two refresh fetches of the same package.
 */
const refreshIntervalMinutes = 5;

/**
 * We know empirically that certain type of GraphQL errors
 * can be fixed by shrinking page size.
 *
 * @see https://github.com/renovatebot/renovate/issues/16343
 */
function isUnknownGraphqlError(err: Error): boolean {
  const { message } = err;
  return message.startsWith('Something went wrong while executing your query.');
}

function canBeSolvedByShrinking(err: Error): boolean {
  const errors: Error[] = err instanceof AggregateError ? err.errors : [err];
  return errors.some(
    (e) => err instanceof ExternalHostError || isUnknownGraphqlError(e),
  );
}

export class GithubGraphqlDatasourceFetcher<
  GraphqlItem,
  ResultItem extends GithubDatasourceItem,
> {
  static async query<T, U extends GithubDatasourceItem>(
    config: GithubPackageConfig,
    http: GithubHttp,
    adapter: GithubGraphqlDatasourceAdapter<T, U>,
    options: GithubGraphqlQueryOptions = {},
  ): Promise<U[]> {
    const instance = new GithubGraphqlDatasourceFetcher<T, U>(
      config,
      http,
      adapter,
      options,
    );
    const items = await instance.getItems();
    return items;
  }

  private readonly baseUrl: string;
  private readonly repoOwner: string;
  private readonly repoName: string;

  private itemsPerQuery: PageSize = pageSizes[0];

  private queryCount = 0;

  private cursor: string | null = null;

  private isPersistent: boolean | undefined;
  private http: GithubHttp;
  private datasourceAdapter: GithubGraphqlDatasourceAdapter<
    GraphqlItem,
    ResultItem
  >;
  private readonly refresh: boolean;

  constructor(
    packageConfig: GithubPackageConfig,
    http: GithubHttp,
    datasourceAdapter: GithubGraphqlDatasourceAdapter<GraphqlItem, ResultItem>,
    options: GithubGraphqlQueryOptions = {},
  ) {
    this.http = http;
    this.datasourceAdapter = datasourceAdapter;
    this.refresh = options.refresh === true;
    const { packageName, registryUrl } = packageConfig;
    [this.repoOwner, this.repoName] = packageName.split('/');
    this.baseUrl = getApiBaseUrl(registryUrl).replace(regEx(/\/v3\/$/), '/'); // Replace for GHE
  }

  private getCacheNs(): PackageCacheNamespace {
    return this.datasourceAdapter.key;
  }

  private getCacheKey(): string {
    return buildCacheKey(this.baseUrl, this.repoOwner, this.repoName);
  }

  private getRawQueryOptions(): GithubHttpOptions {
    const baseUrl = this.baseUrl;
    const repository = `${this.repoOwner}/${this.repoName}`;
    const query = this.datasourceAdapter.query;
    const variables: GithubGraphqlRepoParams = {
      owner: this.repoOwner,
      name: this.repoName,
      count: this.itemsPerQuery,
      cursor: this.cursor,
    };

    return {
      baseUrl,
      repository,
      readOnly: true,
      body: { query, variables },
    };
  }

  private async doRawQuery(): Promise<
    RawQueryResponse<GithubGraphqlPayload<GraphqlItem>>
  > {
    const requestOptions = this.getRawQueryOptions();

    type GraphqlData = GithubGraphqlRepoResponse<GraphqlItem>;
    type HttpBody = GithubGraphqlResponse<GraphqlData>;
    let httpRes: HttpResponse<HttpBody>;
    try {
      httpRes = await this.http.postJson<HttpBody>('/graphql', requestOptions);
    } catch (err) {
      return [null, err];
    }

    const { body } = httpRes;
    const { data, errors } = body;

    if (errors?.length) {
      if (errors.length === 1) {
        const { message } = errors[0];
        const err = new Error(message);
        return [null, err];
      }
      const errorInstances = errors.map(({ message }) => new Error(message));
      const err = new AggregateError(errorInstances);
      return [null, err];
    }

    if (!data) {
      const msg = 'GitHub GraphQL datasource: failed to obtain data';
      const err = new Error(msg);
      return [null, err];
    }

    if (!data.repository) {
      const msg = 'GitHub GraphQL datasource: failed to obtain repository data';
      const err = new Error(msg);
      return [null, err];
    }

    if (!data.repository.payload) {
      const msg =
        'GitHub GraphQL datasource: failed to obtain repository payload data';
      const err = new Error(msg);
      return [null, err];
    }

    this.queryCount += 1;

    // For values other than explicit `false`,
    // we assume that items can not be cached.
    this.isPersistent ??= data.repository.isRepoPrivate === false;

    const res = data.repository.payload;
    return [res, null];
  }

  private shrinkPageSize(): boolean {
    const nextIdx = pageSizes.indexOf(this.itemsPerQuery) + 1;
    if (nextIdx >= pageSizes.length) {
      return false;
    }

    this.itemsPerQuery = pageSizes[nextIdx];
    return true;
  }

  private hasReachedQueryLimit(): boolean {
    return this.queryCount >= 100;
  }

  private async doShrinkableQuery(): Promise<
    GithubGraphqlPayload<GraphqlItem>
  > {
    let res: GithubGraphqlPayload<GraphqlItem> | null = null;
    let err: Error | null = null;

    while (!res) {
      [res, err] = await this.doRawQuery();
      if (err) {
        if (!canBeSolvedByShrinking(err)) {
          throw err;
        }

        const shrinkResult = this.shrinkPageSize();
        if (!shrinkResult) {
          throw err;
        }
        const { body: _, ...options } = this.getRawQueryOptions();
        logger.debug(
          { options, newSize: this.itemsPerQuery },
          'Shrinking GitHub GraphQL page size after error',
        );
      }
    }

    return res;
  }

  private _cacheStrategy: GithubGraphqlCacheStrategy<ResultItem> | undefined;

  private cacheStrategy(): GithubGraphqlCacheStrategy<ResultItem> {
    if (this._cacheStrategy) {
      return this._cacheStrategy;
    }
    const cacheNs = this.getCacheNs();
    const cacheKey = this.getCacheKey();
    const cachePrivatePackages = GlobalConfig.get('cachePrivatePackages');
    const skipStabilization = !is.undefined(this.datasourceAdapter.maxItems);
    this._cacheStrategy =
      cachePrivatePackages || this.isPersistent
        ? new GithubGraphqlPackageCacheStrategy<ResultItem>(
            cacheNs,
            cacheKey,
            skipStabilization,
          )
        : new GithubGraphqlMemoryCacheStrategy<ResultItem>(
            cacheNs,
            cacheKey,
            skipStabilization,
          );
    return this._cacheStrategy;
  }

  private transformNodes(nodes: GraphqlItem[]): ResultItem[] {
    const resultItems: ResultItem[] = [];
    for (const node of nodes) {
      const item = this.datasourceAdapter.transform(node);
      if (!item) {
        logger.once.info(
          {
            packageName: `${this.repoOwner}/${this.repoName}`,
            baseUrl: this.baseUrl,
          },
          `GitHub GraphQL datasource: skipping empty item`,
        );
        continue;
      }
      resultItems.push(item);
    }
    return resultItems;
  }

  /**
   * This method is responsible for data synchronization.
   * It also detects persistence of the package, based on the first page result.
   */
  private async doPaginatedFetch(): Promise<void> {
    let hasNextPage = true;
    let isPaginationDone = false;
    let nextCursor: string | undefined;
    let itemCount = 0;
    const maxItems = this.datasourceAdapter.maxItems;
    while (hasNextPage && !isPaginationDone && !this.hasReachedQueryLimit()) {
      if (!is.undefined(maxItems) && itemCount >= maxItems) {
        break;
      }
      const queryResult = await this.doShrinkableQuery();

      const resultItems = this.transformNodes(queryResult.nodes);
      itemCount += resultItems.length;

      // It's important to call `getCacheStrategy()` after `doShrinkableQuery()`
      // because `doShrinkableQuery()` may change `this.isCacheable`.
      //
      // Otherwise, cache items for public packages will never be persisted
      // in long-term cache.
      isPaginationDone = await this.cacheStrategy().reconcile(resultItems);

      hasNextPage = !!queryResult?.pageInfo?.hasNextPage;
      nextCursor = queryResult?.pageInfo?.endCursor;
      if (hasNextPage && nextCursor) {
        this.cursor = nextCursor;
      }
    }

    if (this.isPersistent) {
      await this.storePersistenceFlag(30);
    }
  }

  private async doCachedQuery(): Promise<ResultItem[]> {
    await this.loadPersistenceFlag();
    if (!this.isPersistent) {
      await this.doPaginatedFetch();
    }

    const res = await this.cacheStrategy().finalizeAndReturn();
    if (res.length) {
      return res;
    }

    delete this.isPersistent;
    await this.doPaginatedFetch();
    return this.cacheStrategy().finalizeAndReturn();
  }

  /**
   * Fetches the first page of items and merges it into the cached items while
   * the persistence flag is set and cached items exist, at most once per
   * `refreshIntervalMinutes`. Otherwise returns the result of the regular query.
   */
  private async doRefreshQuery(): Promise<ResultItem[]> {
    await this.loadPersistenceFlag();
    if (!this.isPersistent) {
      return this.doUniqueQuery(false);
    }

    const ns = this.getCacheNs();
    const key = buildCacheKey(this.getCacheKey(), 'is-refreshed');
    const isRefreshed = await packageCache.get<true>(ns, key);
    if (isRefreshed) {
      return this.doUniqueQuery(false);
    }

    const hasItems = await this.cacheStrategy().hasItems();
    if (!hasItems) {
      return this.doUniqueQuery(false);
    }
    await packageCache.set(ns, key, true, refreshIntervalMinutes);

    const queryResult = await this.doShrinkableQuery();
    await this.cacheStrategy().merge(this.transformNodes(queryResult.nodes));
    return this.cacheStrategy().finalizeAndReturn();
  }

  async loadPersistenceFlag(): Promise<void> {
    const ns = this.getCacheNs();
    const key = buildCacheKey(this.getCacheKey(), 'is-persistent');
    this.isPersistent = await packageCache.get<true>(ns, key);
  }

  async storePersistenceFlag(minutes: number): Promise<void> {
    const ns = this.getCacheNs();
    const key = buildCacheKey(this.getCacheKey(), 'is-persistent');
    await packageCache.set(ns, key, true, minutes);
  }

  /**
   * This method ensures the only one query is executed
   * to a particular package during single run,
   * separately for regular and refresh queries.
   */
  private doUniqueQuery(refresh: boolean): Promise<ResultItem[]> {
    const cacheKey = buildCacheKey(
      refresh ? 'github-pending-refresh' : 'github-pending',
      this.getCacheNs(),
      this.getCacheKey(),
    );
    let resultPromise = memCache.get<Promise<ResultItem[]>>(cacheKey);
    resultPromise ??= refresh ? this.doRefreshQuery() : this.doCachedQuery();
    memCache.set(cacheKey, resultPromise);
    return resultPromise;
  }

  async getItems(): Promise<ResultItem[]> {
    const res = await this.doUniqueQuery(this.refresh);
    return res;
  }
}
