import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getCache } from '../../../util/cache/repository';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider';
import type { GithubHttp, GithubHttpOptions } from '../../../util/http/github';
import { parseLinkHeader } from '../../../util/url';
import { ApiCache } from './api-cache';
import { coerceRestPr } from './common';
import type { ApiPageCache, GhPr, GhRestPr } from './types';

function getPrApiCache(): ApiCache<GhPr> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  repoCache.platform.github ??= {};
  repoCache.platform.github.pullRequestsCache ??= { items: {} };
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
 *      until `ApiCache.coerce` function indicates that
 *      no more fresh items can be found in the next page.
 *
 *      We expect to fetch just one page per run in average,
 *      since it's rare to have more than 100 updated PRs.
 */
export async function getPrCache(
  http: GithubHttp,
  repo: string,
  username: string | null,
): Promise<Record<number, GhPr>> {
  const prApiCache = getPrApiCache();
  const isInitial = is.emptyArray(prApiCache.getItems());

  try {
    let requestsTotal = 0;
    let apiQuotaAffected = false;
    let needNextPageFetch = true;
    let needNextPageSync = true;

    let pageIdx = 1;
    while (needNextPageFetch && needNextPageSync) {
      const opts: GithubHttpOptions = { paginate: false };
      if (pageIdx === 1) {
        opts.cacheProvider = repoCacheProvider;
        if (isInitial) {
          // Speed up initial fetch
          opts.paginate = true;
        }
      }

      const perPage = isInitial ? 100 : 20;
      const urlPath = `repos/${repo}/pulls?per_page=${perPage}&state=all&sort=updated&direction=desc&page=${pageIdx}`;

      const res = await http.getJson<GhRestPr[]>(urlPath, opts);
      apiQuotaAffected = true;
      requestsTotal += 1;

      const {
        headers: { link: linkHeader },
      } = res;

      let { body: page } = res;

      if (username) {
        page = page.filter(
          (ghPr) => ghPr?.user?.login && ghPr.user.login === username,
        );
      }

      const items = page.map(coerceRestPr);

      needNextPageSync = prApiCache.reconcile(items);
      needNextPageFetch = !!parseLinkHeader(linkHeader)?.next;

      if (pageIdx === 1) {
        needNextPageFetch &&= !opts.paginate;
      }

      pageIdx += 1;
    }

    logger.debug(
      {
        pullsTotal: prApiCache.getItems().length,
        requestsTotal,
        apiQuotaAffected,
      },
      `getPrList success`,
    );
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getPrList err');
    throw new ExternalHostError(err, 'github');
  }

  return prApiCache.getItems();
}

export function updatePrCache(pr: GhPr): void {
  const cache = getPrApiCache();
  cache.updateItem(pr);
}
