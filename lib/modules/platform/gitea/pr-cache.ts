import { dequal } from 'dequal';
import { DateTime } from 'luxon';
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
    return Object.values(this.cache.items);
  }

  static async getPrs(
    http: GiteaHttp,
    repo: string,
    author: string,
  ): Promise<Pr[]> {
    const prCache = await GiteaPrCache.init(http, repo, author);
    return prCache.getPrs();
  }

  private addPr(item: Pr): void {
    this.cache.items[item.number] = item;
  }

  static async addPr(
    http: GiteaHttp,
    repo: string,
    author: string,
    item: Pr,
  ): Promise<void> {
    const prCache = await GiteaPrCache.init(http, repo, author);
    prCache.addPr(item);
  }

  private reconcile(rawItems: PR[]): boolean {
    const { items } = this.cache;
    let { updated_at } = this.cache;
    const cacheTime = updated_at ? DateTime.fromISO(updated_at) : null;

    let needNextPage = true;

    for (const rawItem of rawItems) {
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
      const res: HttpResponse<PR[]> = await http.getJson<PR[]>(url, {
        memCache: false,
        paginate: false,
      });

      const needNextPage = this.reconcile(res.body);
      if (!needNextPage) {
        break;
      }

      url = parseLinkHeader(res.headers.link)?.next?.url;
    }

    return this;
  }
}
