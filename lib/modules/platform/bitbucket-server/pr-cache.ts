import { isNullOrUndefined, isPlainObject, isString } from '@sindresorhus/is';
import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { BitbucketServerHttp } from '../../../util/http/bitbucket-server.ts';
import { getQueryString } from '../../../util/url.ts';
import type { BbsPr, BbsPrCacheData, BbsRestPr } from './types.ts';
import { prInfo } from './utils.ts';

/* v8 ignore next */
function migrateBitbucketServerCache(platform: unknown): void {
  if (!isPlainObject(platform)) {
    return;
  }

  if (!isPlainObject(platform.bitbucketServer)) {
    return;
  }

  platform['bitbucket-server'] = platform.bitbucketServer;
  delete platform.bitbucketServer;
}

export class BbsPrCache {
  private cache: BbsPrCacheData;
  private items: BbsPr[] = [];
  private projectKey: string;
  private repo: string;
  private readonly ignorePrAuthor: boolean;
  private author: string | null;

  private constructor(
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string | null,
  ) {
    this.projectKey = projectKey;
    this.repo = repo;
    this.ignorePrAuthor = ignorePrAuthor;
    this.author = author;
    const repoCache = getCache();
    repoCache.platform ??= {};
    migrateBitbucketServerCache(repoCache.platform);
    repoCache.platform['bitbucket-server'] ??= {};
    let pullRequestCache = repoCache.platform['bitbucket-server']
      .pullRequestsCache as BbsPrCacheData;
    if (
      isNullOrUndefined(pullRequestCache) ||
      pullRequestCache.author !== author
    ) {
      pullRequestCache = {
        items: {},
        updatedDate: null,
        author,
      };
    }
    repoCache.platform['bitbucket-server'].pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
    this.updateItems();
  }

  private static async init(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string | null,
  ): Promise<BbsPrCache> {
    const res = new BbsPrCache(projectKey, repo, ignorePrAuthor, author);
    const isSynced = memCache.get<true | undefined>('bbs-pr-cache-synced');

    // v8 ignore next -- TODO: add test #40625
    if (!isSynced) {
      await res.sync(http);
      memCache.set('bbs-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): BbsPr[] {
    return this.items;
  }

  static async getPrs(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string,
  ): Promise<BbsPr[]> {
    const prCache = await BbsPrCache.init(
      http,
      projectKey,
      repo,
      ignorePrAuthor,
      author,
    );
    return prCache.getPrs();
  }

  private setPr(item: BbsPr): void {
    this.cache.items[item.number] = item;
    this.updateItems();
  }

  static async setPr(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string,
    item: BbsPr,
  ): Promise<void> {
    const prCache = await BbsPrCache.init(
      http,
      projectKey,
      repo,
      ignorePrAuthor,
      author,
    );
    prCache.setPr(item);
  }

  private reconcile(rawItems: BbsRestPr[]): boolean {
    logger.debug('reconciled');
    const { items } = this.cache;
    let { updatedDate } = this.cache;
    const cacheTime = updatedDate ? DateTime.fromMillis(updatedDate) : null;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      const id = rawItem.id;

      const newItem = prInfo(rawItem);

      const oldItem = items[id];
      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      items[id] = newItem;

      const itemTime = DateTime.fromMillis(rawItem.updatedDate);
      if (!cacheTime || itemTime > cacheTime) {
        updatedDate = rawItem.updatedDate;
      }
    }

    this.cache.updatedDate = updatedDate;

    return needNextPage;
  }

  private async sync(http: BitbucketServerHttp): Promise<BbsPrCache> {
    const searchParams: Record<string, string> = {
      state: 'ALL',
      limit: this.items.length ? '20' : '100',
    };
    if (!this.ignorePrAuthor && isString(this.author)) {
      searchParams['role.1'] = 'AUTHOR';
      searchParams['username.1'] = this.author;
    }
    let query: string | null = getQueryString(searchParams);

    while (query) {
      const res = await http.getJsonUnchecked<{
        nextPageStart: string;
        values: BbsRestPr[];
      }>(
        `./rest/api/1.0/projects/${this.projectKey}/repos/${this.repo}/pull-requests?${query}`,
        {
          memCache: false,
        },
      );

      const needNextPage = this.reconcile(res.body.values);
      if (!needNextPage) {
        break;
      }

      if (res.body.nextPageStart) {
        searchParams.start = res.body.nextPageStart.toString();
      } else {
        query = null;
      }
    }

    this.updateItems();

    return this;
  }

  /**
   * Ensure the pr cache starts with the most recent PRs.
   * JavaScript ensures that the cache is sorted by PR number.
   */
  private updateItems(): void {
    this.items = Object.values(this.cache.items).reverse();
  }
}
