import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
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

  const cacheLastModified = prApiCache.lastModified;
  let newestModified: string | undefined;
  let oldestModified: string | undefined;

  try {
    let requestsTotal = 0;
    let apiQuotaAffected = false;

    let pageIdx = 1;
    while (true) {
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

      newestModified = page.at(1)?.updated_at;
      oldestModified = page.at(-1)?.updated_at;

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

      const syncDone = prApiCache.reconcile(items);
      if (syncDone) {
        break;
      }

      const hasNextPage = !!parseLinkHeader(linkHeader)?.next;
      if (!hasNextPage) {
        break;
      }

      if (opts.paginate) {
        break;
      }

      if (cacheLastModified && oldestModified) {
        const cacheLastModifiedTime = DateTime.fromISO(cacheLastModified);
        const oldestModifiedTime = DateTime.fromISO(oldestModified);
        if (cacheLastModifiedTime >= oldestModifiedTime) {
          break;
        }
      }

      pageIdx += 1;
    }

    if (newestModified) {
      prApiCache.lastModified = newestModified;
    }

    logger.debug(
      {
        pullsTotal: prApiCache.getItems().length,
        requestsTotal,
        apiQuotaAffected,
      },
      `PR cache: getPrList success`,
    );
  } catch (err) /* v8 ignore start */ {
    logger.debug({ err }, 'PR cache: getPrList err');
    throw new ExternalHostError(err, 'github');
  } /* v8 ignore stop */

  return prApiCache.getItems();
}

export function updatePrCache(pr: GhPr): void {
  const cache = getPrApiCache();
  cache.updateItem(pr);
}
