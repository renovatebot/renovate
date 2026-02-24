import { isEmptyArray, isNonEmptyArray } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';
import type {
  GithubHttp,
  GithubHttpOptions,
} from '../../../util/http/github.ts';
import { parseLinkHeader } from '../../../util/url.ts';
import { ApiCache } from './api-cache.ts';
import { coerceRestPr } from './common.ts';
import type { ApiPageCache, GhPr, GhRestPr } from './types.ts';

const MAX_SYNC_PAGES = 100;

function getPrApiCache(): ApiCache<GhPr> {
  const repoCache = getCache();
  if (!repoCache?.platform?.github?.pullRequestsCache) {
    logger.debug('PR cache: cached data not found, creating new cache');
    repoCache.platform ??= {};
    repoCache.platform.github ??= {};
    repoCache.platform.github.pullRequestsCache ??= { items: {} };
  }

  const prApiCache = new ApiCache<GhPr>(
    repoCache.platform.github.pullRequestsCache as ApiPageCache<GhPr>,
  );
  return prApiCache;
}

/**
 *  Fetch and return Pull Requests from GitHub repository:
 *
 *   1. Synchronize long-term cache.
 *
 *   2. Store items in raw format, i.e. exactly what
 *      has been returned by GitHub REST API.
 *
 *   3. Convert items to the Renovate format and return.
 *
 * In order synchronize ApiCache properly, we handle 3 cases:
 *
 *   a. We never fetched PR list for this repo before.
 *      If cached PR list is empty, we assume it's the case.
 *
 *      In this case, we're falling back to quick fetch via
 *      `paginate=true` option (see `util/http/github.ts`).
 *
 *   b. Some of PRs had changed since last run.
 *
 *      In this case, we sequentially fetch page by page
 *      until the oldest item on an unfiltered page predates
 *      the cache's `lastModified` timestamp.
 *
 *      We expect to fetch just one page per run in average,
 *      since it's rare to have more than 100 updated PRs.
 */
export async function getPrCache(
  http: GithubHttp,
  repo: string,
  username?: string,
): Promise<Record<number, GhPr>> {
  const prApiCache = getPrApiCache();
  const isInitial = isEmptyArray(prApiCache.getItems());

  // Snapshot before the loop — reconcile() updates lastModified as it
  // processes items, so reading it inside the loop would create a moving target.
  // If lastModified is missing but items exist (populated via updateItem()),
  // derive cutoff from the newest cached item.
  let lastModifiedRaw = prApiCache.getLastModified();
  if (!lastModifiedRaw && !isInitial) {
    const items = prApiCache.getItems();
    for (const item of items) {
      if (!lastModifiedRaw || item.updated_at > lastModifiedRaw) {
        lastModifiedRaw = item.updated_at;
      }
    }
  }
  const cutoffTime = lastModifiedRaw ? DateTime.fromISO(lastModifiedRaw) : null;

  try {
    let requestsTotal = 0;
    let apiQuotaAffected = false;
    let needNextPageFetch = true;
    let needNextPageSync = true;

    let pageIdx = 1;
    while (needNextPageFetch && needNextPageSync) {
      const opts: GithubHttpOptions = { paginate: false, memCache: false };
      if (pageIdx === 1) {
        opts.cacheProvider = repoCacheProvider;
        if (isInitial) {
          // Speed up initial fetch
          opts.paginate = true;
        }
      }

      let perPage: number;
      if (isInitial) {
        logger.debug('PR cache: initial fetch');
        perPage = 100;
      } else {
        logger.debug('PR cache: sync fetch');
        perPage = 20;
      }

      const urlPath = `repos/${repo}/pulls?per_page=${perPage}&state=all&sort=updated&direction=desc&page=${pageIdx}`;

      const res = await http.getJsonUnchecked<GhRestPr[]>(urlPath, opts);
      apiQuotaAffected = true;
      requestsTotal += 1;

      const {
        headers: { link: linkHeader },
      } = res;

      let { body: page } = res;

      // Check stop condition on unfiltered page before username filtering.
      // Pages are sorted updated_at desc, so the last element is the oldest.
      if (!isInitial && cutoffTime && isNonEmptyArray(page)) {
        const oldestOnPage = DateTime.fromISO(page[page.length - 1].updated_at);
        if (oldestOnPage < cutoffTime) {
          needNextPageSync = false;
        }
      }

      if (username) {
        const filteredPage = page.filter(
          (ghPr) => ghPr?.user?.login && ghPr.user.login === username,
        );

        logger.debug(
          `PR cache: Filtered ${page.length} PRs to ${filteredPage.length} (user=${username})`,
        );

        page = filteredPage;
      }

      const items = page.map(coerceRestPr);

      if (isNonEmptyArray(items)) {
        prApiCache.reconcile(items);
      }

      needNextPageFetch = !!parseLinkHeader(linkHeader)?.next;

      if (pageIdx === 1) {
        needNextPageFetch &&= !opts.paginate;
      }

      if (!isInitial && needNextPageSync && pageIdx >= MAX_SYNC_PAGES) {
        logger.warn(
          { repo, pages: pageIdx },
          'PR cache: hit max sync pages, stopping',
        );
        needNextPageSync = false;
      }

      pageIdx += 1;
    }

    logger.debug(
      {
        pullsTotal: prApiCache.getItems().length,
        requestsTotal,
        apiQuotaAffected,
      },
      `PR cache: getPrList success`,
    );
  } catch (err) /* v8 ignore next */ {
    logger.debug({ err }, 'PR cache: getPrList err');
    throw new ExternalHostError(err, 'github');
  }

  return prApiCache.getItems();
}

export function updatePrCache(pr: GhPr): void {
  const cache = getPrApiCache();
  cache.updateItem(pr);
}
