import is from '@sindresorhus/is';
import { PlatformId } from '../../../constants';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getCache } from '../../../util/cache/repository';
import type { GithubHttp, GithubHttpOptions } from '../../../util/http/github';
import { parseLinkHeader } from '../../../util/url';
import type { Pr } from '../types';
import { ApiCache } from './api-cache';
import { coerceRestPr } from './common';
import type { ApiPageCache, GhRestPr } from './types';

function getPrApiCache(): ApiCache<GhRestPr> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  repoCache.platform.github ??= {};
  repoCache.platform.github.prCache ??= { items: {} };
  const prCache = new ApiCache(
    repoCache.platform.github.prCache as ApiPageCache<GhRestPr>
  );
  return prCache;
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
 * In order synchronize ApiCache properly, we handle 4 cases:
 *
 *   a. We never fetched PR list for this repo before.
 *      This is detected by `etag` presense in the cache.
 *
 *      In this case, we're falling back to quick fetch via
 *      `paginate=true` option (see `util/http/github.ts`).
 *
 *   b. None of PRs has changed since last run.
 *
 *      We detect this by setting `If-None-Match` HTTP header
 *      with the `etag` value from the previous run.
 *
 *   c. Some of PRs had changed since last run.
 *
 *      In this case, we sequentially fetch page by page
 *      until `ApiCache.coerce` function indicates that
 *      no more fresh items can be found in the next page.
 *
 *      We expect to fetch just one page per run in average,
 *      since it's rare to have more than 100 updated PRs.
 *
 *   d. ETag handling is turned off via `handleEtag`.
 *
 *      We suppose that if PR list from the previous cache
 *      is empty, then this is our initial fetch, so we
 *      try to speed it up.
 *
 *      ETag isn't stored in the cache. This is one more
 *      request for each Renovate run, compared to ETag
 *      support is turned on.
 *
 *      This option is useful for remotely stored cache,
 *      in particular it helps not to update `pr.repo.pushed_at`
 *      which causes ETag to be updated too, which in turn would
 *      cause Renovate to refresh the cache every single run.
 */
export async function getPrCache(
  http: GithubHttp,
  repo: string,
  username: string | null,
  handleEtag = true
): Promise<Record<number, Pr>> {
  const prCache: Record<number, Pr> = {};
  const prApiCache = getPrApiCache();

  try {
    let requestsTotal = 0;
    let apiQuotaAffected = false;
    let needNextPageFetch = true;
    let needNextPageSync = true;

    let pageIdx = 1;
    while (needNextPageFetch && needNextPageSync) {
      const urlPath = `repos/${repo}/pulls?per_page=100&state=all&sort=updated&direction=desc&page=${pageIdx}`;

      const opts: GithubHttpOptions = { paginate: false };
      if (pageIdx === 1) {
        if (handleEtag) {
          const oldEtag = prApiCache.etag;
          if (oldEtag) {
            opts.headers = { 'If-None-Match': oldEtag };
          } else {
            // Speed up initial fetch
            opts.paginate = true;
          }
        } else if (is.emptyArray(prApiCache.getItems())) {
          opts.paginate = true;
        }
      }

      const res = await http.getJson<GhRestPr[]>(urlPath, opts);
      apiQuotaAffected = true;
      requestsTotal += 1;

      if (pageIdx === 1 && res.statusCode === 304) {
        apiQuotaAffected = false;
        break;
      }

      const {
        headers: { link: linkHeader, etag: newEtag },
      } = res;

      let { body: page } = res;

      if (username) {
        page = page.filter(
          (ghPr) => ghPr?.user?.login && ghPr.user.login === username
        );
      }

      if (!handleEtag) {
        page.forEach((ghPr) => {
          delete ghPr?.head?.repo?.pushed_at;
          delete ghPr?.base?.repo?.pushed_at;
        });
      }

      needNextPageSync = prApiCache.reconcile(page);
      needNextPageFetch = !!parseLinkHeader(linkHeader)?.next;

      if (pageIdx === 1) {
        if (handleEtag && newEtag) {
          prApiCache.etag = newEtag;
        }

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
      `getPrList success`
    );
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'getPrList err');
    throw new ExternalHostError(err, PlatformId.Github);
  }

  for (const ghPr of prApiCache.getItems()) {
    const pr = coerceRestPr(ghPr);
    if (pr) {
      prCache[ghPr.number] = pr;
    }
  }

  return prCache;
}
