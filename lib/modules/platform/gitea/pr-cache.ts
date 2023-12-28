import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { getCache } from '../../../util/cache/repository';
import type { GiteaHttp } from '../../../util/http/gitea';
import type { HttpResponse } from '../../../util/http/types';
import { getQueryString, parseLinkHeader } from '../../../util/url';
import type { GiteaPrCacheData, PR } from './types';
import { API_PATH } from './utils';

export class GiteaPrCache {
  private cache: GiteaPrCacheData;

  private constructor(private repo: string) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.gitea ??= {};
    repoCache.platform.gitea.pullRequestsCache ??= {
      items: {},
      updated_at: null,
    };
    this.cache = repoCache.platform.gitea.pullRequestsCache;
  }

  static init(repo: string): GiteaPrCache {
    return new GiteaPrCache(repo);
  }

  getPrs(): PR[] {
    return Object.values(this.cache.items);
  }

  addPr(item: PR): void {
    this.cache.items[item.number] = item;
  }

  private reconcile(newItems: PR[]): boolean {
    const { items } = this.cache;
    let { updated_at } = this.cache;

    let needNextPage = true;

    for (const newItem of newItems) {
      const number = newItem.number;
      const oldItem = items[number];

      const itemNewTime = DateTime.fromISO(newItem.updated_at);
      const itemOldTime = oldItem?.updated_at
        ? DateTime.fromISO(oldItem.updated_at)
        : null;

      if (!dequal(oldItem, newItem)) {
        items[number] = newItem;
      }

      needNextPage = itemOldTime ? itemOldTime < itemNewTime : true;

      const cacheOldTime = updated_at ? DateTime.fromISO(updated_at) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_at = newItem.updated_at;
      }
    }

    this.cache.updated_at = updated_at;

    return needNextPage;
  }

  async sync(http: GiteaHttp): Promise<GiteaPrCache> {
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
