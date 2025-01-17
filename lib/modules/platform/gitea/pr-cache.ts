import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { GiteaHttp } from '../../../util/http/gitea';
import type { HttpResponse } from '../../../util/http/types';
import { getQueryString, parseLinkHeader } from '../../../util/url';
import type { Pr } from '../types';
import type { GiteaPrCacheData, PR } from './types';
import { API_PATH, toRenovatePR } from './utils';

export class GiteaPrCache {
  private cache: GiteaPrCacheData;
  private items: Pr[] = [];

  private constructor(
    private repo: string,
    private author: string | null,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.gitea ??= {};
    let pullRequestCache = repoCache.platform.gitea.pullRequestsCache as
      | GiteaPrCacheData
      | undefined;
    if (!pullRequestCache || pullRequestCache.author !== author) {
      pullRequestCache = {
        items: {},
        updated_at: null,
        author,
      };
    }
    repoCache.platform.gitea.pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
    this.updateItems();
  }

  static forceSync(): void {
    memCache.set('gitea-pr-cache-synced', false);
  }

  private static async init(
    http: GiteaHttp,
    repo: string,
    author: string | null,
  ): Promise<GiteaPrCache> {
    const res = new GiteaPrCache(repo, author);
    const isSynced = memCache.get<true | undefined>('gitea-pr-cache-synced');

    if (!isSynced) {
      await res.sync(http);
      memCache.set('gitea-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): Pr[] {
    return this.items;
  }

  static async getPrs(
    http: GiteaHttp,
    repo: string,
    author: string,
  ): Promise<Pr[]> {
    const prCache = await GiteaPrCache.init(http, repo, author);
    return prCache.getPrs();
  }

  private setPr(item: Pr): void {
    this.cache.items[item.number] = item;
    this.updateItems();
  }

  static async setPr(
    http: GiteaHttp,
    repo: string,
    author: string,
    item: Pr,
  ): Promise<void> {
    const prCache = await GiteaPrCache.init(http, repo, author);
    prCache.setPr(item);
  }

  private reconcile(rawItems: (PR | null)[]): boolean {
    const { items } = this.cache;
    let { updated_at } = this.cache;
    const cacheTime = updated_at ? DateTime.fromISO(updated_at) : null;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      if (!rawItem) {
        logger.warn('Gitea PR is empty, throwing temporary error');
        // Gitea API sometimes returns empty PRs, so we throw a temporary error
        // https://github.com/go-gitea/gitea/blob/fcd096231ac2deaefbca10a7db1b9b01f1da93d7/services/convert/pull.go#L34-L52
        throw new Error(TEMPORARY_ERROR);
      }
      const id = rawItem.number;

      const newItem = toRenovatePR(rawItem, this.author);
      if (!newItem) {
        continue;
      }

      const oldItem = items[id];
      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      items[id] = newItem;

      const itemTime = DateTime.fromISO(rawItem.updated_at);
      if (!cacheTime || itemTime > cacheTime) {
        updated_at = rawItem.updated_at;
      }
    }

    this.cache.updated_at = updated_at;

    return needNextPage;
  }

  private async sync(http: GiteaHttp): Promise<GiteaPrCache> {
    const query = getQueryString({
      state: 'all',
      sort: 'recentupdate',
    });

    let url: string | undefined =
      `${API_PATH}/repos/${this.repo}/pulls?${query}`;

    while (url) {
      // TODO: use zod, typescript can't infer the type of the response #22198
      const res: HttpResponse<(PR | null)[]> = await http.getJsonUnchecked(
        url,
        {
          memCache: false,
          paginate: false,
        },
      );

      const needNextPage = this.reconcile(res.body);
      if (!needNextPage) {
        break;
      }

      url = parseLinkHeader(res.headers.link)?.next?.url;
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
