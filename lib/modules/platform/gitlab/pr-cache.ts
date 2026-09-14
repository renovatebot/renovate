import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';
import type {
  GitlabHttp,
  GitlabHttpOptions,
} from '../../../util/http/gitlab.ts';
import { regEx } from '../../../util/regex.ts';
import { getQueryString } from '../../../util/url.ts';
import { PlatformPrCache } from '../utils/pr-cache.ts';
import { GitLabMergeRequests } from './schema.ts';
import type { GitlabPr, GitlabPrCacheData } from './types.ts';
import { prInfo } from './utils.ts';

const millisecondsRegex = regEx(/\.\d\d\dZ$/);

function isOutdatedFormat(cache: GitlabPrCacheData): boolean {
  return isString(cache.updated_at) && millisecondsRegex.test(cache.updated_at);
}

export class GitlabPrCache extends PlatformPrCache<
  GitlabPr,
  GitlabPrCacheData
> {
  private http: GitlabHttp;
  private repo: string;
  private ignorePrAuthor: boolean;

  private constructor(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    ignorePrAuthor: boolean,
  ) {
    super({
      platform: 'gitlab',
      author,
      createCache: () => ({ items: {}, updated_at: null, author }),
      isOutdated: isOutdatedFormat,
    });
    this.http = http;
    this.repo = repo;
    this.ignorePrAuthor = ignorePrAuthor;
  }

  private static async init(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    ignorePrAuthor: boolean,
  ): Promise<GitlabPrCache> {
    const res = new GitlabPrCache(http, repo, author, ignorePrAuthor);
    await res.ensureSynced();
    return res;
  }

  static async getPrs(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    ignorePrAuthor: boolean,
  ): Promise<GitlabPr[]> {
    const prCache = await GitlabPrCache.init(
      http,
      repo,
      author,
      ignorePrAuthor,
    );
    return prCache.getPrs();
  }

  static async setPr(
    http: GitlabHttp,
    repo: string,
    author: string | null,
    item: GitlabPr,
    ignorePrAuthor: boolean,
  ): Promise<void> {
    const prCache = await GitlabPrCache.init(
      http,
      repo,
      author,
      ignorePrAuthor,
    );
    prCache.setPr(item);
  }

  protected override async sync(): Promise<void> {
    logger.debug('Syncing PR list');

    const searchParams: Record<string, string> = {
      per_page: '100',
      order_by: 'updated_at',
      sort: 'desc',
    };

    const opts: GitlabHttpOptions = { paginate: true };

    const updated_after = this.cache.updated_at;
    if (updated_after) {
      opts.cacheProvider = repoCacheProvider;
      searchParams.updated_after = updated_after;
    }

    if (!this.ignorePrAuthor) {
      searchParams.scope = 'created_by_me';
    }

    const query: string | null = getQueryString(searchParams);
    const { body: items } = await this.http.getJson(
      `/projects/${this.repo}/merge_requests?${query}`,
      opts,
      GitLabMergeRequests,
    );

    if (items.length) {
      for (const item of items) {
        const id = item.iid;
        this.cache.items[id] = prInfo(item);
      }

      const [{ updated_at }] = items;
      this.cache.updated_at = updated_at.replace(millisecondsRegex, 'Z');
    }

    this.updateItems();
  }
}
