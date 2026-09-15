import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { clone } from '../../../util/clone.ts';
import type { BitbucketHttp } from '../../../util/http/bitbucket.ts';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';
import type { Pr } from '../types.ts';
import { PlatformPrCache } from '../utils/pr-cache.ts';
import type { BitbucketPrCacheData, PagedResult, PrResponse } from './types.ts';
import { prFieldsFilter, prInfo, prStates } from './utils.ts';

export class BitbucketPrCache extends PlatformPrCache<
  Pr,
  BitbucketPrCacheData
> {
  private http: BitbucketHttp;
  private repo: string;
  private author: string | null;

  private constructor(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
  ) {
    super({
      platform: 'bitbucket',
      author,
      createCache: () => ({ items: {}, updated_on: null, author }),
    });
    this.http = http;
    this.repo = repo;
    this.author = author;
  }

  private static async init(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
  ): Promise<BitbucketPrCache> {
    const res = new BitbucketPrCache(http, repo, author);
    await res.ensureSynced();
    return res;
  }

  static async getPrs(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
  ): Promise<Pr[]> {
    const prCache = await BitbucketPrCache.init(http, repo, author);
    return prCache.getPrs();
  }

  static async setPr(
    http: BitbucketHttp,
    repo: string,
    author: string | null,
    item: Pr,
  ): Promise<void> {
    const prCache = await BitbucketPrCache.init(http, repo, author);
    prCache.setPr(item);
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
      // v8 ignore else -- TODO: add test #40625
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

  protected override async sync(): Promise<void> {
    logger.debug('Syncing PR list');
    const url = this.getUrl();
    const opts = {
      paginate: true,
      pagelen: 50,
      cacheProvider: repoCacheProvider,
    };
    const res = await this.http.getJsonUnchecked<PagedResult<PrResponse>>(
      url,
      opts,
    );

    const items = res.body.values;
    logger.debug(`Fetched ${items.length} PRs to sync with cache`);
    const oldCache = clone(this.cache.items);

    this.reconcile(items);

    logger.debug(`Total PRs cached: ${Object.values(this.cache.items).length}`);
    logger.trace(
      {
        items,
        oldCache,
        newCache: this.cache.items,
      },
      `PR cache sync finished`,
    );

    this.updateItems();
  }
}
