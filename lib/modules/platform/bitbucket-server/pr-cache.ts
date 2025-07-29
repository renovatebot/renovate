import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { BitbucketServerHttp } from '../../../util/http/bitbucket-server';
import { getQueryString } from '../../../util/url';
import type { BbsPr, BbsPrCacheData, BbsRestPr } from './types';
import { prInfo } from './utils';

export class BbsPrCache {
  private cache: BbsPrCacheData;
  private items: BbsPr[] = [];

  private constructor(
    private projectKey: string,
    private repo: string,
    private readonly ignorePrAuthor: boolean,
    private author: string | null,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.bitbucketServer ??= {};
    let pullRequestCache = repoCache.platform.bitbucketServer
      .pullRequestsCache as BbsPrCacheData;
    if (!pullRequestCache || pullRequestCache.author !== author) {
      pullRequestCache = {
        items: {},
        updatedDate: null,
        author,
      };
    }
    repoCache.platform.bitbucketServer.pullRequestsCache = pullRequestCache;
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
    if (!this.ignorePrAuthor && is.string(this.author)) {
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
