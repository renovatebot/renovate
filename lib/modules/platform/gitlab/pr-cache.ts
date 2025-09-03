import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider';
import type { GitlabHttp, GitlabHttpOptions } from '../../../util/http/gitlab';
import { regEx } from '../../../util/regex';
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
    } else if (pullRequestCache.updated_at?.match(regEx(/\.\d\d\dZ$/))) {
      logger.debug('Resetting PR cache of older format');
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

  private async sync(http: GitlabHttp): Promise<GitlabPrCache> {
    logger.debug('Syncing PR list');

    const searchParams: Record<string, string> = {
      per_page: '100',
      order_by: 'updated_at',
      sort: 'desc',
    };

    const opts: GitlabHttpOptions = { paginate: true };

    const updated_after = this.cache.updated_at;
    if (updated_after) {
      opts.cacheProvider = repoCacheProvider;
      searchParams.updated_after = updated_after;
    }

    if (!this.ignorePrAuthor) {
      searchParams.scope = 'created_by_me';
    }

    const query: string | null = getQueryString(searchParams);
    const { body: items } = await http.getJsonUnchecked<GitLabMergeRequest[]>(
      `/projects/${this.repo}/merge_requests?${query}`,
      opts,
    );

    if (items.length) {
      for (const item of items) {
        const id = item.iid;
        this.cache.items[id] = prInfo(item);
      }

      const [{ updated_at }] = items;
      this.cache.updated_at = updated_at.replace(regEx(/\.\d\d\dZ$/), 'Z');
    }

    this.updateItems();

    return this;
  }

  /**
   * Ensure the pr cache starts with the most recent PRs.
   */
  private updateItems(): void {
    this.items = Object.values(this.cache.items).sort(
      (a, b) => b.number - a.number,
    );
  }
}
