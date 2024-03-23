import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { BitbucketHttp } from '../../../util/http/bitbucket';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider';
import type { Pr } from '../types';
import type { BitbucketPrCacheData, PagedResult, PrResponse } from './types';
import { prFieldsFilter, prInfo, prStates } from './utils';

export class BitbucketPrCache {
  private cache: BitbucketPrCacheData;

  private constructor(
    private repo: string,
    private author: string | null,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    repoCache.platform.bitbucket ??= {};

    let pullRequestCache = repoCache.platform.bitbucket.pullRequestsCache as
      | BitbucketPrCacheData
      | undefined;
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

  private static async init(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
  ): Promise<BitbucketPrCache> {
    const res = new BitbucketPrCache(repo, author);
    const isSynced = memCache.get<true | undefined>(
      'bitbucket-pr-cache-synced',
    );

    if (!isSynced) {
      await res.sync(http);
      memCache.set('bitbucket-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): Pr[] {
    return Object.values(this.cache.items);
  }

  static async getPrs(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
  ): Promise<Pr[]> {
    const prCache = await BitbucketPrCache.init(http, repo, author);
    return prCache.getPrs();
  }

  private addPr(pr: Pr): void {
    this.cache.items[pr.number] = pr;
  }

  static async addPr(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
    item: Pr,
  ): Promise<void> {
    const prCache = await BitbucketPrCache.init(http, repo, author);
    prCache.addPr(item);
  }

  private reconcile(rawItems: PrResponse[]): void {
    const { items: oldItems } = this.cache;
    let { updated_on } = this.cache;

    for (const rawItem of rawItems) {
      const id = rawItem.id;

      const oldItem = oldItems[id];
      const newItem = prInfo(rawItem);

      const itemNewTime = DateTime.fromISO(rawItem.updated_on);

      if (!dequal(oldItem, newItem)) {
        oldItems[id] = newItem;
      }

      const cacheOldTime = updated_on ? DateTime.fromISO(updated_on) : null;
      if (!cacheOldTime || itemNewTime > cacheOldTime) {
        updated_on = rawItem.updated_on;
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

  private async sync(http: BitbucketHttp): Promise<BitbucketPrCache> {
    logger.debug('Syncing PR list');
    const url = this.getUrl();
    const opts = {
      paginate: true,
      pagelen: 50,
      cacheProvider: repoCacheProvider,
    };
    const res = await http.getJson<PagedResult<PrResponse>>(url, opts);
    this.reconcile(res.body.values);
    return this;
  }
}
