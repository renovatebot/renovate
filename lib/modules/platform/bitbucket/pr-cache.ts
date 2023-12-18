import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { getCache } from '../../../util/cache/repository';
import type { BitbucketHttp } from '../../../util/http/bitbucket';
import type { BitbucketPrCacheData, PagedResult, PrResponse } from './types';
import { prFieldsFilter, prStates } from './utils';

export class BitbucketPrCache {
  private cache: BitbucketPrCacheData;

  private constructor(
    private repo: string,
    private author: string | null,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.bitbucket ??= {};

    let pullRequestCache: BitbucketPrCacheData | undefined =
      repoCache.platform.bitbucket.pullRequestsCache;
    if (!pullRequestCache || pullRequestCache.author !== author) {
      pullRequestCache = {
        items: {},
        updated_on: null,
        author,
      };
    }
    repoCache.platform.bitbucket.pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
  }

  static init(repo: string, author: string | null): BitbucketPrCache {
    return new BitbucketPrCache(repo, author);
  }

  getPrs(): PrResponse[] {
    return Object.values(this.cache.items);
  }

  addPr(item: PrResponse): void {
    this.cache.items[item.id] = item;
  }

  private reconcile(newItems: PrResponse[]): void {
    const { items: oldItems } = this.cache;
    let { updated_on } = this.cache;

    for (const newItem of newItems) {
      const itemId = newItem.id;
      const oldItem = oldItems[itemId];

      const itemNewTime = DateTime.fromISO(newItem.updated_on);

      if (!dequal(oldItem, newItem)) {
        oldItems[itemId] = newItem;
      }

      const cacheOldTime = updated_on ? DateTime.fromISO(updated_on) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_on = newItem.updated_on;
      }
    }

    this.cache.updated_on = updated_on;
  }

  private getUrl(): string {
    const params = new URLSearchParams();

    for (const state of prStates.all) {
      params.append('state', state);
    }

    params.append('fields', prFieldsFilter);

    const q: string[] = [];
    if (this.author) {
      q.push(`author.uuid = "${this.author}"`);
    }
    if (this.cache.updated_on) {
      q.push(`updated_on > "${this.cache.updated_on}"`);
    }
    params.append('q', q.join(' AND '));

    const query = params.toString();
    return `/2.0/repositories/${this.repo}/pullrequests?${query}`;
  }

  async sync(http: BitbucketHttp): Promise<BitbucketPrCache> {
    const url = this.getUrl();
    const opts = { paginate: true, pagelen: 50 };
    const res = await http.getJson<PagedResult<PrResponse>>(url, opts);
    this.reconcile(res.body.values);
    return this;
  }
}
