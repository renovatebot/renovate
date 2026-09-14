import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import {
  getQueryString,
  parseLinkHeader,
  parseUrl,
} from '../../../util/url.ts';
import type { Pr } from '../types.ts';
import { PlatformPrCache, prCacheSyncedKey } from '../utils/pr-cache.ts';
import type { PR } from './schema.ts';
import { PRList } from './schema.ts';
import type { GiteaLikeHttp, GiteaPlatformKey, PrCacheData } from './types.ts';
import { API_PATH, toRenovatePR } from './utils.ts';

interface RepoPrCacheOptions {
  repo: string;
  ignorePrAuthor: boolean;
  author: string;
}

/**
 * The PRs of a single repository, backed by the repository cache.
 */
class RepoPrCache extends PlatformPrCache<Pr, PrCacheData> {
  private readonly http: GiteaLikeHttp;
  private readonly platform: GiteaPlatformKey;
  private readonly repo: string;
  private readonly ignorePrAuthor: boolean;
  private readonly author: string;

  constructor(
    http: GiteaLikeHttp,
    platform: GiteaPlatformKey,
    { repo, ignorePrAuthor, author }: RepoPrCacheOptions,
  ) {
    super({
      platform,
      author,
      createCache: () => ({ items: {}, updated_at: null, author }),
    });
    this.http = http;
    this.platform = platform;
    this.repo = repo;
    this.ignorePrAuthor = ignorePrAuthor;
    this.author = author;
  }

  private reconcile(rawItems: (PR | null)[]): boolean {
    const { items } = this.cache;
    let { updated_at } = this.cache;
    const cacheTime = updated_at ? DateTime.fromISO(updated_at) : null;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      if (!rawItem) {
        logger.warn(
          { platform: this.platform },
          'PR is empty, throwing temporary error',
        );
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

  protected override async sync(): Promise<void> {
    let query: string | null = getQueryString({
      state: 'all',
      sort: 'recentupdate',
      // Fetch 100 PRs on the first run to ensure we have the most recent PRs.
      // Gitea / Forgejo will cap appropriate (50 by default, see `MAX_RESPONSE_ITEMS`).
      // https://docs.gitea.com/administration/config-cheat-sheet#api-api
      // https://forgejo.org/docs/latest/admin/config-cheat-sheet/#api-api
      limit: this.items.length ? 20 : 100,
      // Supported since Gitea 1.23.0 and Forgejo v10.0.0.
      // Will be ignored by older instances.
      ...(this.ignorePrAuthor ? {} : { poster: this.author }),
    });

    while (query) {
      const res = await this.http.getJson(
        `${API_PATH}/repos/${this.repo}/pulls?${query}`,
        {
          memCache: false,
          paginate: false,
        },
        PRList,
      );

      const needNextPage = this.reconcile(res.body);
      if (!needNextPage) {
        break;
      }

      const uri = parseUrl(parseLinkHeader(res.headers.link)?.next?.url);
      query = uri ? uri.search : null;
    }

    this.updateItems();
  }
}

/**
 * PR cache of one platform. `initRepo()` records the repository, the
 * repository cache itself is bound on first use because it is initialized
 * after `platform.initRepo()`.
 */
export class GiteaPrCache {
  private readonly http: GiteaLikeHttp;
  private readonly platform: GiteaPlatformKey;
  private repoOptions: RepoPrCacheOptions | null = null;
  private repoCache: RepoPrCache | null = null;

  constructor(http: GiteaLikeHttp, platform: GiteaPlatformKey) {
    this.http = http;
    this.platform = platform;
  }

  initRepo(repo: string, ignorePrAuthor: boolean, author: string): void {
    this.repoOptions = { repo, ignorePrAuthor, author };
    this.repoCache = null;
  }

  reset(): void {
    this.repoOptions = null;
    this.repoCache = null;
  }

  forceSync(): void {
    memCache.set(prCacheSyncedKey(this.platform), false);
  }

  private async open(): Promise<RepoPrCache> {
    if (!this.repoOptions) {
      throw new Error('PR cache used before initRepo()');
    }
    this.repoCache ??= new RepoPrCache(
      this.http,
      this.platform,
      this.repoOptions,
    );
    await this.repoCache.ensureSynced();
    return this.repoCache;
  }

  async getPrs(): Promise<Pr[]> {
    const repoCache = await this.open();
    return repoCache.getPrs();
  }

  async setPr(item: Pr): Promise<void> {
    const repoCache = await this.open();
    repoCache.setPr(item);
  }
}
