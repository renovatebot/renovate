import { isPlainObject, isString } from '@sindresorhus/is';
import { dequal } from 'dequal';
import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { BitbucketServerHttp } from '../../../util/http/bitbucket-server.ts';
import { getQueryString } from '../../../util/url.ts';
import { PlatformPrCache } from '../utils/pr-cache.ts';
import type { BbsPr, BbsPrCacheData, BbsRestPr } from './types.ts';
import { prInfo } from './utils.ts';

/* v8 ignore next -- one-off cache-schema migration shim, only runs against real legacy repo caches */
function migrateBitbucketServerCache(platform: unknown): void {
  if (!isPlainObject(platform)) {
    return;
  }

  if (!isPlainObject(platform.bitbucketServer)) {
    return;
  }

  platform['bitbucket-server'] = platform.bitbucketServer;
  delete platform.bitbucketServer;
}

export class BbsPrCache extends PlatformPrCache<BbsPr, BbsPrCacheData> {
  private http: BitbucketServerHttp;
  private projectKey: string;
  private repo: string;
  private readonly ignorePrAuthor: boolean;
  private author: string | null;

  private constructor(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string | null,
  ) {
    super({
      platform: 'bitbucket-server',
      author,
      createCache: () => ({ items: {}, updatedDate: null, author }),
    });
    this.http = http;
    this.projectKey = projectKey;
    this.repo = repo;
    this.ignorePrAuthor = ignorePrAuthor;
    this.author = author;
  }

  private static async init(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string | null,
  ): Promise<BbsPrCache> {
    migrateBitbucketServerCache(getCache().platform);
    const res = new BbsPrCache(http, projectKey, repo, ignorePrAuthor, author);
    await res.ensureSynced();
    return res;
  }

  static async getPrs(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string,
  ): Promise<BbsPr[]> {
    const prCache = await BbsPrCache.init(
      http,
      projectKey,
      repo,
      ignorePrAuthor,
      author,
    );
    return prCache.getPrs();
  }

  static async setPr(
    http: BitbucketServerHttp,
    projectKey: string,
    repo: string,
    ignorePrAuthor: boolean,
    author: string,
    item: BbsPr,
  ): Promise<void> {
    const prCache = await BbsPrCache.init(
      http,
      projectKey,
      repo,
      ignorePrAuthor,
      author,
    );
    prCache.setPr(item);
  }

  private reconcile(rawItems: BbsRestPr[]): boolean {
    logger.debug('reconciled');
    const { items } = this.cache;
    let { updatedDate } = this.cache;
    const cacheTime = updatedDate ? DateTime.fromMillis(updatedDate) : null;

    let needNextPage = true;

    for (const rawItem of rawItems) {
      const id = rawItem.id;

      const newItem = prInfo(rawItem);

      const oldItem = items[id];
      if (dequal(oldItem, newItem)) {
        needNextPage = false;
        continue;
      }

      items[id] = newItem;

      const itemTime = DateTime.fromMillis(rawItem.updatedDate);
      if (!cacheTime || itemTime > cacheTime) {
        updatedDate = rawItem.updatedDate;
      }
    }

    this.cache.updatedDate = updatedDate;

    return needNextPage;
  }

  protected override async sync(): Promise<void> {
    const searchParams: Record<string, string> = {
      state: 'ALL',
      limit: this.items.length ? '20' : '100',
    };
    if (!this.ignorePrAuthor && isString(this.author)) {
      searchParams['role.1'] = 'AUTHOR';
      searchParams['username.1'] = this.author;
    }
    let query: string | null = getQueryString(searchParams);

    while (query) {
      const res = await this.http.getJsonUnchecked<{
        nextPageStart: string;
        values: BbsRestPr[];
      }>(
        `./rest/api/1.0/projects/${this.projectKey}/repos/${this.repo}/pull-requests?${query}`,
        {
          memCache: false,
        },
      );

      const needNextPage = this.reconcile(res.body.values);
      if (!needNextPage) {
        break;
      }

      if (res.body.nextPageStart) {
        searchParams.start = res.body.nextPageStart.toString();
      } else {
        query = null;
      }
    }

    this.updateItems();
  }
}
