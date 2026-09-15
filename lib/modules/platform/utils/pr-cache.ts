import { isNullOrUndefined } from '@sindresorhus/is';
import type { PlatformId } from '../../../constants/platforms.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { BasePrCacheData, PrCacheOptions } from './types.ts';

export function prCacheSyncedKey(platform: PlatformId): string {
  return `${platform}-pr-cache-synced`;
}

/**
 * The PRs of a single repository, backed by the repository cache. Subclasses only provide the platform-specific `sync()`, which fetches the PRs changed since the last run and writes them into `this.cache.items`.
 */
export abstract class PlatformPrCache<
  TPr extends { number: number },
  TData extends BasePrCacheData<TPr>,
> {
  protected readonly cache: TData;
  protected items: TPr[] = [];
  private readonly syncedKey: string;

  protected constructor({
    platform,
    author,
    createCache,
    isOutdated,
  }: PrCacheOptions<TData>) {
    this.syncedKey = prCacheSyncedKey(platform);

    const repoCache = getCache();
    repoCache.platform ??= {};
    const platformCache = (repoCache.platform[platform] ??= {});

    let prCache = platformCache.pullRequestsCache as TData | undefined;
    if (isNullOrUndefined(prCache)) {
      logger.debug('Initializing new PR cache at repository cache');
      prCache = createCache();
    } else if (prCache.author !== author) {
      logger.debug('Resetting PR cache because authors do not match');
      prCache = createCache();
    } else if (isOutdated?.(prCache)) {
      logger.debug('Resetting PR cache of older format');
      prCache = createCache();
    }

    platformCache.pullRequestsCache = prCache;
    this.cache = prCache;
    this.updateItems();
  }

  /**
   * Fetch the PRs which changed since the last sync and reconcile them into the cache.
   */
  protected abstract sync(): Promise<void>;

  /**
   * Sync at most once per run, because the repository cache only goes stale between runs.
   */
  async ensureSynced(): Promise<void> {
    const isSynced = memCache.get<true | undefined>(this.syncedKey);
    if (isSynced) {
      return;
    }

    await this.sync();
    memCache.set(this.syncedKey, true);
  }

  getPrs(): TPr[] {
    return this.items;
  }

  setPr(pr: TPr): void {
    logger.debug(`Adding PR #${pr.number} to the PR cache`);
    this.cache.items[pr.number] = pr;
    this.updateItems();
  }

  /**
   * Ensure the pr cache starts with the most recent PRs.
   * JavaScript ensures that the cache is sorted by PR number.
   */
  protected updateItems(): void {
    this.items = Object.values(this.cache.items).reverse();
  }
}
