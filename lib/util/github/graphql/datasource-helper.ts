import AggregateError from 'aggregate-error';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as memCache from '../../cache/memory';
import type {
  GithubGraphqlResponse,
  GithubHttp,
  GithubHttpOptions,
} from '../../http/github';
import type { HttpResponse } from '../../http/types';
import { getApiBaseUrl } from '../url';
import type {
  GithubDatasourceItem,
  GithubGraphqlDatasourceAdapter,
  GithubGraphqlPayload,
  GithubGraphqlRepoParams,
  GithubGraphqlRepoResponse,
  GithubPackageConfig,
  RawQueryResponse,
} from './types';

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
  const errors: Error[] = err instanceof AggregateError ? [...err] : [err];
  return errors.some(
    (e) => err instanceof ExternalHostError || isUnknownGraphqlError(e)
  );
}

export class GithubGraphqlDatasourceHelper<
  GraphqlItem,
  ResultItem extends GithubDatasourceItem
> {
  static prepareQuery(payloadQuery: string): string {
    return `
      query($owner: String!, $name: String!, $cursor: String, $count: Int!) {
        repository(owner: $owner, name: $name) {
          isRepoPrivate: isPrivate
          payload: ${payloadQuery}
        }
      }
    `;
  }

  static async query<T, U extends GithubDatasourceItem>(
    config: GithubPackageConfig,
    http: GithubHttp,
    adapter: GithubGraphqlDatasourceAdapter<T, U>
  ): Promise<U[]> {
    const instance = new GithubGraphqlDatasourceHelper<T, U>(
      config,
      http,
      adapter
    );
    const items = await instance.getItems();
    return items;
  }

  private readonly baseUrl: string;
  private readonly repoOwner: string;
  private readonly repoName: string;

  private itemsPerQuery: 100 | 50 | 25 = 100;

  private queryCount = 0;

  private cursor: string | null = null;

  constructor(
    packageConfig: GithubPackageConfig,
    private http: GithubHttp,
    private datasourceAdapter: GithubGraphqlDatasourceAdapter<
      GraphqlItem,
      ResultItem
    >
  ) {
    const { packageName, registryUrl } = packageConfig;
    [this.repoOwner, this.repoName] = packageName.split('/');
    this.baseUrl = getApiBaseUrl(registryUrl).replace(/\/v3\/$/, '/'); // Replace for GHE
  }

  private getFingerprint(): string {
    return [
      this.baseUrl,
      this.repoOwner,
      this.repoName,
      this.datasourceAdapter.key,
    ].join(':');
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
      } else {
        const errorInstances = errors.map(({ message }) => new Error(message));
        const err = new AggregateError(errorInstances);
        return [null, err];
      }
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

    const isRepoPrivate = data.repository.isRepoPrivate;
    const res = { ...data.repository.payload, isRepoPrivate };
    return [res, null];
  }

  private shrinkPageSize(): boolean {
    if (this.itemsPerQuery === 100) {
      this.itemsPerQuery = 50;
      return true;
    }

    if (this.itemsPerQuery === 50) {
      this.itemsPerQuery = 25;
      return true;
    }

    return false;
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
        const { body, ...options } = this.getRawQueryOptions();
        logger.debug(
          { options, newSize: this.itemsPerQuery },
          'Shrinking GitHub GraphQL page size after error'
        );
      }
    }

    return res;
  }

  private async doPaginatedQuery(): Promise<ResultItem[]> {
    const resultItems: ResultItem[] = [];

    let hasNextPage: boolean | undefined = true;
    let cursor: string | undefined;
    while (hasNextPage && !this.hasReachedQueryLimit()) {
      const queryResult = await this.doShrinkableQuery();

      const pageResultItems = queryResult.nodes
        .map((item) => this.datasourceAdapter.transform(item))
        .filter((item): item is ResultItem => item !== null);

      resultItems.push(...pageResultItems);

      hasNextPage = queryResult?.pageInfo?.hasNextPage;
      cursor = queryResult?.pageInfo?.endCursor;
      if (hasNextPage && cursor) {
        this.cursor = cursor;
      }
    }

    return resultItems;
  }

  /**
   * This method intentionally was made not async, though it returns `Promise`.
   *
   * It helps us to avoid potential race conditions during concurrent fetching
   * of the same package releases.
   */
  private doConcurrentQuery(): Promise<ResultItem[]> {
    const packageFingerprint = this.getFingerprint();
    const cacheKey = `github-datasource-promises:${packageFingerprint}`;
    const resultPromise =
      memCache.get<Promise<ResultItem[]>>(cacheKey) ?? this.doPaginatedQuery();
    memCache.set(cacheKey, resultPromise);
    return resultPromise;
  }

  private async getItems(): Promise<ResultItem[]> {
    const res = await this.doConcurrentQuery();
    return res;
  }
}
