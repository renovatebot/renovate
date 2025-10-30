import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { getCache } from '../../../util/cache/repository';
import type { Pr } from '../types';
import { client } from './client';
import type { GerritChange } from './types';
import { REQUEST_DETAILS_FOR_PRS, mapGerritChangeToPr } from './utils';

/**
 * Page size for initial cache population (when cache is empty).
 */
const INITIAL_SYNC_PAGE_SIZE = 100;

/**
 * Page size for incremental cache updates (when cache exists).
 */
const INCREMENTAL_PAGE_SIZE = 20;

export interface GerritPrCacheData {
  items: Record<number, Pr>;
  updatedDate: string | null;
}

interface GerritPlatformCache {
  gerrit?: {
    pullRequestsCache?: GerritPrCacheData;
  };
}

/**
 * Smart cache for Gerrit pull requests (changes).
 * Uses the Gerrit API's sorting by update time to efficiently sync changes.
 * Only fetches changes until we encounter ones that match our cache.
 */
export class GerritPrCache {
  private cache: GerritPrCacheData;
  private items: Pr[] = [];

  private constructor(private repository: string) {
    const repoCache = getCache();
    repoCache.platform ??= {};
    const platformCache = repoCache.platform as GerritPlatformCache;
    platformCache.gerrit ??= {};
    platformCache.gerrit.pullRequestsCache ??= {
      items: {},
      updatedDate: null,
    };
    this.cache = platformCache.gerrit.pullRequestsCache;
    this.updateItems();
  }

  private static async init(repository: string): Promise<GerritPrCache> {
    const res = new GerritPrCache(repository);
    const isSynced = memCache.get<true | undefined>('gerrit-pr-cache-synced');

    if (!isSynced) {
      await res.sync();
      memCache.set('gerrit-pr-cache-synced', true);
    }

    return res;
  }

  private getPrs(): Pr[] {
    logger.trace(`Returning ${this.items.length} PRs from cache`);
    return this.items;
  }

  static async getPrs(repository: string): Promise<Pr[]> {
    const prCache = await GerritPrCache.init(repository);
    return prCache.getPrs();
  }

  private setPr(item: Pr): void {
    logger.trace(`Updating PR ${item.number} in cache`);
    this.cache.items[item.number] = item;
    this.updateItems();
  }

  static async setPr(repository: string, item: Pr): Promise<void> {
    const prCache = await GerritPrCache.init(repository);
    prCache.setPr(item);
  }

  /**
   * Reconciles a page of changes with the cache.
   * Gerrit API returns changes sorted by last update time (most recent first).
   * If we encounter a change that matches our cache, we can stop fetching more pages.
   *
   * @param changes - Page of changes from Gerrit API (sorted newest first)
   * @returns true if more pages should be fetched, false to stop pagination
   */
  private reconcile(changes: GerritChange[]): boolean {
    const { items } = this.cache;
    let { updatedDate } = this.cache;
    const cacheTime = updatedDate
      ? DateTime.fromISO(updatedDate.replace(' ', 'T'))
      : null;

    let changeCount = 0;

    for (const change of changes) {
      const id = change._number;

      const newItem = mapGerritChangeToPr(change);
      if (!newItem) {
        continue;
      }

      const oldItem = items[id];
      if (dequal(oldItem, newItem)) {
        // Found unchanged item - cache is up to date, stop fetching more pages
        logger.debug(
          `Reconciled ${changeCount} changes before hitting cached item ${id}`,
        );
        return false;
      }

      items[id] = newItem;
      changeCount++;

      const itemTime = DateTime.fromISO(change.updated.replace(' ', 'T'));
      if (!cacheTime || itemTime > cacheTime) {
        updatedDate = change.updated;
      }
    }

    this.cache.updatedDate = updatedDate;

    logger.debug(`Reconciled ${changeCount} changes, fetching next page`);
    return true;
  }

  private async sync(forceRefresh = false): Promise<GerritPrCache> {
    if (forceRefresh) {
      logger.debug('Force refreshing Gerrit PR cache');
      this.cache.items = {};
      this.cache.updatedDate = null;
    } else {
      logger.debug('Syncing Gerrit PR cache');
    }

    // Determine page size based on whether cache exists
    const pageLimit = this.items.length
      ? INCREMENTAL_PAGE_SIZE
      : INITIAL_SYNC_PAGE_SIZE;

    // Use client.findChanges with pagination and early termination via reconcile.
    // Gerrit API returns changes sorted by update time (newest first),
    // so we can stop fetching once we hit cached items.
    await client.findChanges(this.repository, {
      branchName: '',
      state: 'all',
      pageLimit,
      requestDetails: REQUEST_DETAILS_FOR_PRS,
      shouldFetchNextPage: (changes: GerritChange[]) => {
        // reconcile returns true if we need the next page
        return this.reconcile(changes);
      },
    });

    this.updateItems();

    logger.debug(`Synced ${this.items.length} changes to cache`);
    return this;
  }

  static async forceRefresh(repository: string): Promise<void> {
    memCache.set('gerrit-pr-cache-synced', undefined);
    const prCache = await GerritPrCache.init(repository);
    await prCache.sync(true);
  }

  /**
   * Converts the cache items map to an array.
   */
  private updateItems(): void {
    this.items = Object.values(this.cache.items);
  }
}
