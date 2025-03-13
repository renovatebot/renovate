import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import { clone } from '../../../util/clone';
import type { GitlabHttp } from '../../../util/http/gitlab';
import { getQueryString } from '../../../util/url';
import type { GitLabMergeRequest, GitlabPr, GitlabPrCacheData } from './types';
import { prInfo } from './utils';

export class GitlabPrCache {
  private items: GitlabPr[] = [];
  private cache: GitlabPrCacheData;

  private constructor(
    private repo: string,
    author: string | null,
    private ignorePrAuthor: boolean,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.gitlab ??= {};

    let pullRequestCache = repoCache.platform.gitlab.pullRequestsCache as
      | GitlabPrCacheData
      | undefined;
    if (!pullRequestCache) {
      logger.debug('Initializing new PR cache at repository cache');
      pullRequestCache = {
        items: {},
        updated_at: null,
        author,
      };
    } else if (pullRequestCache.author !== author) {
      logger.debug('Resetting PR cache because authors do not match');
      pullRequestCache = {
        items: {},
        updated_at: null,
        author,
      };
    }
    repoCache.platform.gitlab.pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
    this.updateItems();
  }

  private static async init(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    ignorePrAuthor: boolean,
  ): Promise<GitlabPrCache> {
    const res = new GitlabPrCache(repo, author, ignorePrAuthor);
    const isSynced = memCache.get<true | undefined>('gitlab-pr-cache-synced');

    if (!isSynced) {
      await res.sync(http);
      memCache.set('gitlab-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): GitlabPr[] {
    return this.items;
  }

  static async getPrs(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    ignorePrAuthor: boolean,
  ): Promise<GitlabPr[]> {
    const prCache = await GitlabPrCache.init(
      http,
      repo,
      author,
      ignorePrAuthor,
    );
    return prCache.getPrs();
  }

  private setPr(pr: GitlabPr): void {
    logger.debug(`Adding PR #${pr.number} to the PR cache`);
    this.cache.items[pr.number] = pr;
    this.updateItems();
  }

  static async setPr(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    item: GitlabPr,
    ignorePrAuthor: boolean,
  ): Promise<void> {
    const prCache = await GitlabPrCache.init(
      http,
      repo,
      author,
      ignorePrAuthor,
    );
    prCache.setPr(item);
  }

  private reconcile(rawItems: GitLabMergeRequest[]): void {
    const { items: oldItems } = this.cache;
    let { updated_at } = this.cache;

    for (const rawItem of rawItems) {
      const id = rawItem.iid;

      const oldItem = oldItems[id];
      const newItem = prInfo(rawItem);

      const itemNewTime = DateTime.fromISO(rawItem.updated_at);

      if (!dequal(oldItem, newItem)) {
        oldItems[id] = newItem;
      }

      const cacheOldTime = updated_at ? DateTime.fromISO(updated_at) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_at = rawItem.updated_at;
      }
    }

    this.cache.updated_at = updated_at;
  }

  private async sync(http: GitlabHttp): Promise<GitlabPrCache> {
    logger.debug('Syncing PR list');
    const searchParams = {
      per_page: '100',
    } as any;
    if (!this.ignorePrAuthor) {
      searchParams.scope = 'created_by_me';
    }
    const query = getQueryString(searchParams);
    const url = `/projects/${this.repo}/merge_requests?${query}`;

    const res = await http.getJsonUnchecked<GitLabMergeRequest[]>(url, {
      paginate: true,
    });

    const items = res.body;
    logger.debug(`Fetched ${items.length} PRs to sync with cache`);
    const oldCache = clone(this.cache.items);

    this.reconcile(items);

    logger.debug(`Total PRs cached: ${Object.values(this.cache.items).length}`);
    logger.trace(
      {
        items,
        oldCache,
        newCache: this.cache.items,
      },
      `PR cache sync finished`,
    );

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
