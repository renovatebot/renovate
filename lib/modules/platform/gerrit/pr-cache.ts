import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { GerritHttp } from '../../../util/http/gerrit';
import type { Pr } from '../types';
import type { GerritChange } from './types';
import { REQUEST_DETAILS_FOR_PRS, mapGerritChangeToPr } from './utils';

export interface GerritPrCacheData {
  items: Record<number, Pr>;
  updatedDate: string | null;
}

export class GerritPrCache {
  private cache: GerritPrCacheData;
  private items: Pr[] = [];

  private constructor(
    private http: GerritHttp,
    private repository: string,
  ) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    (repoCache.platform as any).gerrit ??= {};
    let pullRequestCache = (repoCache.platform as any).gerrit
      .pullRequestsCache as GerritPrCacheData;
    if (!pullRequestCache) {
      pullRequestCache = {
        items: {},
        updatedDate: null,
      };
    }
    (repoCache.platform as any).gerrit.pullRequestsCache = pullRequestCache;
    this.cache = pullRequestCache;
    this.updateItems();
  }

  private static async init(
    http: GerritHttp,
    repository: string,
  ): Promise<GerritPrCache> {
    const res = new GerritPrCache(http, repository);
    const isSynced = memCache.get<true | undefined>('gerrit-pr-cache-synced');

    if (!isSynced) {
      await res.sync();
      memCache.set('gerrit-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): Pr[] {
    return this.items;
  }

  static async getPrs(http: GerritHttp, repository: string): Promise<Pr[]> {
    const prCache = await GerritPrCache.init(http, repository);
    return prCache.getPrs();
  }

  private setPr(item: Pr): void {
    this.cache.items[item.number] = item;
    this.updateItems();
  }

  static async setPr(
    http: GerritHttp,
    repository: string,
    item: Pr,
  ): Promise<void> {
    const prCache = await GerritPrCache.init(http, repository);
    prCache.setPr(item);
  }

  private reconcile(changes: GerritChange[]): boolean {
    logger.debug('reconciled');
    const { items } = this.cache;
    let { updatedDate } = this.cache;
    const cacheTime = updatedDate
      ? DateTime.fromISO(updatedDate.replace(' ', 'T'))
      : null;

    let needNextPage = true;

    for (const change of changes) {
      const id = change._number;

      const newItem = mapGerritChangeToPr(change);
      if (!newItem) {
        continue;
      }

      const oldItem = items[id];
      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      items[id] = newItem;

      const itemTime = DateTime.fromISO(change.created.replace(' ', 'T'));
      if (!cacheTime || itemTime > cacheTime) {
        updatedDate = change.created;
      }
    }

    this.cache.updatedDate = updatedDate;

    return needNextPage;
  }

  private async sync(forceRefresh = false): Promise<GerritPrCache> {
    if (forceRefresh) {
      // Clear the cache to force a full refresh
      this.cache.items = {};
      this.cache.updatedDate = null;
    }

    // Use pagination-like behavior similar to bitbucket-server
    // TODO: implement proper pagination when Gerrit supports it better
    const changes = await this.http.getJsonUnchecked<GerritChange[]>(
      `a/changes/?q=owner:self+project:${this.repository}+-is:wip+-is:private&no-limit&o=${REQUEST_DETAILS_FOR_PRS.join('&o=')}`,
    );

    this.reconcile(changes.body);
    this.updateItems();

    return this;
  }

  static async forceRefresh(
    http: GerritHttp,
    repository: string,
  ): Promise<void> {
    memCache.set('gerrit-pr-cache-synced', undefined);
    const prCache = await GerritPrCache.init(http, repository);
    await prCache.sync(true);
  }

  /**
   * Ensure the pr cache starts with the most recent PRs.
   * JavaScript ensures that the cache is sorted by PR number.
   */
  private updateItems(): void {
    this.items = Object.values(this.cache.items).reverse();
  }
}

// Only used in tests
export function reset(): void {
  const repoCache = getCache();
  const platform = repoCache.platform as any;
  if (platform?.gerrit) {
    platform.gerrit.pullRequestsCache = {
      items: {},
      updatedDate: null,
    };
  }
  memCache.set('gerrit-pr-cache-synced', undefined);
}
