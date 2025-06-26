import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { GitlabHttp } from '../../../util/http/gitlab';
import { getQueryString, parseLinkHeader, parseUrl } from '../../../util/url';
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

    let pullRequestCache = repoCache.platform.gitlab
      .pullRequestsCache as GitlabPrCacheData;
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

  private reconcile(rawItems: GitLabMergeRequest[]): boolean {
    const { items: oldItems } = this.cache;
    let { updated_at } = this.cache;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      const id = rawItem.iid;

      const oldItem = oldItems[id];
      const newItem = prInfo(rawItem);

      const itemNewTime = DateTime.fromISO(rawItem.updated_at);

      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      oldItems[id] = newItem;

      const cacheOldTime = updated_at ? DateTime.fromISO(updated_at) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_at = rawItem.updated_at;
      }
    }

    this.cache.updated_at = updated_at;
    return needNextPage;
  }

  private async sync(http: GitlabHttp): Promise<GitlabPrCache> {
    logger.debug('Syncing PR list');
    const searchParams = {
      per_page: this.items.length ? '20' : '100',
    } as Record<string, string>;
    if (!this.ignorePrAuthor) {
      searchParams.scope = 'created_by_me';
    }
    let query: string | null = getQueryString(searchParams);

    while (query) {
      const res = await http.getJsonUnchecked<GitLabMergeRequest[]>(
        `/projects/${this.repo}/merge_requests?${query}`,
        {
          memCache: false,
        },
      );

      const needNextPage = this.reconcile(res.body);
      if (!needNextPage) {
        break;
      }

      const uri = parseUrl(parseLinkHeader(res.headers.link)?.next?.url);
      query = uri ? uri.search : null;
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
